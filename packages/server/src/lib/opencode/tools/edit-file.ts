/**
 * edit_file - Herramienta para editar archivos con diff-match-patch
 *
 * Adaptada para AgenTo SaaS - valida paths dentro del workspace
 */

import * as fs from "fs/promises"
import * as path from "path"
import { createTwoFilesPatch, diffLines } from "diff"
import { ToolContext, ToolResult, PathValidator } from "../types/tool-context"

export interface EditFileParams {
  /** Ruta del archivo (relativa al workspace) */
  path: string
  /** Texto a reemplazar */
  oldString: string
  /** Texto de reemplazo */
  newString: string
  /** Reemplazar todas las ocurrencias (default: false) */
  replaceAll?: boolean
}

export const edit_file = {
  name: "edit_file",
  description:
    "Edita un archivo reemplazando el texto oldString con newString. " +
    "El texto debe coincidir exactamente, incluyendo espacios y sangría. " +
    "Usa replaceAll para reemplazar todas las ocurrencias.",

  async execute(params: EditFileParams, context: ToolContext): Promise<ToolResult> {
    // Validaciones
    if (!params.path) {
      throw new Error("path is required")
    }
    if (params.oldString === params.newString) {
      throw new Error("No changes to apply: oldString and newString are identical.")
    }

    // Validar path
    const fullPath = PathValidator.resolve(context.workspacePath, params.path)
    PathValidator.validate(context.workspacePath, fullPath)

    // Verificar que existe
    const stat = await fs.stat(fullPath).catch(() => null)
    if (!stat) {
      throw new Error(`File not found: ${params.path}`)
    }
    if (stat.isDirectory()) {
      throw new Error(`Path is a directory, not a file: ${params.path}`)
    }

    // Leer archivo actual
    let contentOld = await fs.readFile(fullPath, "utf-8")

    // Detectar y preservar finales de línea
    const lineEnding = contentOld.includes("\r\n") ? "\r\n" : "\n"

    // Normalizar y aplicar cambios
    const oldNormalized = params.oldString.replaceAll("\r\n", "\n")
    const newNormalized = params.newString.replaceAll("\r\n", "\n")

    // Buscar el texto a reemplazar
    const index = contentOld.replaceAll("\r\n", "\n").indexOf(oldNormalized)

    if (index === -1) {
      throw new Error(
        "Could not find oldString in the file. " +
        "It must match exactly, including whitespace, indentation, and line endings."
      )
    }

    // Verificar que no hay múltiples ocurrencias si no es replaceAll
    if (!params.replaceAll) {
      const lastIndex = contentOld.replaceAll("\r\n", "\n").lastIndexOf(oldNormalized)
      if (index !== lastIndex) {
        throw new Error(
          "Found multiple matches for oldString. " +
          "Provide more surrounding context to make the match unique, or use replaceAll."
        )
      }
    }

    // Aplicar reemplazo
    let contentNew: string
    if (params.replaceAll) {
      contentNew = contentOld.replaceAll(params.oldString, params.newString)
    } else {
      contentNew =
        contentOld.substring(0, index) + params.newString +
        contentOld.substring(index + params.oldString.length)
    }

    // Crear diff para approval
    const diff = trimDiff(
      createTwoFilesPatch(
        fullPath,
        fullPath,
        contentOld.replaceAll("\r\n", "\n"),
        contentNew.replaceAll("\r\n", "\n")
      )
    )

    // Solicitar permiso
    if (context.askPermission) {
      const response = await context.askPermission({
        permission: "write",
        patterns: [params.path],
        always: ["*"],
        metadata: {
          filepath: fullPath,
          diff,
        },
      })
      if (!response.granted) {
        throw new Error(response.reason || "Permission denied")
      }
    }

    // Escribir archivo
    await fs.writeFile(fullPath, contentNew, "utf-8")

    // Calcular estadísticas del diff
    let additions = 0
    let deletions = 0
    for (const change of diffLines(contentOld, contentNew)) {
      if (change.added) additions += change.count || 0
      if (change.removed) deletions += change.count || 0
    }

    const filediff = {
      file: fullPath,
      before: contentOld,
      after: contentNew,
      additions,
      deletions,
    }

    return {
      title: PathValidator.relative(context.workspacePath, fullPath),
      output: "Edit applied successfully.",
      metadata: {
        filepath: fullPath,
        diff,
        filediff,
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
