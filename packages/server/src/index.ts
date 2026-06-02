// Main entry point for AgenTo Backend (Bun + Hono)
import { serve, Server } from "bun"
import { app } from "./app"
import { env } from "./config/env"
import { logger } from "./utils/logger"
import { setupMonitoring } from "./monitoring"

const PORT = env.PORT
let server: ReturnType<typeof serve> | null = null

// Funcion para mostrar el banner de inicio
function showStartupBanner() {
  console.log(`
+===========================================================================+
|                                                                           |
|   AgenTo API Server v2.0                                                 |
|   Runtime: Bun ${Bun.version}                                               |
|   Port: ${PORT}                                                            |
|   Environment: ${env.NODE_ENV}                                             |
|                                                                           |
+===========================================================================+
`)
}

// Funcion de graceful shutdown
async function gracefulShutdown(signal: string) {
  logger.info(`Senal ${signal} recibida, iniciando cierre graceful...`)

  if (server) {
    server.stop()
    logger.info("Servidor HTTP detenido")
  }

  logger.info("Cierre graceful completado")
  process.exit(0)
}

// Funcion principal de inicio
async function startServer() {
  try {
    // Mostrar banner
    showStartupBanner()

    // Configurar monitoreo
    setupMonitoring()
    logger.info("Monitoreo configurado")

    // Iniciar servidor HTTP con Bun.serve
    server = serve({
      fetch: app.fetch,
      port: PORT,
      development: env.NODE_ENV === "development",
    })

    logger.info(`Servidor HTTP iniciado en puerto ${PORT}`)
    logger.info(`Health check disponible en: http://localhost:${PORT}/health`)

    // Configurar manejadores de senales para graceful shutdown
    process.on("SIGTERM", () => gracefulShutdown("SIGTERM"))
    process.on("SIGINT", () => gracefulShutdown("SIGINT"))

    logger.info("Manejadores de senales configurados (SIGTERM, SIGINT)")

  } catch (error) {
    logger.error("Error iniciando servidor:", error)
    process.exit(1)
  }
}

// Iniciar el servidor
startServer()
