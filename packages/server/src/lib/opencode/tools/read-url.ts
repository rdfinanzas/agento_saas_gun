/**
 * Read URL Tool
 * 
 * SP-4.5: Tool para leer contenido de URLs y convertir a markdown
 * 
 * Features:
 * - Fetch de cualquier URL
 * - Convierte HTML a Markdown usando Turndown
 * - Limpia contenido irrelevante (nav, footer, ads)
 * - Extrae links
 * - Timeout configurable
 */

import { z } from "zod"
import Turndown from "turndown"

export const readUrlSchema = z.object({
  url: z.string().url().describe("URL a leer"),
  selector: z.string().optional().describe("CSS selector para extraer contenido específico (opcional)"),
  includeLinks: z.boolean().default(true).describe("Incluir links al final del contenido"),
  timeout: z.number().min(5000).max(60000).default(30000).describe("Timeout en ms"),
})

export type ReadUrlInput = z.infer<typeof readUrlSchema>

export interface ReadUrlOutput {
  url: string
  title: string
  content: string
  links: Array<{ text: string; href: string }>
  extractedAt: string
}

// Instancia de Turndown con configuración
const turndown = new Turndown({
  headingStyle: "atx",
  bulletListMarker: "-",
  codeBlockStyle: "fenced",
})

// Remover elementos no deseados
turndown.remove(["script", "style", "nav", "footer", "aside", "header", ".ad", ".advertisement", ".sidebar"])

/**
 * Lee una URL y convierte su contenido a Markdown
 */
export async function executeReadUrl(params: ReadUrlInput): Promise<ReadUrlOutput> {
  const { url, selector, includeLinks, timeout } = params

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeout)

  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
      signal: controller.signal,
    })

    clearTimeout(timeoutId)

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }

    const contentType = response.headers.get("content-type") || ""
    
    // Si es JSON, retornar formateado
    if (contentType.includes("application/json")) {
      const json = await response.json()
      return {
        url,
        title: "JSON Response",
        content: "```json\n" + JSON.stringify(json, null, 2) + "\n```",
        links: [],
        extractedAt: new Date().toISOString(),
      }
    }

    // Si no es HTML, retornar como texto plano
    if (!contentType.includes("text/html")) {
      const text = await response.text()
      return {
        url,
        title: "Text Content",
        content: text.slice(0, 100000), // Limitar a 100KB
        links: [],
        extractedAt: new Date().toISOString(),
      }
    }

    // Procesar HTML
    const html = await response.text()
    
    // Extraer título
    const titleMatch = html.match(/<title[^>]*>([^<]*)<\/title>/i)
    const title = titleMatch ? titleMatch[1].trim() : "Sin título"

    // Extraer links antes de convertir a markdown
    const links: Array<{ text: string; href: string }> = []
    if (includeLinks) {
      const linkRegex = /<a[^>]+href=["']([^"']+)["'][^>]*>([^<]*)<\/a>/gi
      let match
      while ((match = linkRegex.exec(html)) !== null) {
        const href = match[1]
        const text = match[2].trim()
        // Solo incluir links http/https y con texto
        if (text && (href.startsWith("http") || href.startsWith("/"))) {
          links.push({
            text: text.slice(0, 100), // Limitar longitud
            href: href.startsWith("/") ? new URL(href, url).href : href,
          })
        }
      }
    }

    // Convertir HTML a Markdown
    let content = turndown.turndown(html)

    // Limpiar contenido
    content = content
      .replace(/\n{3,}/g, "\n\n") // Múltiples saltos de línea
      .replace(/^\s+|\s+$/g, "") // Espacios al inicio/final
      .slice(0, 50000) // Limitar a 50KB de markdown

    // Agregar links al final si se solicita
    if (includeLinks && links.length > 0) {
      content += "\n\n## Links encontrados\n\n"
      content += links
        .slice(0, 50) // Máximo 50 links
        .map(link => `- [${link.text}](${link.href})`)
        .join("\n")
    }

    return {
      url,
      title,
      content,
      links: links.slice(0, 50),
      extractedAt: new Date().toISOString(),
    }
  } catch (error) {
    clearTimeout(timeoutId)
    
    if (error instanceof Error) {
      if (error.name === "AbortError") {
        throw new Error(`Request timeout after ${timeout}ms`)
      }
      throw new Error(`Failed to read URL: ${error.message}`)
    }
    throw error
  }
}

export const readUrlTool = {
  name: "read_url",
  description: "Lee el contenido de una URL y lo convierte a Markdown. Extrae texto limpio de páginas web, incluyendo links encontrados. Soporta HTML y JSON.",
  requiresApproval: false,
  schema: readUrlSchema,
  execute: executeReadUrl,
}
