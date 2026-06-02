/**
 * Start Workers - Script para iniciar todos los workers de procesamiento en segundo plano
 *
 * Este script inicia los 3 workers principales:
 * - WhatsApp Worker: Procesa mensajes entrantes de WhatsApp
 * - Billing Worker: Procesa jobs de facturacion y suscripciones
 * - Automation Worker: Procesa tareas automatizadas programadas
 *
 * Uso: bun run src/workers/start-workers.ts
 */

import { whatsappWorker } from "./whatsapp.worker"
import { billingWorker } from "./billing.worker"
import { automationWorker } from "./automation.worker"
import { createLogger } from "../utils/logger"

const logger = createLogger("workers-starter")

// Estado de los workers
interface WorkerStatus {
  name: string
  running: boolean
  error?: string
}

const workersStatus: WorkerStatus[] = [
  { name: "whatsapp", running: false },
  { name: "billing", running: false },
  { name: "automation", running: false },
]

/**
 * Muestra el banner de inicio de workers
 */
function showWorkersBanner() {
  console.log(`
+===========================================================================+
|                                                                           |
|   AgenTo Workers v2.0                                                    |
|   Iniciando workers de procesamiento en segundo plano                    |
|                                                                           |
+===========================================================================+
`)
}

/**
 * Inicia el worker de WhatsApp
 */
async function startWhatsAppWorker(): Promise<void> {
  try {
    logger.info("Iniciando WhatsApp Worker...")
    await whatsappWorker.start()
    workersStatus[0].running = true
    logger.info("WhatsApp Worker iniciado correctamente")
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Error desconocido"
    workersStatus[0].error = errorMessage
    logger.error("Error iniciando WhatsApp Worker:", errorMessage)
    throw error
  }
}

/**
 * Inicia el worker de Billing
 */
async function startBillingWorker(): Promise<void> {
  try {
    logger.info("Iniciando Billing Worker...")
    await billingWorker.start()
    workersStatus[1].running = true
    logger.info("Billing Worker iniciado correctamente")
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Error desconocido"
    workersStatus[1].error = errorMessage
    logger.error("Error iniciando Billing Worker:", errorMessage)
    throw error
  }
}

/**
 * Inicia el worker de Automation
 */
async function startAutomationWorker(): Promise<void> {
  try {
    logger.info("Iniciando Automation Worker...")
    await automationWorker.start()
    workersStatus[2].running = true
    logger.info("Automation Worker iniciado correctamente")
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Error desconocido"
    workersStatus[2].error = errorMessage
    logger.error("Error iniciando Automation Worker:", errorMessage)
    throw error
  }
}

/**
 * Detiene todos los workers de forma graceful
 */
async function stopAllWorkers(): Promise<void> {
  logger.info("Deteniendo todos los workers...")

  const stopPromises: Promise<void>[] = []

  // Detener WhatsApp Worker
  if (workersStatus[0].running) {
    stopPromises.push(
      whatsappWorker.stop()
        .then(() => logger.info("WhatsApp Worker detenido"))
        .catch((err) => logger.error("Error deteniendo WhatsApp Worker:", err.message))
    )
  }

  // Detener Billing Worker
  if (workersStatus[1].running) {
    stopPromises.push(
      billingWorker.stop()
        .then(() => logger.info("Billing Worker detenido"))
        .catch((err) => logger.error("Error deteniendo Billing Worker:", err.message))
    )
  }

  // Detener Automation Worker
  if (workersStatus[2].running) {
    stopPromises.push(
      automationWorker.stop()
        .then(() => logger.info("Automation Worker detenido"))
        .catch((err) => logger.error("Error deteniendo Automation Worker:", err.message))
    )
  }

  await Promise.allSettled(stopPromises)
  logger.info("Todos los workers han sido detenidos")
}

/**
 * Funcion de graceful shutdown
 */
async function gracefulShutdown(signal: string): Promise<void> {
  logger.info(`Senal ${signal} recibida, iniciando cierre graceful de workers...`)

  await stopAllWorkers()

  logger.info("Cierre graceful completado")
  process.exit(0)
}

/**
 * Muestra el estado de los workers
 */
function showWorkersStatus(): void {
  console.log("\nEstado de Workers:")
  console.log("------------------")
  workersStatus.forEach((status) => {
    const statusStr = status.running ? "ACTIVO" : "INACTIVO"
    const errorStr = status.error ? ` (Error: ${status.error})` : ""
    console.log(`  - ${status.name}: ${statusStr}${errorStr}`)
  })
  console.log("")
}

/**
 * Funcion principal que inicia todos los workers
 */
async function startAllWorkers(): Promise<void> {
  // Mostrar banner
  showWorkersBanner()

  logger.info("Iniciando todos los workers...")

  try {
    // Iniciar workers en paralelo
    await Promise.all([
      startWhatsAppWorker(),
      startBillingWorker(),
      startAutomationWorker(),
    ])

    // Mostrar estado
    showWorkersStatus()

    logger.info("Todos los workers iniciados correctamente")

    // Configurar manejadores de senales para graceful shutdown
    process.on("SIGTERM", () => gracefulShutdown("SIGTERM"))
    process.on("SIGINT", () => gracefulShutdown("SIGINT"))

    logger.info("Manejadores de senales configurados (SIGTERM, SIGINT)")

    // Log periodico de estado (cada 5 minutos)
    setInterval(() => {
      const runningCount = workersStatus.filter((w) => w.running).length
      logger.info(`Workers activos: ${runningCount}/${workersStatus.length}`)
    }, 5 * 60 * 1000)

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Error desconocido"
    logger.error("Error iniciando workers:", errorMessage)

    // Intentar detener los workers que si iniciaron
    await stopAllWorkers()

    process.exit(1)
  }
}

// Iniciar todos los workers
startAllWorkers()

// Exportar funciones para uso externo
export { startAllWorkers, stopAllWorkers }
