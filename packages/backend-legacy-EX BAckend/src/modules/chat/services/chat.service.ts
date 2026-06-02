/**
 * ChatService - Servicio de Chat con Integración LLM Real
 * Conecta el Workspace con el TaskManager y las Tools
 */

import { v4 as uuidv4 } from 'uuid';
import { getTaskManager, TaskManager, type TaskResult, type TaskProgressEvent } from '../../opencode/internal/classes/TaskManager';
import { LLMService } from '../../opencode/services/llm.service';
import { ToolRegistry } from '../../opencode/tools/registry';
import type { ProviderType } from '../../opencode/common/types/provider';

// Interfaces
export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  metadata?: {
    tokens?: number;
    model?: string;
    provider?: string;
    toolCalls?: ToolCallInfo[];
  };
}

export interface ToolCallInfo {
  name: string;
  arguments: any;
  result?: string;
}

export interface ChatSession {
  id: string;
  tenantId: string;
  userId: string;
  messages: ChatMessage[];
  config: ChatConfig;
  createdAt: Date;
  updatedAt: Date;
}

export interface ChatConfig {
  provider: ProviderType;
  model: string;
  systemPrompt?: string;
  maxTokens?: number;
  temperature?: number;
  enableTools?: boolean;
}

export interface SendMessageOptions {
  sessionId?: string;
  mode?: 'FULL' | 'LIMITED';
  attachments?: Array<{
    type: 'image' | 'file';
    mimeType: string;
    data: string;
    name?: string;
  }>;
  stream?: boolean;
  onProgress?: (event: ChatProgressEvent) => void;
}

export interface ChatProgressEvent {
  type: 'thought' | 'action' | 'text' | 'tool_use' | 'tool_result' | 'complete' | 'error';
  content: string;
  metadata?: any;
}

export interface SendMessageResult {
  response: string;
  sessionId: string;
  messageId: string;
  mode: 'FULL' | 'LIMITED';
  tokens?: {
    input: number;
    output: number;
    total: number;
  };
  toolCalls?: ToolCallInfo[];
}

/**
 * ChatService - Servicio principal de chat
 */
export class ChatService {
  private taskManager: TaskManager;
  private llmService: LLMService;
  private sessions: Map<string, ChatSession> = new Map();

  constructor() {
    this.taskManager = getTaskManager({
      maxConcurrentTasks: 50,
      defaultTimeout: 300000, // 5 minutos
    });
    this.llmService = new LLMService();
  }

  /**
   * Envía un mensaje y obtiene respuesta del LLM
   */
  async sendMessage(
    tenantId: string,
    message: string,
    mode: 'FULL' | 'LIMITED' = 'FULL',
    options: SendMessageOptions = {},
  ): Promise<SendMessageResult> {
    const sessionId = options.sessionId || uuidv4();
    const messageId = uuidv4();

    // Obtener o crear sesión
    let session = this.sessions.get(sessionId);
    if (!session) {
      session = await this.createSession(tenantId, sessionId);
    }

    // Agregar mensaje del usuario
    const userMessage: ChatMessage = {
      id: messageId,
      role: 'user',
      content: message,
      timestamp: new Date(),
    };
    session.messages.push(userMessage);

    // Obtener configuración del tenant (por defecto)
    const config = session.config;

    // Preparar historial de mensajes
    const messageHistory = session.messages.map((m) => ({
      role: m.role,
      content: m.content,
    }));

    // Variables para tracking
    let responseText = '';
    let toolCalls: ToolCallInfo[] = [];
    let inputTokens = 0;
    let outputTokens = 0;

    try {
      // Emitir progreso inicial
      options.onProgress?.({
        type: 'thought',
        content: 'Procesando mensaje...',
      });

      // Obtener definiciones de tools si están habilitadas
      let tools = undefined;
      if (config.enableTools !== false && mode === 'FULL') {
        tools = await ToolRegistry.getToolDefinitions(tenantId);
      }

      // Llamar al LLM
      options.onProgress?.({
        type: 'action',
        content: `Consultando ${config.provider}/${config.model}...`,
      });

      const llmResponse = await this.llmService.executeRequest({
        provider: config.provider,
        model: config.model,
        messages: messageHistory,
        systemPrompt: config.systemPrompt,
        tools,
        maxTokens: config.maxTokens,
        temperature: config.temperature,
        tenantId,
      });

      inputTokens = llmResponse.usage?.inputTokens || 0;
      outputTokens = llmResponse.usage?.outputTokens || 0;
      responseText = llmResponse.content || '';

      // Emitir respuesta de texto
      if (responseText) {
        options.onProgress?.({
          type: 'text',
          content: responseText,
        });
      }

      // Procesar tool calls si existen
      if (llmResponse.toolCalls && llmResponse.toolCalls.length > 0) {
        // Loop para ejecutar tools y continuar
        let currentMessages = [...messageHistory];
        let iterations = 0;
        const maxIterations = 10;

        while (llmResponse.toolCalls && llmResponse.toolCalls.length > 0 && iterations < maxIterations) {
          iterations++;

          // Agregar respuesta del assistant
          currentMessages.push({
            role: 'assistant',
            content: llmResponse.content || '',
          });

          // Ejecutar cada tool call
          for (const toolCall of llmResponse.toolCalls) {
            options.onProgress?.({
              type: 'tool_use',
              content: `Ejecutando: ${toolCall.name}`,
              metadata: { toolName: toolCall.name, args: toolCall.arguments },
            });

            try {
              const toolResult = await ToolRegistry.execute(tenantId, toolCall.name, toolCall.arguments, {
                tenantId,
                sessionId,
                messageId: uuidv4(),
                agent: 'chat',
                abort: new AbortController().signal,
                workspacePath: process.cwd(),
                metadata: () => {},
                ask: async () => {},
              });

              toolCalls.push({
                name: toolCall.name,
                arguments: toolCall.arguments,
                result: toolResult.output,
              });

              options.onProgress?.({
                type: 'tool_result',
                content: toolResult.output,
                metadata: { toolName: toolCall.name },
              });

              // Agregar resultado al historial
              currentMessages.push({
                role: 'user',
                content: `[Resultado de ${toolCall.name}]:\n${toolResult.output}`,
              });
            } catch (error) {
              const errorMsg = error instanceof Error ? error.message : String(error);
              toolCalls.push({
                name: toolCall.name,
                arguments: toolCall.arguments,
                result: `Error: ${errorMsg}`,
              });

              currentMessages.push({
                role: 'user',
                content: `[Error en ${toolCall.name}]: ${errorMsg}`,
              });
            }
          }

          // Llamar nuevamente al LLM con los resultados
          const nextResponse = await this.llmService.executeRequest({
            provider: config.provider,
            model: config.model,
            messages: currentMessages,
            systemPrompt: config.systemPrompt,
            tools,
            maxTokens: config.maxTokens,
            temperature: config.temperature,
            tenantId,
          });

          inputTokens += nextResponse.usage?.inputTokens || 0;
          outputTokens += nextResponse.usage?.outputTokens || 0;

          if (nextResponse.content) {
            responseText += '\n\n' + nextResponse.content;
            options.onProgress?.({
              type: 'text',
              content: nextResponse.content,
            });
          }

          // Actualizar para siguiente iteración
          llmResponse.toolCalls = nextResponse.toolCalls;
          llmResponse.content = nextResponse.content;
        }
      }

      // Crear mensaje de respuesta
      const assistantMessage: ChatMessage = {
        id: uuidv4(),
        role: 'assistant',
        content: responseText,
        timestamp: new Date(),
        metadata: {
          tokens: inputTokens + outputTokens,
          model: config.model,
          provider: config.provider,
          toolCalls,
        },
      };
      session.messages.push(assistantMessage);
      session.updatedAt = new Date();

      // Emitir completado
      options.onProgress?.({
        type: 'complete',
        content: responseText,
        metadata: { tokens: inputTokens + outputTokens },
      });

      return {
        response: responseText,
        sessionId,
        messageId: assistantMessage.id,
        mode,
        tokens: {
          input: inputTokens,
          output: outputTokens,
          total: inputTokens + outputTokens,
        },
        toolCalls,
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Error desconocido';

      options.onProgress?.({
        type: 'error',
        content: errorMsg,
      });

      throw new Error(`Error en chat: ${errorMsg}`);
    }
  }

  /**
   * Crea una nueva sesión de chat
   */
  private async createSession(tenantId: string, sessionId: string): Promise<ChatSession> {
    // Obtener configuración por defecto del tenant
    // En producción, esto vendría de la base de datos
    const config: ChatConfig = {
      provider: 'openai',
      model: 'gpt-4o',
      systemPrompt: 'Eres un asistente útil y amigable.',
      maxTokens: 4096,
      temperature: 0.7,
      enableTools: true,
    };

    const session: ChatSession = {
      id: sessionId,
      tenantId,
      userId: 'default',
      messages: [],
      config,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.sessions.set(sessionId, session);
    return session;
  }

  /**
   * Obtiene el historial de una sesión
   */
  async getHistory(tenantId: string, sessionId?: string): Promise<{
    tenantId: string;
    sessionId?: string;
    messages: ChatMessage[];
  }> {
    if (sessionId) {
      const session = this.sessions.get(sessionId);
      if (session && session.tenantId === tenantId) {
        return {
          tenantId,
          sessionId,
          messages: session.messages,
        };
      }
    }

    return {
      tenantId,
      sessionId,
      messages: [],
    };
  }

  /**
   * Limpia el historial de una sesión
   */
  async clearHistory(tenantId: string, sessionId: string): Promise<{ success: boolean }> {
    const session = this.sessions.get(sessionId);
    if (session && session.tenantId === tenantId) {
      session.messages = [];
      session.updatedAt = new Date();
      return { success: true };
    }
    return { success: false };
  }

  /**
   * Actualiza la configuración de una sesión
   */
  async updateConfig(
    tenantId: string,
    sessionId: string,
    config: Partial<ChatConfig>,
  ): Promise<{ success: boolean }> {
    const session = this.sessions.get(sessionId);
    if (session && session.tenantId === tenantId) {
      session.config = { ...session.config, ...config };
      session.updatedAt = new Date();
      return { success: true };
    }
    return { success: false };
  }

  /**
   * Obtiene las sesiones activas de un tenant
   */
  getActiveSessions(tenantId: string): ChatSession[] {
    return Array.from(this.sessions.values()).filter((s) => s.tenantId === tenantId);
  }

  /**
   * Elimina una sesión
   */
  async deleteSession(tenantId: string, sessionId: string): Promise<{ success: boolean }> {
    const session = this.sessions.get(sessionId);
    if (session && session.tenantId === tenantId) {
      this.sessions.delete(sessionId);
      return { success: true };
    }
    return { success: false };
  }
}

// Exportar instancia singleton
export const chatService = new ChatService();
