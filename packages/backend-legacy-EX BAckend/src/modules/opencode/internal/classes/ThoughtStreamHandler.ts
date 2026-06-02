/**
 * ThoughtStreamHandler - Maneja eventos de razonamiento en tiempo real
 * Adaptado desde Accomplish Agent-Core para multi-tenant
 */

import { v4 as uuidv4 } from 'uuid';
import type {
  ThoughtEvent,
  CheckpointEvent,
  ThoughtStreamHandlerOptions,
  StoredThoughtEvent,
  StoredCheckpointEvent,
  ThoughtCategory,
  CheckpointStatus,
} from '../../common/types/thought-stream';

/**
 * Handler para eventos de pensamiento desde agentes.
 * Rastrea tareas activas y valida eventos entrantes.
 */
export class ThoughtStreamHandler {
  private activeTaskIds = new Set<string>();
  private thoughtHistory: Map<string, StoredThoughtEvent[]> = new Map();
  private checkpointHistory: Map<string, StoredCheckpointEvent[]> = new Map();
  private maxEventsPerTask: number;
  private retentionMs: number;

  // Callbacks para eventos en tiempo real
  private onThoughtCallback?: (event: StoredThoughtEvent) => void;
  private onCheckpointCallback?: (event: StoredCheckpointEvent) => void;

  constructor(options: ThoughtStreamHandlerOptions = {}) {
    this.maxEventsPerTask = options.maxEventsPerTask || 100;
    this.retentionMs = options.retentionMs || 3600000; // 1 hora por defecto
  }

  /**
   * Configura callback para eventos de pensamiento
   */
  onThought(callback: (event: StoredThoughtEvent) => void): void {
    this.onThoughtCallback = callback;
  }

  /**
   * Configura callback para eventos de checkpoint
   */
  onCheckpoint(callback: (event: StoredCheckpointEvent) => void): void {
    this.onCheckpointCallback = callback;
  }

  /**
   * Registra una tarea como activa
   */
  registerTask(taskId: string): void {
    this.activeTaskIds.add(taskId);
    console.log(`[ThoughtStream] Task registered: ${taskId}`);
  }

  /**
   * Desregistra una tarea (cuando completa)
   */
  unregisterTask(taskId: string): void {
    this.activeTaskIds.delete(taskId);
    console.log(`[ThoughtStream] Task unregistered: ${taskId}`);

    // Programar limpieza de historial
    setTimeout(() => {
      this.cleanupTaskHistory(taskId);
    }, this.retentionMs);
  }

  /**
   * Verifica si una tarea está activa
   */
  isTaskActive(taskId: string): boolean {
    return this.activeTaskIds.has(taskId);
  }

  /**
   * Obtiene todas las tareas activas
   */
  getActiveTaskIds(): string[] {
    return Array.from(this.activeTaskIds);
  }

  /**
   * Limpia todas las tareas activas
   */
  clearAllTasks(): void {
    this.activeTaskIds.clear();
    console.log('[ThoughtStream] All tasks cleared');
  }

  /**
   * Registra un pensamiento
   */
  recordThought(event: ThoughtEvent): StoredThoughtEvent | null {
    // Validar estructura
    if (!this.isValidThoughtData(event)) {
      console.warn('[ThoughtStream] Invalid thought data:', event);
      return null;
    }

    // Verificar que la tarea está activa (o registrarla)
    if (!this.isTaskActive(event.taskId)) {
      this.registerTask(event.taskId);
    }

    const storedEvent: StoredThoughtEvent = {
      ...event,
      id: uuidv4(),
      createdAt: new Date(),
    };

    // Guardar en historial
    this.addToThoughtHistory(event.taskId, storedEvent);

    // Emitir callback si está configurado
    if (this.onThoughtCallback) {
      this.onThoughtCallback(storedEvent);
    }

    console.log(`[ThoughtStream] [${event.category}] ${event.content.substring(0, 50)}...`);
    return storedEvent;
  }

  /**
   * Registra un checkpoint
   */
  recordCheckpoint(event: CheckpointEvent): StoredCheckpointEvent | null {
    // Validar estructura
    if (!this.isValidCheckpointData(event)) {
      console.warn('[ThoughtStream] Invalid checkpoint data:', event);
      return null;
    }

    // Verificar que la tarea está activa (o registrarla)
    if (!this.isTaskActive(event.taskId)) {
      this.registerTask(event.taskId);
    }

    const storedEvent: StoredCheckpointEvent = {
      ...event,
      id: uuidv4(),
      createdAt: new Date(),
    };

    // Guardar en historial
    this.addToCheckpointHistory(event.taskId, storedEvent);

    // Emitir callback si está configurado
    if (this.onCheckpointCallback) {
      this.onCheckpointCallback(storedEvent);
    }

    console.log(`[ThoughtStream] [${event.status}] ${event.summary.substring(0, 50)}...`);

    // Si el checkpoint indica completo o atascado, desregistrar tarea
    if (event.status === 'complete' || event.status === 'stuck') {
      this.unregisterTask(event.taskId);
    }

    return storedEvent;
  }

  /**
   * Obtiene historial de pensamientos de una tarea
   */
  getThoughtHistory(taskId: string): StoredThoughtEvent[] {
    return this.thoughtHistory.get(taskId) || [];
  }

  /**
   * Obtiene historial de checkpoints de una tarea
   */
  getCheckpointHistory(taskId: string): StoredCheckpointEvent[] {
    return this.checkpointHistory.get(taskId) || [];
  }

  /**
   * Obtiene el último checkpoint de una tarea
   */
  getLatestCheckpoint(taskId: string): StoredCheckpointEvent | null {
    const history = this.checkpointHistory.get(taskId);
    if (!history || history.length === 0) return null;
    return history[history.length - 1];
  }

  /**
   * Obtiene resumen de una tarea
   */
  getTaskSummary(taskId: string): {
    isActive: boolean;
    thoughtCount: number;
    checkpointCount: number;
    latestStatus: CheckpointStatus | null;
    latestSummary: string | null;
  } {
    const thoughts = this.thoughtHistory.get(taskId) || [];
    const checkpoints = this.checkpointHistory.get(taskId) || [];
    const latestCheckpoint = this.getLatestCheckpoint(taskId);

    return {
      isActive: this.isTaskActive(taskId),
      thoughtCount: thoughts.length,
      checkpointCount: checkpoints.length,
      latestStatus: latestCheckpoint?.status || null,
      latestSummary: latestCheckpoint?.summary || null,
    };
  }

  /**
   * Limpia historial de una tarea
   */
  cleanupTaskHistory(taskId: string): void {
    this.thoughtHistory.delete(taskId);
    this.checkpointHistory.delete(taskId);
  }

  /**
   * Agrega pensamiento al historial con límite
   */
  private addToThoughtHistory(taskId: string, event: StoredThoughtEvent): void {
    if (!this.thoughtHistory.has(taskId)) {
      this.thoughtHistory.set(taskId, []);
    }
    const history = this.thoughtHistory.get(taskId)!;
    history.push(event);

    // Mantener solo los últimos N eventos
    if (history.length > this.maxEventsPerTask) {
      history.shift();
    }
  }

  /**
   * Agrega checkpoint al historial con límite
   */
  private addToCheckpointHistory(taskId: string, event: StoredCheckpointEvent): void {
    if (!this.checkpointHistory.has(taskId)) {
      this.checkpointHistory.set(taskId, []);
    }
    const history = this.checkpointHistory.get(taskId)!;
    history.push(event);

    // Mantener solo los últimos N eventos
    if (history.length > this.maxEventsPerTask) {
      history.shift();
    }
  }

  /**
   * Validador de datos de pensamiento
   */
  private isValidThoughtData(data: unknown): data is ThoughtEvent {
    if (typeof data !== 'object' || data === null) return false;

    const obj = data as Record<string, unknown>;

    return (
      typeof obj.taskId === 'string' &&
      typeof obj.tenantId === 'string' &&
      typeof obj.content === 'string' &&
      typeof obj.category === 'string' &&
      ['observation', 'reasoning', 'decision', 'action'].includes(obj.category) &&
      typeof obj.agentName === 'string' &&
      typeof obj.timestamp === 'number'
    );
  }

  /**
   * Validador de datos de checkpoint
   */
  private isValidCheckpointData(data: unknown): data is CheckpointEvent {
    if (typeof data !== 'object' || data === null) return false;

    const obj = data as Record<string, unknown>;

    return (
      typeof obj.taskId === 'string' &&
      typeof obj.tenantId === 'string' &&
      typeof obj.status === 'string' &&
      ['progress', 'complete', 'stuck'].includes(obj.status) &&
      typeof obj.summary === 'string' &&
      typeof obj.agentName === 'string' &&
      typeof obj.timestamp === 'number' &&
      (obj.nextPlanned === undefined || typeof obj.nextPlanned === 'string') &&
      (obj.blocker === undefined || typeof obj.blocker === 'string')
    );
  }
}

// Singleton para uso global
let thoughtStreamInstance: ThoughtStreamHandler | null = null;

export function getThoughtStreamHandler(
  options?: ThoughtStreamHandlerOptions
): ThoughtStreamHandler {
  if (!thoughtStreamInstance) {
    thoughtStreamInstance = new ThoughtStreamHandler(options);
  }
  return thoughtStreamInstance;
}

export function createThoughtStreamHandler(
  options?: ThoughtStreamHandlerOptions
): ThoughtStreamHandler {
  return new ThoughtStreamHandler(options);
}
