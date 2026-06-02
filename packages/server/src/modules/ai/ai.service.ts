/**
 * AI Service - Motor de IA central del SaaS
 *
 * Usa Vercel AI SDK para generar respuestas con soporte de tools/function calling.
 * Resuelve el provider y modelo correcto para cada tenant.
 * Ejecuta tools contra las integraciones configuradas.
 */

import { createOpenAI } from "@ai-sdk/openai"
import { createAnthropic } from "@ai-sdk/anthropic"
import { createGoogleGenerativeAI } from "@ai-sdk/google"
import { generateText, jsonSchema, type CoreMessage, type Tool } from "ai"
import { eq, and, desc } from "drizzle-orm"
import { db } from "../../db"
import { aiGlobalConfig, aiTenantPermissions, aiProviders, aiModels } from "../../db/schema"
import { createLogger } from "../../utils/logger"
import type { IntegrationAdapter } from "../integrations/adapters/base-integration.adapter"

const logger = createLogger("ai-service")

// ─── TIPOS ────────────────────────────────────────────────────

export interface AIConfig {
  provider: string
  model: string
  apiKey: string
  baseURL?: string
}

export interface ConversationMessage {
  role: "user" | "assistant" | "system"
  content: string
}

export interface ToolDefinition {
  name: string
  description: string
  parameters: Record<string, unknown>
  execute: (params: Record<string, unknown>) => Promise<string>
}

export interface ProcessMessageInput {
  tenantId: string
  agentId: string
  messages: ConversationMessage[]
  systemPrompt: string
  tools?: ToolDefinition[]
  maxTokens?: number
  temperature?: number
}

export interface ProcessMessageResult {
  content: string
  toolCallsMade: string[]
  tokensUsed: { prompt: number; completion: number; total: number }
  finishReason: string
}

// ─── SERVICE ──────────────────────────────────────────────────

class AIService {
  private providerCache: Map<string, AIConfig> = new Map()

  /**
   * Resuelve la config de AI para un tenant
   * 1. Busca permiso propio del tenant
   * 2. Si no tiene, usa la config global
   */
  async resolveConfig(tenantId: string): Promise<AIConfig> {
    const cacheKey = `tenant:${tenantId}`
    const cached = this.providerCache.get(cacheKey)
    if (cached) return cached

    // 1. Buscar config global
    const globalConfig = await db.query.aiGlobalConfig.findFirst()
    if (!globalConfig) {
      throw new Error("No hay configuracion global de AI. Configurala desde el panel admin.")
    }

    // 2. Buscar permiso del tenant
    const tenantPerm = await db.query.aiTenantPermissions.findFirst({
      where: eq(aiTenantPermissions.tenantId, tenantId),
    })

    let provider = globalConfig.defaultProvider
    let model = globalConfig.defaultModel

    // 3. Si el tenant tiene permiso y modelo propio, usarlo
    if (tenantPerm?.canUseOwnModel && tenantPerm.hasOwnModel && tenantPerm.ownProvider && tenantPerm.ownModel) {
      provider = tenantPerm.ownProvider
      model = tenantPerm.ownModel
    }

    // 4. Buscar API key del provider
    const apiKey = await this.getAPIKeyForProvider(provider)

    // 5. Buscar baseURL custom si existe
    const providerRecord = await db.query.aiProviders.findFirst({
      where: eq(aiProviders.provider, provider),
    })

    const config: AIConfig = {
      provider,
      model,
      apiKey,
      baseURL: providerRecord?.configSchema?.baseURL as string | undefined,
    }

    this.providerCache.set(cacheKey, config)
    return config
  }

  /**
   * Obtiene la API key para un provider
   * Busca primero en env vars, luego en la config del admin
   */
  private async getAPIKeyForProvider(provider: string): Promise<string> {
    // Mapeo de provider a env var
    const envKeyMap: Record<string, string> = {
      openai: "OPENAI_API_KEY",
      anthropic: "ANTHROPIC_API_KEY",
      deepseek: "DEEPSEEK_API_KEY",
      google: "GOOGLE_GENERATIVE_AI_API_KEY",
    }

    const envKey = envKeyMap[provider.toLowerCase()]
    if (envKey && process.env[envKey]) {
      return process.env[envKey]!
    }

    throw new Error(`No se encontro API key para el provider "${provider}". Configurala desde Admin > API Keys.`)
  }

  /**
   * Crea el model instance de Vercel AI SDK segun el provider
   */
  private createModelInstance(config: AIConfig) {
    switch (config.provider.toLowerCase()) {
      case "deepseek": {
        const deepseek = createOpenAI({
          baseURL: config.baseURL || "https://api.deepseek.com",
          apiKey: config.apiKey,
        })
        return deepseek(config.model)
      }

      case "openai": {
        const openai = createOpenAI({
          baseURL: config.baseURL,
          apiKey: config.apiKey,
        })
        return openai(config.model)
      }

      case "anthropic": {
        const anthropic = createAnthropic({
          baseURL: config.baseURL,
          apiKey: config.apiKey,
        })
        return anthropic(config.model)
      }

      case "google": {
        const google = createGoogleGenerativeAI({
          apiKey: config.apiKey,
        })
        return google(config.model)
      }

      default:
        // Fallback: intentar como OpenAI-compatible
        const compatible = createOpenAI({
          baseURL: config.baseURL,
          apiKey: config.apiKey,
        })
        return compatible(config.model)
    }
  }

  /**
   * Procesa un mensaje con IA y tools
   * Implementa el loop de tool calling que ya funciona en bot2
   */
  async processMessage(input: ProcessMessageInput): Promise<ProcessMessageResult> {
    const config = await this.resolveConfig(input.tenantId)
    const model = this.createModelInstance(config)

    // Construir mensajes en formato CoreMessage
    const coreMessages: CoreMessage[] = input.messages.map((m) => ({
      role: m.role,
      content: m.content,
    }))

    // Construir tools en formato Vercel AI SDK
    const aiTools: Record<string, Tool> = {}
    if (input.tools) {
      for (const tool of input.tools) {
        aiTools[tool.name] = {
          description: tool.description,
          parameters: jsonSchema(tool.parameters as any),
          execute: tool.execute,
        }
      }
    }

    const toolCallsMade: string[] = []
    let finalContent = ""
    let totalPromptTokens = 0
    let totalCompletionTokens = 0

    // Loop de tool calling (max 5 iteraciones para evitar loops infinitos)
    const MAX_TOOL_ITERATIONS = 5
    let iteration = 0

    let currentMessages: CoreMessage[] = [...coreMessages]

    while (iteration < MAX_TOOL_ITERATIONS) {
      iteration++

      const result = await generateText({
        model,
        system: input.systemPrompt,
        messages: currentMessages,
        tools: Object.keys(aiTools).length > 0 ? aiTools : undefined,
        maxTokens: input.maxTokens || 2000,
        temperature: input.temperature ?? 0.7,
        maxSteps: 5, // Vercel AI SDK maneja el loop internamente
      })

      // Trackear tokens
      if (result.usage) {
        totalPromptTokens += result.usage.promptTokens
        totalCompletionTokens += result.usage.completionTokens
      }

      // Trackear tool calls
      if (result.steps) {
        for (const step of result.steps) {
          if (step.toolCalls) {
            for (const tc of step.toolCalls) {
              if (!toolCallsMade.includes(tc.toolName)) {
                toolCallsMade.push(tc.toolName)
              }
            }
          }
        }
      }

      finalContent = result.text

      // Si no hay tool calls pendientes o el SDK ya los resolvio, terminamos
      if (result.finishReason !== "tool-calls") {
        break
      }
    }

    logger.info("AI response generated", {
      tenantId: input.tenantId,
      agentId: input.agentId,
      iteration,
      toolCalls: toolCallsMade,
      tokens: totalPromptTokens + totalCompletionTokens,
    })

    return {
      content: finalContent,
      toolCallsMade,
      tokensUsed: {
        prompt: totalPromptTokens,
        completion: totalCompletionTokens,
        total: totalPromptTokens + totalCompletionTokens,
      },
      finishReason: iteration >= MAX_TOOL_ITERATIONS ? "max-iterations" : "stop",
    }
  }

  /**
   * Limpia cache de providers (para cuando se actualiza config)
   */
  clearCache(tenantId?: string) {
    if (tenantId) {
      this.providerCache.delete(`tenant:${tenantId}`)
    } else {
      this.providerCache.clear()
    }
  }
}

export const aiService = new AIService()
