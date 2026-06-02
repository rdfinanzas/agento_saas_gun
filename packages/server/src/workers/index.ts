/**
 * Workers Module - Exporta todos los workers de procesamiento en segundo plano
 *
 * Este modulo centraliza la exportacion de:
 * - Workers de BullMQ para procesamiento de jobs
 * - Tipos de datos para jobs y resultados
 * - Funciones de utilidad para manejo de colas
 * - Funciones para iniciar/detener todos los workers
 */

// ============================================
// Start Workers - Iniciar todos los workers
// ============================================
export { startAllWorkers, stopAllWorkers } from "./start-workers"

// ============================================
// WhatsApp Worker
// ============================================
export { whatsappWorker, WhatsAppWorker } from "./whatsapp.worker"
export type { WhatsAppJobData, WhatsAppJobResult, WorkerStats as WhatsAppWorkerStats } from "./whatsapp.worker"

// ============================================
// Billing Worker
// ============================================
export { billingWorker, BillingWorker } from "./billing.worker"
export type { BillingJobData, BillingJobResult, BillingJobType } from "./billing.worker"

// ============================================
// Automation Worker
// ============================================
export { automationWorker, AutomationWorker, getAutomationQueue } from "./automation.worker"
export type {
  AutomationJobData,
  AutomationJobResult,
  AutomationTaskType,
  WorkerStats as AutomationWorkerStats,
} from "./automation.worker"

// ============================================
// AI Worker
// ============================================
export { aiWorker, AIWorker } from "./ai.worker"
export type {
  AIJobType,
  AIJobData,
  AIJobResult,
  AIWorkerStats,
  ChatCompletionJobData,
  ChatCompletionJobResult,
  EmbeddingJobData,
  EmbeddingJobResult,
  ToolExecutionJobData,
  ToolExecutionJobResult,
  ChatMessage,
  ChatMessageRole,
  AIToolDefinition,
  ToolCallRequest,
  ToolCallResult,
  EmbeddingResult,
} from "./ai.types"

// ============================================
// Queue Configuration & Utilities
// ============================================
export {
  // Queue instances
  whatsappIncomingQueue,
  billingQueue,
  automationQueue,
  // Queue events
  whatsappIncomingQueueEvents,
  billingQueueEvents,
  automationQueueEvents,
  // Queue names
  QUEUE_NAMES,
  // Helper functions
  addWhatsAppJob,
  addBillingJob,
  addAutomationJob,
  // Queue management
  getQueueStats,
  getAllQueuesStats,
  cleanAllQueues,
  pauseAllQueues,
  resumeAllQueues,
  closeQueues,
  registerWorker,
  // BullMQ classes
  Worker,
} from "../config/queue"

// ============================================
// Queue Types
// ============================================
export type {
  WhatsAppIncomingJobData,
  BillingJobData as QueueBillingJobData,
  AutomationJobData as QueueAutomationJobData,
  QueueStats,
  QueueName,
  Job,
} from "../config/queue"
