/**
 * OpenCodeRuntimeAdapter - Adaptador que usa OpenCode como librería interna
 *
 * Este adaptador NO ejecuta el CLI como proceso hijo, sino que importa directamente
 * las funciones de OpenCode y las ejecuta en el mismo proceso.
 *
 * Usa importaciones dinámicas para evitar problemas de compilación de TypeScript.
 */

import { EventEmitter } from 'events';
import path from 'path';
import { TenantManager, TenantConfig } from '../tenant/TenantManager';
import { WorkspaceManager } from '../tenant/WorkspaceManager';

// ============================================
// Types (usamos any para OpenCode API para evitar problemas de compilación)
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
  private opencodeApi: any = null; // Loaded dynamically
  private initialized: boolean = false;
  private readonly DEFAULT_TIMEOUT = 600000;
  private readonly MAX_TIMEOUT = 900000;

  // Sesiones activas por tenant
  private activeSessions: Map<string, string> = new Map();

  constructor(
    tenantManager?: TenantManager,
    workspaceManager?: WorkspaceManager
  ) {
    super();
    this.tenantManager = tenantManager || new TenantManager();
    this.workspaceManager = workspaceManager || new WorkspaceManager();
  }

  /**
   * Inicializa el adaptador cargando OpenCode API dinámicamente
   */
  private async ensureInitialized(): Promise<void> {
    if (this.initialized && this.opencodeApi) {
      return;
    }

    try {
      // Import dinámico usando require para que TypeScript no analice el módulo
      // Usamos Function() para evadir la verificación de tipos de TypeScript
      const opencodePath = path.join(__dirname, '../../../opencode-fork/packages/opencode/src/api.ts');
      const importFn = new Function('path', 'require', `
        const module = require(path);
        return module;
      `);
      const opencodeModule = importFn(opencodePath, require);
      this.opencodeApi = opencodeModule.opencode;

      // Inicializar OpenCode API
      const baseDataDir = process.env.OPENCODE_DATA_DIR || path.join(process.cwd(), '.opencode-data');
      await this.opencodeApi.initialize({
        baseDataDir,
        initDatabase: true,
      });

      this.initialized = true;
      console.log('[OpenCodeRuntimeAdapter] Initialized successfully');
    } catch (error) {
      console.error('[OpenCodeRuntimeAdapter] Failed to initialize:', error);
      throw new Error(`Failed to initialize OpenCode: ${error}`);
    }
  }

  /**
   * Ejecuta una tarea usando OpenCode API directamente
   */
  async execute(
    prompt: string,
    context: ExecutionContext
  ): Promise<ExecutionResult> {
    const startTime = Date.now();
    const messages: ConversationMessage[] = [];
    const toolsUsed: ToolExecution[] = [];

    try {
      // 1. Asegurar inicialización
      await this.ensureInitialized();

      // 2. Validar contexto
      if (!context.tenantId || !context.taskId) {
        throw new Error('tenantId y taskId son requeridos');
      }

      // 3. Obtener configuración del tenant
      const config = await this.tenantManager.getConfig(context.tenantId);
      if (!config) {
        throw new Error(`Tenant ${context.tenantId} not configured`);
      }

      // 4. Asegurar workspace
      const workspacePath = context.workspacePath ||
        this.workspaceManager.ensureWorkspace(context.tenantId);

      // 5. Emitir mensaje del usuario
      const userMessage: ConversationMessage = {
        role: 'user',
        content: prompt,
        timestamp: new Date().toISOString(),
      };
      messages.push(userMessage);
      this.emit('message', userMessage);

      // 6. Obtener o crear sesión
      let sessionId = context.sessionId || this.activeSessions.get(context.tenantId);

      if (!sessionId) {
        // Crear nueva sesión
        const session = await this.opencodeApi.createSession({
          tenantId: context.tenantId,
          directory: workspacePath,
          title: `${context.tenantId} - ${new Date().toISOString()}`,
        });
        const newSessionId = session.id || `session-${Date.now()}`;
        sessionId = newSessionId;
        this.activeSessions.set(context.tenantId, newSessionId);
      }

      // 7. Ejecutar el prompt
      const agent = (config as any).agent || 'build';
      const result = await this.opencodeApi.executePrompt(sessionId, {
        prompt,
        model: `${config.provider}/${config.model}`,
        agent,
        format: 'text',
      });

      // 8. Extraer contenido del resultado
      let content = '';
      if (result && result.message) {
        if (typeof result.message === 'string') {
          content = result.message;
        } else if (result.message.content) {
          content = result.message.content;
        } else if (result.message.parts) {
          content = result.message.parts
            .map((p: any) => p.text || '')
            .filter(Boolean)
            .join('\n');
        }
      }

      // Añadir mensaje del asistente
      if (content) {
        const assistantMessage: ConversationMessage = {
          role: 'assistant',
          content,
          timestamp: new Date().toISOString(),
        };
        messages.push(assistantMessage);
        this.emit('message', assistantMessage);
      }

      const executionTime = Date.now() - startTime;

      return {
        success: true,
        content,
        sessionId: result.sessionId,
        tokensUsed: result.tokens,
        executionTime,
        toolsUsed,
        messages,
      };

    } catch (error) {
      const executionTime = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

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

  /**
   * Obtiene los mensajes de una sesión
   */
  async getSessionMessages(sessionId: string): Promise<ConversationMessage[]> {
    await this.ensureInitialized();
    const messages = await this.opencodeApi.getSessionMessages(sessionId);
    return messages.map((msg: any) => this.convertToConversationMessage(msg));
  }

  /**
   * Convierte un mensaje de OpenCode a ConversationMessage
   */
  private convertToConversationMessage(msg: any): ConversationMessage {
    const base = {
      timestamp: msg.time?.created ? new Date(msg.time.created).toISOString() : undefined,
    };

    if (msg.role === 'user') {
      return {
        ...base,
        role: 'user',
        content: msg.parts?.map((p: any) => p.text).join('') || '',
      };
    }

    if (msg.role === 'assistant') {
      return {
        ...base,
        role: 'assistant',
        content: msg.content || '',
      };
    }

    return {
      ...base,
      role: 'system',
      content: JSON.stringify(msg),
    };
  }

  /**
   * Lista las sesiones de un tenant
   */
  async listSessions(tenantId: string): Promise<any[]> {
    await this.ensureInitialized();
    return this.opencodeApi.listSessions(tenantId);
  }

  /**
   * Elimina una sesión
   */
  async deleteSession(sessionId: string, tenantId: string): Promise<void> {
    await this.ensureInitialized();
    await this.opencodeApi.deleteSession(sessionId);
    this.activeSessions.delete(tenantId);
  }

  /**
   * Limpia recursos
   */
  async cleanup(): Promise<void> {
    this.activeSessions.clear();
    this.removeAllListeners();
    if (this.opencodeApi) {
      await this.opencodeApi.cleanup();
    }
  }

  /**
   * Cancela una ejecución
   */
  async cancelExecution(taskId: string): Promise<void> {
    // TODO: Implementar cancelación
    console.log(`[OpenCodeRuntimeAdapter] Cancel execution requested for task ${taskId}`);
  }
}
