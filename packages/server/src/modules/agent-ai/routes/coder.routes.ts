/**
 * Coder Routes
 *
 * Rutas para el Agente Codificador
 */

import { Hono } from "hono"
import { coderController } from "../controllers/coder.controller"

export const coderRoutes = new Hono()

// ============================================
// Coder Info
// ============================================
coderRoutes.get("/", coderController.getCoder)

// ============================================
// Agent Management
// ============================================
coderRoutes.post("/create-agent", coderController.createAgent)
coderRoutes.get("/agents", coderController.listAgents)
coderRoutes.get("/agents/:id", coderController.getAgent)
coderRoutes.patch("/agents/:id", coderController.updateAgent)
coderRoutes.delete("/agents/:id", coderController.deleteAgent)
coderRoutes.post("/agents/:id/activate", coderController.activateAgent)
coderRoutes.post("/agents/:id/pause", coderController.pauseAgent)

// ============================================
// Tool Management
// ============================================
coderRoutes.post("/create-tool", coderController.createTool)
coderRoutes.get("/tools", coderController.listTools)

// ============================================
// Skill Management
// ============================================
coderRoutes.get("/skills", coderController.listSkills)
