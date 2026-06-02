/**
 * Accomplish Client - Cliente API para el modo FULL
 *
 * Maneja la comunicación con el backend de accomplish
 */

import { fetchEventSource } from '@microsoft/fetch-event-source';

// ============================================
// Types
// ============================================

export type TaskStatus = 'QUEUED' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';

export type FileType = 'USER' | 'TASK' | 'TEMP';

export interface Task {
  id: string;
  tenantId: string;
  prompt: string;
  status: TaskStatus;
  sessionId?: string;
  messages: TaskMessage[];
  result?: any;
  error?: string;
  workspacePath?: string;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
}

export interface TaskMessage {
  id: string;
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  timestamp: string;
  metadata?: any;
}

export interface TaskHistoryResponse {
  tasks: Task[];
  total: number;
  page: number;
  pageSize: number;
}

export interface WorkspaceUsage {
  tenantId: string;
  used: number;
  quota: number;
  percentUsed: number;
  userFiles: number;
  tasks: number;
  temp: number;
}

export interface WorkspaceFile {
  id: string;
  tenantId: string;
  taskId?: string;
  type: FileType;
  path: string;
  name: string;
  size: number;
  expiresAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateTaskRequest {
  prompt: string;
  sessionId?: string;
}

export interface FollowUpRequest {
  message: string;
}

export interface PermissionRequest {
  id: string;
  taskId: string;
  type: 'tool' | 'question' | 'custom';
  toolName?: string;
  description: string;
  options?: string[];
  timeout: number;
  createdAt: string;
}

export interface PermissionResponse {
  decision: 'allow' | 'deny';
  options?: string[];
  customResponse?: string;
}

// ============================================
// AccomplishClient
// ============================================

export class AccomplishClient {
  private baseUrl: string;
  private tenant: string;
  private getAuthHeaders: () => Record<string, string>;

  constructor(
    tenant: string,
    getAuthHeaders: () => Record<string, string> = () => ({})
  ) {
    this.tenant = tenant;
    this.getAuthHeaders = getAuthHeaders;
    this.baseUrl = process.env.NEXT_PUBLIC_API_URL || '';
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    // Usar el tenant dinámicamente desde el contexto
    const url = `${this.baseUrl}/api/v1/${this.tenant}/accomplish${endpoint}`;
    const headers = {
      'Content-Type': 'application/json',
      ...this.getAuthHeaders(),
      ...options.headers,
    };

    const response = await fetch(url, { ...options, headers });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(error.error || error.message || 'Request failed');
    }

    return response.json();
  }

  /**
   * Crea una nueva tarea
   */
  async createTask(request: CreateTaskRequest): Promise<Task> {
    return this.request<Task>('/tasks', {
      method: 'POST',
      body: JSON.stringify(request),
    });
  }

  /**
   * Obtiene una tarea por ID
   */
  async getTask(taskId: string): Promise<Task> {
    return this.request<Task>(`/tasks/${taskId}`);
  }

  /**
   * Envía un follow-up a una tarea
   */
  async sendFollowUp(taskId: string, request: FollowUpRequest): Promise<Task> {
    return this.request<Task>(`/tasks/${taskId}/followup`, {
      method: 'POST',
      body: JSON.stringify(request),
    });
  }

  /**
   * Cancela una tarea
   */
  async cancelTask(taskId: string): Promise<{ success: boolean; message: string }> {
    return this.request(`/tasks/${taskId}`, {
      method: 'DELETE',
    });
  }

  /**
   * Obtiene el historial de tareas
   */
  async getHistory(params?: {
    page?: number;
    pageSize?: number;
    status?: TaskStatus;
    fromDate?: string;
    toDate?: string;
  }): Promise<TaskHistoryResponse> {
    const queryParams = new URLSearchParams();
    if (params?.page) queryParams.set('page', params.page.toString());
    if (params?.pageSize) queryParams.set('pageSize', params.pageSize.toString());
    if (params?.status) queryParams.set('status', params.status);
    if (params?.fromDate) queryParams.set('fromDate', params.fromDate);
    if (params?.toDate) queryParams.set('toDate', params.toDate);

    const query = queryParams.toString();
    return this.request<TaskHistoryResponse>(`/history${query ? `?${query}` : ''}`);
  }

  /**
   * Obtiene el detalle de una tarea del historial
   */
  async getHistoryDetail(taskId: string): Promise<Task> {
    return this.request<Task>(`/history/${taskId}`);
  }

  /**
   * Responde a una solicitud de permiso
   */
  async respondToPermission(
    requestId: string,
    response: PermissionResponse
  ): Promise<{ success: boolean; message: string }> {
    return this.request(`/permissions/${requestId}/respond`, {
      method: 'POST',
      body: JSON.stringify(response),
    });
  }

  /**
   * Obtiene la configuración de permisos
   */
  async getPermissionsConfig(): Promise<any> {
    return this.request('/permissions/config');
  }

  /**
   * Actualiza la configuración de permisos
   */
  async updatePermissionsConfig(config: any): Promise<{ success: boolean; message: string }> {
    return this.request('/permissions/config', {
      method: 'PUT',
      body: JSON.stringify(config),
    });
  }

  /**
   * Obtiene el uso de workspace
   */
  async getWorkspaceUsage(): Promise<WorkspaceUsage> {
    return this.request<WorkspaceUsage>('/workspace/usage');
  }

  /**
   * Lista archivos del workspace
   */
  async listWorkspaceFiles(params?: {
    type?: FileType;
    search?: string;
  }): Promise<{ files: WorkspaceFile[]; count: number }> {
    const queryParams = new URLSearchParams();
    if (params?.type) queryParams.set('type', params.type);
    if (params?.search) queryParams.set('search', params.search);

    const query = queryParams.toString();
    return this.request(`/workspace/files${query ? `?${query}` : ''}`);
  }

  /**
   * Elimina un archivo del workspace
   */
  async deleteWorkspaceFile(fileId: string): Promise<{ success: boolean; message: string }> {
    return this.request(`/workspace/files/${fileId}`, {
      method: 'DELETE',
    });
  }

  /**
   * Fuerza la limpieza de workspace
   */
  async forceCleanup(): Promise<{ success: boolean; message: string; result?: any }> {
    return this.request('/workspace/cleanup', {
      method: 'POST',
    });
  }

  /**
   * Suscribe a eventos SSE de una tarea
   */
  subscribeToTask(
    taskId: string,
    callbacks: {
      onConnected?: () => void;
      onMessage?: (msg: TaskMessage) => void;
      onTool?: (tool: string, input: any) => void;
      onPermission?: (request: PermissionRequest) => void;
      onProgress?: (step: string, progress: number, details?: string) => void;
      onComplete?: (result: any) => void;
      onError?: (error: string) => void;
    }
  ): () => void {
    const url = `${this.baseUrl}/api/v1/${this.tenant}/accomplish/tasks/${taskId}/events`;
    const headers = this.getAuthHeaders();

    const abortController = new AbortController();

    fetchEventSource(url, {
      method: 'GET',
      headers: {
        ...headers,
        'Accept': 'text/event-stream',
      },
      signal: abortController.signal,

      onopen: async () => {
        callbacks.onConnected?.();
      },

      onmessage: (event) => {
        if (event.data === '[DONE]') return;

        try {
          const data = JSON.parse(event.data);

          switch (data.type) {
            case 'connected':
              callbacks.onConnected?.();
              break;

            case 'message':
              callbacks.onMessage?.(data.data);
              break;

            case 'tool':
              callbacks.onTool?.(data.data.toolName, data.data.input);
              break;

            case 'permission':
              callbacks.onPermission?.(data.data);
              break;

            case 'progress':
              callbacks.onProgress?.(data.data.step, data.data.progress, data.data.details);
              break;

            case 'complete':
              callbacks.onComplete?.(data.data.result);
              break;

            case 'error':
              callbacks.onError?.(data.data.error);
              break;

            case 'started':
              callbacks.onProgress?.('started', 0, 'Tarea iniciada');
              break;

            case 'cancelled':
              callbacks.onComplete?.({ cancelled: true });
              break;

            case 'failed':
              callbacks.onError?.(data.data.error || 'Task failed');
              break;
          }
        } catch (error) {
          console.error('Error parsing SSE message:', error);
        }
      },

      onerror: (error) => {
        console.error('SSE error:', error);
        callbacks.onError?.(error?.message || 'Connection error');
        abortController.abort();
      },
    });

    // Return cleanup function
    return () => abortController.abort();
  }

  /**
   * Re-ejecuta una tarea existente
   */
  async reExecuteTask(taskId: string): Promise<Task> {
    return this.request<Task>(`/tasks/${taskId}/reexecute`, {
      method: 'POST',
    });
  }

  /**
   * Elimina una tarea
   */
  async deleteTask(taskId: string): Promise<{ success: boolean; message: string }> {
    return this.request(`/tasks/${taskId}`, {
      method: 'DELETE',
    });
  }

  /**
   * Obtiene los resultados de una tarea
   */
  async getTaskResults(taskId: string): Promise<{
    taskId: string;
    prompt: string;
    status: string;
    messages: TaskMessage[];
    result: any;
    createdAt: string;
    completedAt?: string;
    workspaceFiles?: WorkspaceFile[];
  }> {
    return this.request(`/tasks/${taskId}/results`);
  }

  /**
   * Exporta los resultados de una tarea
   */
  async exportTaskResults(taskId: string): Promise<void> {
    const url = `${this.baseUrl}/api/v1/${this.tenant}/accomplish/tasks/${taskId}/export`;
    const headers = {
      ...this.getAuthHeaders(),
    };

    const response = await fetch(url, { headers });

    if (!response.ok) {
      throw new Error('Error exporting task results');
    }

    // Obtener el filename del header
    const contentDisposition = response.headers.get('Content-Disposition');
    let filename = `task-${taskId}.json`;
    if (contentDisposition) {
      const match = contentDisposition.match(/filename="(.+)"/);
      if (match) {
        filename = match[1];
      }
    }

    // Descargar el blob
    const blob = await response.blob();
    const url_blob = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url_blob;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url_blob);
    document.body.removeChild(a);
  }
}

// ============================================
// Helper function to create client
// ============================================

export function createAccomplishClient(
  tenant: string,
  getAuthHeaders?: () => Record<string, string>
): AccomplishClient {
  return new AccomplishClient(tenant, getAuthHeaders);
}
