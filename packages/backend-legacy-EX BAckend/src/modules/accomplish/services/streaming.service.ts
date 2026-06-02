/**
 * StreamingService - Servicio para streaming de eventos en tiempo real
 *
 * Maneja conexiones SSE y emite eventos durante la ejecución de tareas
 */

import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';

export interface StreamConnection {
  id: string;
  taskId: string;
  tenantId: string;
  connected: boolean;
  connectedAt: Date;
  lastActivity: Date;
}

export interface StreamEvent {
  type: 'message' | 'tool' | 'permission' | 'progress' | 'complete' | 'error' | 'connected' | 'disconnected';
  data: any;
  timestamp: Date;
  eventId?: string;
}

export type EventHandler = (event: StreamEvent) => void;

export class StreamingService extends EventEmitter {
  private connections: Map<string, StreamConnection> = new Map();
  private taskEventListeners: Map<string, Set<string>> = new Map(); // taskId -> connectionIds
  private taskEventBuffers: Map<string, StreamEvent[]> = new Map(); // taskId -> buffered events
  private readonly CONNECTION_TIMEOUT = 5 * 60 * 1000; // 5 minutos
  private readonly MAX_BUFFER_SIZE = 100; // Máximo de eventos a guardar por tarea

  constructor() {
    super();
    // Iniciar limpieza de conexiones expiradas
    setInterval(() => this.cleanupExpiredConnections(), 60000);
  }

  /**
   * Registra una nueva conexión SSE
   */
  registerConnection(taskId: string, tenantId: string): StreamConnection {
    const connectionId = uuidv4();

    const connection: StreamConnection = {
      id: connectionId,
      taskId,
      tenantId,
      connected: true,
      connectedAt: new Date(),
      lastActivity: new Date(),
    };

    this.connections.set(connectionId, connection);

    // Agregar a lista de listeners de la tarea
    if (!this.taskEventListeners.has(taskId)) {
      this.taskEventListeners.set(taskId, new Set());
    }
    this.taskEventListeners.get(taskId)!.add(connectionId);

    // Emitir evento de conexión
    this.emitToConnection(connectionId, {
      type: 'connected',
      data: { connectionId, taskId },
      timestamp: new Date(),
      eventId: uuidv4(),
    });

    return connection;
  }

  /**
   * Desconecta una conexión
   */
  disconnectConnection(connectionId: string): void {
    const connection = this.connections.get(connectionId);
    if (!connection) return;

    // Emitir evento de desconexión
    this.emitToConnection(connectionId, {
      type: 'disconnected',
      data: { connectionId },
      timestamp: new Date(),
      eventId: uuidv4(),
    });

    // Remover de lista de listeners de la tarea
    if (connection.taskId && this.taskEventListeners.has(connection.taskId)) {
      this.taskEventListeners.get(connection.taskId)!.delete(connectionId);
    }

    // Marcar como desconectado
    connection.connected = false;
    this.connections.delete(connectionId);
  }

  /**
   * Emite un evento a una conexión específica
   */
  emitToConnection(connectionId: string, event: StreamEvent): void {
    const connection = this.connections.get(connectionId);
    if (!connection || !connection.connected) return;

    // Actualizar última actividad
    connection.lastActivity = new Date();

    // Emitir evento
    this.emit(`connection:${connectionId}`, event);
  }

  /**
   * Emite un evento a todas las conexiones de una tarea
   */
  emitToTask(taskId: string, event: StreamEvent): void {
    console.log(`[StreamingService] emitToTask: taskId=${taskId}, eventType=${event.type}`);

    // Guardar evento en el buffer
    this.bufferEvent(taskId, event);

    const connectionIds = this.taskEventListeners.get(taskId);
    console.log(`[StreamingService] ConnectionIds for task ${taskId}:`, connectionIds ? Array.from(connectionIds) : 'none');

    if (!connectionIds) return;

    for (const connectionId of connectionIds) {
      this.emitToConnection(connectionId, event);
    }
  }

  /**
   * Guarda un evento en el buffer de una tarea
   */
  private bufferEvent(taskId: string, event: StreamEvent): void {
    if (!this.taskEventBuffers.has(taskId)) {
      this.taskEventBuffers.set(taskId, []);
    }

    const buffer = this.taskEventBuffers.get(taskId)!;
    buffer.push(event);

    // Limitar el tamaño del buffer
    if (buffer.length > this.MAX_BUFFER_SIZE) {
      buffer.shift(); // Remover el evento más antiguo
    }
  }

  /**
   * Obtiene y limpia el buffer de eventos de una tarea
   */
  getBufferedEvents(taskId: string): StreamEvent[] {
    const events = this.taskEventBuffers.get(taskId) || [];
    this.taskEventBuffers.delete(taskId); // Limpiar buffer después de leer
    return events;
  }

  /**
   * Emite un evento de mensaje
   */
  emitMessage(taskId: string, role: 'user' | 'assistant' | 'tool', content: string, metadata?: any): void {
    this.emitToTask(taskId, {
      type: 'message',
      data: {
        role,
        content,
        timestamp: new Date().toISOString(),
        metadata,
      },
      timestamp: new Date(),
      eventId: uuidv4(),
    });
  }

  /**
   * Emite un evento de herramienta
   */
  emitToolEvent(taskId: string, toolName: string, input: any, status: 'started' | 'completed' | 'failed', output?: any): void {
    this.emitToTask(taskId, {
      type: 'tool',
      data: {
        toolName,
        input,
        status,
        output,
        timestamp: new Date().toISOString(),
      },
      timestamp: new Date(),
      eventId: uuidv4(),
    });
  }

  /**
   * Emite un evento de progreso
   */
  emitProgress(taskId: string, step: string, progress: number, details?: string): void {
    this.emitToTask(taskId, {
      type: 'progress',
      data: {
        step,
        progress,
        details,
        timestamp: new Date().toISOString(),
      },
      timestamp: new Date(),
      eventId: uuidv4(),
    });
  }

  /**
   * Emite un evento de permiso
   */
  emitPermissionRequest(taskId: string, request: any): void {
    this.emitToTask(taskId, {
      type: 'permission',
      data: request,
      timestamp: new Date(),
      eventId: uuidv4(),
    });
  }

  /**
   * Emite un evento de completado
   */
  emitComplete(taskId: string, result: any): void {
    this.emitToTask(taskId, {
      type: 'complete',
      data: {
        result,
        timestamp: new Date().toISOString(),
      },
      timestamp: new Date(),
      eventId: uuidv4(),
    });
  }

  /**
   * Emite un evento de error
   */
  emitError(taskId: string, error: string, details?: any): void {
    this.emitToTask(taskId, {
      type: 'error',
      data: {
        error,
        details,
        timestamp: new Date().toISOString(),
      },
      timestamp: new Date(),
      eventId: uuidv4(),
    });
  }

  /**
   * Suscribe a eventos de una conexión
   */
  subscribeToConnection(connectionId: string, handler: EventHandler): () => void {
    const eventName = `connection:${connectionId}`;

    this.on(eventName, handler);

    // Retornar función de limpieza
    return () => {
      this.off(eventName, handler);
    };
  }

  /**
   * Obtiene conexiones activas de una tarea
   */
  getActiveConnections(taskId: string): StreamConnection[] {
    const connectionIds = this.taskEventListeners.get(taskId);
    if (!connectionIds) return [];

    return Array.from(connectionIds)
      .map((id) => this.connections.get(id))
      .filter((conn): conn is StreamConnection => conn !== undefined && conn.connected);
  }

  /**
   * Obtiene una conexión por ID
   */
  getConnection(connectionId: string): StreamConnection | undefined {
    return this.connections.get(connectionId);
  }

  /**
   * Limpia conexiones expiradas
   */
  private cleanupExpiredConnections(): void {
    const now = Date.now();
    const expiredIds: string[] = [];

    for (const [id, connection] of this.connections.entries()) {
      const inactiveTime = now - connection.lastActivity.getTime();

      if (inactiveTime > this.CONNECTION_TIMEOUT) {
        expiredIds.push(id);
      }
    }

    for (const id of expiredIds) {
      this.disconnectConnection(id);
      console.log(`[StreamingService] Cleaned up expired connection: ${id}`);
    }
  }

  /**
   * Obtiene estadísticas del servicio
   */
  getStats(): {
    totalConnections: number;
    activeConnections: number;
    tasksWithConnections: number;
  } {
    const activeConnections = Array.from(this.connections.values()).filter((c) => c.connected);

    return {
      totalConnections: this.connections.size,
      activeConnections: activeConnections.length,
      tasksWithConnections: this.taskEventListeners.size,
    };
  }
}

// Singleton instance
export const streamingService = new StreamingService();
