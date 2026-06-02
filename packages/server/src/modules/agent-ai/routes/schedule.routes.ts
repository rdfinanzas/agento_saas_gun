/**
 * Schedule Routes - SP-8
 * 
 * API endpoints para gestión de tareas programadas (cron jobs)
 * 
 * Endpoints:
 * - GET    /api/v1/ai/schedules        - Listar tareas
 * - POST   /api/v1/ai/schedules        - Crear tarea
 * - GET    /api/v1/ai/schedules/:id    - Obtener tarea
 * - PUT    /api/v1/ai/schedules/:id    - Actualizar tarea
 * - DELETE /api/v1/ai/schedules/:id    - Eliminar tarea
 * - POST   /api/v1/ai/schedules/:id/run - Ejecutar ahora
 * - GET    /api/v1/ai/schedules/:id/history - Historial de ejecuciones
 */

import { Hono } from "hono"
import { db } from "@/db"
import { scheduledTasks, taskExecutions } from "@/db/schema"
import { eq, and, desc, sql } from "drizzle-orm"
import { z } from "zod"
import { Queue } from "bullmq"
import { getAutomationQueue } from "@/workers/automation.worker"

export const scheduleRoutes = new Hono()

// Schema de validación
const createScheduleSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  cronExpression: z.string().regex(/^([0-9,\-\*\/]+\s){4,5}[0-9,\-\*\/]+$/, "Formato cron inválido"),
  timezone: z.string().default("America/Mexico_City"),
  
  // Tool a ejecutar
  toolType: z.enum(["system", "user"]),
  toolId: z.string().uuid().optional(),
  toolName: z.string().min(1),
  toolParams: z.record(z.any()).default({}),
  
  // Notificaciones
  notifyOnSuccess: z.boolean().default(false),
  notifyOnFailure: z.boolean().default(true),
  webhookUrl: z.string().url().optional(),
})

// GET /api/v1/ai/schedules - Listar tareas programadas
scheduleRoutes.get("/", async (c) => {
  const tenantId = c.get("tenantId")
  const enabled = c.req.query("enabled")
  const limit = parseInt(c.req.query("limit") || "50")

  const conditions = [eq(scheduledTasks.tenantId, tenantId)]
  
  if (enabled !== undefined) {
    conditions.push(eq(scheduledTasks.enabled, enabled === "true"))
  }

  const tasks = await db.query.scheduledTasks.findMany({
    where: and(...conditions),
    limit,
    orderBy: [desc(scheduledTasks.updatedAt)],
  })

  return c.json({ tasks })
})

// POST /api/v1/ai/schedules - Crear tarea programada
scheduleRoutes.post("/", async (c) => {
  const tenantId = c.get("tenantId")
  const body = await c.req.json()

  const result = createScheduleSchema.safeParse(body)
  if (!result.success) {
    return c.json({ error: "Invalid input", details: result.error.issues }, 400)
  }

  const data = result.data

  // Calcular próxima ejecución
  const nextRunAt = calculateNextRun(data.cronExpression, data.timezone)

  const [task] = await db.insert(scheduledTasks).values({
    tenantId,
    name: data.name,
    description: data.description,
    cronExpression: data.cronExpression,
    timezone: data.timezone,
    taskType: "custom",
    taskConfig: {
      toolType: data.toolType,
      toolName: data.toolName,
    },
    toolId: data.toolId,
    toolType: data.toolType,
    toolName: data.toolName,
    toolParams: data.toolParams,
    notifyOnSuccess: data.notifyOnSuccess,
    notifyOnFailure: data.notifyOnFailure,
    webhookUrl: data.webhookUrl,
    enabled: true,
    nextRunAt,
  }).returning()

  // Agregar a la cola de BullMQ con repetición
  const queue = getAutomationQueue()
  if (queue) {
    await queue.add(
      `scheduled-task-${task.id}`,
      {
        tenantId,
        taskType: "custom",
        taskConfig: {
          toolType: data.toolType,
          toolName: data.toolName,
          toolParams: data.toolParams,
        },
        scheduledTaskId: task.id,
      },
      {
        repeat: {
          cron: data.cronExpression,
          tz: data.timezone,
        },
        jobId: task.id,
      }
    )
  }

  return c.json({ task }, 201)
})

// GET /api/v1/ai/schedules/:id - Obtener tarea
scheduleRoutes.get("/:id", async (c) => {
  const tenantId = c.get("tenantId")
  const id = c.req.param("id")

  const task = await db.query.scheduledTasks.findFirst({
    where: and(
      eq(scheduledTasks.id, id),
      eq(scheduledTasks.tenantId, tenantId)
    ),
  })

  if (!task) {
    return c.json({ error: "Schedule not found" }, 404)
  }

  return c.json({ task })
})

// PUT /api/v1/ai/schedules/:id - Actualizar tarea
scheduleRoutes.put("/:id", async (c) => {
  const tenantId = c.get("tenantId")
  const id = c.req.param("id")
  const body = await c.req.json()

  const existing = await db.query.scheduledTasks.findFirst({
    where: and(
      eq(scheduledTasks.id, id),
      eq(scheduledTasks.tenantId, tenantId)
    ),
  })

  if (!existing) {
    return c.json({ error: "Schedule not found" }, 404)
  }

  // Calcular nueva próxima ejecución si cambió el cron
  let nextRunAt = existing.nextRunAt
  if (body.cronExpression && body.cronExpression !== existing.cronExpression) {
    const timezone = body.timezone || existing.timezone
    nextRunAt = calculateNextRun(body.cronExpression, timezone)
  }

  const [task] = await db.update(scheduledTasks)
    .set({
      ...body,
      nextRunAt,
      updatedAt: new Date(),
    })
    .where(and(
      eq(scheduledTasks.id, id),
      eq(scheduledTasks.tenantId, tenantId)
    ))
    .returning()

  return c.json({ task })
})

// DELETE /api/v1/ai/schedules/:id - Eliminar tarea
scheduleRoutes.delete("/:id", async (c) => {
  const tenantId = c.get("tenantId")
  const id = c.req.param("id")

  const existing = await db.query.scheduledTasks.findFirst({
    where: and(
      eq(scheduledTasks.id, id),
      eq(scheduledTasks.tenantId, tenantId)
    ),
  })

  if (!existing) {
    return c.json({ error: "Schedule not found" }, 404)
  }

  // Remover de BullMQ
  const queue = getAutomationQueue()
  if (queue) {
    await queue.removeRepeatableByKey(`scheduled-task-${id}`)
  }

  // Soft delete
  await db.update(scheduledTasks)
    .set({
      enabled: false,
      updatedAt: new Date(),
    })
    .where(and(
      eq(scheduledTasks.id, id),
      eq(scheduledTasks.tenantId, tenantId)
    ))

  return c.json({ success: true })
})

// POST /api/v1/ai/schedules/:id/run - Ejecutar ahora
scheduleRoutes.post("/:id/run", async (c) => {
  const tenantId = c.get("tenantId")
  const id = c.req.param("id")

  const task = await db.query.scheduledTasks.findFirst({
    where: and(
      eq(scheduledTasks.id, id),
      eq(scheduledTasks.tenantId, tenantId)
    ),
  })

  if (!task) {
    return c.json({ error: "Schedule not found" }, 404)
  }

  const queue = getAutomationQueue()
  if (!queue) {
    return c.json({ error: "Queue not available" }, 500)
  }

  // Encolar ejecución inmediata
  const job = await queue.add(
    `scheduled-task-${task.id}-manual`,
    {
      tenantId,
      taskType: "custom",
      taskConfig: {
        toolType: task.toolType,
        toolName: task.toolName,
        toolParams: task.toolParams,
      },
      scheduledTaskId: task.id,
    },
    {
      priority: 1,
    }
  )

  return c.json({
    success: true,
    jobId: job.id,
    message: "Task queued for execution",
  })
})

// GET /api/v1/ai/schedules/:id/history - Historial de ejecuciones
scheduleRoutes.get("/:id/history", async (c) => {
  const tenantId = c.get("tenantId")
  const id = c.req.param("id")
  const limit = parseInt(c.req.query("limit") || "20")

  // Verificar que la tarea existe
  const task = await db.query.scheduledTasks.findFirst({
    where: and(
      eq(scheduledTasks.id, id),
      eq(scheduledTasks.tenantId, tenantId)
    ),
  })

  if (!task) {
    return c.json({ error: "Schedule not found" }, 404)
  }

  const executions = await db.query.taskExecutions.findMany({
    where: and(
      eq(taskExecutions.taskId, id),
      eq(taskExecutions.tenantId, tenantId)
    ),
    limit,
    orderBy: [desc(taskExecutions.startedAt)],
  })

  return c.json({ executions })
})

// POST /api/v1/ai/schedules/:id/toggle - Activar/Desactivar
scheduleRoutes.post("/:id/toggle", async (c) => {
  const tenantId = c.get("tenantId")
  const id = c.req.param("id")

  const task = await db.query.scheduledTasks.findFirst({
    where: and(
      eq(scheduledTasks.id, id),
      eq(scheduledTasks.tenantId, tenantId)
    ),
  })

  if (!task) {
    return c.json({ error: "Schedule not found" }, 404)
  }

  const newEnabled = !task.enabled

  await db.update(scheduledTasks)
    .set({
      enabled: newEnabled,
      updatedAt: new Date(),
    })
    .where(and(
      eq(scheduledTasks.id, id),
      eq(scheduledTasks.tenantId, tenantId)
    ))

  return c.json({ 
    success: true, 
    enabled: newEnabled 
  })
})

// Helper para calcular próxima ejecución
function calculateNextRun(cronExpression: string, timezone: string): Date {
  // TODO: Usar librería como node-cron o cron-parser para cálculo real
  // Por ahora retornamos +1 hora como placeholder
  return new Date(Date.now() + 60 * 60 * 1000)
}
