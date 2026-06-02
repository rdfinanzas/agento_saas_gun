/**
 * User Tool Routes
 * 
 * SP-5.2: API CRUD para herramientas de usuario
 * 
 * Endpoints:
 * - GET    /api/v1/ai/tools          - Listar herramientas
 * - POST   /api/v1/ai/tools          - Crear herramienta
 * - GET    /api/v1/ai/tools/:id      - Obtener herramienta
 * - PUT    /api/v1/ai/tools/:id      - Actualizar herramienta
 * - DELETE /api/v1/ai/tools/:id      - Eliminar herramienta (soft delete)
 * - POST   /api/v1/ai/tools/:id/test - Testear herramienta
 * - POST   /api/v1/ai/tools/:id/run  - Ejecutar herramienta
 */

import { Hono } from "hono"
import { db } from "@/db"
import { userTools, userToolExecutions, type NewUserTool } from "@/db/schema/user-tool"
import { eq, and, desc, isNull } from "drizzle-orm"
import { toolExecutor } from "../services/tool-executor.service"
import { z } from "zod"

export const userToolRoutes = new Hono()

// Schema de validación para crear/actualizar
const createToolSchema = z.object({
  name: z.string().min(1).max(100),
  slug: z.string().min(1).max(50).regex(/^[a-z0-9-_]+$/),
  description: z.string().max(500).optional(),
  code: z.string().min(1),
  language: z.enum(["javascript", "typescript"]).default("javascript"),
  parameters: z.array(z.object({
    name: z.string(),
    type: z.enum(["string", "number", "boolean", "array", "object"]),
    description: z.string(),
    required: z.boolean(),
    default: z.any().optional(),
    enum: z.array(z.any()).optional(),
  })).default([]),
  permissions: z.array(z.string()).default([]),
  config: z.object({
    timeout: z.number().min(1000).max(300000).default(30000),
    maxMemory: z.number().min(16).max(512).default(128),
    allowConsole: z.boolean().default(true),
    retryOnError: z.boolean().default(false),
    maxRetries: z.number().min(1).max(5).default(3),
  }).default({}),
})

// GET /api/v1/ai/tools - Listar herramientas
userToolRoutes.get("/", async (c) => {
  const tenantId = c.get("tenantId")
  const status = c.req.query("status")
  const limit = parseInt(c.req.query("limit") || "50")
  const offset = parseInt(c.req.query("offset") || "0")

  const conditions = [
    eq(userTools.tenantId, tenantId),
    eq(userTools.isActive, true),
    isNull(userTools.deletedAt),
  ]

  if (status) {
    conditions.push(eq(userTools.status, status))
  }

  const tools = await db.query.userTools.findMany({
    where: and(...conditions),
    limit,
    offset,
    orderBy: [desc(userTools.updatedAt)],
    columns: {
      id: true,
      name: true,
      slug: true,
      description: true,
      status: true,
      permissions: true,
      createdAt: true,
      updatedAt: true,
      metadata: true,
    },
  })

  return c.json({ tools, count: tools.length })
})

// POST /api/v1/ai/tools - Crear herramienta
userToolRoutes.post("/", async (c) => {
  const tenantId = c.get("tenantId")
  const userId = c.get("userId")
  const body = await c.req.json()

  // Validar input
  const result = createToolSchema.safeParse(body)
  if (!result.success) {
    return c.json({ error: "Invalid input", details: result.error.issues }, 400)
  }

  const data = result.data

  // Validar código
  const validation = toolExecutor.validateCode(data.code)
  if (!validation.valid) {
    return c.json({ error: "Code validation failed", errors: validation.errors }, 400)
  }

  // Verificar que el slug sea único para este tenant
  const existing = await db.query.userTools.findFirst({
    where: and(
      eq(userTools.tenantId, tenantId),
      eq(userTools.slug, data.slug),
      eq(userTools.isActive, true)
    ),
  })

  if (existing) {
    return c.json({ error: "Tool with this slug already exists" }, 409)
  }

  // Crear tool
  const [tool] = await db.insert(userTools).values({
    tenantId,
    createdBy: userId,
    name: data.name,
    slug: data.slug,
    description: data.description,
    code: data.code,
    language: data.language,
    parameters: data.parameters,
    permissions: data.permissions,
    config: data.config,
    status: "active",
    metadata: {
      author: userId,
      version: "1.0.0",
      usageCount: 0,
    },
  }).returning()

  return c.json({ tool }, 201)
})

// GET /api/v1/ai/tools/:id - Obtener herramienta
userToolRoutes.get("/:id", async (c) => {
  const tenantId = c.get("tenantId")
  const id = c.req.param("id")

  const tool = await db.query.userTools.findFirst({
    where: and(
      eq(userTools.id, id),
      eq(userTools.tenantId, tenantId),
      eq(userTools.isActive, true)
    ),
  })

  if (!tool) {
    return c.json({ error: "Tool not found" }, 404)
  }

  return c.json({ tool })
})

// PUT /api/v1/ai/tools/:id - Actualizar herramienta
userToolRoutes.put("/:id", async (c) => {
  const tenantId = c.get("tenantId")
  const id = c.req.param("id")
  const body = await c.req.json()

  // Verificar que existe
  const existing = await db.query.userTools.findFirst({
    where: and(
      eq(userTools.id, id),
      eq(userTools.tenantId, tenantId),
      eq(userTools.isActive, true)
    ),
  })

  if (!existing) {
    return c.json({ error: "Tool not found" }, 404)
  }

  // Si cambia el slug, verificar que no exista
  if (body.slug && body.slug !== existing.slug) {
    const slugExists = await db.query.userTools.findFirst({
      where: and(
        eq(userTools.tenantId, tenantId),
        eq(userTools.slug, body.slug),
        eq(userTools.isActive, true)
      ),
    })
    if (slugExists) {
      return c.json({ error: "Tool with this slug already exists" }, 409)
    }
  }

  // Si cambia el código, validarlo
  if (body.code && body.code !== existing.code) {
    const validation = toolExecutor.validateCode(body.code)
    if (!validation.valid) {
      return c.json({ error: "Code validation failed", errors: validation.errors }, 400)
    }
  }

  // Actualizar
  const [tool] = await db.update(userTools)
    .set({
      ...body,
      updatedAt: new Date(),
      metadata: {
        ...existing.metadata as any,
        version: incrementVersion((existing.metadata as any)?.version || "1.0.0"),
      },
    })
    .where(and(
      eq(userTools.id, id),
      eq(userTools.tenantId, tenantId)
    ))
    .returning()

  return c.json({ tool })
})

// DELETE /api/v1/ai/tools/:id - Eliminar herramienta (soft delete)
userToolRoutes.delete("/:id", async (c) => {
  const tenantId = c.get("tenantId")
  const id = c.req.param("id")

  const existing = await db.query.userTools.findFirst({
    where: and(
      eq(userTools.id, id),
      eq(userTools.tenantId, tenantId)
    ),
  })

  if (!existing) {
    return c.json({ error: "Tool not found" }, 404)
  }

  await db.update(userTools)
    .set({
      isActive: false,
      deletedAt: new Date(),
      status: "deprecated",
    })
    .where(and(
      eq(userTools.id, id),
      eq(userTools.tenantId, tenantId)
    ))

  return c.json({ success: true })
})

// POST /api/v1/ai/tools/:id/test - Testear herramienta
userToolRoutes.post("/:id/test", async (c) => {
  const tenantId = c.get("tenantId")
  const userId = c.get("userId")
  const id = c.req.param("id")
  const params = await c.req.json()

  const tool = await db.query.userTools.findFirst({
    where: and(
      eq(userTools.id, id),
      eq(userTools.tenantId, tenantId),
      eq(userTools.isActive, true)
    ),
  })

  if (!tool) {
    return c.json({ error: "Tool not found" }, 404)
  }

  // Validar parámetros contra el schema
  const validationErrors = validateParams(params, tool.parameters as any)
  if (validationErrors.length > 0) {
    return c.json({ error: "Invalid parameters", errors: validationErrors }, 400)
  }

  // Ejecutar
  const result = await toolExecutor.execute(
    tool,
    params,
    { tenantId, userId }
  )

  // Guardar ejecución de test
  await db.insert(userToolExecutions).values({
    toolId: id,
    tenantId,
    executedBy: userId,
    input: params,
    output: result.success ? result.output : null,
    error: result.error,
    logs: result.logs,
    status: result.success ? "success" : "failed",
    durationMs: result.durationMs,
    startedAt: new Date(),
    completedAt: new Date(),
  })

  return c.json(result)
})

// POST /api/v1/ai/tools/:id/run - Ejecutar herramienta
userToolRoutes.post("/:id/run", async (c) => {
  const tenantId = c.get("tenantId")
  const userId = c.get("userId")
  const id = c.req.param("id")
  const params = await c.req.json()

  const tool = await db.query.userTools.findFirst({
    where: and(
      eq(userTools.id, id),
      eq(userTools.tenantId, tenantId),
      eq(userTools.isActive, true),
      eq(userTools.status, "active")
    ),
  })

  if (!tool) {
    return c.json({ error: "Tool not found or not active" }, 404)
  }

  // Validar parámetros
  const validationErrors = validateParams(params, tool.parameters as any)
  if (validationErrors.length > 0) {
    return c.json({ error: "Invalid parameters", errors: validationErrors }, 400)
  }

  // Ejecutar
  const result = await toolExecutor.execute(
    tool,
    params,
    { tenantId, userId }
  )

  // Guardar ejecución
  await db.insert(userToolExecutions).values({
    toolId: id,
    tenantId,
    executedBy: userId,
    input: params,
    output: result.success ? result.output : null,
    error: result.error,
    logs: result.logs,
    status: result.success ? "success" : "failed",
    durationMs: result.durationMs,
    startedAt: new Date(Date.now() - result.durationMs),
    completedAt: new Date(),
  })

  // Actualizar contador de uso
  await db.update(userTools)
    .set({
      metadata: {
        ...(tool.metadata as any),
        usageCount: ((tool.metadata as any)?.usageCount || 0) + 1,
        lastUsedAt: new Date().toISOString(),
      },
    })
    .where(eq(userTools.id, id))

  return c.json(result)
})

// GET /api/v1/ai/tools/:id/executions - Historial de ejecuciones
userToolRoutes.get("/:id/executions", async (c) => {
  const tenantId = c.get("tenantId")
  const id = c.req.param("id")
  const limit = parseInt(c.req.query("limit") || "20")

  // Verificar que la tool existe
  const tool = await db.query.userTools.findFirst({
    where: and(
      eq(userTools.id, id),
      eq(userTools.tenantId, tenantId)
    ),
  })

  if (!tool) {
    return c.json({ error: "Tool not found" }, 404)
  }

  const executions = await db.query.userToolExecutions.findMany({
    where: and(
      eq(userToolExecutions.toolId, id),
      eq(userToolExecutions.tenantId, tenantId)
    ),
    limit,
    orderBy: [desc(userToolExecutions.startedAt)],
  })

  return c.json({ executions })
})

// Helpers
function incrementVersion(version: string): string {
  const parts = version.split(".").map(Number)
  parts[2] = (parts[2] || 0) + 1
  return parts.join(".")
}

function validateParams(params: any, schema: any[]): string[] {
  const errors: string[] = []
  
  for (const param of schema) {
    if (param.required && !(param.name in params)) {
      errors.push(`Missing required parameter: ${param.name}`)
      continue
    }

    if (param.name in params) {
      const value = params[param.name]
      const expectedType = param.type

      // Validar tipo
      const actualType = Array.isArray(value) ? "array" : typeof value
      if (actualType !== expectedType && expectedType !== "array") {
        errors.push(`Parameter ${param.name} should be ${expectedType}, got ${actualType}`)
      }

      // Validar enum
      if (param.enum && !param.enum.includes(value)) {
        errors.push(`Parameter ${param.name} must be one of: ${param.enum.join(", ")}`)
      }
    }
  }

  return errors
}
