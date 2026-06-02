/**
 * HTTP Request Tool
 * 
 * SP-4.1: Tool para hacer requests HTTP a APIs externas
 * 
 * Features:
 * - Soporte para GET, POST, PUT, DELETE, PATCH
 * - Headers personalizables
 * - Body JSON
 * - Timeout configurable
 * - Requiere approval por seguridad
 */

import { z } from "zod"

export const httpRequestSchema = z.object({
  url: z.string().url().describe("URL del endpoint"),
  method: z.enum(["GET", "POST", "PUT", "DELETE", "PATCH"]).default("GET").describe("Método HTTP"),
  headers: z.record(z.string()).optional().describe("Headers HTTP"),
  body: z.any().optional().describe("Body de la request (para POST/PUT/PATCH)"),
  timeout: z.number().min(1000).max(60000).default(30000).describe("Timeout en ms (default: 30000)"),
})

export type HttpRequestInput = z.infer<typeof httpRequestSchema>

export interface HttpRequestOutput {
  status: number
  statusText: string
  headers: Record<string, string>
  data: any
}

/**
 * Ejecuta un request HTTP
 * 
 * @requiresApproval true - Esta tool requiere aprobación del usuario
 */
export async function executeHttpRequest(params: HttpRequestInput): Promise<HttpRequestOutput> {
  const { url, method, headers, body, timeout } = params

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeout)

  try {
    const response = await fetch(url, {
      method,
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "AgenTo-Agent/1.0",
        ...headers,
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    })

    clearTimeout(timeoutId)

    // Parsear respuesta según content-type
    const contentType = response.headers.get("content-type") || ""
    let data: any

    if (contentType.includes("application/json")) {
      data = await response.json()
    } else {
      data = await response.text()
    }

    return {
      status: response.status,
      statusText: response.statusText,
      headers: Object.fromEntries(response.headers.entries()),
      data,
    }
  } catch (error) {
    clearTimeout(timeoutId)
    
    if (error instanceof Error) {
      if (error.name === "AbortError") {
        throw new Error(`Request timeout after ${timeout}ms`)
      }
      throw new Error(`HTTP request failed: ${error.message}`)
    }
    throw error
  }
}

export const httpRequestTool = {
  name: "http_request",
  description: "Realiza requests HTTP a APIs externas. Soporta GET, POST, PUT, DELETE, PATCH con headers y body personalizables.",
  requiresApproval: true,
  schema: httpRequestSchema,
  execute: executeHttpRequest,
}
