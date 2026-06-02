/**
 * Agent Template Routes - SP-11
 * 
 * API endpoints para gestión de templates de agentes
 * 
 * Endpoints:
 * - GET    /api/v1/ai/templates          - Listar templates
 * - GET    /api/v1/ai/templates/:id      - Obtener template
 * - POST   /api/v1/ai/templates          - Crear template (admin)
 * - POST   /api/v1/ai/templates/:id/install - Instalar template
 * - POST   /api/v1/ai/templates/:id/fork - Duplicar template
 * - GET    /api/v1/ai/templates/installations - Mis instalaciones
 */

import { Hono } from "hono"
import { db } from "@/db"
import { agentTemplates, agentTemplateInstallations } from "@/db/schema/agent-template"
import { agentTemplateService } from "../services/agent-template.service"
import { eq, and, desc } from "drizzle-orm"
import { z } from "zod"

export const agentTemplateRoutes = new Hono()

// Schema de validación
const installTemplateSchema = z.object({
  variables: z.record(z.any()).default({}),
  agentName: z.string().optional(),
})

const createTemplateSchema = z.object({
  name: z.string().min(1).max(100),
  slug: z.string().min(1).max(50).regex(/^[a-z0-9-_]+$/, "Slug inválido"),
  description: z.string().max(500).optional(),
  shortDescription: z.string().max(200).optional(),
  type: z.enum(["MASTER", "INTERNAL", "EXTERNAL"]),
  config: z.object({
    systemPrompt: z.string().min(1),
    instructions: z.string().optional(),
    welcomeMessage: z.string().optional(),
    tools: z.array(z.string()).default([]),
    skills: z.array(z.string()).default([]),
    variables: z.array(z.object({
      name: z.string(),
      key: z.string(),
      type: z.enum(["string", "number", "boolean", "select", "textarea"]),
      label: z.string(),
      description: z.string().optional(),
      default: z.any().optional(),
      required: z.boolean(),
      options: z.array(z.object({
        label: z.string(),
        value: z.any(),
      })).optional(),
    })).default([]),
    category: z.string().optional(),
    tags: z.array(z.string()).default([]),
    difficulty: z.enum(["beginner", "intermediate", "advanced"]).optional(),
    estimatedSetupTime: z.number().optional(),
  }),
  isPublic: z.boolean().default(false),
})

// GET /api/v1/ai/templates - Listar templates
agentTemplateRoutes.get("/", async (c) => {
  const tenantId = c.get("tenantId")
  const type = c.req.query("type")
  const category = c.req.query("category")
  const onlyOfficial = c.req.query("official") === "true"

  const templates = await agentTemplateService.listTemplates(tenantId, {
    type: type as any,
    category: category || undefined,
    onlyOfficial,
  })

  // Ocultar código fuente en listado
  const sanitized = templates.map(t => ({
    id: t.id,
    name: t.name,
    slug: t.slug,
    description: t.description,
    shortDescription: t.shortDescription,
    type: t.type,
    isOfficial: t.isOfficial,
    isPublic: t.isPublic,
    config: {
      category: (t.config as any).category,
      tags: (t.config as any).tags,
      difficulty: (t.config as any).difficulty,
      estimatedSetupTime: (t.config as any).estimatedSetupTime,
      variables: (t.config as any).variables,
    },
    metadata: t.metadata,
    createdAt: t.createdAt,
  }))

  return c.json({ templates: sanitized })
})

// GET /api/v1/ai/templates/:id - Obtener template
agentTemplateRoutes.get("/:id", async (c) => {
  const tenantId = c.get("tenantId")
  const id = c.req.param("id")

  const template = await agentTemplateService.getTemplate(id, tenantId)
  if (!template) {
    return c.json({ error: "Template not found" }, 404)
  }

  // Verificar si ya está instalado
  const installation = await db.query.agentTemplateInstallations.findFirst({
    where: and(
      eq(agentTemplateInstallations.templateId, id),
      eq(agentTemplateInstallations.tenantId, tenantId)
    ),
  })

  return c.json({
    template,
    isInstalled: !!installation,
    installation,
  })
})

// POST /api/v1/ai/templates - Crear template (solo admin o tenant owner)
agentTemplateRoutes.post("/", async (c) => {
  const tenantId = c.get("tenantId")
  const userId = c.get("userId")
  const body = await c.req.json()

  const result = createTemplateSchema.safeParse(body)
  if (!result.success) {
    return c.json({ error: "Invalid input", details: result.error.issues }, 400)
  }

  const data = result.data

  // Verificar que el slug sea único para este tenant
  const existing = await db.query.agentTemplates.findFirst({
    where: and(
      eq(agentTemplates.tenantId, tenantId),
      eq(agentTemplates.slug, data.slug)
    ),
  })

  if (existing) {
    return c.json({ error: "Template with this slug already exists" }, 409)
  }

  const template = await agentTemplateService.createTemplate(tenantId, {
    ...data,
    isActive: true,
  })

  return c.json({ template }, 201)
})

// POST /api/v1/ai/templates/:id/install - Instalar template
agentTemplateRoutes.post("/:id/install", async (c) => {
  const tenantId = c.get("tenantId")
  const userId = c.get("userId")
  const id = c.req.param("id")
  const body = await c.req.json()

  const result = installTemplateSchema.safeParse(body)
  if (!result.success) {
    return c.json({ error: "Invalid input", details: result.error.issues }, 400)
  }

  const { variables, agentName } = result.data

  const installResult = await agentTemplateService.installTemplate(
    id,
    tenantId,
    variables,
    agentName
  )

  if (!installResult.success) {
    return c.json({ error: installResult.error }, 400)
  }

  return c.json({
    success: true,
    agentId: installResult.agentId,
    message: "Template installed successfully",
  })
})

// POST /api/v1/ai/templates/:id/fork - Duplicar template
agentTemplateRoutes.post("/:id/fork", async (c) => {
  const tenantId = c.get("tenantId")
  const id = c.req.param("id")
  const { name } = await c.req.json()

  if (!name) {
    return c.json({ error: "Name is required" }, 400)
  }

  const template = await agentTemplateService.forkTemplate(id, tenantId, name)
  if (!template) {
    return c.json({ error: "Template not found" }, 404)
  }

  return c.json({ template }, 201)
})

// GET /api/v1/ai/templates/installations - Mis instalaciones
agentTemplateRoutes.get("/installations/list", async (c) => {
  const tenantId = c.get("tenantId")

  const installations = await agentTemplateService.getInstallations(tenantId)

  // Enriquecer con info del template
  const enriched = await Promise.all(
    installations.map(async (inst) => {
      const template = await db.query.agentTemplates.findFirst({
        where: eq(agentTemplates.id, inst.templateId),
        columns: {
          id: true,
          name: true,
          slug: true,
          description: true,
          type: true,
        },
      })
      return { ...inst, template }
    })
  )

  return c.json({ installations: enriched })
})

// GET /api/v1/ai/templates/categories - Listar categorías
agentTemplateRoutes.get("/meta/categories", async (c) => {
  const tenantId = c.get("tenantId")

  const templates = await agentTemplateService.listTemplates(tenantId)
  
  const categories = new Map<string, number>()
  for (const t of templates) {
    const category = (t.config as any).category || "Otros"
    categories.set(category, (categories.get(category) || 0) + 1)
  }

  return c.json({
    categories: Array.from(categories.entries()).map(([name, count]) => ({
      name,
      count,
    })),
  })
})

// POST /api/v1/ai/templates/:id/rate - Calificar template
agentTemplateRoutes.post("/:id/rate", async (c) => {
  const tenantId = c.get("tenantId")
  const id = c.req.param("id")
  const { rating } = await c.req.json()

  if (!rating || rating < 1 || rating > 5) {
    return c.json({ error: "Rating must be between 1 and 5" }, 400)
  }

  const template = await agentTemplateService.getTemplate(id, tenantId)
  if (!template) {
    return c.json({ error: "Template not found" }, 404)
  }

  const currentMeta = template.metadata as any
  const currentRating = currentMeta?.rating || 5
  const currentCount = currentMeta?.ratingCount || 0

  // Calcular nuevo promedio
  const newCount = currentCount + 1
  const newRating = ((currentRating * currentCount) + rating) / newCount

  await db.update(agentTemplates)
    .set({
      metadata: {
        ...currentMeta,
        rating: Math.round(newRating * 10) / 10,
        ratingCount: newCount,
      },
    })
    .where(eq(agentTemplates.id, id))

  return c.json({
    success: true,
    newRating: Math.round(newRating * 10) / 10,
    ratingCount: newCount,
  })
})
