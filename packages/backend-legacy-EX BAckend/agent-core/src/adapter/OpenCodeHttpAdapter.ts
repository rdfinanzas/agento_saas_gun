/**
 * OpenCodeHttpAdapter - Se comunica vía HTTP con el servidor de OpenCode
 *
 * Este adaptador NO ejecuta nada de OpenCode directamente.
 * Solo hace llamadas HTTP al servidor HTTP de OpenCode (que corre con Bun).
 *
 * Ventajas:
 * - Sin importaciones del fork (evita incompatibilidad de módulos)
 * - agent-core sigue siendo CommonJS/Node.js
 * - OpenCode corre con Bun usando su runtime nativo
 * - Comunicación limpia vía HTTP
 */

import { EventEmitter } from 'events';
import axios from 'axios';
import { TenantManager, TenantConfig } from '../tenant/TenantManager';
import { WorkspaceManager } from '../tenant/WorkspaceManager';

// Type for axios instance
type AxiosInstance = ReturnType<typeof axios.create>;

// ============================================
// Types
// ============================================

// Types para respuestas HTTP del servidor OpenCode
interface CreateSessionResponse {
  sessionID?: string;
  id?: string;
  title?: string;
  directory?: string;
}

interface PromptResponse {
  info?: {
    role: string;
    tokens?: {
      total?: number;
      input?: number;
      output?: number;
    };
  };
  parts?: Array<{
    type: string;
    text?: string;
    [key: string]: any;
  }>;
  sessionID?: string;
}

interface MessagesResponse {
  messages?: ConversationMessage[];
}

interface ListSessionsResponse {
  sessions?: any[];
  data?: any[];
}

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

export interface OpenCodeHttpAdapterEvents {
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
// OpenCodeHttpAdapter
// ============================================

export class OpenCodeHttpAdapter extends EventEmitter<OpenCodeHttpAdapterEvents> {
  private tenantManager: TenantManager;
  private workspaceManager: WorkspaceManager;
  private axiosClient: AxiosInstance;
  private serverUrl: string;
  private serverReady: boolean = false;

  // Sesiones activas por tenant
  private activeSessions: Map<string, string> = new Map();

  constructor(
    tenantManager?: TenantManager,
    workspaceManager?: WorkspaceManager
  ) {
    super();
    this.tenantManager = tenantManager || new TenantManager();
    this.workspaceManager = workspaceManager || new WorkspaceManager();

    // URL del servidor HTTP de OpenCode
    // El servidor de OpenCode usa las rutas directamente (ej: /session, no /api/sessions)
    this.serverUrl = process.env.OPENCODE_SERVER_URL || 'http://localhost:4096';

    this.axiosClient = axios.create({
      baseURL: this.serverUrl,
      timeout: 600000, // 10 minutos default
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }

  /**
   * Verifica que el servidor de OpenCode esté disponible
   */
  private async ensureServerReady(): Promise<void> {
    if (this.serverReady) {
      return;
    }

    try {
      // Health check - El servidor tiene endpoint /status
      const response = await this.axiosClient.get('/session/status');
      if (response.status === 200) {
        this.serverReady = true;
        console.log('[OpenCodeHttpAdapter] ✅ Servidor OpenCode listo en', this.serverUrl);
        return;
      }
    } catch (error) {
      const err = error as Error;
      console.error('[OpenCodeHttpAdapter] ❌ Servidor OpenCode no disponible:', err.message);
      throw new Error(
        `OpenCode server not available at ${this.serverUrl}. ` +
        `Start the OpenCode server with: cd packages/opencode-fork/packages/opencode && bun run src/server/server.ts`
      );
    }
  }

  /**
   * Ejecuta una tarea usando el servidor HTTP de OpenCode
   */
  async execute(
    prompt: string,
    context: ExecutionContext
  ): Promise<ExecutionResult> {
    const startTime = Date.now();
    const messages: ConversationMessage[] = [];
    const toolsUsed: ToolExecution[] = [];

    try {
      await this.ensureServerReady();

      // 1. Validar contexto
      if (!context.tenantId || !context.taskId) {
        throw new Error('tenantId y taskId son requeridos');
      }

      // 2. Obtener configuración del tenant
      const config = await this.tenantManager.getConfig(context.tenantId);
      if (!config) {
        throw new Error(`Tenant ${context.tenantId} not configured`);
      }

      // 3. Asegurar workspace
      const workspacePath = context.workspacePath ||
        this.workspaceManager.ensureWorkspace(context.tenantId);

      // 4. Emitir mensaje del usuario
      const userMessage: ConversationMessage = {
        role: 'user',
        content: prompt,
        timestamp: new Date().toISOString(),
      };
      messages.push(userMessage);
      this.emit('message', userMessage);

      // 5. Obtener o crear sesión
      let sessionId: string;
      // Solo usar sessionID del contexto si tiene el formato correcto (empieza con "ses_")
      if (context.sessionId && context.sessionId.startsWith('ses_')) {
        sessionId = context.sessionId;
      } else if (this.activeSessions.has(context.tenantId)) {
        sessionId = this.activeSessions.get(context.tenantId)!;
      } else {
        // Crear nueva sesión vía HTTP
        // POST /session - Crear sesión
        const response = await this.axiosClient.post<CreateSessionResponse>('/session', {
          title: `${context.tenantId} - ${new Date().toISOString()}`,
          directory: workspacePath,
        });
        sessionId = response.data?.sessionID || response.data?.id || '';
        if (!sessionId) {
          throw new Error('Failed to create session: no session ID returned');
        }
        this.activeSessions.set(context.tenantId, sessionId);
      }

      // 6. Ejecutar el prompt vía HTTP
      // POST /session/:sessionID/message - Enviar prompt (endpoint correcto de OpenCode)
      // NOTA: Este endpoint usa streaming en el servidor Bun, así que usamos fetch
      // en lugar de axios porque axios no maneja streams correctamente
      const agent = (config as any).agent || 'build';

      // Estructura correcta según SessionPrompt.PromptInput
      // Por ahora, no enviamos model para usar los defaults del servidor
      const requestBody: any = {
        parts: [{ type: 'text', text: prompt }],
      };

      // Opcionalmente agregar agent si es diferente al default
      if (agent !== 'build') {
        requestBody.agent = agent;
      }

      console.log('[OpenCodeHttpAdapter] Sending prompt to session:', sessionId);
      console.log('[OpenCodeHttpAdapter] Request body:', JSON.stringify(requestBody).substring(0, 200));

      // Usar fetch en lugar de axios para manejar el stream del servidor Bun
      const fetchResponse = await fetch(`${this.serverUrl}/session/${sessionId}/message`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      if (!fetchResponse.ok) {
        const errorText = await fetchResponse.text();
        throw new Error(`OpenCode server error: ${fetchResponse.status} - ${errorText}`);
      }

      // Leer el stream completo (el servidor escribe un JSON completo, no SSE incremental)
      const responseText = await fetchResponse.text();

      // 7. Procesar resultado
      // La estructura de respuesta es: { info: {...}, parts: [...] }
      const data: PromptResponse = JSON.parse(responseText);

      // Extraer contenido de los parts tipo 'text'
      let content = '';
      if (data.parts && Array.isArray(data.parts)) {
        const textParts = data.parts.filter((p: any) => p.type === 'text');
        content = textParts.map((p: any) => p.text || '').join('\n');

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
        sessionId,
        tokensUsed: data.info?.tokens?.total || 0,
        executionTime,
        toolsUsed,
        messages,
      };

    } catch (error) {
      const executionTime = Date.now() - startTime;
      const err = error as Error;
      const errorMessage = err.message || 'Unknown error';

      this.emit('error', err);

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
    await this.ensureServerReady();
    const response = await this.axiosClient.get<MessagesResponse>(`/session/${sessionId}/message`);
    return response.data?.messages || [];
  }

  /**
   * Lista las sesiones de un tenant
   */
  async listSessions(tenantId: string): Promise<any[]> {
    await this.ensureServerReady();
    const workspacePath = this.workspaceManager.ensureWorkspace(tenantId);
    const response = await this.axiosClient.get<ListSessionsResponse>('/session', {
      params: { directory: workspacePath }
    });
    return response.data?.sessions || response.data?.data || (Array.isArray(response.data) ? response.data : []);
  }

  /**
   * Elimina una sesión
   */
  async deleteSession(sessionId: string, tenantId: string): Promise<void> {
    await this.ensureServerReady();
    await this.axiosClient.delete(`/session/${sessionId}`);
    this.activeSessions.delete(tenantId);
  }

  /**
   * Limpia recursos
   */
  async cleanup(): Promise<void> {
    this.activeSessions.clear();
    this.removeAllListeners();
  }

  /**
   * Cancela una ejecución
   */
  async cancelExecution(taskId: string): Promise<void> {
    // TODO: Implementar cancelación vía HTTP
    console.log(`[OpenCodeHttpAdapter] Cancel execution requested for task ${taskId}`);
  }
}
