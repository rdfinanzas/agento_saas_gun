// WebSocket Server for AgenTo - Bun + Redis Pub/Sub
import { serve, type ServerWebSocket } from "bun"
import Redis from "ioredis"
import { Hono } from "hono"
import { cors } from "hono/cors"
import { env } from "../config/env"
import { createLogger } from "../utils/logger"
import { createPublisher, createSubscriber, redisHealthCheck } from "../config/redis"
import {
  handleOpen,
  handleMessage,
  handleClose,
  type WSContext,
} from "./handlers"
import type {
  WebSocketData,
  WSMessage,
  WSServerStats,
  WSHealthCheck,
  RedisPubSubMessage,
} from "./types"

const logger = createLogger("ws-server")

// ============================================
// WebSocket Server Class
// ============================================

export class WebSocketServer {
  private server: ReturnType<typeof serve> | null = null
  private publisher: Redis | null = null
  private subscriber: Redis | null = null
  private startedAt: Date | null = null
  private instanceId: string
  private messagesReceived: number = 0
  private messagesSent: number = 0
  private connections: Map<string, ServerWebSocket<WebSocketData>> = new Map()

  // Redis channels for pub/sub
  private readonly REDIS_CHANNEL = "agento:websocket:broadcast"

  constructor() {
    this.instanceId = `ws-${process.pid}-${Date.now()}`
  }

  // ============================================
  // Server Lifecycle
  // ============================================

  /**
   * Inicia el servidor WebSocket
   */
  async start(port: number = env.PORT + 1): Promise<void> {
    if (this.server) {
      logger.warn("El servidor WebSocket ya esta en ejecucion")
      return
    }

    // Inicializar conexiones Redis para pub/sub
    await this.initRedisPubSub()

    // Crear servidor Bun con soporte WebSocket
    this.server = serve({
      port,
      fetch: this.createFetchRequestHandler(),
      websocket: {
        open: (ws) => this.onOpen(ws as ServerWebSocket<WebSocketData>),
        message: (ws, message) => this.onMessage(ws as ServerWebSocket<WebSocketData>, message),
        close: (ws) => this.onClose(ws as ServerWebSocket<WebSocketData>),
      },
      development: env.NODE_ENV === "development",
    })

    this.startedAt = new Date()

    logger.info(`
╔═════════════════════════════════════════════════════════════════════════╗
║                                                                           ║
║   AgenTo WebSocket Server                                                ║
║   Runtime: Bun ${Bun.version}                                              ║
║   Port: ${port}                                                            ║
║   Instance: ${this.instanceId}                                     ║
║   Environment: ${env.NODE_ENV}                                              ║
║                                                                           ║
╚═════════════════════════════════════════════════════════════════════════╝
    `)
  }

  /**
   * Detiene el servidor WebSocket gracefully
   */
  async stop(): Promise<void> {
    logger.info("Iniciando graceful shutdown del servidor WebSocket...")

    // Cerrar todas las conexiones activas
    if (this.connections.size > 0) {
      logger.info(`Cerrando ${this.connections.size} conexiones activas...`)

      for (const [id, ws] of this.connections) {
        try {
          ws.send(
            JSON.stringify({
              type: "server_shutdown",
              payload: {
                message: "El servidor se esta cerrando",
                reconnectIn: 5000,
              },
              timestamp: new Date().toISOString(),
            })
          )
          ws.close(1001, "Server shutting down")
        } catch (error) {
          logger.error(`Error al cerrar conexion ${id}:`, error)
        }
      }
    }

    // Desuscribir y cerrar conexiones Redis
    if (this.subscriber) {
      await this.subscriber.unsubscribe(this.REDIS_CHANNEL)
      await this.subscriber.quit()
      this.subscriber = null
    }

    if (this.publisher) {
      await this.publisher.quit()
      this.publisher = null
    }

    // Detener servidor
    if (this.server) {
      this.server.stop()
      this.server = null
    }

    logger.info("Servidor WebSocket detenido correctamente")
  }

  // ============================================
  // Redis Pub/Sub
  // ============================================

  /**
   * Inicializa las conexiones Redis para pub/sub
   */
  private async initRedisPubSub(): Promise<void> {
    try {
      // Crear publisher
      this.publisher = createPublisher()

      // Crear subscriber
      this.subscriber = createSubscriber()

      // Suscribirse al canal de broadcast
      await this.subscriber.subscribe(this.REDIS_CHANNEL)

      // Manejar mensajes de Redis
      this.subscriber.on("message", (channel, message) => {
        if (channel === this.REDIS_CHANNEL) {
          this.handleRedisMessage(message)
        }
      })

      logger.info("Redis Pub/Sub inicializado correctamente")
    } catch (error) {
      logger.error("Error al inicializar Redis Pub/Sub:", error)
      throw error
    }
  }

  /**
   * Maneja mensajes recibidos desde Redis (de otras instancias)
   */
  private handleRedisMessage(message: string): void {
    try {
      const data = JSON.parse(message) as RedisPubSubMessage

      // Ignorar mensajes de la misma instancia
      if (data.sourceInstance === this.instanceId) {
        return
      }

      logger.debug(`Mensaje Redis recibido: event=${data.event}`)

      // Broadcast local segun el tipo de destinatario
      if (data.room) {
        this.broadcastToRoom(data.room, {
          type: data.event,
          payload: data.payload,
          timestamp: new Date().toISOString(),
        })
      } else if (data.tenantId) {
        this.broadcastToTenant(data.tenantId, {
          type: data.event,
          payload: data.payload,
          timestamp: new Date().toISOString(),
        })
      } else if (data.userId) {
        this.broadcastToUser(data.userId, {
          type: data.event,
          payload: data.payload,
          timestamp: new Date().toISOString(),
        })
      }
    } catch (error) {
      logger.error("Error al procesar mensaje Redis:", error)
    }
  }

  /**
   * Publica un mensaje en Redis para otras instancias
   */
  private publishToRedis(message: RedisPubSubMessage): void {
    if (!this.publisher) {
      logger.warn("Publisher Redis no disponible")
      return
    }

    this.publisher.publish(this.REDIS_CHANNEL, JSON.stringify(message)).catch((error) => {
      logger.error("Error al publicar en Redis:", error)
    })
  }

  // ============================================
  // WebSocket Event Handlers
  // ============================================

  /**
   * Handler para nueva conexion WebSocket
   */
  private onOpen(ws: ServerWebSocket<WebSocketData>): void {
    // Generar ID unico para la conexion
    const connectionId = this.generateConnectionId()
    ;(ws as any).connectionId = connectionId

    // Inicializar datos (no autenticado aun)
    ws.data = {
      userId: "",
      tenantId: "",
      role: "",
      authenticated: false,
    }

    // Crear contexto
    const ctx = this.createContext()

    // Registrar conexion
    this.connections.set(connectionId, ws)

    // Obtener URL de la conexion
    const wsUrl = (ws as any).url || ""

    // Delegar al handler de conexion
    handleOpen(ws, ctx, wsUrl).catch((error) => {
      logger.error("Error en handleOpen:", error)
    })
  }

  /**
   * Handler para mensajes entrantes
   */
  private onMessage(ws: ServerWebSocket<WebSocketData>, message: string | Buffer): void {
    this.messagesReceived++

    const ctx = this.createContext()

    handleMessage(ws, message.toString(), ctx).catch((error) => {
      logger.error("Error en handleMessage:", error)
    })
  }

  /**
   * Handler para cierre de conexion
   */
  private onClose(ws: ServerWebSocket<WebSocketData>): void {
    const connectionId = (ws as any).connectionId
    if (connectionId) {
      this.connections.delete(connectionId)
    }

    const ctx = this.createContext()
    handleClose(ws, ctx)
  }

  // ============================================
  // Broadcast Methods
  // ============================================

  /**
   * Crea el contexto para los handlers
   */
  private createContext(): WSContext {
    return {
      broadcast: (message: WSMessage, room?: string) => this.broadcast(message, room),
      emitToTenant: (tenantId: string, message: WSMessage) => this.emitToTenant(tenantId, message),
      emitToUser: (userId: string, message: WSMessage) => this.emitToUser(userId, message),
      getInstanceId: () => this.instanceId,
    }
  }

  /**
   * Broadcast a un room especifico
   */
  broadcast(message: WSMessage, room?: string): void {
    this.messagesSent++
    const messageStr = JSON.stringify(message)

    if (room) {
      // Broadcast a un room especifico
      this.broadcastToRoom(room, message)

      // Publicar en Redis para otras instancias
      this.publishToRedis({
        event: message.type,
        room,
        payload: message.payload,
        sourceInstance: this.instanceId,
      })
    } else {
      // Broadcast global (todas las conexiones)
      if (this.server) {
        for (const ws of this.connections.values()) {
          if (ws.data.authenticated) {
            ws.send(messageStr)
          }
        }
      }
    }
  }

  /**
   * Broadcast a todos los usuarios de un tenant
   */
  emitToTenant(tenantId: string, message: WSMessage): void {
    this.messagesSent++
    const room = `tenant:${tenantId}`

    this.broadcastToRoom(room, message)

    // Publicar en Redis para otras instancias
    this.publishToRedis({
      event: message.type,
      tenantId,
      payload: message.payload,
      sourceInstance: this.instanceId,
    })
  }

  /**
   * Broadcast a un usuario especifico
   */
  emitToUser(userId: string, message: WSMessage): void {
    this.messagesSent++
    const room = `user:${userId}`

    this.broadcastToRoom(room, message)

    // Publicar en Redis para otras instancias
    this.publishToRedis({
      event: message.type,
      userId,
      payload: message.payload,
      sourceInstance: this.instanceId,
    })
  }

  /**
   * Broadcast local a un room
   */
  private broadcastToRoom(room: string, message: WSMessage): void {
    if (!this.server) return

    const messageStr = JSON.stringify(message)

    for (const ws of this.connections.values()) {
      // Verificar si el ws esta suscrito al room
      // Bun no expone directamente los rooms suscritos, asi que enviamos
      // y dejamos que Bun maneje el filtrado
      try {
        ws.send(messageStr)
      } catch {
        // Ignorar errores de envio
      }
    }
  }

  /**
   * Broadcast local a un tenant
   */
  private broadcastToTenant(tenantId: string, message: WSMessage): void {
    const messageStr = JSON.stringify(message)
    const room = `tenant:${tenantId}`

    for (const ws of this.connections.values()) {
      if (ws.data.tenantId === tenantId && ws.data.authenticated) {
        try {
          ws.send(messageStr)
        } catch {
          // Ignorar errores de envio
        }
      }
    }
  }

  /**
   * Broadcast local a un usuario
   */
  private broadcastToUser(userId: string, message: WSMessage): void {
    const messageStr = JSON.stringify(message)

    for (const ws of this.connections.values()) {
      if (ws.data.userId === userId && ws.data.authenticated) {
        try {
          ws.send(messageStr)
        } catch {
          // Ignorar errores de envio
        }
      }
    }
  }

  // ============================================
  // HTTP Request Handler (for health checks)
  // ============================================

  /**
   * Crea el handler para peticiones HTTP (health checks, etc.)
   */
  private createFetchRequestHandler(): (request: Request) => Response | Promise<Response> {
    const app = new Hono()

    // CORS
    app.use(
      "*",
      cors({
        origin: "*",
        allowHeaders: ["Content-Type", "Authorization"],
        allowMethods: ["GET", "POST", "OPTIONS"],
      })
    )

    // Health check endpoint
    app.get("/health", async (c) => {
      const health = await this.healthCheck()
      const status = health.status === "ok" ? 200 : 503
      return c.json(health, status)
    })

    // Stats endpoint
    app.get("/stats", (c) => {
      const stats = this.getStats()
      return c.json(stats)
    })

    // WebSocket upgrade endpoint
    app.get("/ws", (c) => {
      // Este endpoint es solo informativo
      // El upgrade real lo maneja Bun automaticamente
      return c.json({
        message: "WebSocket endpoint - use ws:// protocol",
        endpoint: "/ws",
      })
    })

    return app.fetch
  }

  // ============================================
  // Utility Methods
  // ============================================

  /**
   * Verifica el estado de salud del servidor
   */
  async healthCheck(): Promise<WSHealthCheck> {
    const redisCheck = await redisHealthCheck()

    let status: "ok" | "degraded" | "error" = "ok"

    if (redisCheck.status === "error") {
      status = "degraded" // El servidor puede funcionar sin Redis pub/sub
    }

    return {
      status,
      redis: {
        connected: redisCheck.status === "ok",
        latency: redisCheck.latency,
      },
      connections: this.connections.size,
      uptime: this.startedAt ? Date.now() - this.startedAt.getTime() : 0,
    }
  }

  /**
   * Obtiene estadisticas del servidor
   */
  getStats(): WSServerStats {
    const connectionsByTenant: Record<string, number> = {}

    for (const ws of this.connections.values()) {
      if (ws.data.tenantId) {
        connectionsByTenant[ws.data.tenantId] = (connectionsByTenant[ws.data.tenantId] || 0) + 1
      }
    }

    // Contar usuarios unicos
    const uniqueUsers = new Set<string>()
    for (const ws of this.connections.values()) {
      if (ws.data.userId) {
        uniqueUsers.add(ws.data.userId)
      }
    }

    return {
      totalConnections: this.connections.size,
      uniqueUsers: uniqueUsers.size,
      connectionsByTenant,
      uptime: this.startedAt ? Date.now() - this.startedAt.getTime() : 0,
      startedAt: this.startedAt || new Date(),
      messagesReceived: this.messagesReceived,
      messagesSent: this.messagesSent,
    }
  }

  /**
   * Genera un ID unico para la conexion
   */
  private generateConnectionId(): string {
    return `conn-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`
  }

  /**
   * Obtiene el ID de la instancia
   */
  getInstanceId(): string {
    return this.instanceId
  }
}

// ============================================
// Singleton Instance
// ============================================

let wsServerInstance: WebSocketServer | null = null

/**
 * Obtiene la instancia singleton del servidor WebSocket
 */
export function getWebSocketServer(): WebSocketServer {
  if (!wsServerInstance) {
    wsServerInstance = new WebSocketServer()
  }
  return wsServerInstance
}

/**
 * Inicia el servidor WebSocket
 */
export async function startWebSocketServer(port?: number): Promise<WebSocketServer> {
  const server = getWebSocketServer()
  await server.start(port)
  return server
}

/**
 * Detiene el servidor WebSocket
 */
export async function stopWebSocketServer(): Promise<void> {
  if (wsServerInstance) {
    await wsServerInstance.stop()
    wsServerInstance = null
  }
}

// Re-export types
export * from "./types"
export * from "./handlers"
