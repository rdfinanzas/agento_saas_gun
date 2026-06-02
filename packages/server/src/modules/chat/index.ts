/**
 * Chat Module - Exporta todos los componentes del modulo de chat
 */

export { chatService } from "./services/chat.service"
export type {
  CreateConversationInput,
  UpdateConversationInput,
  SendMessageInput,
  ConversationFilterOptions,
} from "./services/chat.service"

export { chatController } from "./controllers/chat.controller"

export { chatRoutes } from "./routes/chat.routes"
