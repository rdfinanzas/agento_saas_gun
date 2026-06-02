/**
 * Task Store - Estado global para accomplish usando Zustand
 *
 * Maneja el estado de tareas, mensajes, permisos y loading
 */

import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import {
  AccomplishClient,
  Task,
  TaskMessage,
  PermissionRequest,
  CreateTaskRequest,
  FollowUpRequest,
} from '@/lib/accomplish-client';
import { useStreamingStore, ConnectionState } from './streamingStore';

// ============================================
// Set GLOBAL para tracking de mensajes procesados
// ============================================

const processedMessageIds = new Set<string>();

// ============================================
// Types
// ============================================

interface ActiveTool {
  id: string;
  name: string;
  status: 'running' | 'completed' | 'failed';
  progress?: number;
  details?: string;
  startTime: Date;
}

// Función para limpiar el Set (al crear nueva tarea)
function clearProcessedIds() {
  processedMessageIds.clear();
  console.log('[taskStore] 🧹 Set de IDs procesados limpiado');
}

// ============================================
// Función de suscripción simple con protección contra duplicados
// ============================================

function subscribeToStreamingEvents(set: any, get: any) {
  console.log('[taskStore] Creando suscripción a streamingStore');

  const unsubscribe = useStreamingStore.subscribe(
    (state) => {
      // Evitar procesamiento simultáneo
      // SIN flag isProcessing - procesar de forma sincrónica
      const messages = state.messageBuffer;
      const lastMessage = messages[messages.length - 1];
      if (!lastMessage) return;

      // Verificar duplicado con Set GLOBAL
      if (processedMessageIds.has(lastMessage.id)) {
        console.log('[taskStore] ⚠️ Mensaje duplicado, saltando:', lastMessage.id);
        return;
      }

      // Marcar como procesado ANTES de procesar
      processedMessageIds.add(lastMessage.id);

      console.log('[taskStore] ✅ Procesando mensaje NUEVO:', lastMessage.id, 'tipo:', lastMessage.type);

      // Procesar de forma SINCRONA (sin setTimeout) - evitar bloqueos
      switch (lastMessage.type) {
        case 'message':
          // Filtrar mensajes de progreso que no deben mostrarse en el chat
          // PERO SIEMPRE mostrar mensajes del usuario
          const content = lastMessage.data.content || '';
          const role = lastMessage.data.role || '';

          console.log('[taskStore] 🔍 Mensaje recibido:', { role, content: content.substring(0, 50), id: lastMessage.id });

          const skipPatterns = [
            'Iniciando ejecución en modo FULL',
            'Entendido. Voy a procesar tu solicitud',
            'Ejecutando tarea',
          ];

          // NO filtrar mensajes del usuario
          const shouldSkip = role !== 'user' && skipPatterns.some(pattern => content.includes(pattern));

          if (!shouldSkip) {
            console.log('[taskStore] 💬 Mensaje agregado al chat:', role, content.substring(0, 50));
            console.log('[taskStore] 📊 Mensajes antes:', get().messages.length, 'después:', get().messages.length + 1);
            set((state: any) => ({
              messages: [...state.messages, lastMessage.data],
            }));
            console.log('[taskStore] ✅ Mensaje agregado, total:', get().messages.length);
          } else {
            console.log('[taskStore] 🔄 Mensaje de progreso filtrado:', content);
          }
          break;

        case 'tool':
          console.log('[taskStore] 🔧 Herramienta ejecutándose:', lastMessage.data.toolName);

          // Extraer información de la herramienta
          const toolName = lastMessage.data.toolName || 'Herramienta';
          const toolStatus = lastMessage.data.status || 'started';
          const toolInput = lastMessage.data.input;
          const toolOutput = lastMessage.data.output;
          const duration = lastMessage.data.duration;

          // Crear ID único para la herramienta basado en su nombre
          const toolId = `tool-${toolName.replace(/\s+/g, '-').toLowerCase()}`;

          // Determinar estado y detalles
          let status: 'running' | 'completed' | 'failed' = 'running';
          let details = `Ejecutando ${toolName}...`;
          let progress: number | undefined = undefined;

          if (toolStatus === 'completed') {
            status = 'completed';
            details = `${toolName} completado${duration ? ` (${duration}ms)` : ''}`;
          } else if (toolStatus === 'failed') {
            status = 'failed';
            details = `${toolName} falló`;
          } else {
            // Estado 'started' o por defecto
            if (toolInput) {
              details = `${toolName}: ${JSON.stringify(toolInput).substring(0, 50)}...`;
            }
          }

          // Actualizar activeTools
          set((state: any) => {
            const existingToolIndex = state.activeTools.findIndex((t: ActiveTool) => t.id === toolId);

            if (status === 'running' && existingToolIndex === -1) {
              // Nueva herramienta en ejecución - agregar al inicio
              return {
                activeTools: [
                  {
                    id: toolId,
                    name: toolName,
                    status,
                    details,
                    progress,
                    startTime: new Date(),
                  },
                  ...state.activeTools,
                ],
              };
            } else if (existingToolIndex !== -1) {
              // Actualizar herramienta existente
              const updatedTools = [...state.activeTools];
              updatedTools[existingToolIndex] = {
                ...updatedTools[existingToolIndex],
                status,
                details,
                progress,
              };
              return { activeTools: updatedTools };
            }

            return {};
          });
          break;

        case 'permission':
          console.log('[taskStore] 🔐 Solicitud de permiso recibida');
          set({ permissionRequest: lastMessage.data });
          break;

        case 'progress':
          console.log('[taskStore] 📊 Progreso recibido:', lastMessage.data);

          // Extraer información de progreso
          const step = lastMessage.data.step || 'Procesando...';
          const stepProgress = lastMessage.data.progress || 0;
          const progressDetails = lastMessage.data.details;

          // Agregar o actualizar herramienta de progreso genérica
          const progressToolId = 'agent-progress';

          set((state: any) => {
            const existingToolIndex = state.activeTools.findIndex((t: ActiveTool) => t.id === progressToolId);

            if (existingToolIndex !== -1) {
              // Actualizar progreso existente
              const updatedTools = [...state.activeTools];
              updatedTools[existingToolIndex] = {
                ...updatedTools[existingToolIndex],
                progress: stepProgress,
                details: progressDetails || step,
              };
              return { activeTools: updatedTools };
            } else {
              // Crear nueva herramienta de progreso si no existe
              return {
                activeTools: [
                  {
                    id: progressToolId,
                    name: 'Agente de IA',
                    status: 'running',
                    details: progressDetails || step,
                    progress: stepProgress,
                    startTime: new Date(),
                  },
                  ...state.activeTools,
                ],
              };
            }
          });
          break;

        case 'complete':
          console.log('[taskStore] Task completed');
          const completeMessages = lastMessage.data.messages || [];
          const assistantMessages = completeMessages.filter((m: any) => m.role === 'assistant');
          set((state: any) => ({
            currentTask: state.currentTask ? {
              ...state.currentTask,
              result: lastMessage.data.result,
              messages: completeMessages,
              status: 'COMPLETED',
            } : null,
            messages: [...state.messages, ...assistantMessages],
            isProcessing: false,
          }));
          break;

        case 'error':
          console.log('[taskStore] ❌ Error recibido:', lastMessage.data.error);
          set({
            error: lastMessage.data.error,
            isProcessing: false,
          });
          break;
      }
    }
  );

  return unsubscribe;
}

// ============================================
// Store State
// ============================================

interface AccomplishState {
  // Estado actual
  currentTask: Task | null;
  messages: TaskMessage[];
  isLoading: boolean;
  isProcessing: boolean;
  permissionRequest: PermissionRequest | null;

  // Herramientas activas (para el área roja de progreso)
  activeTools: ActiveTool[];

  // Errores
  error: string | null;

  // SSE connection
  isConnected: boolean;
  unsubscribe: (() => void) | null;

  // Cliente
  client: AccomplishClient | null;
}

// ============================================
// Store Actions
// ============================================

interface AccomplishActions {
  // Inicialización
  initClient: (tenant: string, getAuthHeaders: () => Record<string, string>) => void;

  // Gestión de tareas
  createTask: (request: CreateTaskRequest) => Promise<void>;
  getTask: (taskId: string) => Promise<Task>;
  loadTask: (taskId: string) => Promise<void>;
  followUp: (message: string) => Promise<void>;
  cancelTask: () => Promise<void>;

  // Gestión de permisos
  respondToPermission: (decision: 'allow' | 'deny', options?: string[], customResponse?: string) => Promise<void>;

  // Gestión de estado
  clearCurrentTask: () => void;
  clearError: () => void;
  clearPermissionRequest: () => void;

  // Event handlers
  handleTaskEvent: (event: any) => void;
}

// ============================================
// Combined Store
// ============================================

type AccomplishStore = AccomplishState & AccomplishActions;

export const useAccomplishStore = create<AccomplishStore>()(
  devtools(
    persist(
      (set, get) => ({
        // Estado inicial
        currentTask: null,
        messages: [],
        isLoading: false,
        isProcessing: false,
        permissionRequest: null,
        activeTools: [],
        error: null,
        isConnected: false,
        unsubscribe: null,
        client: null,

        // Inicializar cliente
        initClient: (tenant, getAuthHeaders) => {
          const client = new AccomplishClient(tenant, getAuthHeaders);
          set({ client });
        },

        // Crear tarea
        createTask: async (request) => {
          const { client, unsubscribe } = get();

          if (!client) {
            set({ error: 'Cliente no inicializado' });
            return;
          }

          // Limpiar estado anterior
          if (unsubscribe) {
            console.log('[taskStore] Limpiando suscripción anterior');
            unsubscribe();
          }

          // RESET completo del streamingStore (limpia buffer de sesiones anteriores)
          useStreamingStore.getState().reset();

          // Limpiar Set global de IDs procesados
          clearProcessedIds();

          set({
            isLoading: true,
            isProcessing: true,
            error: null,
            messages: [],
            permissionRequest: null,
            activeTools: [], // Limpiar herramientas activas al crear nueva tarea
          });

          try {
            const task = await client.createTask(request);

            set({ currentTask: task, isLoading: false });

            // Suscribirse a eventos SSE usando streamingStore
            const baseUrl = process.env.NEXT_PUBLIC_API_URL || '';
            const headers = client['getAuthHeaders'] ? client['getAuthHeaders']() : {};

            useStreamingStore.getState().connect({
              url: `${baseUrl}/api/v1/${client['tenant']}/accomplish/tasks/${task.id}/events`,
              headers,
              reconnectInterval: 2000,
              maxReconnectAttempts: 10,
              backoffMultiplier: 1.5,
            });

            // Crear suscripción a eventos SSE
            const unsubscribeStreaming = subscribeToStreamingEvents(set, get);

            set({
              unsubscribe: () => {
                unsubscribeStreaming();
                useStreamingStore.getState().disconnect();
              }
            });
          } catch (error) {
            set({
              error: error instanceof Error ? error.message : 'Error al crear tarea',
              isLoading: false,
              isProcessing: false,
            });
          }
        },

        // Obtener tarea
        getTask: async (taskId) => {
          const { client } = get();

          if (!client) {
            set({ error: 'Cliente no inicializado' });
            throw new Error('Cliente no inicializado');
          }

          try {
            const task = await client.getTask(taskId);
            set({ currentTask: task, messages: task.messages || [] });
            return task;
          } catch (error) {
            const errorMsg = error instanceof Error ? error.message : 'Error al obtener tarea';
            set({ error: errorMsg });
            throw error;
          }
        },

        // Cargar tarea existente (desde historial)
        loadTask: async (taskId) => {
          const { client, unsubscribe } = get();

          if (!client) {
            set({ error: 'Cliente no inicializado' });
            throw new Error('Cliente no inicializado');
          }

          // Limpiar suscripción anterior
          if (unsubscribe) {
            console.log('[taskStore] Limpiando suscripción anterior al cargar tarea');
            unsubscribe();
          }

          // RESET completo del streamingStore (limpia buffer de sesiones anteriores)
          useStreamingStore.getState().reset();

          // Limpiar Set global de IDs procesados
          clearProcessedIds();

          set({
            isLoading: true,
            isProcessing: false,
            error: null,
            messages: [],
            permissionRequest: null,
            activeTools: [], // Limpiar herramientas activas al cargar tarea
          });

          try {
            const task = await client.getTask(taskId);

            set({
              currentTask: task,
              messages: task.messages || [],
              isLoading: false,
            });

            // Si la tarea está completada, no crear suscripción
            if (task.status === 'COMPLETED' || task.status === 'FAILED' || task.status === 'CANCELLED') {
              console.log('[taskStore] Tarea completada/fallida, no se crea suscripción SSE');
              return;
            }

            // Crear suscripción SSE para seguir recibiendo actualizaciones
            const baseUrl = process.env.NEXT_PUBLIC_API_URL || '';
            const headers = client['getAuthHeaders'] ? client['getAuthHeaders']() : {};

            useStreamingStore.getState().connect({
              url: `${baseUrl}/api/v1/${client['tenant']}/accomplish/tasks/${task.id}/events`,
              headers,
              reconnectInterval: 2000,
              maxReconnectAttempts: 10,
              backoffMultiplier: 1.5,
            });

            // Crear suscripción a eventos SSE
            const unsubscribeStreaming = subscribeToStreamingEvents(set, get);

            set({
              unsubscribe: () => {
                unsubscribeStreaming();
                useStreamingStore.getState().disconnect();
              }
            });
          } catch (error) {
            const errorMsg = error instanceof Error ? error.message : 'Error al cargar tarea';
            set({ error: errorMsg, isLoading: false });
            throw error;
          }
        },

        // Follow-up
        followUp: async (message) => {
          const { client, currentTask, unsubscribe } = get();

          if (!client || !currentTask) {
            set({ error: 'No hay tarea activa' });
            return;
          }

          // Limpiar suscripción anterior
          if (unsubscribe) {
            console.log('[taskStore] Limpiando suscripción anterior en followUp');
            unsubscribe();
          }

          // Desconectar streaming anterior
          useStreamingStore.getState().disconnect();

          // NO limpiar el Set global para mantener el historial
          // pero limpiamos al crear una NUEVA tarea

          set({
            isProcessing: true,
            error: null,
          });

          // NO agregar el mensaje de usuario localmente
          // El backend lo enviará vía SSE y se mostrará cuando llegue
          // Esto evita duplicación

          try {
            const updatedTask = await client.sendFollowUp(currentTask.id, { message });

            set({ currentTask: updatedTask });

            // Usar streamingStore para SSE (igual que en createTask)
            const baseUrl = process.env.NEXT_PUBLIC_API_URL || '';
            const headers = client['getAuthHeaders'] ? client['getAuthHeaders']() : {};

            useStreamingStore.getState().connect({
              url: `${baseUrl}/api/v1/${client['tenant']}/accomplish/tasks/${currentTask.id}/events`,
              headers,
              reconnectInterval: 2000,
              maxReconnectAttempts: 10,
              backoffMultiplier: 1.5,
            });

            // Crear suscripción a eventos SSE
            const unsubscribeStreaming = subscribeToStreamingEvents(set, get);

            set({
              unsubscribe: () => {
                unsubscribeStreaming();
                useStreamingStore.getState().disconnect();
              }
            });
          } catch (error) {
            set({
              error: error instanceof Error ? error.message : 'Error al enviar follow-up',
              isProcessing: false,
            });
          }
        },

        // Cancelar tarea
        cancelTask: async () => {
          const { client, currentTask, unsubscribe } = get();

          if (!client || !currentTask) {
            set({ error: 'No hay tarea activa' });
            return;
          }

          try {
            await client.cancelTask(currentTask.id);

            // Limpiar suscripción
            if (unsubscribe) {
              unsubscribe();
            }

            set({
              currentTask: { ...currentTask, status: 'CANCELLED' },
              isProcessing: false,
              isConnected: false,
              unsubscribe: null,
            });
          } catch (error) {
            set({
              error: error instanceof Error ? error.message : 'Error al cancelar tarea',
            });
          }
        },

        // Responder a permiso
        respondToPermission: async (decision, options, customResponse) => {
          const { client, permissionRequest } = get();

          if (!client || !permissionRequest) {
            return;
          }

          try {
            await client.respondToPermission(permissionRequest.id, {
              decision,
              options,
              customResponse,
            });

            set({ permissionRequest: null });
          } catch (error) {
            set({
              error: error instanceof Error ? error.message : 'Error al responder permiso',
            });
          }
        },

        // Limpiar tarea actual
        clearCurrentTask: () => {
          const { unsubscribe } = get();

          console.log('[taskStore] clearCurrentTask - Iniciando limpieza completa');

          // RESET completo del streamingStore (incluye buffer)
          useStreamingStore.getState().reset();

          // Limpiar suscripción si existe
          if (unsubscribe) {
            unsubscribe();
          }

          // Limpiar Set global de IDs procesados
          clearProcessedIds();

          console.log('[taskStore] clearCurrentTask - Limpieza completada, buffer limpiado');

          set({
            currentTask: null,
            messages: [],
            isLoading: false,
            isProcessing: false,
            permissionRequest: null,
            activeTools: [], // Limpiar herramientas activas
            error: null,
            isConnected: false,
            unsubscribe: null,
          });
        },

        // Limpiar error
        clearError: () => {
          set({ error: null });
        },

        // Limpiar solicitud de permiso
        clearPermissionRequest: () => {
          set({ permissionRequest: null });
        },

        // Manejar evento de tarea
        handleTaskEvent: (event) => {
          console.log('Task event:', event);
          // Este método puede usarse para manejar eventos externos
        },
      }),
      {
        name: 'accomplish-storage',
        partialize: (state) => ({
          // Solo persistir ciertos campos
          currentTask: state.currentTask,
          messages: state.messages,
        }),
      }
    )
  )
);
