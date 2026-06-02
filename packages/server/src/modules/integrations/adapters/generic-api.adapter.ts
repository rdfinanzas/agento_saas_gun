/**
 * Generic API Adapter
 *
 * Para clientes que no usan Dolibarr. Se configura con una base URL
 * y endpoints mapeados a tools.
 */

import axios from "axios"
import { z } from "zod"
import { BaseIntegrationAdapter, type IntegrationConfig, type ToolContext, type ToolDefinition } from "./base-integration.adapter"
import { createLogger } from "../../../utils/logger"

const logger = createLogger("generic-api-adapter")

export class GenericAPIAdapter extends BaseIntegrationAdapter {
  readonly type = "generic-api"
  private client: axios.AxiosInstance

  constructor(config: IntegrationConfig) {
    super(config)

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    }

    // Auth type
    const authType = this.config.metadata?.authType as string || "bearer"
    if (authType === "bearer" && this.credentials.token) {
      headers.Authorization = `Bearer ${this.credentials.token}`
    } else if (authType === "apikey" && this.credentials.headerName && this.credentials.apiKeyValue) {
      headers[this.credentials.headerName] = this.credentials.apiKeyValue
    } else if (authType === "basic" && this.credentials.username && this.credentials.password) {
      // Axios maneja basic auth
    }

    this.client = axios.create({
      baseURL: this.baseUrl,
      headers,
      timeout: 15000,
      auth: authType === "basic" ? {
        username: this.credentials.username || "",
        password: this.credentials.password || "",
      } : undefined,
    })
  }

  async testConnection(): Promise<{ success: boolean; message: string }> {
    try {
      const healthEndpoint = (this.config.metadata?.healthEndpoint as string) || "/health"
      const { status } = await this.client.get(healthEndpoint)
      return { success: status >= 200 && status < 300, message: "Conexion exitosa" }
    } catch (error: any) {
      // Algunas APIs no tienen /health, probar con cualquier endpoint
      if (error.response?.status === 401) {
        return { success: false, message: "Credenciales invalidas" }
      }
      return { success: false, message: `Error: ${error.message}` }
    }
  }

  getTools(context: ToolContext): ToolDefinition[] {
    // Las tools se generan dinamicamente desde la config metadata
    const endpoints = (this.config.metadata?.endpoints as Array<{
      name: string
      description: string
      method: "GET" | "POST" | "PUT" | "DELETE"
      path: string
      parameters?: Record<string, { type: string; description: string; required: boolean }>
    }>) || []

    return endpoints.map((ep) => ({
      name: ep.name,
      description: ep.description,
      parameters: this.buildZodSchema(ep.parameters),
      execute: async (params: Record<string, unknown>) => {
        try {
          const url = ep.path.replace(/\{(\w+)\}/g, (_, key) => String(params[key] || ""))

          const { data } = await this.client.request({
            method: ep.method,
            url,
            params: ep.method === "GET" ? params : undefined,
            data: ep.method !== "GET" ? params : undefined,
          })

          // Truncar respuesta si es muy larga para WhatsApp
          const str = typeof data === "string" ? data : JSON.stringify(data, null, 2)
          return str.length > 2000 ? str.substring(0, 2000) + "..." : str
        } catch (error: any) {
          return `Error: ${error.response?.data?.message || error.message}`
        }
      },
    }))
  }

  private buildZodSchema(parameters?: Record<string, { type: string; description: string; required: boolean }>): z.ZodType<any> {
    if (!parameters) return z.object({})

    const shape: Record<string, z.ZodTypeAny> = {}
    for (const [key, config] of Object.entries(parameters)) {
      let field: z.ZodTypeAny
      switch (config.type) {
        case "number":
          field = z.number().describe(config.description)
          break
        case "boolean":
          field = z.boolean().describe(config.description)
          break
        case "array":
          field = z.array(z.any()).describe(config.description)
          break
        default:
          field = z.string().describe(config.description)
      }
      if (!config.required) field = field.optional()
      shape[key] = field
    }

    return z.object(shape)
  }
}
