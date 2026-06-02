/**
 * Tipos para el sistema de Thought Stream
 * Adaptado desde Accomplish Agent-Core
 */

// Evento de pensamiento (reasoning en tiempo real)
export interface ThoughtEvent {
  taskId: string;
  tenantId: string;
  content: string;
  category: 'observation' | 'reasoning' | 'decision' | 'action';
  agentName: string;
  timestamp: number;
}

// Evento de checkpoint (progreso de tarea)
export interface CheckpointEvent {
  taskId: string;
  tenantId: string;
  status: 'progress' | 'complete' | 'stuck';
  summary: string;
  nextPlanned?: string;
  blocker?: string;
  agentName: string;
  timestamp: number;
}

// Categorías de pensamiento
export type ThoughtCategory = 'observation' | 'reasoning' | 'decision' | 'action';

// Estado de checkpoint
export type CheckpointStatus = 'progress' | 'complete' | 'stuck';

// Opciones del ThoughtStreamHandler
export interface ThoughtStreamHandlerOptions {
  maxEventsPerTask?: number;
  retentionMs?: number;
}

// Evento almacenado con metadata
export interface StoredThoughtEvent extends ThoughtEvent {
  id: string;
  createdAt: Date;
}

export interface StoredCheckpointEvent extends CheckpointEvent {
  id: string;
  createdAt: Date;
}

// DTOs para API
export class ReportThoughtDto {
  content!: string;
  category!: ThoughtCategory;
  agentName?: string;
}

export class ReportCheckpointDto {
  status!: CheckpointStatus;
  summary!: string;
  nextPlanned?: string;
  blocker?: string;
  agentName?: string;
}

// Respuesta con eventos
export class ThoughtStreamResponseDto {
  taskId!: string;
  thoughts!: StoredThoughtEvent[];
  checkpoints!: StoredCheckpointEvent[];
  lastActivity!: Date;
}
