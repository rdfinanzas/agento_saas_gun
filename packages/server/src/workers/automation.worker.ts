/**
 * Automation Worker - BullMQ Worker para procesar tareas de automatizacion
 *
 * Tipos de tareas soportadas:
 * - stock_check: Verificacion de inventario
 * - alert: Envio de alertas
 * - follow_up: Seguimiento de clientes/conversaciones
 * - report: Generacion de reportes
 * - custom: Tareas personalizadas
 */

import { Worker, Job, Queue, JobProgress } from "bullmq"
import { eq, and, sql } from "drizzle-orm"
import { db } from "../db"
import { scheduledTasks, taskExecutions, agents } from "../db/schema"
import { redis } from "../config/redis"
import { createLogger } from "../utils/logger"
import { env } from "../config/env"

// Opciones de conexion para BullMQ derivadas de la configuracion de Redis
const redisConnection = {
  host: env.REDIS_HOST || "localhost",
  port: Number(env.REDIS_PORT) || 6379,
  password: env.REDIS_PASSWORD || undefined,
  db: Number(env.REDIS_DB) || 0,
}

const logger = createLogger("automation-worker")

// Tipos de tareas de automatizacion
export type AutomationTaskType = "stock_check" | "alert" | "follow_up" | "report" | "custom"

// Datos del job de automatizacion
export interface AutomationJobData {
  tenantId: string
  taskType: AutomationTaskType
  taskConfig: Record<string, any>
  agentId?: string
  scheduledTaskId?: string
  priority?: number
  retryCount?: number
}

// Resultado del procesamiento del job
export interface AutomationJobResult {
  success: boolean
  taskType: AutomationTaskType
  tenantId: string
  agentId?: string
  data?: Record<string, any>
  error?: string
  duration: number
  processedAt: Date
}

// Estadisticas del worker
export interface WorkerStats {
  isRunning: boolean
  queueName: string
  jobsCompleted: number
  jobsFailed: number
  jobsProcessed: number
  averageProcessingTime: number
  lastJobAt: Date | null
  uptime: number
}

// Configuracion del worker
interface WorkerConfig {
  concurrency?: number
  limiter?: {
    max: number
    duration: number
  }
}

// Cola de automatizaciones
const QUEUE_NAME = "automation"

// Variable para almacenar la cola
let automationQueue: Queue | null = null

/**
 * Clase principal del Automation Worker
 */
export class AutomationWorker {
  private worker: Worker | null = null
  private isRunning: boolean = false
  private startTime: Date | null = null

  // Estadisticas
  private jobsCompleted: number = 0
  private jobsFailed: number = 0
  private jobsProcessed: number = 0
  private totalProcessingTime: number = 0
  private lastJobAt: Date | null = null

  // Configuracion por defecto
  private readonly defaultConcurrency: number = 5
  private readonly defaultRateLimit = { max: 100, duration: 60000 } // 100 jobs por minuto

  constructor(private config: WorkerConfig = {}) {}

  /**
   * Inicializa y inicia el worker
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      logger.warn("Worker ya esta en ejecucion")
      return
    }

    logger.info("Iniciando Automation Worker...")

    // Crear la cola
    automationQueue = new Queue(QUEUE_NAME, {
      connection: redisConnection,
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: "exponential",
          delay: 1000,
        },
        removeOnComplete: {
          age: 3600, // Mantener jobs completados por 1 hora
          count: 1000, // Maximo 1000 jobs
        },
        removeOnFail: {
          age: 86400, // Mantener jobs fallidos por 24 horas
        },
      },
    })

    // Crear el worker
    this.worker = new Worker<AutomationJobData, AutomationJobResult>(
      QUEUE_NAME,
      async (job: Job<AutomationJobData>) => this.process(job),
      {
        connection: redisConnection,
        concurrency: this.config.concurrency || this.defaultConcurrency,
        limiter: this.config.limiter || this.defaultRateLimit,
      }
    )

    // Configurar eventos del worker
    this.setupWorkerEvents()

    this.isRunning = true
    this.startTime = new Date()

    logger.info("Automation Worker iniciado correctamente", {
      queue: QUEUE_NAME,
      concurrency: this.config.concurrency || this.defaultConcurrency,
    })
  }

  /**
   * Detiene el worker de forma graceful
   */
  async stop(): Promise<void> {
    if (!this.isRunning || !this.worker) {
      logger.warn("Worker no esta en ejecucion")
      return
    }

    logger.info("Deteniendo Automation Worker...")

    this.isRunning = false

    // Cerrar worker gracefully (espera a que terminen los jobs actuales)
    await this.worker.close()

    // Cerrar la cola
    if (automationQueue) {
      await automationQueue.close()
      automationQueue = null
    }

    logger.info("Automation Worker detenido correctamente", {
      jobsCompleted: this.jobsCompleted,
      jobsFailed: this.jobsFailed,
      uptime: this.getStats().uptime,
    })
  }

  /**
   * Obtiene las estadisticas del worker
   */
  getStats(): WorkerStats {
    return {
      isRunning: this.isRunning,
      queueName: QUEUE_NAME,
      jobsCompleted: this.jobsCompleted,
      jobsFailed: this.jobsFailed,
      jobsProcessed: this.jobsProcessed,
      averageProcessingTime:
        this.jobsProcessed > 0 ? this.totalProcessingTime / this.jobsProcessed : 0,
      lastJobAt: this.lastJobAt,
      uptime: this.startTime ? Math.floor((Date.now() - this.startTime.getTime()) / 1000) : 0,
    }
  }

  /**
   * Procesa un job de automatizacion
   */
  async process(job: Job<AutomationJobData>): Promise<AutomationJobResult> {
    const startTime = Date.now()
    const { tenantId, taskType, taskConfig, agentId, scheduledTaskId } = job.data

    logger.info("Procesando job de automatizacion", {
      jobId: job.id,
      taskType,
      tenantId,
      agentId,
      attempt: job.attemptsMade,
    })

    let executionId: string | null = null

    try {
      // Crear registro de ejecucion si hay scheduledTaskId
      if (scheduledTaskId) {
        executionId = await this.createExecution(scheduledTaskId, tenantId)
      }

      // Verificar que el agente existe (si se especifica)
      if (agentId) {
        const agent = await db.query.agents.findFirst({
          where: and(eq(agents.id, agentId), eq(agents.tenantId, tenantId)),
        })

        if (!agent) {
          throw new Error(`Agente no encontrado: ${agentId}`)
        }
      }

      // Procesar segun el tipo de tarea
      let result: Record<string, any>

      switch (taskType) {
        case "stock_check":
          result = await this.processStockCheck(tenantId, taskConfig, agentId)
          break
        case "alert":
          result = await this.processAlert(tenantId, taskConfig, agentId)
          break
        case "follow_up":
          result = await this.processFollowUp(tenantId, taskConfig, agentId)
          break
        case "report":
          result = await this.processReport(tenantId, taskConfig, agentId)
          break
        case "custom":
          result = await this.processCustom(tenantId, taskConfig, agentId)
          break
        default:
          throw new Error(`Tipo de tarea no soportado: ${taskType}`)
      }

      const duration = Date.now() - startTime

      // Actualizar estadisticas
      this.updateStats(true, duration)

      // Actualizar ejecucion como completada
      if (executionId) {
        await this.updateExecution(executionId, "completed", result)
      }

      // Actualizar tarea programada
      if (scheduledTaskId) {
        await this.updateScheduledTask(scheduledTaskId)
      }

      const jobResult: AutomationJobResult = {
        success: true,
        taskType,
        tenantId,
        agentId,
        data: result,
        duration,
        processedAt: new Date(),
      }

      logger.info("Job completado exitosamente", {
        jobId: job.id,
        taskType,
        duration,
      })

      return jobResult
    } catch (error) {
      const duration = Date.now() - startTime
      const errorMessage = error instanceof Error ? error.message : "Error desconocido"

      // Actualizar estadisticas
      this.updateStats(false, duration)

      // Actualizar ejecucion como fallida
      if (executionId) {
        await this.updateExecution(executionId, "failed", null, errorMessage)
      }

      logger.error("Error procesando job", {
        jobId: job.id,
        taskType,
        error: errorMessage,
        attempt: job.attemptsMade,
      })

      // Si es el ultimo intento, marcar como fallo definitivo
      if (job.attemptsMade >= (job.opts.attempts || 3) - 1) {
        throw error
      }

      // Reintentar
      throw error
    }
  }

  /**
   * Procesa tarea de verificacion de inventario
   */
  private async processStockCheck(
    tenantId: string,
    config: Record<string, any>,
    agentId?: string
  ): Promise<Record<string, any>> {
    logger.debug("Procesando stock_check", { tenantId, agentId, config })

    // TODO: Implementar logica de verificacion de inventario
    // Esta es una implementacion base que puede ser extendida

    const { productIds, threshold = 10, notifyOnLowStock = true } = config

    // Simular verificacion de stock
    const results = {
      checked: productIds?.length || 0,
      lowStock: [] as Array<{ productId: string; currentStock: number }>,
      outOfStock: [] as string[],
      timestamp: new Date(),
    }

    // Aqui iria la integracion con el sistema de inventario real
    // Por ahora retornamos resultados simulados

    if (notifyOnLowStock && results.lowStock.length > 0) {
      // Encolar notificacion de alerta
      await this.enqueueAlert(tenantId, {
        type: "low_stock",
        data: results.lowStock,
        agentId,
      })
    }

    return results
  }

  /**
   * Procesa tarea de alerta
   */
  private async processAlert(
    tenantId: string,
    config: Record<string, any>,
    agentId?: string
  ): Promise<Record<string, any>> {
    logger.debug("Procesando alert", { tenantId, agentId, config })

    const { type, recipients, message, channels = ["whatsapp"] } = config

    // TODO: Implementar logica de envio de alertas
    // Integrar con WhatsApp, Email, SMS, etc.

    const result = {
      type,
      sent: false,
      recipients: recipients?.length || 0,
      channels,
      timestamp: new Date(),
    }

    // Simular envio de alerta
    if (recipients && recipients.length > 0) {
      // Aqui iria la logica real de envio
      result.sent = true
    }

    return result
  }

  /**
   * Procesa tarea de seguimiento
   */
  private async processFollowUp(
    tenantId: string,
    config: Record<string, any>,
    agentId?: string
  ): Promise<Record<string, any>> {
    logger.debug("Procesando follow_up", { tenantId, agentId, config })

    const { conversationId, customerId, delay, message } = config

    // TODO: Implementar logica de seguimiento
    // Verificar conversaciones pendientes, enviar recordatorios, etc.

    const result = {
      conversationId,
      customerId,
      action: "follow_up_sent",
      timestamp: new Date(),
    }

    return result
  }

  /**
   * Procesa tarea de generacion de reportes
   */
  private async processReport(
    tenantId: string,
    config: Record<string, any>,
    agentId?: string
  ): Promise<Record<string, any>> {
    logger.debug("Procesando report", { tenantId, agentId, config })

    const { type, period, format = "json", includeCharts = false } = config

    // TODO: Implementar generacion de reportes
    // Integrar con servicio de analytics

    const result = {
      type,
      period,
      format,
      generatedAt: new Date(),
      downloadUrl: null as string | null,
    }

    // Simular generacion de reporte
    // result.downloadUrl = await this.generateReportFile(tenantId, type, period, format)

    return result
  }

  /**
   * Procesa tarea personalizada
   * SP-8: Ejecuta tools del sistema o del usuario
   */
  private async processCustom(
    tenantId: string,
    config: Record<string, any>,
    agentId?: string
  ): Promise<Record<string, any>> {
    logger.debug("Procesando custom task", { tenantId, agentId, config })

    const { toolType, toolName, toolParams, toolId } = config

    // Si es una tool del sistema
    if (toolType === "system") {
      return this.executeSystemTool(tenantId, toolName, toolParams || {})
    }

    // Si es una user tool
    if (toolType === "user" && toolId) {
      return this.executeUserTool(tenantId, toolId, toolParams || {})
    }

    // Fallback: comportamiento anterior
    const { handler, payload } = config
    return {
      handler,
      executed: true,
      timestamp: new Date(),
      payload,
    }
  }

  /**
   * Ejecuta una tool del sistema
   */
  private async executeSystemTool(
    tenantId: string,
    toolName: string,
    params: Record<string, any>
  ): Promise<Record<string, any>> {
    logger.debug("Ejecutando system tool", { tenantId, toolName })

    // Importar dinámicamente las tools
    const { executeHttpRequest, executeDbQuery, executeWhatsappSend, executeReadUrl } = 
      await import("@/lib/opencode/tools")

    switch (toolName) {
      case "http_request":
        return await executeHttpRequest(params)
      
      case "db_query":
        return await executeDbQuery(params, { tenantId })
      
      case "whatsapp_send":
        return await executeWhatsappSend(params, { tenantId })
      
      case "read_url":
        return await executeReadUrl(params)
      
      default:
        throw new Error(`System tool not found: ${toolName}`)
    }
  }

  /**
   * Ejecuta una user tool
   */
  private async executeUserTool(
    tenantId: string,
    toolId: string,
    params: Record<string, any>
  ): Promise<Record<string, any>> {
    logger.debug("Ejecutando user tool", { tenantId, toolId })

    const { toolExecutor } = await import("@/modules/agent-ai/services")
    const { db } = await import("@/db")
    const { userTools } = await import("@/db/schema")
    const { eq, and } = await import("drizzle-orm")

    // Obtener la tool
    const tool = await db.query.userTools.findFirst({
      where: and(
        eq(userTools.id, toolId),
        eq(userTools.tenantId, tenantId),
        eq(userTools.isActive, true)
      ),
    })

    if (!tool) {
      throw new Error(`User tool not found: ${toolId}`)
    }

    // Ejecutar
    const result = await toolExecutor.execute(
      tool,
      params,
      { tenantId }
    )

    return {
      toolId,
      toolName: tool.name,
      success: result.success,
      output: result.output,
      error: result.error,
      duration: result.durationMs,
    }
  }

  /**
   * Encola una tarea de alerta
   */
  private async enqueueAlert(
    tenantId: string,
    alertConfig: Record<string, any>
  ): Promise<void> {
    if (!automationQueue) {
      logger.warn("Cola no disponible para encolar alerta")
      return
    }

    await automationQueue.add(
      "alert",
      {
        tenantId,
        taskType: "alert",
        taskConfig: alertConfig,
        agentId: alertConfig.agentId,
      },
      {
        priority: 1, // Alta prioridad para alertas
      }
    )
  }

  /**
   * Crea un registro de ejecucion
   */
  private async createExecution(taskId: string, tenantId: string): Promise<string> {
    const [execution] = await db
      .insert(taskExecutions)
      .values({
        taskId,
        tenantId,
        status: "running",
        startedAt: new Date(),
      })
      .returning()

    return execution.id
  }

  /**
   * Actualiza un registro de ejecucion
   */
  private async updateExecution(
    executionId: string,
    status: string,
    result?: any,
    error?: string
  ): Promise<void> {
    await db
      .update(taskExecutions)
      .set({
        status,
        completedAt: new Date(),
        result,
        error,
      })
      .where(eq(taskExecutions.id, executionId))
  }

  /**
   * Actualiza una tarea programada despues de ejecutar
   */
  private async updateScheduledTask(taskId: string): Promise<void> {
    await db
      .update(scheduledTasks)
      .set({
        lastRunAt: new Date(),
        runCount: sql`${scheduledTasks.runCount} + 1`,
        updatedAt: new Date(),
      })
      .where(eq(scheduledTasks.id, taskId))
  }

  /**
   * Actualiza las estadisticas del worker
   */
  private updateStats(success: boolean, duration: number): void {
    this.jobsProcessed++
    this.totalProcessingTime += duration
    this.lastJobAt = new Date()

    if (success) {
      this.jobsCompleted++
    } else {
      this.jobsFailed++
    }
  }

  /**
   * Configura los eventos del worker
   */
  private setupWorkerEvents(): void {
    if (!this.worker) return

    this.worker.on("completed", (job: Job, result: AutomationJobResult) => {
      logger.debug("Job completado", {
        jobId: job.id,
        taskType: result.taskType,
        duration: result.duration,
      })
    })

    this.worker.on("failed", (job: Job | undefined, error: Error) => {
      logger.error("Job fallido", {
        jobId: job?.id,
        error: error.message,
        attemptsMade: job?.attemptsMade,
      })
    })

    this.worker.on("error", (error: Error) => {
      logger.error("Error en el worker", { error: error.message })
    })

    this.worker.on("stalled", (jobId: string) => {
      logger.warn("Job estancado", { jobId })
    })

    this.worker.on("active", (job: Job) => {
      logger.debug("Job activo", { jobId: job.id })
    })

    this.worker.on("progress", (job: Job, progress: JobProgress) => {
      logger.debug("Progreso del job", { jobId: job.id, progress })
    })
  }
}

// Exportar instancia singleton
export const automationWorker = new AutomationWorker()

// Exportar funcion para obtener la cola
export function getAutomationQueue(): Queue | null {
  return automationQueue
}

// Manejar graceful shutdown
process.on("SIGINT", async () => {
  logger.info("Recibida senal SIGINT, cerrando worker...")
  await automationWorker.stop()
  process.exit(0)
})

process.on("SIGTERM", async () => {
  logger.info("Recibida senal SIGTERM, cerrando worker...")
  await automationWorker.stop()
  process.exit(0)
})

export default automationWorker
