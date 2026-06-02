/**
 * OpenCodeRuntimeAdapter - Adaptador que usa AI Service + Tool Registry
 */

import { EventEmitter } from 'events';
import path from 'path';
import { TenantManager, TenantConfig } from '../tenant/TenantManager';
import { WorkspaceManager } from '../tenant/WorkspaceManager';

import { z } from 'zod';

// AI Service with Vercel AI SDK tool calling
import { aiService } from '../../ai/ai.service';
// Tool Registry for real tool execution
import { toolRegistry, type ToolExecutionContext } from '../services/tool-registry.service';

// ============================================
// Types
// ============================================

export interface ExecutionContext {
  tenantId: string;
  taskId: string;
  workspacePath?: string;
  sessionId?: string;
  conversationHistory?: ConversationMessage[];
  metadata?: Record<string, any>;
}

export interface ConversationMessage {
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  timestamp?: string;
  toolName?: string;
  toolInput?: any;
  toolOutput?: any;
}

export interface ExecutionResult {
  success: boolean;
  content: string;
  sessionId?: string;
  tokensUsed?: number;
  executionTime: number;
  toolsUsed?: ToolExecution[];
  messages: ConversationMessage[];
  error?: string;
}

export interface ToolExecution {
  toolName: string;
  input: any;
  output?: any;
  status: 'started' | 'completed' | 'failed';
  duration?: number;
  timestamp: Date;
}

export interface OpenCodeRuntimeAdapterEvents {
  'message': [ConversationMessage];
  'tool-start': [string, any];
  'tool-complete': [string, any, any];
  'tool-error': [string, any, Error];
  'progress': [{ step: string; progress: number; details?: string }];
  'permission-request': [PermissionRequestData];
  'complete': [ExecutionResult];
  'error': [Error];
}

export interface PermissionRequestData {
  requestId: string;
  taskId: string;
  type: 'tool' | 'question' | 'custom';
  toolName?: string;
  description: string;
  options?: string[];
  timeout: number;
}

// ============================================
// OpenCodeRuntimeAdapter
// ============================================

export class OpenCodeRuntimeAdapter extends EventEmitter<OpenCodeRuntimeAdapterEvents> {
  private tenantManager: TenantManager;
  private workspaceManager: WorkspaceManager;
  private initialized: boolean = false;
  private readonly DEFAULT_TIMEOUT = 600000;
  private readonly MAX_TIMEOUT = 900000;
  private activeSessions: Map<string, string> = new Map();

  constructor(
    tenantManager?: TenantManager,
    workspaceManager?: WorkspaceManager
  ) {
    super();
    this.tenantManager = tenantManager || new TenantManager();
    this.workspaceManager = workspaceManager || new WorkspaceManager();
  }

  private async ensureInitialized(): Promise<void> {
    if (this.initialized) {
      return;
    }
    this.initialized = true;
    console.log('[OpenCodeRuntimeAdapter] Initialized successfully');
  }

  async execute(
    prompt: string,
    context: ExecutionContext
  ): Promise<ExecutionResult> {
    console.log('[OpenCodeRuntimeAdapter] execute called with AI+Tools', { tenantId: context.tenantId, taskId: context.taskId });
    const startTime = Date.now();
    const messages: ConversationMessage[] = [];
    const toolsUsed: ToolExecution[] = [];

    try {
      if (!context.tenantId || !context.taskId) {
        throw new Error('tenantId y taskId son requeridos');
      }

      const userMessage: ConversationMessage = {
        role: 'user',
        content: prompt,
        timestamp: new Date().toISOString(),
      };
      messages.push(userMessage);
      this.emit('message', userMessage);

      // Get available tools for MASTER agent
      const agentId = context.taskId;
      const agentType = "MASTER" as const;
      const availableTools = await toolRegistry.getToolsForAgent(
        context.tenantId, agentId, agentType
      );

      console.log('[OpenCodeRuntimeAdapter] Available tools:', availableTools.map(t => t.name));

      const toolExecCtx: ToolExecutionContext = {
        tenantId: context.tenantId,
        agentId,
        agentType,
        workspacePath: context.workspacePath,
      };

      // Pass JSON Schema directly - aiService wraps with jsonSchema()
      const aiTools = availableTools.map(tool => {
        return {
          name: tool.name,
          description: tool.description,
          parameters: tool.parameters || { type: "object", properties: {} },
          execute: async (params: Record<string, unknown>) => {
            console.log(`[Tool] Executing: ${tool.name}`, JSON.stringify(params).substring(0, 200));
            const toolStart = Date.now();
            try {
              const result = await tool.execute(params, toolExecCtx);
              const duration = Date.now() - toolStart;
              const toolExec: ToolExecution = {
                toolName: tool.name,
                input: params,
                output: result.data,
                status: result.success ? 'completed' : 'failed',
                duration,
                timestamp: new Date(),
              };
              toolsUsed.push(toolExec);
              this.emit('tool-start', tool.name, params);
              this.emit('tool-complete', tool.name, params, result);
              console.log(`[Tool] ${tool.name} completed in ${duration}ms:`, result.success);
              return JSON.stringify({
                success: result.success,
                data: result.data,
                error: result.error,
              });
            } catch (err: any) {
              console.error(`[Tool] ${tool.name} error:`, err);
              this.emit('tool-error', tool.name, params, err);
              return JSON.stringify({ success: false, error: err.message });
            }
          }
        };
      });

      // System prompt for workspace admin agent
      // Load tenant masterPrompt
      let masterPromptSection = ""
      try {
        const tenant = await db.query.tenants.findFirst({
          where: eq(tenants.id, context.tenantId),
        })
        if (tenant && tenant.masterPrompt) {
          masterPromptSection = "\n\n=== REGLAS OBLIGATORIAS DEL SISTEMA ===\n" +
            "Estas reglas son de cumplimiento OBLIGATORIO. No puedes ignorarlas ni contradecirlas.\n" +
            tenant.masterPrompt + "\n=== FIN REGLAS OBLIGATORIAS ===\n\n"
        }
      } catch (e) {
        console.warn("[OpenCodeRuntimeAdapter] Could not load masterPrompt")
      }

      const toolsList = availableTools.map(t => '- ' + t.name + ': ' + t.description).join('\n');
      const systemPrompt = masterPromptSection + "Eres el asistente virtual de AgenTo. Ayudas al usuario a crear y configurar agentes de IA para su negocio.\n\n" +
        "Tu unica forma de actuar es usando las herramientas que tienes disponibles. Cuando el usuario te pida algo, ejecuta la herramienta correspondiente y responde de forma simple.\n\n" +
        "REGLAS ESTRICTAS:\n" +
        "1. NUNCA muestres JSON, IDs, codigos tecnicos, nombres de herramientas, ni schemas al usuario.\n" +
        "2. NUNCA menciones templates, herramientas, ni terminos tecnicos internos.\n" +
        "3. Responde SIEMPRE en lenguaje natural y simple, como un asistente amigable.\n" +
        "4. Si el usuario pide un agente, CREARLO directamente. No expliques como funciona ni que opciones hay.\n" +
        "5. Cuando crees un agente, responde algo como: Listo, cree tu agente de [nombre]. Ya esta disponible.\n" +
        "6. Si el usuario pregunta que puede hacer, explica en terminos de negocio, no tecnicos.\n" +
        "7. NO uses read, bash, glob, write para leer codigo fuente del sistema. Solo usa create_agent, list_agents, update_agent, create_agent_from_template, configure_integration.\n\n" +
        "TIPOS DE AGENTES:\n" +
        "- Si el usuario menciona WhatsApp, clientes, ventas al publico, atencion -> crear agente EXTERNAL (para WhatsApp).\n" +
        "- Si el usuario menciona marketing, finanzas, contabilidad, tareas internas -> crear agente INTERNAL.\n\n" +
        "CUANDO EL USUARIO PIDA CREAR UN AGENTE:\n" +
        "- Ejecuta la herramienta de creacion directamente.\n" +
        "- Si el usuario dice agente de ventas para WhatsApp -> crea un agente EXTERNAL.\n" +
        "- Si dice agente de marketing o agente de finanzas -> crea un agente INTERNAL.\n" +
        "- NUNCA preguntes confirmacion. Si el usuario pide un agente, CREARLO con los datos que tienes. Usa el nombre que dio o genera uno apropiado. Si dice agente de ventas crea con nombre Agente de Ventas. INVENTA el nombre y la descripcion si el usuario no los da. No esperes mas datos.\n" +
        "- Despues de crear, responde simple: Listo, cree [nombre]. Ya esta disponible.\n\n" +
        "CUANDO EL USUARIO PIDA MEJORAR UN AGENTE:\n" +
        "- Ejecuta la herramienta de actualizacion con los cambios pedidos.\n" +
        "- Responde: Listo, actualice [lo que cambio].\n\n" +
        "CUANDO EL USUARIO PIDA CONECTAR CON EL ERP:\n" +
        "- Ejecuta la herramienta de configuracion de integracion.\n" +
        "- Si no tienes los datos, pregunta: Cual es la URL de tu Dolibarr y la API key?\n" +
        "- Despues de configurar, responde: Listo, conecte el agente con tu sistema. Ahora puede buscar productos, consultar stock y tomar pedidos.\n\n" +
        "SIEMPRE responde en el idioma del usuario. Se directo, amigable y eficiente. No des explicaciones tecnicas.";

      console.log('[OpenCodeRuntimeAdapter] Calling aiService.processMessage with', aiTools.length, 'tools');

      const aiResult = await aiService.processMessage({
        tenantId: context.tenantId,
        agentId,
        messages: (historyMessages && historyMessages.length > 0)
            ? [...historyMessages, { role: 'user', content: prompt }]
            : [{ role: 'user', content: prompt }],
        systemPrompt,
        tools: aiTools,
        maxTokens: 4096,
      });

      console.log('[OpenCodeRuntimeAdapter] AI result:', {
        contentLength: aiResult.content?.length,
        toolCalls: aiResult.toolCallsMade,
        tokens: aiResult.tokensUsed?.total,
      });

      const assistantMessage: ConversationMessage = {
        role: 'assistant',
        content: aiResult.content,
        timestamp: new Date().toISOString(),
      };
      messages.push(assistantMessage);
      this.emit('message', assistantMessage);

      for (const toolExec of toolsUsed) {
        const toolMsg: ConversationMessage = {
          role: 'tool',
          content: typeof toolExec.output === 'string' ? toolExec.output : JSON.stringify(toolExec.output || toolExec.input),
          timestamp: new Date().toISOString(),
          toolName: toolExec.toolName,
          toolInput: toolExec.input,
          toolOutput: toolExec.output,
        };
        messages.push(toolMsg);
      }

      const executionTime = Date.now() - startTime;

      return {
        success: true,
        content: aiResult.content,
        sessionId: context.sessionId,
        tokensUsed: aiResult.tokensUsed?.total,
        executionTime,
        toolsUsed,
        messages,
      };

    } catch (error) {
      const executionTime = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('[OpenCodeRuntimeAdapter] Execute error:', errorMessage);
      this.emit('error', error instanceof Error ? error : new Error(errorMessage));
      return {
        success: false,
        content: '',
        executionTime,
        toolsUsed,
        messages,
        error: errorMessage,
      };
    }
  }

  async getSessionMessages(sessionId: string): Promise<ConversationMessage[]> {
    return [];
  }

  async listSessions(tenantId: string): Promise<any[]> {
    const result: any[] = [];
    return result;
  }

  async deleteSession(sessionId: string, tenantId: string): Promise<void> {
    this.activeSessions.delete(tenantId);
  }

  async cleanup(): Promise<void> {
    this.activeSessions.clear();
    this.removeAllListeners();
  }

  async cancelExecution(taskId: string): Promise<void> {
    console.log(`[OpenCodeRuntimeAdapter] Cancel execution requested for task ${taskId}`);
  }
}
