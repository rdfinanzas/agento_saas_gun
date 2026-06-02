// BullMQ Queue Configuration
import { Queue, Worker, QueueEvents, Job } from "bullmq"
import { redisConnection, redis } from "./redis"
import { createLogger } from "../utils/logger"

const logger = createLogger("queue")

// ============================================
// Job Data Types
// ============================================

/**
 * Datos para jobs de mensajes entrantes de WhatsApp
 */
export interface WhatsAppIncomingJobData {
  messageId: string
  conversationId: string
  tenantId: string
  agentId: string
  from: string
  messageContent: string
  messageType: "text" | "image" | "audio" | "document" | "video"
  timestamp: number
  metadata?: Record<string, unknown>
}

/**
 * Datos para jobs de facturacion
 */
export interface BillingJobData {
  type: "payment_received" | "payment_failed" | "subscription_created" | "subscription_cancelled" | "subscription_renewed" | "invoice_generated"
  tenantId: string
  subscriptionId?: string
  paymentId?: string
  invoiceId?: string
  amount?: number
  currency?: string
  timestamp: number
  metadata?: Record<string, unknown>
}

/**
 * Datos para jobs de automatizacion
 */
export interface AutomationJobData {
  automationId: string
  tenantId: string
  triggerType: "schedule" | "event" | "webhook" | "message_received"
  triggerData: Record<string, unknown>
  agentId?: string
  conversationId?: string
  timestamp: number
  metadata?: Record<string, unknown>
}

// ============================================
// Queue Names
// ============================================

export const QUEUE_NAMES = {
  WHATSAPP_INCOMING: "whatsapp-incoming",
  BILLING: "billing",
  AUTOMATION: "automation",
} as const

export type QueueName = (typeof QUEUE_NAMES)[keyof typeof QUEUE_NAMES]

// ============================================
// Queue Instances
// ============================================

/**
 * Cola para mensajes entrantes de WhatsApp
 */
export const whatsappIncomingQueue = new Queue<WhatsAppIncomingJobData>(QUEUE_NAMES.WHATSAPP_INCOMING, {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: "exponential",
      delay: 1000,
    },
    removeOnComplete: {
      count: 1000,
      age: 24 * 3600, // 24 horas
    },
    removeOnFail: {
      count: 5000,
      age: 7 * 24 * 3600, // 7 dias
    },
  },
})

/**
 * Cola para procesos de facturacion
 */
export const billingQueue = new Queue<BillingJobData>(QUEUE_NAMES.BILLING, {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 5,
    backoff: {
      type: "exponential",
      delay: 2000,
    },
    removeOnComplete: {
      count: 2000,
      age: 30 * 24 * 3600, // 30 dias
    },
    removeOnFail: {
      count: 10000,
      age: 90 * 24 * 3600, // 90 dias
    },
  },
})

/**
 * Cola para automatizaciones
 */
export const automationQueue = new Queue<AutomationJobData>(QUEUE_NAMES.AUTOMATION, {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: "exponential",
      delay: 1500,
    },
    removeOnComplete: {
      count: 500,
      age: 7 * 24 * 3600, // 7 dias
    },
    removeOnFail: {
      count: 2000,
      age: 30 * 24 * 3600, // 30 dias
    },
  },
})

// ============================================
// Queue Events
// ============================================

export const whatsappIncomingQueueEvents = new QueueEvents(QUEUE_NAMES.WHATSAPP_INCOMING, {
  connection: redisConnection,
})

export const billingQueueEvents = new QueueEvents(QUEUE_NAMES.BILLING, {
  connection: redisConnection,
})

export const automationQueueEvents = new QueueEvents(QUEUE_NAMES.AUTOMATION, {
  connection: redisConnection,
})

// ============================================
// Queue Statistics
// ============================================

export interface QueueStats {
  name: string
  waiting: number
  active: number
  completed: number
  failed: number
  delayed: number
  paused: boolean
}

/**
 * Obtiene estadisticas de una cola especifica
 */
export async function getQueueStats(queue: Queue): Promise<QueueStats> {
  const [waiting, active, completed, failed, delayed, paused] = await Promise.all([
    queue.getWaitingCount(),
    queue.getActiveCount(),
    queue.getCompletedCount(),
    queue.getFailedCount(),
    queue.getDelayedCount(),
    queue.isPaused(),
  ])

  return {
    name: queue.name,
    waiting,
    active,
    completed,
    failed,
    delayed,
    paused,
  }
}

/**
 * Obtiene estadisticas de todas las colas
 */
export async function getAllQueuesStats(): Promise<QueueStats[]> {
  const queues = [whatsappIncomingQueue, billingQueue, automationQueue]

  const stats = await Promise.all(queues.map((queue) => getQueueStats(queue)))

  return stats
}

// ============================================
// Graceful Shutdown
// ============================================

const workers: Worker[] = []

/**
 * Registra un worker para ser cerrado gracefully
 */
export function registerWorker(worker: Worker): void {
  workers.push(worker)
}

/**
 * Cierra todas las colas y workers gracefully
 */
export async function closeQueues(): Promise<void> {
  logger.info("Iniciando cierre graceful de colas...")

  const shutdownPromises: Promise<void>[] = []

  // Cerrar workers primero
  for (const worker of workers) {
    shutdownPromises.push(
      worker.close().then(() => {
        logger.info(`Worker cerrado: ${worker.name}`)
      })
    )
  }

  // Cerrar queue events
  shutdownPromises.push(
    whatsappIncomingQueueEvents.close().then(() => {
      logger.info("Queue events cerrado: whatsapp-incoming")
    })
  )
  shutdownPromises.push(
    billingQueueEvents.close().then(() => {
      logger.info("Queue events cerrado: billing")
    })
  )
  shutdownPromises.push(
    automationQueueEvents.close().then(() => {
      logger.info("Queue events cerrado: automation")
    })
  )

  // Cerrar colas
  shutdownPromises.push(
    whatsappIncomingQueue.close().then(() => {
      logger.info("Cola cerrada: whatsapp-incoming")
    })
  )
  shutdownPromises.push(
    billingQueue.close().then(() => {
      logger.info("Cola cerrada: billing")
    })
  )
  shutdownPromises.push(
    automationQueue.close().then(() => {
      logger.info("Cola cerrada: automation")
    })
  )

  // Cerrar conexion Redis
  if ("quit" in redis && typeof redis.quit === "function") {
    shutdownPromises.push(
      redis.quit().then(() => {
        logger.info("Conexion Redis cerrada")
      })
    )
  }

  await Promise.allSettled(shutdownPromises)

  logger.info("Cierre graceful de colas completado")
}

// ============================================
// Helper Functions
// ============================================

/**
 * Agrega un job a la cola de WhatsApp
 */
export async function addWhatsAppJob(data: WhatsAppIncomingJobData, jobId?: string): Promise<Job<WhatsAppIncomingJobData>> {
  const job = await whatsappIncomingQueue.add("process-message", data, {
    jobId,
    timestamp: data.timestamp,
  })

  logger.debug(`Job agregado a whatsapp-incoming: ${job.id}`)

  return job
}

/**
 * Agrega un job a la cola de facturacion
 */
export async function addBillingJob(data: BillingJobData, jobId?: string): Promise<Job<BillingJobData>> {
  const job = await billingQueue.add(`billing-${data.type}`, data, {
    jobId,
    timestamp: data.timestamp,
  })

  logger.debug(`Job agregado a billing: ${job.id}`)

  return job
}

/**
 * Agrega un job a la cola de automatizacion
 */
export async function addAutomationJob(data: AutomationJobData, jobId?: string): Promise<Job<AutomationJobData>> {
  const job = await automationQueue.add(`automation-${data.triggerType}`, data, {
    jobId,
    timestamp: data.timestamp,
  })

  logger.debug(`Job agregado a automation: ${job.id}`)

  return job
}

/**
 * Limpia jobs completados y fallidos de todas las colas
 */
export async function cleanAllQueues(): Promise<void> {
  const queues = [whatsappIncomingQueue, billingQueue, automationQueue]

  await Promise.all(
    queues.map(async (queue) => {
      await queue.clean(0, 1000, "completed")
      await queue.clean(0, 1000, "failed")
      logger.info(`Cola limpiada: ${queue.name}`)
    })
  )
}

/**
 * Pausa todas las colas
 */
export async function pauseAllQueues(): Promise<void> {
  const queues = [whatsappIncomingQueue, billingQueue, automationQueue]

  await Promise.all(
    queues.map(async (queue) => {
      await queue.pause()
      logger.info(`Cola pausada: ${queue.name}`)
    })
  )
}

/**
 * Reanuda todas las colas
 */
export async function resumeAllQueues(): Promise<void> {
  const queues = [whatsappIncomingQueue, billingQueue, automationQueue]

  await Promise.all(
    queues.map(async (queue) => {
      await queue.resume()
      logger.info(`Cola reanudada: ${queue.name}`)
    })
  )
}

// ============================================
// Type Exports
// ============================================

export type { Job }
export { Worker }
