/**
 * Dashboard Routes - SP-14
 * 
 * API endpoints para el dashboard del agente codificador
 * 
 * Endpoints:
 * - GET /api/v1/ai/dashboard/stats      - Estadísticas del agente
 * - GET /api/v1/ai/dashboard/activity   - Actividad reciente
 * - GET /api/v1/ai/dashboard/alerts     - Alertas y notificaciones
 */

import { Hono } from "hono"
import { db } from "@/db"
import { agentSessions, agentMessages, userTools, userToolExecutions, scheduledTasks, taskExecutions } from "@/db/schema"
import { eq, and, desc, gte, sql } from "drizzle-orm"

export const dashboardRoutes = new Hono()

// GET /api/v1/ai/dashboard/stats - Estadísticas del agente codificador
dashboardRoutes.get("/stats", async (c) => {
  const tenantId = c.get("tenantId")
  
  // Fecha de inicio del mes actual
  const now = new Date()
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate())

  try {
    // Sesiones activas (no archivadas)
    const activeSessions = await db
      .select({ count: sql<number>`count(*)` })
      .from(agentSessions)
      .where(and(
        eq(agentSessions.tenantId, tenantId),
        eq(agentSessions.isActive, true),
        eq(agentSessions.isArchived, false)
      ))
      .then(r => r[0]?.count || 0)

    // Total de sesiones
    const totalSessions = await db
      .select({ count: sql<number>`count(*)` })
      .from(agentSessions)
      .where(eq(agentSessions.tenantId, tenantId))
      .then(r => r[0]?.count || 0)

    // Mensajes este mes
    const messagesThisMonth = await db
      .select({ count: sql<number>`count(*)` })
      .from(agentMessages)
      .where(and(
        eq(agentMessages.tenantId, tenantId),
        gte(agentMessages.createdAt, startOfMonth)
      ))
      .then(r => r[0]?.count || 0)

    // Herramientas creadas
    const toolsCreated = await db
      .select({ count: sql<number>`count(*)` })
      .from(userTools)
      .where(and(
        eq(userTools.tenantId, tenantId),
        eq(userTools.isActive, true)
      ))
      .then(r => r[0]?.count || 0)

    // Tareas programadas activas
    const scheduledTasksCount = await db
      .select({ count: sql<number>`count(*)` })
      .from(scheduledTasks)
      .where(and(
        eq(scheduledTasks.tenantId, tenantId),
        eq(scheduledTasks.enabled, true)
      ))
      .then(r => r[0]?.count || 0)

    // Ejecuciones de tools hoy
    const toolExecutionsToday = await db
      .select({ count: sql<number>`count(*)` })
      .from(userToolExecutions)
      .where(and(
        eq(userToolExecutions.tenantId, tenantId),
        gte(userToolExecutions.startedAt, startOfDay)
      ))
      .then(r => r[0]?.count || 0)

    // Promedio de mensajes por sesión
    const avgMessagesPerSession = totalSessions > 0 
      ? Math.round((await db
          .select({ count: sql<number>`count(*)` })
          .from(agentMessages)
          .where(eq(agentMessages.tenantId, tenantId))
          .then(r => r[0]?.count || 0)) / totalSessions)
      : 0

    // Tokens estimados (basado en longitud de mensajes)
    const tokensEstimate = await db
      .select({ 
        total: sql<number>`coalesce(sum(length(content)), 0)` 
      })
      .from(agentMessages)
      .where(and(
        eq(agentMessages.tenantId, tenantId),
        gte(agentMessages.createdAt, startOfMonth)
      ))
      .then(r => Math.round((r[0]?.total || 0) / 4)) // Aprox 4 chars por token

    return c.json({
      stats: {
        activeSessions,
        totalSessions,
        messagesThisMonth,
        toolsCreated,
        scheduledTasksCount,
        toolExecutionsToday,
        avgMessagesPerSession,
        tokensEstimate,
      }
    })
  } catch (error) {
    console.error("[Dashboard] Stats error:", error)
    return c.json({ error: "Failed to fetch stats" }, 500)
  }
})

// GET /api/v1/ai/dashboard/activity - Actividad reciente
dashboardRoutes.get("/activity", async (c) => {
  const tenantId = c.get("tenantId")
  const limit = parseInt(c.req.query("limit") || "10")

  try {
    // Sesiones recientes
    const recentSessions = await db.query.agentSessions.findMany({
      where: eq(agentSessions.tenantId, tenantId),
      orderBy: [desc(agentSessions.updatedAt)],
      limit,
    })

    // Mensajes recientes
    const recentMessages = await db.query.agentMessages.findMany({
      where: eq(agentMessages.tenantId, tenantId),
      orderBy: [desc(agentMessages.createdAt)],
      limit: 5,
    })

    // Ejecuciones de tools recientes
    const recentToolExecutions = await db.query.userToolExecutions.findMany({
      where: eq(userToolExecutions.tenantId, tenantId),
      orderBy: [desc(userToolExecutions.startedAt)],
      limit: 5,
    })

    // Tareas ejecutadas recientemente
    const recentTaskExecutions = await db.query.taskExecutions.findMany({
      where: eq(taskExecutions.tenantId, tenantId),
      orderBy: [desc(taskExecutions.startedAt)],
      limit: 5,
    })

    return c.json({
      recentSessions,
      recentMessages,
      recentToolExecutions,
      recentTaskExecutions,
    })
  } catch (error) {
    console.error("[Dashboard] Activity error:", error)
    return c.json({ error: "Failed to fetch activity" }, 500)
  }
})

// GET /api/v1/ai/dashboard/alerts - Alertas y notificaciones
dashboardRoutes.get("/alerts", async (c) => {
  const tenantId = c.get("tenantId")

  try {
    const alerts: Array<{
      id: string
      type: "warning" | "error" | "info" | "success"
      title: string
      message: string
      timestamp: Date
      action?: { label: string; href: string }
    }> = []

    // 1. Ejecuciones de tools fallidas recientes
    const failedExecutions = await db.query.userToolExecutions.findMany({
      where: and(
        eq(userToolExecutions.tenantId, tenantId),
        eq(userToolExecutions.status, "failed")
      ),
      orderBy: [desc(userToolExecutions.startedAt)],
      limit: 3,
    })

    if (failedExecutions.length > 0) {
      alerts.push({
        id: "failed-tools",
        type: "error",
        title: "Ejecuciones fallidas",
        message: `${failedExecutions.length} herramienta(s) fallaron recientemente`,
        timestamp: failedExecutions[0].startedAt,
        action: {
          label: "Ver logs",
          href: "/tools/logs",
        },
      })
    }

    // 2. Tareas programadas con errores
    const failedTasks = await db.query.taskExecutions.findMany({
      where: and(
        eq(taskExecutions.tenantId, tenantId),
        eq(taskExecutions.status, "failed")
      ),
      orderBy: [desc(taskExecutions.startedAt)],
      limit: 3,
    })

    if (failedTasks.length > 0) {
      alerts.push({
        id: "failed-tasks",
        type: "warning",
        title: "Tareas con errores",
        message: `${failedTasks.length} tarea(s) programada(s) fallaron`,
        timestamp: failedTasks[0].startedAt,
        action: {
          label: "Ver tareas",
          href: "/schedules",
        },
      })
    }

    // 3. Tools sin usar (creadas hace > 30 días sin ejecuciones)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    const unusedTools = await db.query.userTools.findMany({
      where: and(
        eq(userTools.tenantId, tenantId),
        eq(userTools.isActive, true),
        eq(userTools.status, "active"),
        gte(userTools.createdAt, thirtyDaysAgo)
      ),
    })

    // Filtrar tools sin ejecuciones
    const toolsWithoutExecutions = []
    for (const tool of unusedTools) {
      const execCount = await db
        .select({ count: sql<number>`count(*)` })
        .from(userToolExecutions)
        .where(eq(userToolExecutions.toolId, tool.id))
        .then(r => r[0]?.count || 0)
      
      if (execCount === 0) {
        toolsWithoutExecutions.push(tool)
      }
    }

    if (toolsWithoutExecutions.length > 0) {
      alerts.push({
        id: "unused-tools",
        type: "info",
        title: "Tools sin usar",
        message: `${toolsWithoutExecutions.length} herramienta(s) creada(s) hace más de 30 días sin ejecuciones`,
        timestamp: new Date(),
      })
    }

    // 4. Sesiones archivadas recientemente
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    const archivedSessions = await db
      .select({ count: sql<number>`count(*)` })
      .from(agentSessions)
      .where(and(
        eq(agentSessions.tenantId, tenantId),
        eq(agentSessions.isArchived, true),
        gte(agentSessions.archivedAt, sevenDaysAgo)
      ))
      .then(r => r[0]?.count || 0)

    if (archivedSessions > 0) {
      alerts.push({
        id: "archived-sessions",
        type: "info",
        title: "Sesiones archivadas",
        message: `${archivedSessions} sesión(es) archivada(s) esta semana`,
        timestamp: new Date(),
      })
    }

    // Ordenar por timestamp descendente
    alerts.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())

    return c.json({ alerts })
  } catch (error) {
    console.error("[Dashboard] Alerts error:", error)
    return c.json({ error: "Failed to fetch alerts" }, 500)
  }
})

// GET /api/v1/ai/dashboard/usage-chart - Datos para gráfico de uso
dashboardRoutes.get("/usage-chart", async (c) => {
  const tenantId = c.get("tenantId")
  const days = parseInt(c.req.query("days") || "7")

  try {
    const data = []
    const now = new Date()

    for (let i = days - 1; i >= 0; i--) {
      const date = new Date(now)
      date.setDate(date.getDate() - i)
      date.setHours(0, 0, 0, 0)
      
      const nextDate = new Date(date)
      nextDate.setDate(nextDate.getDate() + 1)

      // Mensajes de ese día
      const messageCount = await db
        .select({ count: sql<number>`count(*)` })
        .from(agentMessages)
        .where(and(
          eq(agentMessages.tenantId, tenantId),
          gte(agentMessages.createdAt, date),
          gte(nextDate, agentMessages.createdAt)
        ))
        .then(r => r[0]?.count || 0)

      // Ejecuciones de tools de ese día
      const executionCount = await db
        .select({ count: sql<number>`count(*)` })
        .from(userToolExecutions)
        .where(and(
          eq(userToolExecutions.tenantId, tenantId),
          gte(userToolExecutions.startedAt, date),
          gte(nextDate, userToolExecutions.startedAt)
        ))
        .then(r => r[0]?.count || 0)

      data.push({
        date: date.toISOString().split('T')[0],
        messages: messageCount,
        executions: executionCount,
      })
    }

    return c.json({ data })
  } catch (error) {
    console.error("[Dashboard] Usage chart error:", error)
    return c.json({ error: "Failed to fetch usage chart" }, 500)
  }
})
