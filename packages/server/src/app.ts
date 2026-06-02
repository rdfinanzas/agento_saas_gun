// Fix BigInt serialization
BigInt.prototype.toJSON = function() { return this.toString() }

import { Hono } from "hono"
import { cors } from "hono/cors"
import { logger as honoLogger } from "hono/logger"
import { prettyJSON } from "hono/pretty-json"
import { secureHeaders } from "hono/secure-headers"
import { trimTrailingSlash } from "hono/trailing-slash"
import { errorHandler } from "./middleware/error.middleware"
import { authMiddleware } from "./modules/auth/middleware/auth.middleware"

// Track server start time for uptime calculation
export const serverStartTime = Date.now()

// Import routes
import { authRoutes } from "./modules/auth/routes/auth.routes"
import { agentsRoutes } from "./modules/agents/routes/agents.routes"
import { agentAiRoutes } from "./modules/agent-ai/routes/agent-ai.routes"
import { coderRoutes } from "./modules/agent-ai/routes/coder.routes"
import { whatsappRoutes } from "./modules/whatsapp/routes/whatsapp.routes"
import { billingRoutes } from "./modules/billing/routes/billing.routes"
import { knowledgeRoutes } from "./modules/knowledge/routes/knowledge.routes"
import { analyticsRoutes } from "./modules/analytics/routes/analytics.routes"
import { adminRoutes } from "./modules/admin/routes/admin.routes"
import { tenantRoutes } from "./modules/tenant/routes/tenant.routes"
import { usersRoutes } from "./modules/users/routes/users.routes"
import { chatRoutes } from "./modules/chat/routes/chat.routes"
import { integrationsRoutes } from "./modules/integrations/routes/integrations.routes"
import { marketplaceRoutes } from "./modules/marketplace/routes/marketplace.routes"
import { accomplishRoutes } from "./modules/accomplish/routes/accomplish.routes"
import { aiConfigRoutes } from "./modules/ai-config/routes/ai-config.routes"
import { tenantFromParamsMiddleware } from "./modules/accomplish/middleware/tenant.middleware"

const app = new Hono()

// Security middleware
app.use(
  secureHeaders({
    xXssProtection: true,
    xContentTypeOptions: true,
  })
)

// CORS configuration
app.use(
  cors({
    origin: (origin) => {
      // Allow localhost for development
      if (origin.startsWith("http://localhost:")) return origin
      // Allow your production domains
      if (origin.endsWith(".agento.com")) return origin
      return null
    },
    credentials: true,
    allowHeaders: ["Content-Type", "Authorization", "X-Tenant-Id", "X-Tenant-Slug"],
    allowMethods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
  })
)

// Logging
app.use(honoLogger())
app.use(prettyJSON())
app.use(trimTrailingSlash())

// Health check endpoint
app.get("/health", (c) => {
  const uptime = Date.now() - serverStartTime
  return c.json({
    status: "ok",
    service: "agento-api",
    version: "2.0.0",
    runtime: "bun",
    timestamp: new Date().toISOString(),
    uptime,
  })
})

// Additional health endpoints
app.get("/api/v1/health", (c) => {
  const uptime = Date.now() - serverStartTime
  return c.json({
    status: "healthy",
    service: "agento-api",
    version: "2.0.0",
    runtime: "bun",
    uptime,
    timestamp: new Date().toISOString(),
  })
})

app.get("/ready", (c) => {
  // Check if service is ready to accept requests
  // For now, always return ready (can be enhanced to check DB, Redis, etc.)
  return c.json({
    ready: true,
    checks: {
      database: "unknown",
      redis: "unknown",
    },
  })
})

app.get("/live", (c) => {
  // Liveness probe - if this endpoint responds, the service is alive
  return c.json({
    alive: true,
    timestamp: new Date().toISOString(),
  })
})

// API v1 routes
app.route("/api/v1/auth", authRoutes)
app.route("/api/v1/agents", agentsRoutes)
app.route("/api/v1/ai", agentAiRoutes)
app.route("/api/v1/ai/coder", coderRoutes)
app.route("/api/v1/whatsapp", whatsappRoutes)
app.route("/api/v1/billing", billingRoutes)
app.route("/api/v1/knowledge", knowledgeRoutes)
app.route("/api/v1/analytics", analyticsRoutes)
app.route("/api/v1/admin", adminRoutes)
app.route("/api/v1/ai-config", aiConfigRoutes)
app.route("/api/v1/tenants", tenantRoutes)
app.route("/api/v1/users", usersRoutes)
app.route("/api/v1/chat", chatRoutes)
app.route("/api/v1/integrations", integrationsRoutes)
app.route("/api/v1/marketplace", marketplaceRoutes)

// Accomplish routes - ruta estática por ahora (usar tenantId del JWT)
app.route("/api/v1/:tenant/accomplish", accomplishRoutes)

// Error handler (must be last)
app.onError(errorHandler)

export { app }
