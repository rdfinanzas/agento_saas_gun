/**
 * Analytics Routes - Migrado a Hono
 */

import { Hono } from "hono"
import { authMiddleware } from "../../auth/middleware/auth.middleware"
import { analyticsController } from "../controllers/analytics.controller"

const analyticsRoutes = new Hono()

// Aplicar middleware de autenticación a todas las rutas
analyticsRoutes.use("*", authMiddleware)

// Dashboard stats
analyticsRoutes.get("/dashboard", (c) => analyticsController.getDashboardStats(c))

// Conversation metrics
analyticsRoutes.get("/conversations", (c) => analyticsController.getConversationMetrics(c))

// Usage stats
analyticsRoutes.get("/usage", (c) => analyticsController.getUsageStats(c))

// Agent performance
analyticsRoutes.get("/agents/performance", (c) => analyticsController.getAgentPerformance(c))

// Top queries
analyticsRoutes.get("/queries/top", (c) => analyticsController.getTopQueries(c))

// Response time metrics
analyticsRoutes.get("/response-time", (c) => analyticsController.getResponseTimeMetrics(c))

// Complete analytics (all in one call)
analyticsRoutes.get("/complete", (c) => analyticsController.getCompleteAnalytics(c))

// KPIs
analyticsRoutes.get("/kpis", (c) => analyticsController.getKPIs(c))
analyticsRoutes.get("/kpis/compare", (c) => analyticsController.compareKPIs(c))
analyticsRoutes.get("/kpis/trends", (c) => analyticsController.getKPITrends(c))

export { analyticsRoutes }
