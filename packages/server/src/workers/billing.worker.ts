/**
 * Billing Worker - BullMQ Worker para procesar jobs de facturacion
 *
 * Tipos de jobs soportados:
 * - renewal: Renovacion de suscripciones
 * - dunning: Reintentos de cobro fallidos
 * - invoice: Generacion de facturas
 * - proration: Calculo de prorrateo
 * - webhook: Procesamiento de webhooks de pago
 */

import { Worker, Job } from "bullmq"
import { eq, and } from "drizzle-orm"
import { db } from "../db"
import { subscriptions, invoices, dunningAttempts, tenants } from "../db/schema"
import { subscriptionStatusEnum, invoiceStatusEnum } from "../db/schema/enums"

// Valores de los enums para comparacion
const SUBSCRIPTION_STATUS = {
  PENDING: "PENDING",
  ACTIVE: "ACTIVE",
  PAUSED: "PAUSED",
  PAST_DUE: "PAST_DUE",
  CANCELLED: "CANCELLED",
  EXPIRED: "EXPIRED",
} as const

const INVOICE_STATUS = {
  DRAFT: "DRAFT",
  OPEN: "OPEN",
  PAID: "PAID",
  VOID: "VOID",
  UNCOLLECTIBLE: "UNCOLLECTIBLE",
} as const
import { redis } from "../config/redis"
import { createLogger } from "../utils/logger"
import { subscriptionService, AVAILABLE_PLANS } from "../modules/billing"

const logger = createLogger("billing-worker")

// Tipos de jobs de facturacion
export type BillingJobType = "renewal" | "dunning" | "invoice" | "proration" | "webhook"

// Datos del job de facturacion
export interface BillingJobData {
  type: BillingJobType
  subscriptionId?: string
  tenantId?: string
  attemptId?: string
  webhookPayload?: {
    type: string
    data: {
      id: string
      [key: string]: any
    }
  }
  invoiceId?: string
  metadata?: Record<string, any>
}

// Resultado del procesamiento del job
export interface BillingJobResult {
  success: boolean
  type: BillingJobType
  subscriptionId?: string
  tenantId?: string
  message?: string
  error?: string
  data?: Record<string, any>
}

// Estadisticas del worker
interface WorkerStats {
  isRunning: boolean
  jobsProcessed: number
  jobsFailed: number
  jobsCompleted: number
  lastJobAt: Date | null
  queueName: string
}

class BillingWorker {
  private worker: Worker<BillingJobData, BillingJobResult> | null = null
  private stats: WorkerStats = {
    isRunning: false,
    jobsProcessed: 0,
    jobsFailed: 0,
    jobsCompleted: 0,
    lastJobAt: null,
    queueName: "billing",
  }
  private readonly queueName = "billing"
  private readonly connection = {
    host: process.env.REDIS_HOST || "localhost",
    port: Number(process.env.REDIS_PORT) || 6379,
    password: process.env.REDIS_PASSWORD || undefined,
    db: Number(process.env.REDIS_DB) || 0,
  }

  /**
   * Inicia el worker de facturacion
   */
  async start(): Promise<void> {
    if (this.worker) {
      logger.warn("Worker ya esta en ejecucion")
      return
    }

    logger.info("Iniciando Billing Worker...")

    this.worker = new Worker<BillingJobData, BillingJobResult>(
      this.queueName,
      async (job: Job<BillingJobData>) => {
        return this.processJob(job)
      },
      {
        connection: this.connection,
        concurrency: 5, // Procesar hasta 5 jobs concurrentemente
        limiter: {
          max: 100, // Maximo 100 jobs
          duration: 60000, // Por minuto
        },
      }
    )

    // Configurar eventos del worker
    this.setupEventHandlers()

    this.stats.isRunning = true
    logger.info("Billing Worker iniciado correctamente")
  }

  /**
   * Detiene el worker de forma graceful
   */
  async stop(): Promise<void> {
    if (!this.worker) {
      logger.warn("Worker no esta en ejecucion")
      return
    }

    logger.info("Deteniendo Billing Worker...")

    try {
      // Esperar a que los jobs actuales terminen (graceful shutdown)
      await this.worker.close()
      this.worker = null
      this.stats.isRunning = false
      logger.info("Billing Worker detenido correctamente")
    } catch (error) {
      logger.error("Error al detener Billing Worker", error)
      // Forzar cierre si hay error
      if (this.worker) {
        await this.worker.close(true)
        this.worker = null
      }
      this.stats.isRunning = false
    }
  }

  /**
   * Obtiene estadisticas del worker
   */
  getStats(): WorkerStats {
    return { ...this.stats }
  }

  /**
   * Procesa un job individual
   */
  private async processJob(job: Job<BillingJobData>): Promise<BillingJobResult> {
    const { type, subscriptionId, tenantId, attemptId, webhookPayload, invoiceId, metadata } =
      job.data

    logger.info(`Procesando job ${job.id} de tipo: ${type}`, {
      subscriptionId,
      tenantId,
    })

    this.stats.jobsProcessed++
    this.stats.lastJobAt = new Date()

    try {
      let result: BillingJobResult

      switch (type) {
        case "renewal":
          result = await this.processRenewal(job.data)
          break
        case "dunning":
          result = await this.processDunning(job.data)
          break
        case "invoice":
          result = await this.processInvoice(job.data)
          break
        case "proration":
          result = await this.processProration(job.data)
          break
        case "webhook":
          result = await this.processWebhook(job.data)
          break
        default:
          throw new Error(`Tipo de job desconocido: ${type}`)
      }

      this.stats.jobsCompleted++
      logger.info(`Job ${job.id} completado exitosamente`, result)
      return result
    } catch (error) {
      this.stats.jobsFailed++
      const errorMessage = error instanceof Error ? error.message : "Error desconocido"
      logger.error(`Error procesando job ${job.id}:`, errorMessage)

      throw error // Re-lanzar para que BullMQ maneje el reintento
    }
  }

  /**
   * Procesa renovacion de suscripcion
   */
  private async processRenewal(data: BillingJobData): Promise<BillingJobResult> {
    const { subscriptionId, tenantId } = data

    if (!subscriptionId && !tenantId) {
      return {
        success: false,
        type: "renewal",
        error: "Se requiere subscriptionId o tenantId",
      }
    }

    try {
      // Obtener la suscripcion
      const subscription = subscriptionId
        ? await db.query.subscriptions.findFirst({
            where: eq(subscriptions.id, subscriptionId),
          })
        : await db.query.subscriptions.findFirst({
            where: eq(subscriptions.tenantId, tenantId!),
          })

      if (!subscription) {
        return {
          success: false,
          type: "renewal",
          subscriptionId,
          tenantId,
          error: "Suscripcion no encontrada",
        }
      }

      // Verificar si la suscripcion esta activa y configurada para auto-renovacion
      if (subscription.status !== SUBSCRIPTION_STATUS.ACTIVE) {
        return {
          success: false,
          type: "renewal",
          subscriptionId: subscription.id,
          tenantId: subscription.tenantId,
          error: `La suscripcion no esta activa. Estado actual: ${subscription.status}`,
        }
      }

      if (!subscription.autoRenew) {
        return {
          success: true,
          type: "renewal",
          subscriptionId: subscription.id,
          tenantId: subscription.tenantId,
          message: "La suscripcion no tiene auto-renovacion habilitada",
        }
      }

      // Verificar si el periodo actual ha terminado
      const now = new Date()
      if (subscription.currentPeriodEnd && subscription.currentPeriodEnd > now) {
        return {
          success: true,
          type: "renewal",
          subscriptionId: subscription.id,
          tenantId: subscription.tenantId,
          message: "El periodo actual aun no ha terminado",
        }
      }

      // Obtener el plan
      const plan = subscriptionService.getPlanById(subscription.planId)
      if (!plan) {
        return {
          success: false,
          type: "renewal",
          subscriptionId: subscription.id,
          tenantId: subscription.tenantId,
          error: "Plan no encontrado",
        }
      }

      // Calcular nuevo periodo
      const newPeriodStart = now
      const newPeriodEnd = this.calculatePeriodEnd(now, plan.interval)

      // Actualizar la suscripcion
      await db
        .update(subscriptions)
        .set({
          currentPeriodStart: newPeriodStart,
          currentPeriodEnd: newPeriodEnd,
          updatedAt: now,
        })
        .where(eq(subscriptions.id, subscription.id))

      // Crear una nueva factura para la renovacion
      const invoiceNumber = `INV-${Date.now()}-${subscription.tenantId.slice(0, 8)}`

      await db.insert(invoices).values({
        tenantId: subscription.tenantId,
        subscriptionId: subscription.id,
        number: invoiceNumber,
        amount: plan.price,
        currency: plan.currency,
        status: INVOICE_STATUS.OPEN,
        dueDate: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000), // 7 dias de vencimiento
      })

      logger.info(`Renovacion procesada para suscripcion ${subscription.id}`)

      return {
        success: true,
        type: "renewal",
        subscriptionId: subscription.id,
        tenantId: subscription.tenantId,
        message: "Suscripcion renovada exitosamente",
        data: {
          newPeriodStart,
          newPeriodEnd,
          invoiceNumber,
        },
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Error desconocido"
      logger.error("Error en processRenewal:", errorMessage)
      return {
        success: false,
        type: "renewal",
        subscriptionId,
        tenantId,
        error: errorMessage,
      }
    }
  }

  /**
   * Procesa reintento de cobro (dunning)
   */
  private async processDunning(data: BillingJobData): Promise<BillingJobResult> {
    const { subscriptionId, attemptId } = data

    if (!subscriptionId) {
      return {
        success: false,
        type: "dunning",
        error: "Se requiere subscriptionId",
      }
    }

    try {
      // Obtener la suscripcion
      const subscription = await db.query.subscriptions.findFirst({
        where: eq(subscriptions.id, subscriptionId),
      })

      if (!subscription) {
        return {
          success: false,
          type: "dunning",
          subscriptionId,
          error: "Suscripcion no encontrada",
        }
      }

      // Verificar si ya existe un intento de dunning
      let attempt
      if (attemptId) {
        attempt = await db.query.dunningAttempts.findFirst({
          where: eq(dunningAttempts.id, attemptId),
        })
      }

      // Determinar el numero de intento
      const existingAttempts = await db.query.dunningAttempts.findMany({
        where: eq(dunningAttempts.subscriptionId, subscriptionId),
      })

      const attemptNumber = existingAttempts.length + 1

      // Maximo 5 intentos de dunning
      if (attemptNumber > 5) {
        // Marcar suscripcion como vencida
        await db
          .update(subscriptions)
          .set({
            status: SUBSCRIPTION_STATUS.PAST_DUE,
            updatedAt: new Date(),
          })
          .where(eq(subscriptions.id, subscriptionId))

        return {
          success: false,
          type: "dunning",
          subscriptionId,
          error: "Se alcanzó el maximo de intentos de dunning",
        }
      }

      // Crear o actualizar el intento de dunning
      const newAttemptId = attemptId || `dunning-${Date.now()}-${subscriptionId.slice(0, 8)}`

      // Aqui iria la logica real de reintento de cobro con el gateway de pago
      // Por ahora simulamos el proceso
      const paymentSuccess = await this.simulatePaymentRetry(subscription)

      if (paymentSuccess) {
        // Actualizar intento como exitoso
        await db
          .insert(dunningAttempts)
          .values({
            id: newAttemptId,
            subscriptionId,
            attemptNumber,
            status: "SUCCESS",
          })
          .onConflictDoUpdate({
            target: dunningAttempts.id,
            set: { status: "SUCCESS" },
          })

        // Reactivar la suscripcion si estaba pausada
        if (subscription.status === SUBSCRIPTION_STATUS.PAST_DUE) {
          await db
            .update(subscriptions)
            .set({
              status: SUBSCRIPTION_STATUS.ACTIVE,
              updatedAt: new Date(),
            })
            .where(eq(subscriptions.id, subscriptionId))
        }

        return {
          success: true,
          type: "dunning",
          subscriptionId,
          message: "Cobro exitoso en reintento",
          data: {
            attemptNumber,
            attemptId: newAttemptId,
          },
        }
      } else {
        // Calcular proximo reintento con backoff exponencial
        const nextRetryDelay = Math.min(Math.pow(2, attemptNumber) * 24 * 60 * 60 * 1000, 7 * 24 * 60 * 60 * 1000) // Maximo 7 dias
        const nextRetryAt = new Date(Date.now() + nextRetryDelay)

        // Registrar intento fallido
        await db.insert(dunningAttempts).values({
          id: newAttemptId,
          subscriptionId,
          attemptNumber,
          status: "FAILED",
          error: "Payment declined",
          nextRetryAt,
        })

        return {
          success: false,
          type: "dunning",
          subscriptionId,
          error: "Cobro rechazado, programado proximo reintento",
          data: {
            attemptNumber,
            nextRetryAt,
            attemptId: newAttemptId,
          },
        }
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Error desconocido"
      logger.error("Error en processDunning:", errorMessage)
      return {
        success: false,
        type: "dunning",
        subscriptionId,
        error: errorMessage,
      }
    }
  }

  /**
   * Procesa generacion de factura
   */
  private async processInvoice(data: BillingJobData): Promise<BillingJobResult> {
    const { subscriptionId, tenantId, invoiceId, metadata } = data

    if (!tenantId && !subscriptionId) {
      return {
        success: false,
        type: "invoice",
        error: "Se requiere tenantId o subscriptionId",
      }
    }

    try {
      // Si ya existe una factura, obtenerla
      if (invoiceId) {
        const existingInvoice = await db.query.invoices.findFirst({
          where: eq(invoices.id, invoiceId),
        })

        if (existingInvoice) {
          return {
            success: true,
            type: "invoice",
            tenantId: existingInvoice.tenantId,
            message: "Factura existente encontrada",
            data: {
              invoiceId: existingInvoice.id,
              invoiceNumber: existingInvoice.number,
            },
          }
        }
      }

      // Obtener la suscripcion
      const subscription = subscriptionId
        ? await db.query.subscriptions.findFirst({
            where: eq(subscriptions.id, subscriptionId),
          })
        : await db.query.subscriptions.findFirst({
            where: eq(subscriptions.tenantId, tenantId!),
          })

      if (!subscription) {
        return {
          success: false,
          type: "invoice",
          subscriptionId,
          tenantId,
          error: "Suscripcion no encontrada",
        }
      }

      // Obtener el plan
      const plan = subscriptionService.getPlanById(subscription.planId)
      if (!plan) {
        return {
          success: false,
          type: "invoice",
          subscriptionId: subscription.id,
          tenantId: subscription.tenantId,
          error: "Plan no encontrado",
        }
      }

      // Calcular monto (considerando prorrateo si existe)
      let amount = plan.price
      if (subscription.prorationCredit && subscription.prorationCredit > 0) {
        amount = Math.max(0, amount - subscription.prorationCredit)
      }

      // Aplicar descuento si existe en metadata
      if (metadata?.discount) {
        amount = Math.max(0, amount - metadata.discount)
      }

      // Crear la factura
      const invoiceNumber = `INV-${Date.now()}-${subscription.tenantId.slice(0, 8)}`

      const [newInvoice] = await db
        .insert(invoices)
        .values({
          tenantId: subscription.tenantId,
          subscriptionId: subscription.id,
          number: invoiceNumber,
          amount,
          currency: plan.currency,
          tax: amount * 0.16, // IVA 16%
          discount: metadata?.discount || 0,
          couponId: metadata?.couponId,
          status: INVOICE_STATUS.OPEN,
          dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 dias
        })
        .returning()

      logger.info(`Factura creada: ${invoiceNumber}`)

      return {
        success: true,
        type: "invoice",
        subscriptionId: subscription.id,
        tenantId: subscription.tenantId,
        message: "Factura generada exitosamente",
        data: {
          invoiceId: newInvoice.id,
          invoiceNumber: newInvoice.number,
          amount: newInvoice.amount,
          dueDate: newInvoice.dueDate,
        },
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Error desconocido"
      logger.error("Error en processInvoice:", errorMessage)
      return {
        success: false,
        type: "invoice",
        subscriptionId,
        tenantId,
        error: errorMessage,
      }
    }
  }

  /**
   * Procesa calculo de prorrateo
   */
  private async processProration(data: BillingJobData): Promise<BillingJobResult> {
    const { subscriptionId, tenantId, metadata } = data

    if (!subscriptionId && !tenantId) {
      return {
        success: false,
        type: "proration",
        error: "Se requiere subscriptionId o tenantId",
      }
    }

    try {
      // Obtener la suscripcion
      const subscription = subscriptionId
        ? await db.query.subscriptions.findFirst({
            where: eq(subscriptions.id, subscriptionId),
          })
        : await db.query.subscriptions.findFirst({
            where: eq(subscriptions.tenantId, tenantId!),
          })

      if (!subscription) {
        return {
          success: false,
          type: "proration",
          subscriptionId,
          tenantId,
          error: "Suscripcion no encontrada",
        }
      }

      const oldPlanId = metadata?.oldPlanId
      const newPlanId = metadata?.newPlanId || subscription.planId

      if (!oldPlanId) {
        return {
          success: false,
          type: "proration",
          subscriptionId: subscription.id,
          tenantId: subscription.tenantId,
          error: "Se requiere oldPlanId en metadata",
        }
      }

      // Obtener planes
      const oldPlan = subscriptionService.getPlanById(oldPlanId)
      const newPlan = subscriptionService.getPlanById(newPlanId)

      if (!oldPlan || !newPlan) {
        return {
          success: false,
          type: "proration",
          subscriptionId: subscription.id,
          tenantId: subscription.tenantId,
          error: "Plan no encontrado",
        }
      }

      // Calcular dias restantes en el periodo actual
      const now = new Date()
      const periodEnd = subscription.currentPeriodEnd || now
      const periodStart = subscription.currentPeriodStart || now

      const totalDays = Math.ceil((periodEnd.getTime() - periodStart.getTime()) / (1000 * 60 * 60 * 24))
      const remainingDays = Math.ceil((periodEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))

      // Calcular prorrateo
      const oldDailyRate = oldPlan.price / 30
      const newDailyRate = newPlan.price / 30
      const dailyDifference = newDailyRate - oldDailyRate
      const prorationAmount = dailyDifference * remainingDays

      // Actualizar credito de prorrateo en la suscripcion
      const currentCredit = subscription.prorationCredit || 0
      const newCredit = Math.max(0, currentCredit - prorationAmount)

      await db
        .update(subscriptions)
        .set({
          prorationCredit: newCredit,
          updatedAt: now,
        })
        .where(eq(subscriptions.id, subscription.id))

      logger.info(`Prorrateo calculado para suscripcion ${subscription.id}: ${prorationAmount}`)

      return {
        success: true,
        type: "proration",
        subscriptionId: subscription.id,
        tenantId: subscription.tenantId,
        message: "Prorrateo calculado exitosamente",
        data: {
          oldPlanId,
          newPlanId,
          prorationAmount,
          remainingDays,
          totalDays,
          newCredit,
        },
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Error desconocido"
      logger.error("Error en processProration:", errorMessage)
      return {
        success: false,
        type: "proration",
        subscriptionId,
        tenantId,
        error: errorMessage,
      }
    }
  }

  /**
   * Procesa webhooks de pago
   */
  private async processWebhook(data: BillingJobData): Promise<BillingJobResult> {
    const { webhookPayload, tenantId, subscriptionId } = data

    if (!webhookPayload) {
      return {
        success: false,
        type: "webhook",
        error: "Se requiere webhookPayload",
      }
    }

    try {
      const { type: webhookType, data: webhookData } = webhookPayload

      logger.info(`Procesando webhook tipo: ${webhookType}`, webhookData)

      // Procesar segun el tipo de webhook
      switch (webhookType) {
        case "payment": {
          // Webhook de pago de MercadoPago
          const paymentId = webhookData.id

          // Aqui iria la logica para verificar el pago con la API de MercadoPago
          // Por ahora simulamos el proceso
          logger.info(`Procesando notificacion de pago: ${paymentId}`)

          return {
            success: true,
            type: "webhook",
            tenantId,
            subscriptionId,
            message: `Webhook de pago procesado: ${paymentId}`,
            data: {
              webhookType,
              paymentId,
            },
          }
        }

        case "subscription_preapproval": {
          // Webhook de suscripcion de MercadoPago
          const preapprovalId = webhookData.id

          // Buscar suscripcion por gateway preapproval ID
          const subscription = await db.query.subscriptions.findFirst({
            where: eq(subscriptions.gatewayPreapprovalId, preapprovalId),
          })

          if (subscription) {
            // Actualizar estado de la suscripcion
            await db
              .update(subscriptions)
              .set({
                status: SUBSCRIPTION_STATUS.ACTIVE,
                updatedAt: new Date(),
              })
              .where(eq(subscriptions.id, subscription.id))

            logger.info(`Suscripcion activada via webhook: ${subscription.id}`)

            return {
              success: true,
              type: "webhook",
              tenantId: subscription.tenantId,
              subscriptionId: subscription.id,
              message: "Suscripcion activada exitosamente",
              data: {
                webhookType,
                preapprovalId,
              },
            }
          }

          return {
            success: true,
            type: "webhook",
            message: "Webhook recibido pero suscripcion no encontrada",
            data: {
              webhookType,
              preapprovalId,
            },
          }
        }

        default:
          logger.warn(`Tipo de webhook no manejado: ${webhookType}`)
          return {
            success: true,
            type: "webhook",
            message: `Tipo de webhook no procesado: ${webhookType}`,
            data: {
              webhookType,
            },
          }
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Error desconocido"
      logger.error("Error en processWebhook:", errorMessage)
      return {
        success: false,
        type: "webhook",
        tenantId,
        subscriptionId,
        error: errorMessage,
      }
    }
  }

  /**
   * Configura los manejadores de eventos del worker
   */
  private setupEventHandlers(): void {
    if (!this.worker) return

    this.worker.on("completed", (job: Job<BillingJobData>, result: BillingJobResult) => {
      logger.info(`Job ${job.id} completado`, {
        type: job.data.type,
        result,
      })
    })

    this.worker.on("failed", (job: Job<BillingJobData> | undefined, error: Error) => {
      if (job) {
        logger.error(`Job ${job.id} fallido`, {
          type: job.data.type,
          error: error.message,
          attemptsMade: job.attemptsMade,
        })
      } else {
        logger.error("Job fallido sin informacion", error.message)
      }
    })

    this.worker.on("error", (error: Error) => {
      logger.error("Error en el worker", error.message)
    })

    this.worker.on("stalled", (jobId: string) => {
      logger.warn(`Job ${jobId} estancado`)
    })

    this.worker.on("progress", (job: Job<BillingJobData>, progress) => {
      let progressValue = 0
      if (typeof progress === "number") {
        progressValue = progress
      } else if (typeof progress === "object" && progress !== null) {
        progressValue = (progress as Record<string, unknown>).percentage as number || 0
      }
      logger.debug(`Job ${job.id} progreso: ${progressValue}%`)
    })

    this.worker.on("drained", () => {
      logger.info("Cola de jobs vacia")
    })

    this.worker.on("ready", () => {
      logger.info("Worker listo para procesar jobs")
    })

    // Manejar cierre graceful
    const gracefulShutdown = async () => {
      logger.info("Senal de cierre recibida, deteniendo worker...")
      await this.stop()
      process.exit(0)
    }

    process.on("SIGTERM", gracefulShutdown)
    process.on("SIGINT", gracefulShutdown)
  }

  /**
   * Calcula la fecha de fin de periodo
   */
  private calculatePeriodEnd(start: Date, interval: "monthly" | "yearly"): Date {
    const end = new Date(start)
    if (interval === "monthly") {
      end.setMonth(end.getMonth() + 1)
    } else {
      end.setFullYear(end.getFullYear() + 1)
    }
    return end
  }

  /**
   * Simula un reintento de pago
   * En produccion, esto conectaria con el gateway de pago real
   */
  private async simulatePaymentRetry(subscription: typeof subscriptions.$inferSelect): Promise<boolean> {
    // Simulacion: 70% de exito
    return Math.random() > 0.3
  }
}

// Exportar instancia singleton
export const billingWorker = new BillingWorker()

// Exportar clase para testing
export { BillingWorker }
