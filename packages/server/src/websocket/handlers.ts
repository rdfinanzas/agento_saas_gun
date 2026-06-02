// WebSocket Event Handlers for AgenTo Server
import type { ServerWebSocket } from "bun"
import type {
  WebSocketData,
  WSMessage,
  WSEventType,
  MessagePayload,
  ConversationUpdatePayload,
  NotificationPayload,
  SubscribePayload,
  UnsubscribePayload,
  TypingPayload,
} from "./types"
import { createLogger } from "../utils/logger"
import { jwtService } from "../modules/auth/services/jwt.service"

const logger = createLogger("ws-handlers")

// ============================================
// WebSocket Context Type
// ============================================

export interface WSContext {
  broadcast: (message: WSMessage, room?: string) => void
  emitToTenant: (tenantId: string, message: WSMessage) => void
  emitToUser: (userId: string, message: WSMessage) => void
  getInstanceId: () => string
}

// ============================================
// Connection Handler
// ============================================

/**
 * Maneja nueva conexion WebSocket
 * Autentica al usuario y registra la conexion
 */
export async function handleOpen(
  ws: ServerWebSocket<WebSocketData>,
  ctx: WSContext,
  url?: string
): Promise<void> {
  // Obtener token del query string
  const wsUrl = url || ""
  const queryString = wsUrl.includes("?") ? wsUrl.split("?")[1] : ""
  const params = new URLSearchParams(queryString)
  const token = params.get("token")

  if (!token) {
    logger.warn("Conexion rechazada: token no proporcionado")
    ws.send(
      JSON.stringify({
        type: "error",
        payload: {
          code: "AUTH_REQUIRED",
          message: "Token de autenticacion requerido",
        },
        timestamp: new Date().toISOString(),
      })
    )
    ws.close(1008, "Authentication required")
    return
  }

  try {
    // Verificar token JWT
    const payload = jwtService.verifyToken(token)

    // Actualizar datos del websocket
    ws.data = {
      userId: payload.userId,
      tenantId: payload.tenantId,
      role: payload.role,
      authenticated: true,
    }

    // Suscribir automaticamente al room del tenant
    const tenantRoom = `tenant:${payload.tenantId}`
    ws.subscribe(tenantRoom)

    // Suscribir automaticamente al room del usuario
    const userRoom = `user:${payload.userId}`
    ws.subscribe(userRoom)

    logger.info(`Cliente conectado: userId=${payload.userId}, tenantId=${payload.tenantId}`)

    // Enviar confirmacion de conexion
    ws.send(
      JSON.stringify({
        type: "connection_established",
        payload: {
          userId: payload.userId,
          tenantId: payload.tenantId,
          rooms: [tenantRoom, userRoom],
        },
        timestamp: new Date().toISOString(),
      })
    )

    // Notificar presencia a otros usuarios del tenant
    ctx.emitToTenant(payload.tenantId, {
      type: "presence",
      payload: {
        userId: payload.userId,
        status: "online",
      },
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    logger.error("Error al autenticar conexion:", error)
    ws.send(
      JSON.stringify({
        type: "error",
        payload: {
          code: "AUTH_FAILED",
          message: error instanceof Error ? error.message : "Error de autenticacion",
        },
        timestamp: new Date().toISOString(),
      })
    )
    ws.close(1008, "Authentication failed")
  }
}

// ============================================
// Message Handler
// ============================================

/**
 * Maneja mensajes entrantes del cliente
 */
export async function handleMessage(
  ws: ServerWebSocket<WebSocketData>,
  message: string,
  ctx: WSContext
): Promise<void> {
  if (!ws.data.authenticated) {
    logger.warn("Mensaje recibido de cliente no autenticado")
    return
  }

  let parsedMessage: WSMessage

  try {
    parsedMessage = JSON.parse(message) as WSMessage
  } catch {
    logger.error("Error al parsear mensaje:", message)
    ws.send(
      JSON.stringify({
        type: "error",
        payload: {
          code: "INVALID_MESSAGE",
          message: "Formato de mensaje invalido",
        },
        timestamp: new Date().toISOString(),
      })
    )
    return
  }

  const { type, payload } = parsedMessage

  logger.debug(`Mensaje recibido: type=${type}, userId=${ws.data.userId}`)

  // Manejar segun el tipo de evento
  switch (type) {
    case "ping":
      handlePing(ws)
      break

    case "subscribe":
      handleSubscribe(ws, payload as SubscribePayload)
      break

    case "unsubscribe":
      handleUnsubscribe(ws, payload as UnsubscribePayload)
      break

    case "message":
      await handleChatMessage(ws, payload as MessagePayload, ctx)
      break

    case "conversation_update":
      await handleConversationUpdate(ws, payload as ConversationUpdatePayload, ctx)
      break

    case "typing":
      handleTyping(ws, payload as TypingPayload, ctx)
      break

    case "notification":
      handleNotification(ws, payload as NotificationPayload, ctx)
      break

    default:
      logger.warn(`Tipo de mensaje no soportado: ${type}`)
      ws.send(
        JSON.stringify({
          type: "error",
          payload: {
            code: "UNKNOWN_EVENT",
            message: `Tipo de evento no soportado: ${type}`,
          },
          timestamp: new Date().toISOString(),
        })
      )
  }
}

// ============================================
// Close Handler
// ============================================

/**
 * Maneja el cierre de conexion
 */
export function handleClose(
  ws: ServerWebSocket<WebSocketData>,
  ctx: WSContext
): void {
  if (!ws.data.authenticated) {
    return
  }

  const { userId, tenantId } = ws.data

  logger.info(`Cliente desconectado: userId=${userId}, tenantId=${tenantId}`)

  // Notificar presencia offline a otros usuarios del tenant
  ctx.emitToTenant(tenantId, {
    type: "presence",
    payload: {
      userId,
      status: "offline",
      lastSeen: new Date().toISOString(),
    },
    timestamp: new Date().toISOString(),
  })
}

// ============================================
// Event-Specific Handlers
// ============================================

/**
 * Maneja ping/pong para mantener conexion viva
 */
function handlePing(ws: ServerWebSocket<WebSocketData>): void {
  ws.send(
    JSON.stringify({
      type: "pong",
      payload: { timestamp: Date.now() },
      timestamp: new Date().toISOString(),
    })
  )
}

/**
 * Maneja suscripcion a rooms
 */
function handleSubscribe(
  ws: ServerWebSocket<WebSocketData>,
  payload: SubscribePayload
): void {
  const { room } = payload

  // Validar que el room pertenezca al tenant del usuario
  if (!validateRoomAccess(ws.data, room)) {
    ws.send(
      JSON.stringify({
        type: "error",
        payload: {
          code: "ACCESS_DENIED",
          message: "No tienes acceso a este room",
        },
        timestamp: new Date().toISOString(),
      })
    )
    return
  }

  ws.subscribe(room)
  logger.debug(`Cliente suscrito a room: ${room}`)

  ws.send(
    JSON.stringify({
      type: "subscribed",
      payload: { room },
      timestamp: new Date().toISOString(),
    })
  )
}

/**
 * Maneja desuscripcion de rooms
 */
function handleUnsubscribe(
  ws: ServerWebSocket<WebSocketData>,
  payload: UnsubscribePayload
): void {
  const { room } = payload
  ws.unsubscribe(room)

  logger.debug(`Cliente desuscrito de room: ${room}`)

  ws.send(
    JSON.stringify({
      type: "unsubscribed",
      payload: { room },
      timestamp: new Date().toISOString(),
    })
  )
}

/**
 * Maneja mensajes de chat
 */
async function handleChatMessage(
  ws: ServerWebSocket<WebSocketData>,
  payload: MessagePayload,
  ctx: WSContext
): Promise<void> {
  // Validar que el mensaje pertenece al tenant del usuario
  if (!payload.conversationId) {
    ws.send(
      JSON.stringify({
        type: "error",
        payload: {
          code: "INVALID_MESSAGE",
          message: "conversationId es requerido",
        },
        timestamp: new Date().toISOString(),
      })
    )
    return
  }

  // Broadcast al room de la conversacion
  const conversationRoom = `conversation:${payload.conversationId}`

  const message: WSMessage<MessagePayload> = {
    type: "message",
    payload: {
      ...payload,
      id: payload.id || generateId(),
      createdAt: payload.createdAt || new Date().toISOString(),
    },
    timestamp: new Date().toISOString(),
  }

  ctx.broadcast(message, conversationRoom)
}

/**
 * Maneja actualizaciones de conversacion
 */
async function handleConversationUpdate(
  ws: ServerWebSocket<WebSocketData>,
  payload: ConversationUpdatePayload,
  ctx: WSContext
): Promise<void> {
  const message: WSMessage<ConversationUpdatePayload> = {
    type: "conversation_update",
    payload,
    timestamp: new Date().toISOString(),
  }

  // Notificar a todos los usuarios del tenant
  ctx.emitToTenant(ws.data.tenantId, message)
}

/**
 * Maneja eventos de typing
 */
function handleTyping(
  ws: ServerWebSocket<WebSocketData>,
  payload: TypingPayload,
  ctx: WSContext
): void {
  const message: WSMessage<TypingPayload> = {
    type: "typing",
    payload: {
      ...payload,
      userId: ws.data.userId,
    },
    timestamp: new Date().toISOString(),
  }

  // Broadcast al room de la conversacion (excepto al remitente)
  const conversationRoom = `conversation:${payload.conversationId}`
  ctx.broadcast(message, conversationRoom)
}

/**
 * Maneja notificaciones
 */
function handleNotification(
  ws: ServerWebSocket<WebSocketData>,
  payload: NotificationPayload,
  ctx: WSContext
): void {
  // Solo admins pueden enviar notificaciones globales
  if (ws.data.role !== "admin" && ws.data.role !== "owner") {
    ws.send(
      JSON.stringify({
        type: "error",
        payload: {
          code: "UNAUTHORIZED",
          message: "No autorizado para enviar notificaciones",
        },
        timestamp: new Date().toISOString(),
      })
    )
    return
  }

  const message: WSMessage<NotificationPayload> = {
    type: "notification",
    payload: {
      ...payload,
      id: payload.id || generateId(),
      createdAt: payload.createdAt || new Date().toISOString(),
    },
    timestamp: new Date().toISOString(),
  }

  // Broadcast a todo el tenant
  ctx.emitToTenant(ws.data.tenantId, message)
}

// ============================================
// Utility Functions
// ============================================

/**
 * Valida si un usuario tiene acceso a un room
 */
function validateRoomAccess(data: WebSocketData, room: string): boolean {
  const [type, id] = room.split(":")

  switch (type) {
    case "tenant":
      return id === data.tenantId
    case "user":
      return id === data.userId || data.role === "admin" || data.role === "owner"
    case "conversation":
      // TODO: Validar que el usuario pertenece a la conversacion
      return true
    case "agent":
      // TODO: Validar que el agente pertenece al tenant
      return true
    default:
      return false
  }
}

/**
 * Genera un ID unico
 */
function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`
}
