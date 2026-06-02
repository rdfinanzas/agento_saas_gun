/**
 * TaskManager - Gestor de Tareas Agénticas
 * Adaptado desde Accomplish/OpenCode para multi-tenant
 *
 * VERSIÓN COMPLETA - Con integración real de LLM y Tools
 */

import { v4 as uuidv4 } from 'uuid';
import type { ProviderType } from '../../common/types/provider';
import { LLMService } from '../../services/llm.service';
import { ToolRegistry } from '../../tools/registry';
import type { Tool } from '../../tools/tool';

// Estados de una tarea
export type TaskStatus =
  | 'pending'
  | 'queued'
  | 'running'
  | 'waiting_permission'
  | 'waiting_input'
  | 'completed'
  | 'failed'
  | 'cancelled'
  | 'interrupted';

// Configuración de una tarea
export interface TaskConfig {
  taskId: string;
  tenantId: string;
  agentId: string;
  conversationId?: string;
  provider: ProviderType;
  model: string;
  prompt: string;
  systemPrompt?: string;
  workingDirectory?: string;
  timeout?: number;
  maxTokens?: number;
  temperature?: number;
  tools?: ToolDefinition[];
  attachments?: Attachment[];
  context?: ConversationMessage[];
}

// Definición de herramienta
export interface ToolDefinition {
  name: string;
  description: string;
  input_schema: {
    type: 'object';
    properties: Record<string, any>;
    required?: string[];
  };
}

// Adjunto (imagen, archivo)
export interface Attachment {
  type: 'image' | 'file';
  mimeType: string;
  data: string; // base64 o URL
  name?: string;
}

// Mensaje de conversación
export interface ConversationMessage {
  role: 'user' | 'assistant' | 'system';
  content: string | ContentBlock[];
}

// Bloque de contenido
export interface ContentBlock {
  type: 'text' | 'image' | 'tool_use' | 'tool_result';
  text?: string;
  source?: { type: string; media_type: string; data: string };
  id?: string;
  name?: string;
  input?: any;
  tool_use_id?: string;
  content?: string | ContentBlock[];
  is_error?: boolean;
}

// Evento de progreso
export interface TaskProgressEvent {
  taskId?: string;
  type: 'thought' | 'action' | 'observation' | 'tool_use' | 'tool_result' | 'text' | 'error' | 'complete';
  content: string | ContentBlock[];
  timestamp?: Date;
  metadata?: Record<string, any>;
}

// Callbacks del ciclo de vida
export interface TaskCallbacks {
  onProgress?: (event: TaskProgressEvent) => void;
  onComplete?: (result: TaskResult) => void;
  onError?: (error: Error) => void;
  onPermissionRequest?: (request: PermissionRequest) => Promise<PermissionResponse>;
  onInputRequest?: (request: InputRequest) => Promise<string>;
  onCancelled?: () => void;
}

// Solicitud de permiso
export interface PermissionRequest {
  id: string;
  taskId: string;
  operation: 'file_read' | 'file_write' | 'file_delete' | 'execute' | 'network';
  resource: string;
  details?: string;
}

// Respuesta de permiso
export interface PermissionResponse {
  granted: boolean;
  reason?: string;
}

// Solicitud de input
export interface InputRequest {
  id: string;
  taskId: string;
  message: string;
  options?: { label: string; value: string }[];
}

// Resultado de tarea
export interface TaskResult {
  taskId: string;
  status: TaskStatus;
  output?: string;
  error?: string;
  usage?: {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
  };
  duration?: number;
  messages?: ConversationMessage[];
}

// Sesión de tarea activa
interface TaskSession {
  config: TaskConfig;
  callbacks: TaskCallbacks;
  status: TaskStatus;
  startTime: Date;
  abortController?: AbortController;
  messages: ConversationMessage[];
  pendingPermission?: {
    resolve: (granted: boolean) => void;
    request: PermissionRequest;
  };
  pendingInput?: {
    resolve: (input: string) => void;
    request: InputRequest;
  };
}

// Opciones del TaskManager
export interface TaskManagerOptions {
  maxConcurrentTasks?: number;
  defaultTimeout?: number;
  workingDirectory?: string;
  llmService?: LLMService;
}

// API pública del TaskManager
export interface TaskManagerAPI {
  startTask(config: TaskConfig, callbacks: TaskCallbacks): Promise<string>;
  cancelTask(taskId: string): Promise<void>;
  interruptTask(taskId: string): Promise<void>;
  getTaskStatus(taskId: string): TaskStatus | undefined;
  isTaskRunning(taskId: string): boolean;
  getActiveTasks(): string[];
  sendPermissionResponse(taskId: string, response: PermissionResponse): void;
  sendInputResponse(taskId: string, input: string): void;
  cancelAllTasks(): Promise<void>;
}

/**
 * TaskManager - Gestiona la ejecución de tareas agénticas
 * CON INTEGRACIÓN REAL DE LLM Y TOOLS
 */
export class TaskManager implements TaskManagerAPI {
  private sessions: Map<string, TaskSession> = new Map();
  private queue: Array<{ config: TaskConfig; callbacks: TaskCallbacks }> = [];
  private maxConcurrent: number;
  private defaultTimeout: number;
  private defaultWorkingDirectory: string;
  private llmService: LLMService;

  constructor(options: TaskManagerOptions = {}) {
    this.maxConcurrent = options.maxConcurrentTasks ?? 10;
    this.defaultTimeout = options.defaultTimeout ?? 600000; // 10 min
    this.defaultWorkingDirectory = options.workingDirectory ?? process.cwd();
    this.llmService = options.llmService || new LLMService();
  }

  /**
   * Inicia una nueva tarea
   */
  async startTask(config: TaskConfig, callbacks: TaskCallbacks): Promise<string> {
    const taskId = config.taskId || uuidv4();

    // Verificar límite de concurrencia
    if (this.sessions.size >= this.maxConcurrent) {
      this.queue.push({ config, callbacks });
      return taskId;
    }

    // Crear sesión
    const session: TaskSession = {
      config: { ...config, taskId },
      callbacks,
      status: 'pending',
      startTime: new Date(),
      messages: config.context || [],
    };

    this.sessions.set(taskId, session);

    // Ejecutar tarea
    this.executeTask(taskId).catch((error) => {
      this.handleTaskError(taskId, error);
    });

    return taskId;
  }

  /**
   * Ejecuta una tarea con el LLM y tools reales
   */
  private async executeTask(taskId: string): Promise<void> {
    const session = this.sessions.get(taskId);
    if (!session) return;

    session.status = 'running';
    const abortController = new AbortController();
    session.abortController = abortController;
    const startTime = Date.now();

    try {
      // Emitir evento de progreso inicial
      this.emitProgress(taskId, {
        type: 'thought',
        content: 'Iniciando tarea...',
        timestamp: new Date(),
      });

      // Preparar mensajes para el LLM
      const messages: Array<{ role: 'user' | 'assistant' | 'system'; content: string }> = [];

      // Agregar system prompt si existe
      if (session.config.systemPrompt) {
        messages.push({
          role: 'system',
          content: session.config.systemPrompt,
        });
      }

      // Agregar contexto previo
      for (const msg of session.messages) {
        if (typeof msg.content === 'string') {
          messages.push({
            role: msg.role,
            content: msg.content,
          });
        }
      }

      // Agregar el prompt del usuario
      messages.push({
        role: 'user',
        content: session.config.prompt,
      });

      // Obtener definiciones de tools
      const toolDefinitions = await ToolRegistry.getToolDefinitions(session.config.tenantId);

      // Emitir evento de acción
      this.emitProgress(taskId, {
        type: 'action',
        content: `Enviando solicitud a ${session.config.provider}/${session.config.model}`,
        timestamp: new Date(),
      });

      // Variables para tracking
      let totalInputTokens = 0;
      let totalOutputTokens = 0;
      const maxIterations = 20; // Prevenir bucles infinitos
      let iteration = 0;

      // Loop de ejecución agéntica
      while (iteration < maxIterations) {
        iteration++;

        // Llamar al LLM
        const response = await this.llmService.chat({
          provider: session.config.provider,
          model: session.config.model,
          messages,
          tools: toolDefinitions,
          maxTokens: session.config.maxTokens,
          temperature: session.config.temperature,
        });

        totalInputTokens += response.usage?.inputTokens || 0;
        totalOutputTokens += response.usage?.outputTokens || 0;

        // Verificar si fue cancelado
        if (abortController.signal.aborted) {
          session.status = 'cancelled';
          session.callbacks.onCancelled?.();
          return;
        }

        // Procesar respuesta
        if (response.content) {
          // Emitir texto de respuesta
          this.emitProgress(taskId, {
            type: 'text',
            content: response.content,
            timestamp: new Date(),
          });

          // Agregar a mensajes
          messages.push({
            role: 'assistant',
            content: response.content,
          });
        }

        // Si no hay tool calls, terminar
        if (!response.toolCalls || response.toolCalls.length === 0) {
          // Tarea completada
          session.status = 'completed';
          const duration = Date.now() - startTime;

          const result: TaskResult = {
            taskId,
            status: 'completed',
            output: response.content || '',
            usage: {
              inputTokens: totalInputTokens,
              outputTokens: totalOutputTokens,
              totalTokens: totalInputTokens + totalOutputTokens,
            },
            duration,
            messages: messages.map((m) => ({
              role: m.role,
              content: m.content,
            })),
          };

          this.emitProgress(taskId, {
            type: 'complete',
            content: response.content || 'Tarea completada',
            timestamp: new Date(),
            metadata: { duration, totalTokens: totalInputTokens + totalOutputTokens },
          });

          session.callbacks.onComplete?.(result);
          this.sessions.delete(taskId);
          this.processQueue();
          return;
        }

        // Procesar tool calls
        for (const toolCall of response.toolCalls) {
          // Emitir evento de tool use
          this.emitProgress(taskId, {
            type: 'tool_use',
            content: `Usando herramienta: ${toolCall.name}`,
            timestamp: new Date(),
            metadata: { toolName: toolCall.name, args: toolCall.arguments },
          });

          // Ejecutar la herramienta
          const toolResult = await this.executeToolCall(
            taskId,
            toolCall.name,
            toolCall.arguments,
            session,
            abortController.signal,
          );

          // Emitir resultado de tool
          this.emitProgress(taskId, {
            type: 'tool_result',
            content: toolResult.output,
            timestamp: new Date(),
            metadata: {
              toolName: toolCall.name,
              isError: toolResult.isError,
            },
          });

          // Agregar resultado a mensajes (formato para el LLM)
          messages.push({
            role: 'assistant',
            content: '', // El contenido ya fue agregado arriba
          });

          // Agregar tool result como mensaje del usuario (formato estándar)
          messages.push({
            role: 'user',
            content: `[Resultado de ${toolCall.name}]:\n${toolResult.output}`,
          });
        }
      }

      // Si llegamos aquí, se alcanzó el límite de iteraciones
      session.status = 'completed';
      const result: TaskResult = {
        taskId,
        status: 'completed',
        output: 'Se alcanzó el límite máximo de iteraciones.',
        usage: {
          inputTokens: totalInputTokens,
          outputTokens: totalOutputTokens,
          totalTokens: totalInputTokens + totalOutputTokens,
        },
        duration: Date.now() - startTime,
        messages: messages.map((m) => ({
          role: m.role,
          content: m.content,
        })),
      };

      session.callbacks.onComplete?.(result);
      this.sessions.delete(taskId);
      this.processQueue();
    } catch (error) {
      if ((error as Error).name === 'AbortError') {
        session.status = 'cancelled';
        session.callbacks.onCancelled?.();
      } else {
        throw error;
      }
    }
  }

  /**
   * Ejecuta una llamada a herramienta
   */
  private async executeToolCall(
    taskId: string,
    toolName: string,
    args: any,
    session: TaskSession,
    signal: AbortSignal,
  ): Promise<{ output: string; isError: boolean }> {
    try {
      // Crear contexto de ejecución
      const ctx: Tool.Context = {
        tenantId: session.config.tenantId,
        sessionId: session.config.conversationId || taskId,
        messageId: uuidv4(),
        agent: session.config.agentId,
        abort: signal,
        workspacePath: session.config.workingDirectory || this.defaultWorkingDirectory,
        metadata: () => {},
        ask: async (request: Tool.PermissionRequest) => {
          // Auto-aprobar permisos que están en 'always'
          // En producción, esto debería pedir confirmación al usuario
          return;
        },
      };

      // Ejecutar la herramienta
      const result = await ToolRegistry.execute(session.config.tenantId, toolName, args, ctx);

      return {
        output: result.output,
        isError: false,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        output: `Error ejecutando ${toolName}: ${errorMessage}`,
        isError: true,
      };
    }
  }

  /**
   * Cancela una tarea
   */
  async cancelTask(taskId: string): Promise<void> {
    const session = this.sessions.get(taskId);
    if (!session) return;

    if (session.abortController) {
      session.abortController.abort();
    }

    session.status = 'cancelled';
    session.callbacks.onCancelled?.();
    this.sessions.delete(taskId);

    this.processQueue();
  }

  /**
   * Interrumpe una tarea suavemente
   */
  async interruptTask(taskId: string): Promise<void> {
    const session = this.sessions.get(taskId);
    if (!session) return;

    session.status = 'interrupted';
  }

  /**
   * Obtiene el estado de una tarea
   */
  getTaskStatus(taskId: string): TaskStatus | undefined {
    return this.sessions.get(taskId)?.status;
  }

  /**
   * Verifica si una tarea está corriendo
   */
  isTaskRunning(taskId: string): boolean {
    const session = this.sessions.get(taskId);
    return session?.status === 'running' || session?.status === 'waiting_permission';
  }

  /**
   * Obtiene todas las tareas activas
   */
  getActiveTasks(): string[] {
    return Array.from(this.sessions.keys());
  }

  /**
   * Envía respuesta a una solicitud de permiso
   */
  sendPermissionResponse(taskId: string, response: PermissionResponse): void {
    const session = this.sessions.get(taskId);
    if (!session || !session.pendingPermission) return;

    session.pendingPermission.resolve(response.granted);
    session.pendingPermission = undefined;
    session.status = 'running';
  }

  /**
   * Envía respuesta a una solicitud de input
   */
  sendInputResponse(taskId: string, input: string): void {
    const session = this.sessions.get(taskId);
    if (!session || !session.pendingInput) return;

    session.pendingInput.resolve(input);
    session.pendingInput = undefined;
    session.status = 'running';
  }

  /**
   * Cancela todas las tareas
   */
  async cancelAllTasks(): Promise<void> {
    const taskIds = Array.from(this.sessions.keys());
    await Promise.all(taskIds.map((id) => this.cancelTask(id)));
    this.queue = [];
  }

  /**
   * Emite evento de progreso
   */
  private emitProgress(taskId: string, event: TaskProgressEvent): void {
    const session = this.sessions.get(taskId);
    if (session?.callbacks.onProgress) {
      session.callbacks.onProgress(event);
    }
  }

  /**
   * Maneja error de tarea
   */
  private handleTaskError(taskId: string, error: Error): void {
    const session = this.sessions.get(taskId);
    if (!session) return;

    session.status = 'failed';

    this.emitProgress(taskId, {
      type: 'error',
      content: error.message,
      timestamp: new Date(),
    });

    if (session.callbacks.onError) {
      session.callbacks.onError(error);
    }

    this.sessions.delete(taskId);
    this.processQueue();
  }

  /**
   * Procesa la cola de tareas pendientes
   */
  private processQueue(): void {
    while (this.queue.length > 0 && this.sessions.size < this.maxConcurrent) {
      const item = this.queue.shift();
      if (item) {
        this.startTask(item.config, item.callbacks);
      }
    }
  }

  /**
   * Obtiene sesiones por tenant
   */
  getTasksByTenant(tenantId: string): string[] {
    return Array.from(this.sessions.entries())
      .filter(([_, session]) => session.config.tenantId === tenantId)
      .map(([taskId]) => taskId);
  }

  /**
   * Obtiene sesiones por agente
   */
  getTasksByAgent(tenantId: string, agentId: string): string[] {
    return Array.from(this.sessions.entries())
      .filter(
        ([_, session]) =>
          session.config.tenantId === tenantId && session.config.agentId === agentId,
      )
      .map(([taskId]) => taskId);
  }
}

// Instancia singleton para el sistema
let taskManagerInstance: TaskManager | null = null;

export function getTaskManager(options?: TaskManagerOptions): TaskManager {
  if (!taskManagerInstance) {
    taskManagerInstance = new TaskManager(options);
  }
  return taskManagerInstance;
}

export function createTaskManager(options?: TaskManagerOptions): TaskManager {
  return new TaskManager(options);
}
