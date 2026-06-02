/**
 * Agent Template Service
 * 
 * SP-11.2: Templates pre-configurados y SP-11.3: API CRUD templates
 * 
 * Features:
 * - Templates por defecto (oficiales de AgenTo)
 * - Templates personalizados por tenant
 * - Instalación de templates (crea agente a partir de template)
 * - Variables de personalización
 */

import { db } from "@/db"
import { 
  agentTemplates, 
  agentTemplateInstallations, 
  type AgentTemplate, 
  type NewAgentTemplate,
  type AgentType,
  type AgentTemplateConfig,
} from "@/db/schema/agent-template"
import { agents } from "@/db/schema/agent"
import { eq, and, isNull, or, desc } from "drizzle-orm"

// Templates pre-configurados por defecto
export const DEFAULT_TEMPLATES: Array<{
  name: string
  slug: string
  description: string
  shortDescription: string
  type: AgentType
  config: AgentTemplateConfig
  isOfficial: boolean
}> = [
  {
    name: "Agente de Ventas",
    slug: "sales-agent",
    description: "Ayuda con consultas de productos, precios y procesamiento de pedidos. Ideal para tiendas online y catálogos de productos.",
    shortDescription: "Asistente de ventas para consultas de productos y pedidos",
    type: "INTERNAL",
    isOfficial: true,
    config: {
      systemPrompt: `Eres un agente de ventas helpful y profesional. Tu objetivo es ayudar a los clientes a encontrar los productos que necesitan, responder preguntas sobre precios, disponibilidad y características, y facilitar el proceso de compra.

Reglas:
- Sé amable y profesional en todo momento
- Proporciona información precisa sobre productos
- Sugiere productos relacionados cuando sea apropiado
- No hagas promesas sobre precios o disponibilidad que no puedas cumplir
- Si no tienes información específica, ofrece buscarla o transferir a un humano`,
      instructions: "Ayuda a los clientes con consultas de productos, precios y pedidos.",
      welcomeMessage: "¡Hola! Soy tu asistente de ventas. ¿En qué puedo ayudarte hoy?",
      tools: ["read_file", "http_request", "whatsapp_send"],
      skills: [],
      variables: [
        {
          name: "Nombre de la tienda",
          key: "storeName",
          type: "string",
          label: "Nombre de tu tienda",
          description: "El nombre que usará el agente para referirse a tu negocio",
          required: true,
          default: "nuestra tienda",
        },
        {
          name: "Catálogo de productos",
          key: "productCatalog",
          type: "textarea",
          label: "URL o descripción del catálogo",
          description: "URL de tu catálogo o descripción breve de productos principales",
          required: false,
        },
      ],
      category: "Ventas",
      tags: ["ventas", "ecommerce", "productos", "pedidos"],
      difficulty: "beginner",
      estimatedSetupTime: 5,
    },
  },
  {
    name: "Agente de Stock/Inventario",
    slug: "stock-agent",
    description: "Monitorea niveles de inventario y alerta sobre productos bajos. Se conecta a tu base de datos de inventario y envía notificaciones automáticas.",
    shortDescription: "Monitoreo de inventario y alertas de stock bajo",
    type: "INTERNAL",
    isOfficial: true,
    config: {
      systemPrompt: `Eres un agente de gestión de inventario. Tu trabajo es monitorear niveles de stock, identificar productos que necesitan reposición y generar alertas.

Capacidades:
- Consultar niveles de inventario en tiempo real
- Identificar productos con stock bajo
- Generar reportes de inventario
- Enviar alertas por WhatsApp o email
- Sugerir órdenes de compra basadas en historial

Reglas:
- Siempre verifica la información más reciente
- Sé proactivo en las alertas
- Proporciona contexto en tus reportes`,
      instructions: "Monitorea inventario y alerta sobre productos que necesitan reposición.",
      welcomeMessage: "Sistema de gestión de inventario activado. ¿Qué necesitas consultar?",
      tools: ["read_file", "db_query", "schedule_task", "whatsapp_send"],
      skills: [],
      variables: [
        {
          name: "Umbral de stock bajo",
          key: "lowStockThreshold",
          type: "number",
          label: "Cantidad mínima de stock",
          description: "Alertar cuando el stock sea menor a esta cantidad",
          required: true,
          default: 10,
        },
        {
          name: "Horario de monitoreo",
          key: "monitorSchedule",
          type: "select",
          label: "Frecuencia de revisión",
          description: "¿Con qué frecuencia revisar el inventario?",
          required: true,
          default: "0 9 * * *",
          options: [
            { label: "Cada hora", value: "0 * * * *" },
            { label: "Cada 4 horas", value: "0 */4 * * *" },
            { label: "Diario (9 AM)", value: "0 9 * * *" },
            { label: "Semanal (Lunes 9 AM)", value: "0 9 * * 1" },
          ],
        },
        {
          name: "Número de alertas",
          key: "alertPhone",
          type: "string",
          label: "WhatsApp para alertas",
          description: "Número de WhatsApp para recibir alertas de stock bajo",
          required: false,
        },
      ],
      category: "Operaciones",
      tags: ["inventario", "stock", "alertas", "operaciones"],
      difficulty: "intermediate",
      estimatedSetupTime: 15,
    },
  },
  {
    name: "Agente de Soporte Técnico",
    slug: "support-agent",
    description: "Responde preguntas frecuentes, crea tickets y escala casos complejos a humanos. Ideal para reducir la carga del equipo de soporte.",
    shortDescription: "Soporte al cliente y gestión de tickets",
    type: "EXTERNAL",
    isOfficial: true,
    config: {
      systemPrompt: `Eres un agente de soporte técnico amable y eficiente. Tu objetivo es resolver los problemas de los clientes o escalarlos al equipo adecuado.

Proceso:
1. Escucha activamente el problema del cliente
2. Busca en la base de conocimiento
3. Proporciona soluciones paso a paso
4. Si no puedes resolver, crea un ticket y escala
5. Haz seguimiento hasta confirmar resolución

Reglas:
- Sé empático y paciente
- Explica los pasos claramente
- Confirma que el problema está resuelto antes de cerrar
- Documenta cada interacción`,
      instructions: "Proporciona soporte técnico y escala casos complejos.",
      welcomeMessage: "¡Bienvenido al soporte técnico! Describe tu problema y te ayudaré a resolverlo.",
      tools: ["read_file", "http_request"],
      skills: [],
      variables: [
        {
          name: "Base de conocimiento",
          key: "knowledgeBase",
          type: "textarea",
          label: "URL de documentación o FAQ",
          description: "Enlace a tu base de conocimiento o documentación",
          required: false,
        },
        {
          name: "Nivel de escalamiento",
          key: "escalationLevel",
          type: "select",
          label: "¿Cuándo escalar a humanos?",
          description: "Define cuándo el agente debe transferir a un humano",
          required: true,
          default: "complex",
          options: [
            { label: "Nunca (solo registra tickets)", value: "never" },
            { label: "Problemas complejos", value: "complex" },
            { label: "Siempre (primera línea)", value: "always" },
          ],
        },
      ],
      category: "Soporte",
      tags: ["soporte", "helpdesk", "tickets", "faq"],
      difficulty: "beginner",
      estimatedSetupTime: 10,
    },
  },
  {
    name: "Agente de Reportes y Analytics",
    slug: "reporting-agent",
    description: "Genera reportes automáticos de ventas, usuarios, o métricas personalizadas. Envía reportes por email o WhatsApp en horarios programados.",
    shortDescription: "Generación automática de reportes y análisis",
    type: "INTERNAL",
    isOfficial: true,
    config: {
      systemPrompt: `Eres un agente de análisis de datos y reportes. Tu trabajo es consultar bases de datos, generar insights y crear reportes visuales o escritos.

Capacidades:
- Consultar múltiples fuentes de datos
- Generar reportes en diferentes formatos
- Crear visualizaciones de datos
- Programar envío automático de reportes
- Identificar tendencias y anomalías

Formato de reportes:
- Resumen ejecutivo al inicio
- Datos clave con contexto
- Recomendaciones accionables
- Opción de exportar a Excel/PDF`,
      instructions: "Genera reportes y análisis de datos automáticos.",
      welcomeMessage: "Listo para generar reportes. ¿Qué métricas necesitas analizar?",
      tools: ["db_query", "schedule_task", "whatsapp_send", "http_request"],
      skills: [],
      variables: [
        {
          name: "Tipo de reporte",
          key: "reportType",
          type: "select",
          label: "Tipo de reporte principal",
          description: "¿Qué tipo de reporte generará este agente?",
          required: true,
          default: "sales",
          options: [
            { label: "Ventas", value: "sales" },
            { label: "Usuarios/Clientes", value: "users" },
            { label: "Inventario", value: "inventory" },
            { label: "Financiero", value: "financial" },
            { label: "Personalizado", value: "custom" },
          ],
        },
        {
          name: "Frecuencia",
          key: "frequency",
          type: "select",
          label: "Frecuencia de generación",
          description: "¿Con qué frecuencia generar los reportes?",
          required: true,
          default: "weekly",
          options: [
            { label: "Diario", value: "daily" },
            { label: "Semanal", value: "weekly" },
            { label: "Mensual", value: "monthly" },
          ],
        },
        {
          name: "Destinatarios",
          key: "recipients",
          type: "textarea",
          label: "Emails o WhatsApps para envío",
          description: "Lista de destinatarios separados por coma",
          required: false,
        },
      ],
      category: "Analytics",
      tags: ["reportes", "analytics", "datos", "dashboard"],
      difficulty: "advanced",
      estimatedSetupTime: 20,
    },
  },
]

export class AgentTemplateService {
  /**
   * Inicializa los templates por defecto
   * Llama a esto al crear un nuevo tenant
   */
  async initializeDefaultTemplates(): Promise<void> {
    console.log("[AgentTemplate] Initializing default templates...")

    for (const template of DEFAULT_TEMPLATES) {
      // Verificar si ya existe
      const existing = await db.query.agentTemplates.findFirst({
        where: and(
          eq(agentTemplates.slug, template.slug),
          isNull(agentTemplates.tenantId),
          eq(agentTemplates.isOfficial, true)
        ),
      })

      if (!existing) {
        await db.insert(agentTemplates).values({
          ...template,
          isPublic: true,
          isActive: true,
          metadata: {
            version: "1.0.0",
            downloads: 0,
            rating: 5,
            ratingCount: 0,
          },
        })
        console.log(`[AgentTemplate] Created template: ${template.name}`)
      }
    }
  }

  /**
   * Lista templates disponibles para un tenant
   * Incluye templates públicos + templates del tenant
   */
  async listTemplates(tenantId: string, options?: {
    type?: AgentType
    category?: string
    onlyOfficial?: boolean
  }): Promise<AgentTemplate[]> {
    const conditions = [
      eq(agentTemplates.isActive, true),
    ]

    // Templates públicos O templates del tenant
    conditions.push(
      or(
        eq(agentTemplates.isPublic, true),
        eq(agentTemplates.tenantId, tenantId)
      )!
    )

    if (options?.type) {
      conditions.push(eq(agentTemplates.type, options.type))
    }

    if (options?.onlyOfficial) {
      conditions.push(eq(agentTemplates.isOfficial, true))
    }

    const templates = await db.query.agentTemplates.findMany({
      where: and(...conditions),
      orderBy: [
        desc(agentTemplates.isOfficial),
        desc(agentTemplates.createdAt),
      ],
    })

    // Filtrar por categoría si se especificó
    if (options?.category) {
      return templates.filter(t => 
        (t.config as AgentTemplateConfig).category === options.category
      )
    }

    return templates
  }

  /**
   * Obtiene un template por ID
   */
  async getTemplate(id: string, tenantId: string): Promise<AgentTemplate | null> {
    return db.query.agentTemplates.findFirst({
      where: and(
        eq(agentTemplates.id, id),
        eq(agentTemplates.isActive, true),
        or(
          eq(agentTemplates.isPublic, true),
          eq(agentTemplates.tenantId, tenantId)
        )!
      ),
    })
  }

  /**
   * Crea un template personalizado
   */
  async createTemplate(
    tenantId: string,
    data: Omit<NewAgentTemplate, "id" | "tenantId" | "createdAt" | "updatedAt">
  ): Promise<AgentTemplate> {
    const [template] = await db.insert(agentTemplates).values({
      ...data,
      tenantId,
      isPublic: false,
      isOfficial: false,
    }).returning()

    return template
  }

  /**
   * Instala un template creando un agente
   */
  async installTemplate(
    templateId: string,
    tenantId: string,
    variables: Record<string, any>,
    agentName?: string
  ): Promise<{ success: boolean; agentId?: string; error?: string }> {
    try {
      // Obtener template
      const template = await this.getTemplate(templateId, tenantId)
      if (!template) {
        return { success: false, error: "Template not found" }
      }

      const config = template.config as AgentTemplateConfig

      // Validar variables requeridas
      const missingVars = config.variables
        .filter(v => v.required && !variables[v.key])
        .map(v => v.name)

      if (missingVars.length > 0) {
        return { 
          success: false, 
          error: `Missing required variables: ${missingVars.join(", ")}` 
        }
      }

      // Aplicar variables al system prompt
      let systemPrompt = config.systemPrompt
      for (const [key, value] of Object.entries(variables)) {
        systemPrompt = systemPrompt.replace(
          new RegExp(`{{${key}}}`, "g"),
          String(value)
        )
      }

      // Crear agente
      const [agent] = await db.insert(agents).values({
        tenantId,
        name: agentName || template.name,
        description: template.description,
        type: template.type,
        status: "ACTIVE",
        configuration: {
          systemPrompt,
          instructions: config.instructions,
          welcomeMessage: config.welcomeMessage,
          tools: config.tools,
          skills: config.skills,
          maxTokens: config.maxTokens,
          temperature: config.temperature,
          model: config.model,
          provider: config.provider,
        },
      }).returning()

      // Registrar instalación
      await db.insert(agentTemplateInstallations).values({
        templateId,
        tenantId,
        agentId: agent.id,
        variables,
        status: "active",
      })

      // Actualizar contador de descargas
      await db.update(agentTemplates)
        .set({
          metadata: {
            ...(template.metadata as any),
            downloads: ((template.metadata as any)?.downloads || 0) + 1,
          },
        })
        .where(eq(agentTemplates.id, templateId))

      return { success: true, agentId: agent.id }
    } catch (error) {
      console.error("[AgentTemplate] Install error:", error)
      return { 
        success: false, 
        error: error instanceof Error ? error.message : "Unknown error" 
      }
    }
  }

  /**
   * Obtiene instalaciones de un tenant
   */
  async getInstallations(tenantId: string): Promise<AgentTemplateInstallation[]> {
    return db.query.agentTemplateInstallations.findMany({
      where: eq(agentTemplateInstallations.tenantId, tenantId),
      orderBy: [desc(agentTemplateInstallations.installedAt)],
    })
  }

  /**
   * Duplica un template para personalización
   */
  async forkTemplate(
    templateId: string,
    tenantId: string,
    newName: string
  ): Promise<AgentTemplate | null> {
    const template = await this.getTemplate(templateId, tenantId)
    if (!template) return null

    const [newTemplate] = await db.insert(agentTemplates).values({
      tenantId,
      name: newName,
      slug: `${template.slug}-fork-${Date.now()}`,
      description: template.description,
      shortDescription: template.shortDescription,
      type: template.type,
      config: template.config,
      isPublic: false,
      isOfficial: false,
      isActive: true,
      metadata: {
        forkedFrom: templateId,
        version: "1.0.0",
      },
    }).returning()

    return newTemplate
  }
}

// Singleton
export const agentTemplateService = new AgentTemplateService()
