/**
 * WebSocket Client - Socket.io para el frontend
 * FASE 3: Monitoreo en tiempo real de conversaciones
 */

// @ts-ignore - socket.io-client puede no estar instalado en desarrollo
declare const io: any;

// Usar any para Socket para evitar errores de tipos
type Socket = any;

// ============================================
// Types
// ============================================

export interface NewMessageEvent {
  conversationId: string;
  messageId: string;
  phoneNumber: string;
  content: string;
  direction: 'INCOMING' | 'OUTGOING';
  timestamp: string;
}

export interface ConversationUpdateEvent {
  conversationId: string;
  lastMessage?: string;
  lastMessageAt?: string;
  status?: string;
  unreadCount?: number;
}

export interface AgentStatusEvent {
  agentId: string;
  isOnline: boolean;
  isProcessing: boolean;
  lastActivity?: string;
  activeConversations?: number;
  timestamp: string;
}

export interface NotificationEvent {
  type: 'info' | 'warning' | 'error' | 'success';
  title: string;
  message: string;
  data?: any;
  timestamp: string;
}

export interface StatsUpdateEvent {
  activeConversations: number;
  pendingMessages: number;
  avgResponseTime?: number;
  timestamp: string;
}

// PLAN #7: Evento de aprobación pendiente
export interface PendingApprovalEvent {
  type: 'pending_approval';
  conversationId: string;
  phoneNumber: string;
  pendingId: string;
  preview: string;
  reason?: string;
  timestamp: string;
}

// PLAN #7: Evento de respuesta aprobada
export interface ResponseApprovedEvent {
  responseId: string;
  conversationId: string;
  reviewedBy: string;
  timestamp: string;
}

export type MessageCallback = (data: NewMessageEvent) => void;
export type ConversationCallback = (data: ConversationUpdateEvent) => void;
export type AgentStatusCallback = (data: AgentStatusEvent) => void;
export type NotificationCallback = (data: NotificationEvent) => void;
export type StatsCallback = (data: StatsUpdateEvent) => void;
// PLAN #7: Callbacks para aprobaciones
export type PendingApprovalCallback = (data: PendingApprovalEvent) => void;
export type ResponseApprovedCallback = (data: ResponseApprovedEvent) => void;

// ============================================
// WebSocket Client Class
// ============================================

class WebSocketClient {
  private socket: Socket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private listeners: Map<string, Set<Function>> = new Map();

  /**
   * Conecta al servidor WebSocket
   */
  connect(token: string): Promise<boolean> {
    return new Promise((resolve, reject) => {
      if (this.socket?.connected) {
        resolve(true);
        return;
      }

      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

      this.socket = io(apiUrl, {
        auth: { token },
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionAttempts: this.maxReconnectAttempts,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
      });

      this.socket.on('connect', () => {
        console.log('[WS] Conectado al servidor');
        this.reconnectAttempts = 0;
        resolve(true);
      });

      this.socket.on('connect_error', (error: Error) => {
        console.error('[WS] Error de conexion:', error.message);
        this.reconnectAttempts++;

        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
          reject(new Error('Max reconnection attempts reached'));
        }
      });

      this.socket.on('disconnect', (reason: string) => {
        console.log(`[WS] Desconectado: ${reason}`);
        this.notifyListeners('disconnect', { reason });
      });

      // Registrar listeners para eventos del servidor
      this.setupEventListeners();
    });
  }

  /**
   * Configura los listeners para eventos del servidor
   */
  private setupEventListeners() {
    if (!this.socket) return;

    // Nuevo mensaje
    this.socket.on('message:new', (data: NewMessageEvent) => {
      this.notifyListeners('message:new', data);
    });

    // Actualizacion de conversacion
    this.socket.on('conversation:update', (data: ConversationUpdateEvent) => {
      this.notifyListeners('conversation:update', data);
    });

    // Estado del agente
    this.socket.on('agent:status', (data: AgentStatusEvent) => {
      this.notifyListeners('agent:status', data);
    });

    // Notificaciones
    this.socket.on('notification', (data: NotificationEvent) => {
      this.notifyListeners('notification', data);
    });

    // Actualizacion de estadisticas
    this.socket.on('stats:update', (data: StatsUpdateEvent) => {
      this.notifyListeners('stats:update', data);
    });

    // Human takeover
    this.socket.on('human:takeover', (data: any) => {
      this.notifyListeners('human:takeover', data);
    });

    // Conversacion liberada
    this.socket.on('conversation:released', (data: any) => {
      this.notifyListeners('conversation:released', data);
    });

    // PLAN #7: Aprobación pendiente
    this.socket.on('pending_approval', (data: PendingApprovalEvent) => {
      this.notifyListeners('pending_approval', data);
    });

    // PLAN #7: Respuesta aprobada
    this.socket.on('response_approved', (data: ResponseApprovedEvent) => {
      this.notifyListeners('response_approved', data);
    });

    // Pong response
    this.socket.on('pong', (data: { timestamp: number }) => {
      this.notifyListeners('pong', data);
    });
  }

  /**
   * Desconecta del servidor WebSocket
   */
  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      console.log('[WS] Desconectado');
    }
  }

  /**
   * Verifica si esta conectado
   */
  isConnected(): boolean {
    return this.socket?.connected ?? false;
  }

  // ============================================
  // Suscripciones
  // ============================================

  /**
   * Suscribirse a conversaciones del tenant
   */
  subscribeToConversations(): void {
    if (this.socket) {
      this.socket.emit('subscribe:conversations');
      console.log('[WS] Suscrito a conversaciones');
    }
  }

  /**
   * Suscribirse a una conversacion especifica
   */
  subscribeToConversation(conversationId: string): void {
    if (this.socket) {
      this.socket.emit('subscribe:conversation', conversationId);
      console.log(`[WS] Suscrito a conversacion ${conversationId}`);
    }
  }

  /**
   * Suscribirse al estado de un agente
   */
  subscribeToAgentStatus(agentId: string): void {
    if (this.socket) {
      this.socket.emit('subscribe:agent:status', agentId);
    }
  }

  /**
   * Desuscribirse de conversaciones
   */
  unsubscribeFromConversations(): void {
    if (this.socket) {
      this.socket.emit('unsubscribe:conversations');
    }
  }

  /**
   * Desuscribirse de una conversacion
   */
  unsubscribeFromConversation(conversationId: string): void {
    if (this.socket) {
      this.socket.emit('unsubscribe:conversation', conversationId);
    }
  }

  // ============================================
  // Event Listeners
  // ============================================

  /**
   * Agregar listener para un evento
   */
  on(event: string, callback: Function): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback);

    // Retornar funcion para remover el listener
    return () => {
      this.listeners.get(event)?.delete(callback);
    };
  }

  /**
   * Remover listener
   */
  off(event: string, callback?: Function): void {
    if (callback) {
      this.listeners.get(event)?.delete(callback);
    } else {
      this.listeners.delete(event);
    }
  }

  /**
   * Notificar a todos los listeners de un evento
   */
  private notifyListeners(event: string, data: any): void {
    const callbacks = this.listeners.get(event);
    if (callbacks) {
      callbacks.forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error(`[WS] Error en listener ${event}:`, error);
        }
      });
    }
  }

  // ============================================
  // Metodos de conveniencia
  // ============================================

  /**
   * Escuchar nuevos mensajes
   */
  onNewMessage(callback: MessageCallback): () => void {
    return this.on('message:new', callback);
  }

  /**
   * Escuchar actualizaciones de conversacion
   */
  onConversationUpdate(callback: ConversationCallback): () => void {
    return this.on('conversation:update', callback);
  }

  /**
   * Escuchar estado del agente
   */
  onAgentStatus(callback: AgentStatusCallback): () => void {
    return this.on('agent:status', callback);
  }

  /**
   * Escuchar notificaciones
   */
  onNotification(callback: NotificationCallback): () => void {
    return this.on('notification', callback);
  }

  /**
   * Escuchar actualizaciones de estadisticas
   */
  onStatsUpdate(callback: StatsCallback): () => void {
    return this.on('stats:update', callback);
  }

  /**
   * Escuchar desconexiones
   */
  onDisconnect(callback: (data: { reason: string }) => void): () => void {
    return this.on('disconnect', callback);
  }

  // ============================================
  // PLAN #7: Métodos para aprobaciones
  // ============================================

  /**
   * Escuchar aprobaciones pendientes
   */
  onPendingApproval(callback: PendingApprovalCallback): () => void {
    return this.on('pending_approval', callback);
  }

  /**
   * Escuchar respuestas aprobadas
   */
  onResponseApproved(callback: ResponseApprovedCallback): () => void {
    return this.on('response_approved', callback);
  }

  /**
   * Enviar ping para verificar conexion
   */
  ping(): void {
    if (this.socket) {
      this.socket.emit('ping');
    }
  }
}

// ============================================
// Singleton Instance
// ============================================

export const wsClient = new WebSocketClient();

// ============================================
// React Hook (opcional)
// ============================================

import { useEffect, useState, useCallback } from 'react';

export function useWebSocket(token: string | null) {
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      wsClient.disconnect();
      setIsConnected(false);
      return;
    }

    wsClient.connect(token)
      .then(() => {
        setIsConnected(true);
        setError(null);
      })
      .catch((err) => {
        setError(err.message);
        setIsConnected(false);
      });

    const unsubscribe = wsClient.onDisconnect(() => {
      setIsConnected(false);
    });

    return () => {
      unsubscribe();
    };
  }, [token]);

  const disconnect = useCallback(() => {
    wsClient.disconnect();
    setIsConnected(false);
  }, []);

  return {
    isConnected,
    error,
    disconnect,
    client: wsClient,
  };
}

export function useConversationUpdates(token: string | null, onNewMessage?: MessageCallback) {
  const [lastMessage, setLastMessage] = useState<NewMessageEvent | null>(null);

  useEffect(() => {
    if (!token || !wsClient.isConnected()) return;

    wsClient.subscribeToConversations();

    const unsubscribe = wsClient.onNewMessage((data) => {
      setLastMessage(data);
      onNewMessage?.(data);
    });

    return () => {
      unsubscribe();
      wsClient.unsubscribeFromConversations();
    };
  }, [token, onNewMessage]);

  return { lastMessage };
}
