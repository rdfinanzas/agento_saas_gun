/**
 * Start All - Script para iniciar el servidor HTTP + Workers + WebSocket en paralelo
 *
 * Este script inicia:
 * 1. Servidor HTTP con Hono/Bun
 * 2. Workers de procesamiento en segundo plano (WhatsApp, Billing, Automation)
 * 3. Servidor WebSocket para tiempo real
 *
 * Uso: bun run scripts/start-all.ts
 */

import { serve, Server } from "bun"
import { app } from "../src/app"
import { env } from "../src/config/env"
import { createLogger } from "../src/utils/logger"
import { setupMonitoring } from "../src/monitoring"
import { whatsappWorker } from "../src/workers/whatsapp.worker"
import { billingWorker } from "../src/workers/billing.worker"
import { automationWorker } from "../src/workers/automation.worker"
import { aiWorker } from "../src/workers/ai.worker"
import { startWebSocketServer, stopWebSocketServer } from "../src/websocket"

const logger = createLogger("start-all")

const PORT = env.PORT
let server: Server | null = null

// Estado de los componentes
interface ComponentStatus {
  name: string
  running: boolean
  error?: string
}

const componentsStatus: ComponentStatus[] = [
  { name: "HTTP Server", running: false },
  { name: "WebSocket Server", running: false },
  { name: "WhatsApp Worker", running: false },
  { name: "Billing Worker", running: false },
  { name: "Automation Worker", running: false },
  { name: "AI Worker", running: false },
]

/**
 * Muestra el banner de inicio
 */
function showStartupBanner() {
  console.log(`
+===========================================================================+
|                                                                           |
|   AgenTo Server v2.0 - Full Stack                                        |
|                                                                           |
|   Iniciando HTTP + WebSocket + Workers en paralelo                       |
|                                                                           |
+===========================================================================+
`)
}

/**
 * Inicia el servidor HTTP
 */
async function startHttpServer(): Promise<void> {
  try {
    logger.info("Iniciando servidor HTTP...")

    server = serve({
      fetch: app.fetch,
      port: PORT,
      development: env.NODE_ENV === "development",
    })

    componentsStatus[0].running = true
    logger.info(`Servidor HTTP iniciado en puerto ${PORT}`)
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Error desconocido"
    componentsStatus[0].error = errorMessage
    logger.error("Error iniciando servidor HTTP:", errorMessage)
    throw error
  }
}

/**
 * Inicia el worker de WhatsApp
 */
async function startWhatsAppWorker(): Promise<void> {
  try {
    logger.info("Iniciando WhatsApp Worker...")
    await whatsappWorker.start()
    componentsStatus[2].running = true
    logger.info("WhatsApp Worker iniciado correctamente")
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Error desconocido"
    componentsStatus[2].error = errorMessage
    logger.error("Error iniciando WhatsApp Worker:", errorMessage)
    // No lanzamos el error para permitir que otros componentes inicien
  }
}

/**
 * Inicia el worker de Billing
 */
async function startBillingWorker(): Promise<void> {
  try {
    logger.info("Iniciando Billing Worker...")
    await billingWorker.start()
    componentsStatus[3].running = true
    logger.info("Billing Worker iniciado correctamente")
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Error desconocido"
    componentsStatus[3].error = errorMessage
    logger.error("Error iniciando Billing Worker:", errorMessage)
    // No lanzamos el error para permitir que otros componentes inicien
  }
}

/**
 * Inicia el worker de Automation
 */
async function startAutomationWorker(): Promise<void> {
  try {
    logger.info("Iniciando Automation Worker...")
    await automationWorker.start()
    componentsStatus[4].running = true
    logger.info("Automation Worker iniciado correctamente")
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Error desconocido"
    componentsStatus[4].error = errorMessage
    logger.error("Error iniciando Automation Worker:", errorMessage)
    // No lanzamos el error para permitir que otros componentes inicien
  }
}

/**
 * Inicia el worker de AI
 */
async function startAIWorker(): Promise<void> {
  try {
    logger.info("Iniciando AI Worker...")
    await aiWorker.start()
    componentsStatus[5].running = true
    logger.info("AI Worker iniciado correctamente")
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Error desconocido"
    componentsStatus[5].error = errorMessage
    logger.error("Error iniciando AI Worker:", errorMessage)
    // No lanzamos el error para permitir que otros componentes inicien
  }
}

/**
 * Inicia el servidor WebSocket
 */
async function startWebSocket(): Promise<void> {
  try {
    logger.info("Iniciando WebSocket Server...")
    const wsPort = env.PORT + 1 // WebSocket en puerto HTTP + 1
    await startWebSocketServer(wsPort)
    componentsStatus[1].running = true
    logger.info(`WebSocket Server iniciado en puerto ${wsPort}`)
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Error desconocido"
    componentsStatus[1].error = errorMessage
    logger.error("Error iniciando WebSocket Server:", errorMessage)
    // No lanzamos el error para permitir que otros componentes inicien
  }
}

/**
 * Detiene todos los componentes de forma graceful
 */
async function stopAllComponents(): Promise<void> {
  logger.info("Deteniendo todos los componentes...")

  const stopPromises: Promise<void>[] = []

  // Detener servidor HTTP
  if (server && componentsStatus[0].running) {
    server.stop()
    logger.info("Servidor HTTP detenido")
  }

  // Detener WebSocket Server
  if (componentsStatus[1].running) {
    stopPromises.push(
      stopWebSocketServer()
        .then(() => logger.info("WebSocket Server detenido"))
        .catch((err) => logger.error("Error deteniendo WebSocket Server:", err.message))
    )
  }

  // Detener WhatsApp Worker
  if (componentsStatus[2].running) {
    stopPromises.push(
      whatsappWorker.stop()
        .then(() => logger.info("WhatsApp Worker detenido"))
        .catch((err) => logger.error("Error deteniendo WhatsApp Worker:", err.message))
    )
  }

  // Detener Billing Worker
  if (componentsStatus[3].running) {
    stopPromises.push(
      billingWorker.stop()
        .then(() => logger.info("Billing Worker detenido"))
        .catch((err) => logger.error("Error deteniendo Billing Worker:", err.message))
    )
  }

  // Detener Automation Worker
  if (componentsStatus[4].running) {
    stopPromises.push(
      automationWorker.stop()
        .then(() => logger.info("Automation Worker detenido"))
        .catch((err) => logger.error("Error deteniendo Automation Worker:", err.message))
    )
  }

  // Detener AI Worker
  if (componentsStatus[5].running) {
    stopPromises.push(
      aiWorker.stop()
        .then(() => logger.info("AI Worker detenido"))
        .catch((err) => logger.error("Error deteniendo AI Worker:", err.message))
    )
  }

  await Promise.allSettled(stopPromises)
  logger.info("Todos los componentes han sido detenidos")
}

/**
 * Funcion de graceful shutdown
 */
async function gracefulShutdown(signal: string): Promise<void> {
  logger.info(`Senal ${signal} recibida, iniciando cierre graceful...`)

  await stopAllComponents()

  logger.info("Cierre graceful completado")
  process.exit(0)
}

/**
 * Muestra el estado de todos los componentes
 */
function showComponentsStatus(): void {
  console.log("\n+-------------------------------------------------------------------+")
  console.log("| Estado de Componentes                                             |")
  console.log("+-------------------------------------------------------------------+")

  componentsStatus.forEach((status) => {
    const statusStr = status.running ? "ACTIVO" : "INACTIVO"
    const errorStr = status.error ? ` (Error: ${status.error})` : ""
    const padding = " ".repeat(Math.max(0, 30 - status.name.length))
    console.log(`| ${status.name}${padding} | ${statusStr.padEnd(10)} |`)
    if (status.error) {
      console.log(`|   Error: ${status.error}${" ".repeat(Math.max(0, 54 - status.error.length))} |`)
    }
  })

  console.log("+-------------------------------------------------------------------+\n")
}

/**
 * Muestra informacion de endpoints disponibles
 */
function showEndpointsInfo(): void {
  const wsPort = PORT + 1
  console.log("Endpoints disponibles:")
  console.log("---------------------")
  console.log(`  Health Check: http://localhost:${PORT}/health`)
  console.log(`  API Base:     http://localhost:${PORT}/api/v1`)
  console.log(`  WebSocket:    ws://localhost:${wsPort}/ws`)
  console.log("")
}

/**
 * Funcion principal que inicia servidor + workers + websocket en paralelo
 */
async function startAll(): Promise<void> {
  // Mostrar banner
  showStartupBanner()

  logger.info(`Iniciando AgenTo Server v2.0 en modo: ${env.NODE_ENV}`)

  try {
    // Configurar monitoreo
    setupMonitoring()
    logger.info("Monitoreo configurado")

    // Iniciar todos los componentes en paralelo
    logger.info("Iniciando componentes en paralelo...")

    await Promise.all([
      startHttpServer(),
      startWebSocket(),
      startWhatsAppWorker(),
      startBillingWorker(),
      startAutomationWorker(),
      startAIWorker(),
    ])

    // Mostrar estado y endpoints
    showComponentsStatus()
    showEndpointsInfo()

    const runningCount = componentsStatus.filter((c) => c.running).length
    logger.info(`Sistema iniciado: ${runningCount}/${componentsStatus.length} componentes activos`)

    // Si el servidor HTTP no inicio, es un error critico
    if (!componentsStatus[0].running) {
      throw new Error("El servidor HTTP no pudo iniciar. Revisa los logs para mas detalles.")
    }

    // Configurar manejadores de senales para graceful shutdown
    process.on("SIGTERM", () => gracefulShutdown("SIGTERM"))
    process.on("SIGINT", () => gracefulShutdown("SIGINT"))

    logger.info("Manejadores de senales configurados (SIGTERM, SIGINT)")

    // Log periodico de estado (cada 5 minutos)
    setInterval(() => {
      const runningCount = componentsStatus.filter((c) => c.running).length
      const wsRunning = componentsStatus[1].running ? 1 : 0
      const workersRunning = componentsStatus.slice(2).filter((c) => c.running).length
      logger.info(`Estado: HTTP activo, WebSocket ${wsRunning}/1, Workers ${workersRunning}/4 activos`)
    }, 5 * 60 * 1000)

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Error desconocido"
    logger.error("Error iniciando el sistema:", errorMessage)

    // Intentar detener los componentes que si iniciaron
    await stopAllComponents()

    process.exit(1)
  }
}

// Iniciar todo
startAll()

// Exportar funciones para uso externo
export { startAll, stopAllComponents }
