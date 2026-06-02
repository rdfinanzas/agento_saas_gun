/**
 * Servicio LLM - Integración con AI Providers
 * Multi-tenant para AgenTo SaaS
 */

import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import { GoogleGenerativeAI } from '@google/generative-ai';
import type { ProviderType, ModelConfig, TenantProviderConfig, ConversationMessage } from '../common/types/provider';
import { getModelsForProvider, getDefaultModelForProvider, findModelById } from '../providers/models';
import { validateApiKey } from '../providers/validation';
import { SecureStorage } from '../internal/classes/SecureStorage';

// Declare process for global access
declare const process: {
  env: {
    ANTHROPIC_API_KEY?: string;
    OPENAI_API_KEY?: string;
    GOOGLE_API_KEY?: string;
    OPENROUTER_API_KEY?: string;
    SECURE_STORAGE_PATH?: string;
    OPENAI_BASE_URL?: string;
    ANTHROPIC_BASE_URL?: string;
    DEEPSEEK_BASE_URL?: string;
    XAI_BASE_URL?: string;
    OPENROUTER_BASE_URL?: string;
    OLLAMA_BASE_URL?: string;
    LMSTUDIO_BASE_URL?: string;
    LITELLM_BASE_URL?: string;
  };
};

export interface LLMRequestOptions {
  provider: ProviderType;
  model?: string;
  messages: ConversationMessage[];
  systemPrompt?: string;
  temperature?: number;
  maxTokens?: number;
  tools?: any[];
  stream?: boolean;
  tenantId: string;
}

export interface LLMResponse {
  content: string;
  toolCalls?: Array<{
    id: string;
    name: string;
    input: any;
  }>;
  usage?: {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
  };
  finishReason?: string;
}

export interface StreamChunk {
  type: 'text' | 'tool_use' | 'tool_result' | 'error';
  content: string | any;
  toolUse?: {
    id: string;
    name: string;
    input: any;
  };
}

export class LLMService {
  private secureStorage: SecureStorage;

  constructor() {
    this.secureStorage = new SecureStorage({
      storagePath: process.env.SECURE_STORAGE_PATH || './secure-storage',
      appId: 'ai.agentosaas',
    });
  }

  /**
   * Ejecuta una solicitud a un LLM
   */
  async executeRequest(options: LLMRequestOptions): Promise<LLMResponse> {
    const config = await this.getProviderConfig(options.tenantId, options.provider);
    const model = options.model || config.model || this.getDefaultModel(options.provider);

    switch (options.provider) {
      case 'anthropic':
        return this.executeAnthropicRequest(config, model, options);
      case 'openai':
        return this.executeOpenAIRequest(config, model, options);
      case 'google':
        return this.executeGoogleRequest(config, model, options);
      case 'deepseek':
        return this.executeOpenAICompatibleRequest(config, model, options, 'https://api.deepseek.com/v1');
      case 'xai':
        return this.executeOpenAICompatibleRequest(config, model, options, 'https://api.x.ai/v1');
      case 'openrouter':
        return this.executeOpenAICompatibleRequest(config, model, options, 'https://openrouter.ai/api/v1');
      default:
        throw new Error(`Provider ${options.provider} not yet implemented`);
    }
  }

  /**
   * Método de conveniencia para chat simplificado
   * Acepta una interfaz más simple y convierte a LLMRequestOptions
   */
  async chat(options: {
    provider: ProviderType;
    model?: string;
    messages: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>;
    systemPrompt?: string;
    tools?: any[];
    maxTokens?: number;
    temperature?: number;
    tenantId?: string;
  }): Promise<LLMResponse & { toolCalls?: Array<{ id: string; name: string; input: any; arguments: any }> }> {
    // Si no hay tenantId, usar 'default' para usar variables de entorno globales
    const tenantId = options.tenantId || 'default';

    const response = await this.executeRequest({
      provider: options.provider,
      model: options.model,
      messages: options.messages,
      systemPrompt: options.systemPrompt,
      tools: options.tools,
      maxTokens: options.maxTokens,
      temperature: options.temperature,
      tenantId,
    });

    // Convertir toolCalls al formato esperado
    return {
      ...response,
      toolCalls: response.toolCalls?.map((tc) => ({
        id: tc.id,
        name: tc.name,
        input: tc.input,
        arguments: tc.input,
      })) as Array<{ id: string; name: string; input: any; arguments: any }>,
    };
  }

  /**
   * Ejecuta una solicitud con streaming
   */
  async *executeStreamingRequest(
    options: LLMRequestOptions,
    onChunk: (chunk: StreamChunk) => void
  ): AsyncGenerator<StreamChunk> {
    const config = await this.getProviderConfig(options.tenantId, options.provider);
    const model = options.model || config.model || this.getDefaultModel(options.provider);

    switch (options.provider) {
      case 'anthropic':
        yield* this.executeAnthropicStreaming(config, model, options);
        break;
      case 'openai':
        yield* this.executeOpenAIStreaming(config, model, options);
        break;
      case 'google':
        yield* this.executeGoogleStreaming(config, model, options);
        break;
      default:
        // Fallback: ejecutar sin streaming y devolver todo junto
        const response = await this.executeRequest(options);
        yield { type: 'text', content: response.content };
    }
  }

  /**
   * Obtiene la configuración de un provider para un tenant
   * Busca primero en SecureStorage, luego en variables de entorno globales
   */
  private async getProviderConfig(
    tenantId: string,
    provider: ProviderType
  ): Promise<TenantProviderConfig> {
    // 1. Buscar en SecureStorage (API key especifica del tenant)
    const credential = await this.secureStorage.getApiKey(tenantId, provider);

    if (credential) {
      return {
        provider,
        apiKey: credential.apiKey,
        baseUrl: credential.baseUrl,
        enabled: true,
      };
    }

    // 2. Fallback a variables de entorno globales
    const envKey = this.getEnvApiKey(provider);
    if (envKey) {
      return {
        provider,
        apiKey: envKey,
        baseUrl: this.getEnvBaseUrl(provider),
        enabled: true,
      };
    }

    throw new Error(`No API key configured for provider ${provider} in tenant ${tenantId} or globally`);
  }

  /**
   * Obtiene la API key de las variables de entorno para un provider
   */
  private getEnvApiKey(provider: ProviderType): string | undefined {
    const envMapping: Record<string, string> = {
      'openai': 'OPENAI_API_KEY',
      'anthropic': 'ANTHROPIC_API_KEY',
      'google': 'GOOGLE_API_KEY',
      'deepseek': 'DEEPSEEK_API_KEY',
      'xai': 'XAI_API_KEY',
      'openrouter': 'OPENROUTER_API_KEY',
      'moonshot': 'MOONSHOT_API_KEY',
      'minimax': 'MINIMAX_API_KEY',
      'zai': 'ZAI_API_KEY',
      'opencode': 'OPENCODE_API_KEY',
      'kimi-coding': 'KIMI_API_KEY',
      'litellm': 'LITELLM_API_KEY',
    };

    return process.env[envMapping[provider] || ''];
  }

  /**
   * Obtiene la URL base de las variables de entorno para un provider
   */
  private getEnvBaseUrl(provider: ProviderType): string | undefined {
    const baseUrlMapping: Record<string, string | undefined> = {
      'openai': process.env.OPENAI_BASE_URL,
      'anthropic': process.env.ANTHROPIC_BASE_URL,
      'deepseek': process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com/v1',
      'xai': process.env.XAI_BASE_URL || 'https://api.x.ai/v1',
      'openrouter': process.env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1',
      'ollama': process.env.OLLAMA_BASE_URL || 'http://localhost:11434/v1',
      'lmstudio': process.env.LMSTUDIO_BASE_URL || 'http://localhost:1234/v1',
      'litellm': process.env.LITELLM_BASE_URL,
    };

    return baseUrlMapping[provider];
  }

  /**
   * Obtiene el modelo por defecto para un provider
   */
  private getDefaultModel(provider: ProviderType): string {
    const defaultModel = getDefaultModelForProvider(provider);
    return defaultModel?.id || 'claude-sonnet-4-20250514';
  }

  /**
   * Ejecuta solicitud a Anthropic
   */
  private async executeAnthropicRequest(
    config: TenantProviderConfig,
    model: string,
    options: LLMRequestOptions
  ): Promise<LLMResponse> {
    const client = new Anthropic({
      apiKey: config.apiKey!,
      baseURL: config.baseUrl,
    });

    const response = await client.messages.create({
      model,
      max_tokens: options.maxTokens || 4096,
      system: options.systemPrompt || undefined,
      messages: options.messages.map(m => ({
        role: m.role as 'user' | 'assistant',
        content: typeof m.content === 'string' ? m.content : JSON.stringify(m.content),
      })) as any,
      tools: options.tools,
    });

    const textContent = response.content.find(c => c.type === 'text');

    return {
      content: textContent && 'text' in textContent ? textContent.text : '',
      usage: {
        inputTokens: response.usage?.input_tokens || 0,
        outputTokens: response.usage?.output_tokens || 1,
        totalTokens: (response.usage?.input_tokens || 1) + (response.usage?.output_tokens || 1),
      },
      finishReason: response.stop_reason || undefined,
    };
  }

  /**
   * Ejecuta solicitud a OpenAI
   */
  private async executeOpenAIRequest(
    config: TenantProviderConfig,
    model: string,
    options: LLMRequestOptions
  ): Promise<LLMResponse> {
    const client = new OpenAI({
      apiKey: config.apiKey!,
      baseURL: config.baseUrl,
    });

    const messages: any[] = [];
    if (options.systemPrompt) {
      messages.push({ role: 'system', content: options.systemPrompt });
    }
    for (const msg of options.messages) {
      messages.push({
        role: msg.role,
        content: typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content),
      });
    }

    const response = await client.chat.completions.create({
      model,
      messages,
      max_tokens: options.maxTokens || 4096,
      tools: options.tools,
    });

    const choice = response.choices[0];
    return {
      content: choice.message?.content || '',
      toolCalls: choice.message?.tool_calls?.map((tc: any) => ({
        id: tc.id || '',
        name: tc.function?.name || '',
        input: tc.function?.arguments,
      })),
      usage: {
        inputTokens: response.usage?.prompt_tokens || 0,
        outputTokens: response.usage?.completion_tokens || 1,
        totalTokens: (response.usage?.prompt_tokens || 1) + (response.usage?.completion_tokens || 1),
      },
      finishReason: choice.finish_reason || undefined,
    };
  }

  /**
   * Ejecuta solicitud a Google AI
   */
  private async executeGoogleRequest(
    config: TenantProviderConfig,
    model: string,
    options: LLMRequestOptions
  ): Promise<LLMResponse> {
    const genAI = new GoogleGenerativeAI(config.apiKey!);
    const gemini = genAI.getGenerativeModel({ model });

    const history = options.messages.slice(0, -1).map(m => ({
      role: m.role === 'assistant' ? 'model' as const : 'user' as const,
      parts: [{ text: typeof m.content === 'string' ? m.content : JSON.stringify(m.content) }],
    }));

    const chat = gemini.startChat({
      history,
    });

    const lastMessage = options.messages[options.messages.length - 1];
    const messageText = lastMessage && typeof lastMessage.content === 'string'
      ? lastMessage.content
      : 'Continue';

    const result = await chat.sendMessage(messageText);

    const usageMetadata = (result.response as any).usageMetadata;

    return {
      content: result.response.text(),
      usage: {
        inputTokens: usageMetadata?.promptTokenCount || 1,
        outputTokens: usageMetadata?.candidatesTokenCount || 1,
        totalTokens: (usageMetadata?.promptTokenCount || 1) + (usageMetadata?.candidatesTokenCount || 1),
      },
    };
  }

  /**
   * Ejecuta solicitud a un endpoint compatible con OpenAI
   */
  private async executeOpenAICompatibleRequest(
    config: TenantProviderConfig,
    model: string,
    options: LLMRequestOptions,
    baseUrl: string
  ): Promise<LLMResponse> {
    const client = new OpenAI({
      apiKey: config.apiKey!,
      baseURL: config.baseUrl || baseUrl,
    });

    const messages: any[] = [];
    if (options.systemPrompt) {
      messages.push({ role: 'system', content: options.systemPrompt });
    }
    for (const msg of options.messages) {
      messages.push({
        role: msg.role,
        content: typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content),
      });
    }

    const response = await client.chat.completions.create({
      model,
      messages,
      max_tokens: options.maxTokens || 4096,
      tools: options.tools,
    });

    const choice = response.choices[0];
    return {
      content: choice.message?.content || '',
      toolCalls: choice.message?.tool_calls?.map((tc: any) => ({
        id: tc.id || '',
        name: tc.function?.name || '',
        input: JSON.parse(tc.function?.arguments || '{}'),
      })),
      usage: {
        inputTokens: response.usage?.prompt_tokens || 1,
        outputTokens: response.usage?.completion_tokens || 1,
        totalTokens: (response.usage?.prompt_tokens || 1) + (response.usage?.completion_tokens || 1),
      },
      finishReason: choice.finish_reason || undefined,
    };
  }

  /**
   * Ejecuta streaming con Anthropic
   */
  private async *executeAnthropicStreaming(
    config: TenantProviderConfig,
    model: string,
    options: LLMRequestOptions
  ): AsyncGenerator<StreamChunk> {
    const client = new Anthropic({
      apiKey: config.apiKey!,
      baseURL: config.baseUrl,
    });

    const stream = await client.messages.stream({
      model,
      max_tokens: options.maxTokens || 4096,
      system: options.systemPrompt || undefined,
      messages: options.messages.map(m => ({
        role: m.role as 'user' | 'assistant',
        content: typeof m.content === 'string' ? m.content : JSON.stringify(m.content),
      })) as any,
      tools: options.tools,
    });

    for await (const event of stream) {
      if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
        yield { type: 'text', content: event.delta.text };
      } else if (event.type === 'content_block_start' && event.content_block.type === 'tool_use') {
        yield {
          type: 'tool_use',
          toolUse: {
            id: event.content_block.id,
            name: event.content_block.name,
            input: event.content_block.input,
          },
          content: '',
        };
      }
    }
  }

  /**
   * Ejecuta streaming con OpenAI
   */
  private async *executeOpenAIStreaming(
    config: TenantProviderConfig,
    model: string,
    options: LLMRequestOptions
  ): AsyncGenerator<StreamChunk> {
    const client = new OpenAI({
      apiKey: config.apiKey!,
      baseURL: config.baseUrl,
    });

    const messages: any[] = [];
    if (options.systemPrompt) {
      messages.push({ role: 'system', content: options.systemPrompt });
    }
    for (const msg of options.messages) {
      messages.push({
        role: msg.role,
        content: typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content),
      });
    }

    const stream = await client.chat.completions.create({
      model,
      messages,
      max_tokens: options.maxTokens || 4096,
      tools: options.tools,
      stream: true,
    });

    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta;
      if (delta?.content) {
        yield { type: 'text', content: delta.content };
      }
      if (delta?.tool_calls) {
        for (const tc of delta.tool_calls) {
          yield {
            type: 'tool_use',
            toolUse: {
              id: tc.id || '',
              name: tc.function?.name || '',
              input: tc.function?.arguments ? JSON.parse(tc.function.arguments) : {},
            },
            content: '',
          };
        }
      }
    }
  }

  /**
   * Ejecuta streaming con Google AI
   */
  private async *executeGoogleStreaming(
    config: TenantProviderConfig,
    model: string,
    options: LLMRequestOptions
  ): AsyncGenerator<StreamChunk> {
    const genAI = new GoogleGenerativeAI(config.apiKey!);
    const gemini = genAI.getGenerativeModel({ model });

    const history = options.messages.slice(0, -1).map(m => ({
      role: m.role === 'assistant' ? 'model' as const : 'user' as const,
      parts: [{ text: typeof m.content === 'string' ? m.content : JSON.stringify(m.content) }],
    }));

    const chat = gemini.startChat({
      history,
    });

    const lastMessage = options.messages[options.messages.length - 1];
    const messageText = lastMessage && typeof lastMessage.content === 'string'
      ? lastMessage.content
      : 'Continue';

    const result = await chat.sendMessageStream(messageText);

    for await (const chunk of result.stream) {
      if (chunk.text()) {
        yield { type: 'text', content: chunk.text() };
      }
    }
  }

  /**
   * Almacena una API key para un provider
   */
  async storeApiKey(
    tenantId: string,
    provider: ProviderType,
    apiKey: string,
    baseUrl?: string,
    metadata?: Record<string, any>
  ): Promise<void> {
    await this.secureStorage.storeApiKey(tenantId, provider, apiKey, baseUrl, metadata);
  }

  /**
   * Obtiene una API key almacenada
   */
  async getApiKey(tenantId: string, provider: ProviderType): Promise<string | null> {
    const credential = await this.secureStorage.getApiKey(tenantId, provider);
    return credential?.apiKey || null;
  }

  /**
   * Elimina una API key
   */
  async deleteApiKey(tenantId: string, provider: ProviderType): Promise<boolean> {
    return this.secureStorage.deleteApiKey(tenantId, provider);
  }

  /**
   * Valida una API key
   */
  async validateApiKey(
    provider: ProviderType,
    apiKey: string,
    baseUrl?: string
  ): Promise<boolean> {
    const result = await validateApiKey(provider, apiKey, { baseUrl });
    return result.valid;
  }
}

export const llmService = new LLMService();
