/**
 * write_file - Herramienta para escribir archivos
 *
 * Adaptada para AgenTo SaaS - valida paths dentro del workspace
 */

import * as fs from "fs/promises"
import * as path from "path"
import { createTwoFilesPatch } from "diff"
import { ToolContext, ToolResult, PathValidator } from "../types/tool-context"

export interface WriteFileParams {
  /** Ruta del archivo (relativa al workspace) */
  path: string
  /** Contenido a escribir */
  content: string
}

export const write_file = {
  name: "write_file",
  description:
    "Crea un nuevo archivo o sobrescribe uno existente con el contenido proporcionado. " +
    "El path debe ser relativo al workspace del agente.",

  async execute(params: WriteFileParams, context: ToolContext): Promise<ToolResult> {
    // Validar path
    const fullPath = PathValidator.resolve(context.workspacePath, params.path)
    PathValidator.validate(context.workspacePath, fullPath)

    // Verificar si existe el archivo
    const exists = await fs.access(fullPath).then(() => true).catch(() => false)
    const contentOld = exists ? await fs.readFile(fullPath, "utf-8") : ""

    // Crear diff para approval
    const diff = trimDiff(createTwoFilesPatch(fullPath, fullPath, contentOld, params.content))

    // Solicitar permiso
    if (context.askPermission) {
      const response = await context.askPermission({
        permission: "write",
        patterns: [params.path],
        always: ["*"],
        metadata: {
          filepath: fullPath,
          diff,
          exists,
        },
      })
      if (!response.granted) {
        throw new Error(response.reason || "Permission denied")
      }
    }

    // Crear directorio padre si no existe
    const parentDir = path.dirname(fullPath)
    await fs.mkdir(parentDir, { recursive: true })

    // Escribir archivo
    await fs.writeFile(fullPath, params.content, "utf-8")

    return {
      success: true,
      title: PathValidator.relative(context.workspacePath, fullPath),
      output: exists ? "File updated successfully." : "File created successfully.",
      metadata: {
        filepath: fullPath,
        path: params.path,
        exists,
        diff,
      },
    }
  },
}

/**
 * Trunca el diff para hacerlo más legible
 */
function trimDiff(diff: string): string {
  const lines = diff.split("\n")
  const contentLines = lines.filter(
    (line) =>
      (line.startsWith("+") || line.startsWith("-") || line.startsWith(" ")) &&
      !line.startsWith("---") &&
      !line.startsWith("+++")
  )

  if (contentLines.length === 0) return diff

  let minIndent = Infinity
  for (const line of contentLines) {
    const content = line.slice(1)
    if (content.trim().length > 0) {
      const match = content.match(/^(\s*)/)
      if (match) minIndent = Math.min(minIndent, match[1].length)
    }
  }

  if (minIndent === Infinity || minIndent === 0) return diff

  const trimmedLines = lines.map((line) => {
    if (
      (line.startsWith("+") || line.startsWith("-") || line.startsWith(" ")) &&
      !line.startsWith("---") &&
      !line.startsWith("+++")
    ) {
      const prefix = line[0]
      const content = line.slice(1)
      return prefix + content.slice(minIndent)
    }
    return line
  })

  return trimmedLines.join("\n")
}
