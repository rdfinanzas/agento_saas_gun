/**
 * @agento/agent-ai
 *
 * Módulo de IA para agentes
 * - Agente Codificador (MASTER)
 * - ToolRegistry
 * - SkillRegistry
 */

// Services
export * from "./services"

// Controllers
export * from "./controllers/coder.controller"

// Routes
export { coderRoutes } from "./routes/coder.routes"

// Adapters
export { OpenCodeRuntimeAdapter } from "./adapter/OpenCodeRuntimeAdapter"
export type {
  ExecutionContext as OpenCodeExecutionContext,
  ExecutionResult as OpenCodeExecutionResult,
  ConversationMessage,
  ToolExecution,
} from "./adapter/OpenCodeRuntimeAdapter"
