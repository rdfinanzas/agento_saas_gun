/**
 * StreamingStore - Store para conexiones SSE con reconexión automática
 *
 * Maneja conexiones SSE, reconexión automática y buffer de mensajes
 */

import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { fetchEventSource, FetchEventSourceInit } from '@microsoft/fetch-event-source';

// ============================================
// Types
// ============================================

export type ConnectionState =
  | 'disconnected'
  | 'connecting'
  | 'connected'
  | 'reconnecting'
  | 'error';

export interface StreamMessage {
  id: string;
  type: 'message' | 'tool' | 'permission' | 'progress' | 'complete' | 'error';
  data: any;
  timestamp: Date;
}

interface ConnectionConfig {
  url: string;
  headers?: Record<string, string>;
  reconnectInterval?: number;
  maxReconnectAttempts?: number;
  backoffMultiplier?: number;
}

// ============================================
// Store State
// ============================================

interface StreamingState {
  // Estado de conexión
  connectionState: ConnectionState;
  connectedAt: Date | null;
  lastError: string | null;
  reconnectAttempts: number;

  // Buffer de mensajes (para reconexión)
  messageBuffer: StreamMessage[];
  maxBufferSize: number;

  // Control de reconexión
  autoReconnect: boolean;
  abortController: AbortController | null;

  // Estadísticas
  messagesReceived: number;
  bytesReceived: number;

  // URL y configuración
  currentUrl: string | null;
  currentConfig: ConnectionConfig | null;
}

// ============================================
// Store Actions
// ============================================

interface StreamingActions {
  // Gestión de conexión
  connect: (config: ConnectionConfig) => Promise<void>;
  disconnect: () => void;

  // Reconexión
  reconnect: () => Promise<void>;
  setAutoReconnect: (enabled: boolean) => void;

  // Manejo de mensajes
  addMessage: (message: StreamMessage) => void;
  clearBuffer: () => void;

  // Reset
  reset: () => void;
}

// ============================================
// Combined Store
// ============================================

type StreamingStore = StreamingState & StreamingActions;

export const useStreamingStore = create<StreamingStore>()(
  devtools(
    (set, get) => ({
      // Estado inicial
      connectionState: 'disconnected',
      connectedAt: null,
      lastError: null,
      reconnectAttempts: 0,
      messageBuffer: [],
      maxBufferSize: 1000,
      autoReconnect: true,
      abortController: null,
      messagesReceived: 0,
      bytesReceived: 0,
      currentUrl: null,
      currentConfig: null,

      // Conectar a endpoint SSE
      connect: async (config: ConnectionConfig) => {
        const { disconnect } = get();

        // Desconectar conexión existente
        disconnect();

        set({
          connectionState: 'connecting',
          currentUrl: config.url,
          currentConfig: config,
          lastError: null,
        });

        const abortController = new AbortController();
        set({ abortController });

        try {
          await fetchEventSource(config.url, {
            method: 'GET',
            headers: config.headers || {},
            signal: abortController.signal,

            onopen: async () => {
              set({
                connectionState: 'connected',
                connectedAt: new Date(),
                reconnectAttempts: 0,
              });
            },

            onmessage: (event) => {
              // Ignore SSE comments (keepalive)
              if (!event.data || event.data.trim() === '' || event.data === '[DONE]') {
                return;
              }

              console.log('[SSE] Received event:', event.data);

              try {
                const data = JSON.parse(event.data);

                const message: StreamMessage = {
                  id: `msg-${Date.now()}-${Math.random()}`,
                  type: data.type,
                  data: data.data,
                  timestamp: new Date(),
                };

                // Agregar al buffer
                get().addMessage(message);

                // Actualizar estadísticas
                set((state) => ({
                  messagesReceived: state.messagesReceived + 1,
                  bytesReceived: state.bytesReceived + event.data.length,
                }));

                // Manejar eventos específicos
                if (data.type === 'disconnected') {
                  set({ connectionState: 'disconnected' });
                }

                if (data.type === 'error') {
                  set({
                    lastError: data.data.error || 'Unknown error',
                    connectionState: 'error',
                  });

                  // Intentar reconectar si está habilitado
                  if (get().autoReconnect) {
                    setTimeout(() => get().reconnect(), 1000);
                  }
                }
              } catch (error) {
                console.error('Error parsing SSE message:', error);
              }
            },

            onerror: (error) => {
              console.error('SSE error:', error);

              set({
                lastError: error?.message || 'Connection error',
                connectionState: 'error',
              });

              // Reconectar si está habilitado
              if (get().autoReconnect) {
                setTimeout(() => get().reconnect(), 1000);
              }

              throw error; // Esto cierra la conexión
            },

            onclose: () => {
              set({ connectionState: 'disconnected' });

              // Reconectar si está habilitado y no fue un cierre intencional
              if (get().autoReconnect && get().abortController?.signal.aborted === false) {
                setTimeout(() => get().reconnect(), 1000);
              }
            },
          } as FetchEventSourceInit);
        } catch (error) {
          set({
            lastError: error instanceof Error ? error.message : 'Connection failed',
            connectionState: 'error',
          });
        }
      },

      // Desconectar
      disconnect: () => {
        const { abortController } = get();

        if (abortController) {
          abortController.abort();
        }

        set({
          connectionState: 'disconnected',
          abortController: null,
          connectedAt: null,
          autoReconnect: false,
        });
      },

      // Reset completo - limpia TODO incluyendo buffer
      reset: () => {
        const { abortController } = get();

        if (abortController) {
          abortController.abort();
        }

        set({
          connectionState: 'disconnected',
          connectedAt: null,
          lastError: null,
          reconnectAttempts: 0,
          messageBuffer: [],  // ← Limpia el buffer de mensajes
          abortController: null,
          messagesReceived: 0,
          bytesReceived: 0,
          currentUrl: null,
          currentConfig: null,
          autoReconnect: true,
        });

        console.log('[streamingStore] Reset completo ejecutado - buffer limpiado');
      },

      // Reconectar
      reconnect: async () => {
        const { currentConfig, reconnectAttempts, autoReconnect } = get();

        if (!currentConfig || !autoReconnect) {
          return;
        }

        // Límite de intentos de reconexión
        const maxAttempts = currentConfig.maxReconnectAttempts || 5;
        if (reconnectAttempts >= maxAttempts) {
          set({
            connectionState: 'error',
            lastError: 'Max reconnect attempts reached',
            autoReconnect: false,
          });
          return;
        }

        set({
          connectionState: 'reconnecting',
          reconnectAttempts: reconnectAttempts + 1,
        });

        // Esperar con backoff exponencial
        const backoff = currentConfig.reconnectInterval || 1000;
        const multiplier = currentConfig.backoffMultiplier || 2;
        const delay = backoff * Math.pow(multiplier, reconnectAttempts);

        await new Promise(resolve => setTimeout(resolve, delay));

        // Reconectar
        await get().connect(currentConfig);
      },

      // Habilitar/deshabilitar reconexión automática
      setAutoReconnect: (enabled: boolean) => {
        set({ autoReconnect: enabled, reconnectAttempts: 0 });
      },

      // Agregar mensaje al buffer
      addMessage: (message: StreamMessage) => {
        set((state) => {
          const buffer = [...state.messageBuffer, message];

          // Mantener solo los últimos maxBufferSize mensajes
          if (buffer.length > state.maxBufferSize) {
            buffer.shift();
          }

          return { messageBuffer: buffer };
        });
      },

      // Limpiar buffer
      clearBuffer: () => {
        set({ messageBuffer: [] });
      },
    })
  )
);

// ============================================
// Selectores
// ============================================

export const selectConnectionState = (state: StreamingStore) => state.connectionState;
export const selectIsConnected = (state: StreamingStore) => state.connectionState === 'connected';
export const selectIsConnecting = (state: StreamingStore) =>
  state.connectionState === 'connecting' || state.connectionState === 'reconnecting';
export const selectLastError = (state: StreamingStore) => state.lastError;
export const selectMessages = (state: StreamingStore) => state.messageBuffer;
export const selectLatestMessage = (state: StreamingStore) =>
  state.messageBuffer[state.messageBuffer.length - 1] || null;
