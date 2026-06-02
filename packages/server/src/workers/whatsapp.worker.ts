/**
 * WhatsApp Worker - Procesa mensajes de WhatsApp usando BullMQ
 *
 * Consume jobs de la cola 'whatsapp-incoming' y los procesa
 * a traves del Conversation Engine (AI + tools + Evolution API).
 */

import { Worker, Job } from "bullmq"
import { env } from "../config/env"
import { conversationEngine, type IncomingMessage } from "../modules/ai/conversation-engine"
import { createLogger } from "../utils/logger"

const logger = createLogger("whatsapp-worker")

/**
 * Opciones de conexion Redis para BullMQ
 */
function getRedisConnectionOptions() {
  return {
    host: env.REDIS_HOST || "localhost",
    port: Number(env.REDIS_PORT) || 6379,
    password: env.REDIS_PASSWORD || undefined,
    db: Number(env.REDIS_DB) || 0,
  }
}

/**
 * Tipos de datos para los jobs de WhatsApp
 */
export interface WhatsAppJobData {
  messageId: string
  conversationId: string
  tenantId: string
  configId: string
  phoneNumber: string
  content: string
  timestamp: Date
  metadata?: Record<string, unknown>
}

/**
 * Resultado del procesamiento del job
 */
export interface WhatsAppJobResult {
  success: boolean
  conversationId: string
  messageId: string
  processedAt: Date
  error?: string
}

/**
 * Estadisticas del worker
 */
export interface WorkerStats {
  isRunning: boolean
  queueName: string
  processedCount: number
  failedCount: number
  lastProcessedAt: Date | null
  lastError: string | null
}

/**
 * WhatsApp Worker Class
 * Maneja el procesamiento de mensajes entrantes de WhatsApp
 */
class WhatsAppWorker {
  private worker: Worker | null = null
  private queueName = "whatsapp-incoming"
  private processedCount = 0
  private failedCount = 0
  private lastProcessedAt: Date | null = null
  private lastError: string | null = null
  private isRunning = false

  /**
   * Procesa un job individual de WhatsApp a traves del Conversation Engine
   */
  private async processJob(job: Job<WhatsAppJobData>): Promise<WhatsAppJobResult> {
    const { messageId, tenantId, configId, phoneNumber, content, metadata } = job.data

    logger.info(`Procesando job ${job.id}`, {
      messageId,
      tenantId,
      phoneNumber,
    })

    try {
      // Delegar al Conversation Engine (busca config, agente, integracion, AI, envia respuesta)
      const result = await conversationEngine.processMessage({
        tenantId,
        configId,
        phoneNumber,
        messageText: content,
        messageId,
        metadata,
      })

      if (!result.success) {
        throw new Error(result.error || "Error desconocido en Conversation Engine")
      }

      logger.info(`Mensaje procesado exitosamente`, {
        jobId: job.id,
        conversationId: result.conversationId,
        toolsUsed: result.toolCallsMade,
        tokens: result.tokensUsed.total,
      })

      this.processedCount++
      this.lastProcessedAt = new Date()

      return {
        success: true,
        conversationId: result.conversationId,
        messageId,
        processedAt: new Date(),
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Error desconocido"
      logger.error(`Error procesando job ${job.id}`, {
        error: errorMessage,
        jobId: job.id,
        messageId,
      })

      throw error
    }
  }

  /**
   * Inicia el worker
   */
  async start(): Promise<void> {
    if (this.worker) {
      logger.warn("El worker ya esta en ejecucion")
      return
    }

    logger.info(`Iniciando WhatsApp Worker para cola: ${this.queueName}`)

    this.worker = new Worker<WhatsAppJobData, WhatsAppJobResult>(
      this.queueName,
      async (job: Job<WhatsAppJobData>) => {
        return this.processJob(job)
      },
      {
        connection: getRedisConnectionOptions(),
        concurrency: 5, // Procesar hasta 5 jobs simultaneamente
        limiter: {
          max: 100, // Maximo 100 jobs
          duration: 1000, // Por segundo
        },
      }
    )

    // Evento: Job completado
    this.worker.on("completed", (job: Job<WhatsAppJobData>, result: WhatsAppJobResult) => {
      logger.info(`Job completado`, {
        jobId: job.id,
        messageId: job.data.messageId,
        result,
      })
    })

    // Evento: Job fallido
    this.worker.on("failed", (job: Job<WhatsAppJobData> | undefined, error: Error) => {
      this.failedCount++
      this.lastError = error.message

      logger.error(`Job fallido`, {
        jobId: job?.id,
        messageId: job?.data?.messageId,
        error: error.message,
      })
    })

    // Evento: Error del worker
    this.worker.on("error", (error: Error) => {
      logger.error(`Error en el worker`, { error: error.message })
    })

    // Evento: Worker cerrado
    this.worker.on("closed", () => {
      logger.info("Worker cerrado")
      this.isRunning = false
    })

    // Evento: Worker listo (ready se dispara cuando la conexion esta lista)
    this.worker.on("ready", () => {
      logger.info("Worker listo y conectado a Redis")
    })

    // Evento: Worker detenido
    this.worker.on("stalled", (jobId: string) => {
      logger.warn(`Job estancado`, { jobId })
    })

    this.isRunning = true
    logger.info("WhatsApp Worker iniciado correctamente")
  }

  /**
   * Detiene el worker de forma graceful
   */
  async stop(): Promise<void> {
    if (!this.worker) {
      logger.warn("El worker no esta en ejecucion")
      return
    }

    logger.info("Deteniendo WhatsApp Worker...")

    try {
      // Esperar a que los jobs actuales terminen (graceful shutdown)
      await this.worker.close()
      this.worker = null
      this.isRunning = false
      logger.info("WhatsApp Worker detenido correctamente")
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Error desconocido"
      logger.error("Error al detener el worker", { error: errorMessage })
      throw error
    }
  }

  /**
   * Obtiene las estadisticas del worker
   */
  getStats(): WorkerStats {
    return {
      isRunning: this.isRunning,
      queueName: this.queueName,
      processedCount: this.processedCount,
      failedCount: this.failedCount,
      lastProcessedAt: this.lastProcessedAt,
      lastError: this.lastError,
    }
  }

  /**
   * Resetea las estadisticas del worker
   */
  resetStats(): void {
    this.processedCount = 0
    this.failedCount = 0
    this.lastProcessedAt = null
    this.lastError = null
    logger.info("Estadisticas del worker reseteadas")
  }
}

// Export singleton instance
export const whatsappWorker = new WhatsAppWorker()

// Export class for testing
export { WhatsAppWorker }
