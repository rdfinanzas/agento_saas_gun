/**
 * grep - Herramienta para buscar texto en archivos
 *
 * Adaptada para AgenTo SaaS - valida paths dentro del workspace
 */

import * as path from "path"
import * as fs from "fs/promises"
import { ToolContext, ToolResult, PathValidator } from "../types/tool-context"

export interface GrepParams {
  /** Patrón de búsqueda (texto o regex simple) */
  pattern: string
  /** Directorio o archivo donde buscar (default: workspace) */
  path?: string
  /** Patrón de inclusión de archivos (ej: "*.ts", "*.{js,tsx}") */
  include?: string
  /** Límite de resultados (default: 100) */
  limit?: number
}

const DEFAULT_LIMIT = 100
const MAX_LINE_LENGTH = 2000

export const grep = {
  name: "grep",
  description:
    "Busca texto en archivos. Soporta búsqueda de texto simple y patrones básicos. " +
    "Usa 'include' para filtrar tipos de archivo (ej: '*.ts'). " +
    "Usa 'path' para especificar directorio o archivo específico.",

  async execute(params: GrepParams, context: ToolContext): Promise<ToolResult> {
    // Validar patrón
    if (!params.pattern || params.pattern.trim().length === 0) {
      throw new Error("pattern is required")
    }

    // Validar path
    const searchPath = params.path
      ? PathValidator.resolve(context.workspacePath, params.path)
      : context.workspacePath

    PathValidator.validate(context.workspacePath, searchPath)

    // Solicitar permiso
    if (context.askPermission) {
      const response = await context.askPermission({
        permission: "grep",
        patterns: [params.pattern],
        always: ["*"],
        metadata: {
          pattern: params.pattern,
          path: PathValidator.relative(context.workspacePath, searchPath),
          include: params.include,
        },
      })
      if (!response.granted) {
        throw new Error(response.reason || "Permission denied")
      }
    }

    const limit = params.limit ?? DEFAULT_LIMIT

    try {
      // Verificar si es archivo o directorio
      const stat = await fs.stat(searchPath).catch(() => null)

      let filesToSearch: string[] = []

      if (stat && stat.isFile()) {
        // Buscar solo en el archivo especificado
        filesToSearch = [searchPath]
      } else {
        // Buscar en directorio
        filesToSearch = await collectFiles(searchPath, params.include)
      }

      // Buscar coincidencias
      const matches = await searchInFiles(filesToSearch, params.pattern)

      // Ordenar por tiempo de modificación
      matches.sort((a, b) => b.modTime - a.modTime)

      const truncated = matches.length > limit
      const finalMatches = truncated ? matches.slice(0, limit) : matches

      if (finalMatches.length === 0) {
        return {
          title: params.pattern,
          output: "No matches found",
          metadata: { matches: 0, truncated: false },
        }
      }

      // Construir output
      const outputLines = [
        `Found ${matches.length} match${matches.length > 1 ? "es" : ""}${truncated ? ` (showing first ${limit})` : ""}`,
      ]

      let currentFile = ""
      for (const match of finalMatches) {
        const relPath = PathValidator.relative(context.workspacePath, match.path)
        if (currentFile !== relPath) {
          if (currentFile !== "") {
            outputLines.push("")
          }
          currentFile = relPath
          outputLines.push(`${relPath}:`)
        }
        const truncatedLine =
          match.lineText.length > MAX_LINE_LENGTH
            ? match.lineText.substring(0, MAX_LINE_LENGTH) + "..."
            : match.lineText
        outputLines.push(`  Line ${match.lineNum}: ${truncatedLine}`)
      }

      if (truncated) {
        outputLines.push("")
        outputLines.push(
          `(Results truncated: showing ${limit} of ${matches.length} matches. ` +
          `Consider using a more specific path or pattern.)`
        )
      }

      return {
        title: params.pattern,
        output: outputLines.join("\n"),
        metadata: {
          matches: matches.length,
          truncated,
        },
      }
    } catch (error) {
      throw new Error(`Grep search failed: ${error instanceof Error ? error.message : String(error)}`)
    }
  },
}

/**
 * Colecta archivos para buscar recursivamente
 */
async function collectFiles(
  dirPath: string,
  include?: string
): Promise<string[]> {
  const files: string[] = []

  async function walk(currentPath: string) {
    const entries = await fs.readdir(currentPath, { withFileTypes: true })

    for (const entry of entries) {
      const fullPath = path.join(currentPath, entry.name)

      // Skip node_modules y carpetas comunes
      if (
        entry.isDirectory() &&
        ["node_modules", ".git", "dist", "build", ".next", ".venv"].includes(entry.name)
      ) {
        continue
      }

      if (entry.isDirectory()) {
        await walk(fullPath)
      } else if (entry.isFile()) {
        // Filtrar por include si se proporciona
        if (include) {
          const matches = matchIncludePattern(entry.name, include)
          if (matches) {
            files.push(fullPath)
          }
        } else {
          // Skip archivos binarios comunes
          const ext = path.extname(entry.name).toLowerCase()
          const binaryExts = [
            ".png", ".jpg", ".jpeg", ".gif", ".svg", ".ico", ".pdf", ".zip",
            ".tar", ".gz", ".exe", ".dll", ".so", ".dylib", ".bin",
          ]
          if (!binaryExts.includes(ext)) {
            files.push(fullPath)
          }
        }
      }
    }
  }

  await walk(dirPath)
  return files
}

/**
 * Verifica si un archivo coincide con el patrón include
 */
function matchIncludePattern(filename: string, include: string): boolean {
  // Soportar patrones como "*.ts", "*.{js,tsx}", "*.js"
  const braceMatch = include.match(/^\*\.\{(.+)\}$/)
  if (braceMatch) {
    const extensions = braceMatch[1].split(",")
    const ext = path.extname(filename).toLowerCase()
    return extensions.some((e) => `.${e.toLowerCase()}` === ext)
  }

  const simpleMatch = include.match(/^\*\.(.+)$/)
  if (simpleMatch) {
    const ext = path.extname(filename).toLowerCase()
    return `.${simpleMatch[1].toLowerCase()}` === ext
  }

  // Fallback: verificar si filename termina en include
  return filename.endsWith(include)
}

/**
 * Busca el patrón en los archivos
 */
async function searchInFiles(
  files: string[],
  pattern: string
): Promise<Array<{ path: string; modTime: number; lineNum: number; lineText: string }>> {
  const matches: Array<{ path: string; modTime: number; lineNum: number; lineText: string }> = []
  const regex = new RegExp(pattern.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i")

  for (const file of files) {
    try {
      const content = await fs.readFile(file, "utf-8")
      const lines = content.split("\n")

      for (let i = 0; i < lines.length; i++) {
        if (regex.test(lines[i])) {
          const stat = await fs.stat(file).catch(() => null)
          matches.push({
            path: file,
            modTime: stat?.mtime.getTime() || 0,
            lineNum: i + 1,
            lineText: lines[i],
          })
        }
      }
    } catch {
      // Skip archivos que no se pueden leer
    }
  }

  return matches
}
