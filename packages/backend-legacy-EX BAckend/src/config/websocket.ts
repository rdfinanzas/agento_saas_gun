/**
 * WebSocket Configuration - Socket.io para tiempo real
 * FASE 3: Monitoreo en tiempo real de conversaciones
 */

import { Server as HttpServer } from 'http';
import { Server as SocketIOServer, Socket } from 'socket.io';
import { verify } from 'jsonwebtoken';

// ============================================
// Interfaces
// ============================================

interface AuthenticatedSocket extends Socket {
  tenantId?: string;
  userId?: string;
  userEmail?: string;
}

interface JoinRoomPayload {
  room: string;
  tenantId?: string;
}

interface ChatMessagePayload {
  conversationId: string;
  message: string;
}

// ============================================
// WebSocket Server
// ============================================

let io: SocketIOServer;

/**
 * Inicializa el servidor WebSocket
 */
export function initializeWebSocket(httpServer: HttpServer): SocketIOServer {
  io = new SocketIOServer(httpServer, {
    cors: {
      origin: process.env.FRONTEND_URL || 'http://localhost:3001',
      credentials: true,
      methods: ['GET', 'POST'],
    },
    transports: ['websocket', 'polling'],
  });

  // Middleware de autenticacion
  io.use(async (socket: AuthenticatedSocket, next) => {
    try {
      const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.replace('Bearer ', '');

      if (!token) {
        return next(new Error('Authentication required'));
      }

      const decoded = verify(token, process.env.JWT_SECRET!) as any;

      socket.userId = decoded.userId || decoded.sub;
      socket.tenantId = decoded.tenantId;
      socket.userEmail = decoded.email;

      next();
    } catch (error) {
      console.error('[WebSocket] Auth error:', error);
      next(new Error('Invalid token'));
    }
  });

  // Manejar conexiones
  io.on('connection', (socket: AuthenticatedSocket) => {
    console.log(`[WebSocket] Cliente conectado: ${socket.id} (User: ${socket.userId})`);

    // Auto-unirse a la sala del tenant
    if (socket.tenantId) {
      socket.join(`tenant:${socket.tenantId}`);
      console.log(`[WebSocket] Cliente ${socket.id} unido a tenant:${socket.tenantId}`);
    }

    // Eventos de suscripcion
    socket.on('subscribe:conversations', () => {
      if (socket.tenantId) {
        socket.join(`conversations:${socket.tenantId}`);
        console.log(`[WebSocket] Cliente ${socket.id} suscrito a conversaciones`);
      }
    });

    socket.on('subscribe:conversation', (conversationId: string) => {
      socket.join(`conversation:${conversationId}`);
      console.log(`[WebSocket] Cliente ${socket.id} suscrito a conversacion ${conversationId}`);
    });

    socket.on('subscribe:agent:status', (agentId: string) => {
      socket.join(`agent:${agentId}:status`);
    });

    socket.on('unsubscribe:conversations', () => {
      if (socket.tenantId) {
        socket.leave(`conversations:${socket.tenantId}`);
      }
    });

    socket.on('unsubscribe:conversation', (conversationId: string) => {
      socket.leave(`conversation:${conversationId}`);
    });

    // Enviar mensaje manual (human takeover)
    socket.on('send:message', async (data: ChatMessagePayload, callback) => {
      try {
        // Este evento sera manejado por el ConversationMonitorService
        // Por ahora solo confirmamos recepcion
        callback({ success: true, timestamp: new Date().toISOString() });
      } catch (error: any) {
        callback({ success: false, error: error.message });
      }
    });

    // Heartbeat para mantener conexion activa
    socket.on('ping', () => {
      socket.emit('pong', { timestamp: Date.now() });
    });

    // Desconexion
    socket.on('disconnect', (reason) => {
      console.log(`[WebSocket] Cliente desconectado: ${socket.id} (${reason})`);
    });

    // Error handling
    socket.on('error', (error) => {
      console.error(`[WebSocket] Error en socket ${socket.id}:`, error);
    });
  });

  console.log('[WebSocket] Servidor WebSocket inicializado');
  return io;
}

/**
 * Obtiene la instancia del servidor Socket.io
 */
export function getIO(): SocketIOServer {
  if (!io) {
    throw new Error('WebSocket not initialized. Call initializeWebSocket first.');
  }
  return io;
}

/**
 * Verifica si el WebSocket esta inicializado
 */
export function isWebSocketInitialized(): boolean {
  return io !== undefined;
}

// ============================================
// Funciones de Emision de Eventos
// ============================================

/**
 * Emite un nuevo mensaje a los suscriptores
 */
export function emitNewMessage(tenantId: string, data: {
  conversationId: string;
  messageId: string;
  phoneNumber: string;
  content: string;
  direction: 'INCOMING' | 'OUTGOING';
  timestamp: Date;
}): void {
  if (!io) return;

  // Emitir a la sala de conversaciones del tenant
  io.to(`conversations:${tenantId}`).emit('message:new', {
    ...data,
    timestamp: data.timestamp.toISOString(),
  });

  // Emitir a la sala especifica de la conversacion
  io.to(`conversation:${data.conversationId}`).emit('message:new', {
    ...data,
    timestamp: data.timestamp.toISOString(),
  });
}

/**
 * Emite actualizacion de conversacion
 */
export function emitConversationUpdate(tenantId: string, conversationId: string, data: {
  lastMessage?: string;
  lastMessageAt?: Date;
  status?: string;
  unreadCount?: number;
}): void {
  if (!io) return;

  io.to(`conversations:${tenantId}`).emit('conversation:update', {
    conversationId,
    ...data,
    lastMessageAt: data.lastMessageAt?.toISOString(),
  });
}

/**
 * Emite cambio de estado del agente
 */
export function emitAgentStatus(agentId: string, status: {
  isOnline: boolean;
  isProcessing: boolean;
  lastActivity?: Date;
  activeConversations?: number;
}): void {
  if (!io) return;

  io.to(`agent:${agentId}:status`).emit('agent:status', {
    agentId,
    ...status,
    lastActivity: status.lastActivity?.toISOString(),
    timestamp: new Date().toISOString(),
  });
}

/**
 * Emite notificacion a un tenant
 */
export function emitNotification(tenantId: string, notification: {
  type: 'info' | 'warning' | 'error' | 'success';
  title: string;
  message: string;
  data?: any;
}): void {
  if (!io) return;

  io.to(`tenant:${tenantId}`).emit('notification', {
    ...notification,
    timestamp: new Date().toISOString(),
  });
}

/**
 * Emite evento de toma de control humano
 */
export function emitHumanTakeover(tenantId: string, data: {
  conversationId: string;
  phoneNumber: string;
  takenBy: string;
  reason?: string;
}): void {
  if (!io) return;

  io.to(`conversations:${tenantId}`).emit('human:takeover', {
    ...data,
    timestamp: new Date().toISOString(),
  });
}

/**
 * Emite evento de liberacion de conversacion
 */
export function emitConversationReleased(tenantId: string, data: {
  conversationId: string;
  phoneNumber: string;
  releasedBy: string;
}): void {
  if (!io) return;

  io.to(`conversations:${tenantId}`).emit('conversation:released', {
    ...data,
    timestamp: new Date().toISOString(),
  });
}

/**
 * Emite actualizacion de estadisticas
 */
export function emitStatsUpdate(tenantId: string, stats: {
  activeConversations: number;
  pendingMessages: number;
  avgResponseTime?: number;
}): void {
  if (!io) return;

  io.to(`tenant:${tenantId}`).emit('stats:update', {
    ...stats,
    timestamp: new Date().toISOString(),
  });
}

/**
 * Emite a todos los clientes de un tenant
 */
export function emitToTenant(tenantId: string, event: string, data: any): void {
  if (!io) return;
  io.to(`tenant:${tenantId}`).emit(event, data);
}

/**
 * Emite a un usuario especifico
 */
export function emitToUser(userId: string, event: string, data: any): void {
  if (!io) return;
  io.to(`user:${userId}`).emit(event, data);
}

// ============================================
// Estadisticas de WebSocket
// ============================================

/**
 * Obtiene estadisticas del servidor WebSocket
 */
export function getWebSocketStats(): {
  connectedClients: number;
  rooms: string[];
} {
  if (!io) {
    return { connectedClients: 0, rooms: [] };
  }

  const rooms = Array.from(io.sockets.adapter.rooms.keys());

  return {
    connectedClients: io.sockets.sockets.size,
    rooms,
  };
}

/**
 * Obtiene clientes conectados a un tenant
 */
export function getTenantConnectedClients(tenantId: string): number {
  if (!io) return 0;

  const room = io.sockets.adapter.rooms.get(`tenant:${tenantId}`);
  return room ? room.size : 0;
}
