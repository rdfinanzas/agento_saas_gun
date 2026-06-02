/**
 * Agent AI Routes
 * Endpoints para ejecutar el agente AI integrado
 */

import { Hono } from "hono"
import { authMiddleware } from "../../auth/middleware/auth.middleware"
import { agentAiController } from "../controllers/agent-ai.controller"
import { approvalRoutes } from "./approval.routes"
import { auditRoutes } from "./audit.routes"
import { usageRoutes } from "./usage.routes"
import { chatRoutes } from "./chat.routes"
import { coderRoutes } from "./coder.routes"
import { userToolRoutes } from "./user-tool.routes"
import { scheduleRoutes } from "./schedule.routes"
import { dashboardRoutes } from "./dashboard.routes"

const agentAiRoutes = new Hono()

// Todas las rutas requieren autenticacion
agentAiRoutes.use("*", authMiddleware)

// ============================================
// SP-7: Chat con el Agente
// ============================================
agentAiRoutes.route("/", chatRoutes)

// ============================================
// SP-6: Approval Workflow
// ============================================
agentAiRoutes.route("/approvals", approvalRoutes)

// ============================================
// SP-9: Logs y Auditoría
// ============================================
agentAiRoutes.route("/audit", auditRoutes)

// ============================================
// SP-10: Monitoreo de Uso
// ============================================
agentAiRoutes.route("/usage", usageRoutes)

// ============================================
// SP-5: Herramientas de Usuario
// ============================================
agentAiRoutes.route("/tools", userToolRoutes)

// ============================================
// SP-8: Tareas Programadas
// ============================================
agentAiRoutes.route("/schedules", scheduleRoutes)

// ============================================
// Agente Codificador
// ============================================
agentAiRoutes.route("/coder", coderRoutes)

// ============================================
// Ejecución del Agente AI (legacy)
// ============================================
agentAiRoutes.post("/execute", (c) => agentAiController.execute(c))
agentAiRoutes.post("/execute/stream", (c) => agentAiController.executeStream(c))

// Sesiones
agentAiRoutes.get("/sessions", (c) => agentAiController.listSessions(c))
agentAiRoutes.get("/sessions/:id", (c) => agentAiController.getSession(c))
agentAiRoutes.delete("/sessions/:id", (c) => agentAiController.deleteSession(c))

// Estadisticas
agentAiRoutes.get("/stats", (c) => agentAiController.getStats(c))

// Verificar disponibilidad
agentAiRoutes.get("/health", (c) => agentAiController.healthCheck(c))

export { agentAiRoutes }
