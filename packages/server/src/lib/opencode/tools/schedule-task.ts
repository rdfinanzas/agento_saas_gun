/**
 * Schedule Task Tool
 * 
 * SP-4.3: Tool para programar tareas periódicas
 * 
 * Features:
 * - Programación con cron expressions
 * - Ejecuta tools del sistema o del usuario
 * - Integración con BullMQ
 * - Notificaciones opcionales
 */

import { z } from "zod"
import { Queue } from "bullmq"
import { db } from "@/db"
import { scheduledTasks } from "@/db/schema/scheduled-task"

// Conexión Redis para BullMQ
const redisConnection = {
  host: process.env.REDIS_HOST || "localhost",
  port: parseInt(process.env.REDIS_PORT || "6379"),
  password: process.env.REDIS_PASSWORD,
}

const automationQueue = new Queue("automation", { connection: redisConnection })

export const scheduleTaskSchema = z.object({
  name: z.string().min(1).max(100).describe("Nombre descriptivo de la tarea"),
  cron: z.string().regex(/^([0-9,\-\*\/]+\s){4,5}[0-9,\-\*\/]+$/, "Formato cron inválido")
    .describe("Expresión cron (ej: '0 9 * * *' para 9am diario)"),
  toolName: z.string().describe("Nombre de la tool a ejecutar"),
  toolParams: z.record(z.any()).default({}).describe("Parámetros para la tool"),
  timezone: z.string().default("UTC").describe("Zona horaria (default: UTC)"),
  description: z.string().optional().describe("Descripción opcional"),
})

export type ScheduleTaskInput = z.infer<typeof scheduleTaskSchema>

export interface ScheduleTaskOutput {
  taskId: string
  name: string
  cron: string
  timezone: string
  status: string
  nextRun?: Date
}

/**
 * Programa una tarea para ejecución periódica
 */
export async function executeScheduleTask(
  params: ScheduleTaskInput,
  context: { tenantId: string }
): Promise<ScheduleTaskOutput> {
  const { name, cron, toolName, toolParams, timezone, description } = params
  const { tenantId } = context

  // Validar expresión cron básica
  const cronParts = cron.split(" ")
  if (cronParts.length < 5 || cronParts.length > 6) {
    throw new Error("Expresión cron inválida. Use: min hora dia-mes mes dia-semana [año]")
  }

  // Crear registro en la base de datos
  const [task] = await db
    .insert(scheduledTasks)
    .values({
      tenantId,
      name,
      description: description || `Tarea programada: ${toolName}`,
      taskType: "custom",
      taskConfig: {
        toolName,
        toolParams,
      },
      cronExpression: cron,
      timezone,
      isActive: true,
    })
    .returning()

  // Agregar job a BullMQ
  // Nota: El worker real debe estar configurado para procesar estos jobs
  await automationQueue.add(
    `scheduled-task-${task.id}`,
    {
      taskId: task.id,
      tenantId,
      toolName,
      toolParams,
    },
    {
      repeat: {
        cron,
        tz: timezone,
      },
      jobId: task.id,
    }
  )

  console.log(`[ScheduleTask] Created task "${name}" for tenant ${tenantId}`, {
    taskId: task.id,
    cron,
    timezone,
  })

  return {
    taskId: task.id,
    name: task.name,
    cron: task.cronExpression,
    timezone: task.timezone,
    status: task.isActive ? "active" : "inactive",
  }
}

/**
 * Calcula la próxima ejecución basada en cron
 * Nota: En producción usar librería como node-cron o cron-parser
 */
export function getNextRun(cron: string, timezone: string): Date {
  // Placeholder - implementar con cron-parser
  const now = new Date()
  return new Date(now.getTime() + 24 * 60 * 60 * 1000) // Mañana
}

export const scheduleTaskTool = {
  name: "schedule_task",
  description: "Programa tareas para ejecución periódica usando cron expressions. Ejecuta tools del sistema o del usuario en horarios definidos.",
  requiresApproval: true,
  schema: scheduleTaskSchema,
  execute: executeScheduleTask,
}
