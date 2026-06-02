/**
 * Chat Routes - Rutas del modulo de chat con Hono
 */

import { Hono } from "hono"
import { authMiddleware } from "../../auth/middleware/auth.middleware"
import { chatController } from "../controllers/chat.controller"

const chatRoutes = new Hono()

// Todas las rutas requieren autenticacion
chatRoutes.use("*", authMiddleware)

// Estadisticas (debe ir antes de las rutas con :id)
chatRoutes.get("/stats", (c) => chatController.getStats(c))
chatRoutes.get("/unread-count", (c) => chatController.getUnreadCount(c))

// CRUD de conversaciones
chatRoutes.post("/conversations", (c) => chatController.createConversation(c))
chatRoutes.get("/conversations", (c) => chatController.listConversations(c))
chatRoutes.get("/conversations/:id", (c) => chatController.getConversationById(c))
chatRoutes.put("/conversations/:id", (c) => chatController.updateConversation(c))
chatRoutes.post("/conversations/:id/archive", (c) => chatController.archiveConversation(c))

// Mensajes
chatRoutes.get("/conversations/:id/messages", (c) => chatController.getMessages(c))
chatRoutes.post("/conversations/:id/messages", (c) => chatController.sendMessage(c))
chatRoutes.post("/conversations/:id/read", (c) => chatController.markAsRead(c))

export { chatRoutes }
