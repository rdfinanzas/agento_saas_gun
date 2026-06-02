// WebSocket Types for AgenTo Server

// ============================================
// Connection Types
// ============================================

export interface WebSocketClient {
  id: string
  userId: string
  tenantId: string
  role: string
  connectedAt: Date
  lastPingAt: Date
  rooms: Set<string>
}

export interface WebSocketData {
  userId: string
  tenantId: string
  role: string
  authenticated: boolean
}

// ============================================
// Message Types
// ============================================

export type WSEventType =
  | "message"
  | "conversation_update"
  | "notification"
  | "agent_status"
  | "typing"
  | "presence"
  | "error"
  | "ping"
  | "pong"
  | "subscribe"
  | "unsubscribe"

export interface WSMessage<T = unknown> {
  type: WSEventType
  payload: T
  timestamp: string
  id?: string
}

export interface WSMessagePayload {
  message: MessagePayload
  conversation_update: ConversationUpdatePayload
  notification: NotificationPayload
  agent_status: AgentStatusPayload
  typing: TypingPayload
  presence: PresencePayload
  error: ErrorPayload
  subscribe: SubscribePayload
  unsubscribe: UnsubscribePayload
}

// ============================================
// Payload Types
// ============================================

export interface MessagePayload {
  id: string
  conversationId: string
  agentId?: string
  content: string
  sender: "user" | "agent" | "system"
  createdAt: string
  metadata?: Record<string, unknown>
}

export interface ConversationUpdatePayload {
  conversationId: string
  action: "created" | "updated" | "closed" | "assigned"
  data?: Record<string, unknown>
}

export interface NotificationPayload {
  id: string
  type: "info" | "warning" | "error" | "success"
  title: string
  message: string
  actionUrl?: string
  createdAt: string
}

export interface AgentStatusPayload {
  agentId: string
  status: "online" | "offline" | "busy" | "away"
  lastSeen?: string
}

export interface TypingPayload {
  conversationId: string
  userId: string
  isTyping: boolean
}

export interface PresencePayload {
  userId: string
  status: "online" | "offline" | "away"
  lastSeen?: string
}

export interface ErrorPayload {
  code: string
  message: string
  details?: unknown
}

export interface SubscribePayload {
  room: string
}

export interface UnsubscribePayload {
  room: string
}

// ============================================
// Room Types
// ============================================

export type RoomType = "tenant" | "user" | "conversation" | "agent"

export interface RoomInfo {
  type: RoomType
  id: string
  tenantId: string
}

// ============================================
// Server Stats Types
// ============================================

export interface WSServerStats {
  totalConnections: number
  uniqueUsers: number
  connectionsByTenant: Record<string, number>
  uptime: number
  startedAt: Date
  messagesReceived: number
  messagesSent: number
}

// ============================================
// Redis Pub/Sub Types
// ============================================

export interface RedisPubSubMessage {
  event: WSEventType
  room?: string
  tenantId?: string
  userId?: string
  payload: unknown
  sourceInstance: string
}

// ============================================
// Health Check Types
// ============================================

export interface WSHealthCheck {
  status: "ok" | "degraded" | "error"
  redis: {
    connected: boolean
    latency?: number
  }
  connections: number
  uptime: number
}
