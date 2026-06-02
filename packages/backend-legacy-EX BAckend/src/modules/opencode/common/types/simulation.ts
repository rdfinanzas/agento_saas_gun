/**
 * Types for Simulation/Sandbox mode
 * FASE 4: Modo Sandbox/Entrenamiento
 */

export interface SimulationConfig {
  scenario?: 'positive' | 'negative' | 'question' | 'custom';
  customerProfile?: CustomerProfile;
  initialContext?: string;
  autoRespond?: boolean;
}

export interface CustomerProfile {
  name: string;
  tone: 'friendly' | 'formal' | 'casual' | 'angry';
  language?: string;
  interests?: string[];
}

export interface SandboxSession {
  id: string;
  tenantId: string;
  agentId: string;
  config: SimulationConfig;
  messages: SimulationMessage[];
  startedAt: Date;
  endedAt?: Date;
  status: 'active' | 'completed' | 'abandoned';
  metrics: SimulationMetrics;
}

export interface SimulationMessage {
  id: string;
  role: 'user' | 'agent' | 'system';
  content: string;
  timestamp: Date;
  metadata?: SimulationMessageMetadata;
}

export interface SimulationMessageMetadata {
  intent?: string;
  sentiment?: 'positive' | 'negative' | 'neutral';
  responseTime?: number;
}

export interface SimulationMetrics {
  totalMessages: number;
  avgResponseTime: number;
  sentimentScore: number;
  resolutionRate: number;
  escalatedCount: number;
}

export interface SimulationLog {
  sessionId: string;
  timestamp: Date;
  event: string;
  details: Record<string, any>;
}

export interface CreateSimulationDto {
  config?: SimulationConfig;
}

export interface SendMessageDto {
  message: string;
  role?: 'user' | 'agent';
}

export interface SimulateCustomerDto {
  scenario?: 'positive' | 'negative' | 'question';
}

export interface SimulationMetricsResponse {
  totalSessions: number;
  completedSessions: number;
  avgMessagesPerSession: number;
  avgResponseTime: number;
  overallSentiment: number;
  resolutionRate: number;
}

export interface PromoteToProductionResponse {
  success: boolean;
  message: string;
  validation?: ValidationResult;
}

export interface ValidationResult {
  valid: boolean;
  issues: ValidationIssue[];
  completeness: number;
}

export interface ValidationIssue {
  field: string;
  message: string;
  severity: 'error' | 'warning' | 'info';
}
