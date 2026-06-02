/**
 * read_file - Herramienta para leer archivos
 *
 * Adaptada para AgenTo SaaS - valida paths dentro del workspace
 */

import * as fs from "fs/promises"
import * as path from "path"
import { createReadStream } from "fs"
import { createInterface } from "readline"
import { ToolContext, ToolResult, PathValidator } from "../types/tool-context"

export interface ReadFileParams {
  /** Ruta del archivo (relativa al workspace) */
  path: string
  /** Línea de inicio (1-indexado, opcional) */
  offset?: number
  /** Límite de líneas a leer (default: 2000) */
  limit?: number
}

export const read_file = {
  name: "read_file",
  description:
    "Lee el contenido de un archivo. Soporta archivos de texto, PDF e imágenes. " +
    "Para archivos grandes, usa offset y limit para leer por partes.",

  async execute(params: ReadFileParams, context: ToolContext): Promise<ToolResult> {
    // Validar offset
    if (params.offset !== undefined && params.offset < 1) {
      throw new Error("offset must be greater than or equal to 1")
    }

    // Validar path
    const fullPath = PathValidator.resolve(context.workspacePath, params.path)
    PathValidator.validate(context.workspacePath, fullPath)

    // Solicitar permiso si está implementado
    if (context.askPermission) {
      const response = await context.askPermission({
        permission: "read",
        patterns: [params.path],
        always: ["*"],
      })
      if (!response.granted) {
        throw new Error(response.reason || "Permission denied")
      }
    }

    // Verificar que el archivo existe
    const stat = await fs.stat(fullPath).catch(() => null)
    if (!stat) {
      throw new Error(`File not found: ${params.path}`)
    }

    // Si es directorio, listar contenido
    if (stat.isDirectory()) {
      return await readDirectory(fullPath, context.workspacePath, params.offset, params.limit)
    }

    // Detectar si es imagen o PDF
    const mime = getMimeType(fullPath)
    const isImage = mime.startsWith("image/") && mime !== "image/svg+xml"
    const isPdf = mime === "application/pdf"

    if (isImage || isPdf) {
      return {
        title: PathValidator.relative(context.workspacePath, fullPath),
        output: `${isPdf ? "PDF" : "Image"} file read successfully`,
        attachments: [
          {
            type: "file",
            mime,
            url: `data:${mime};base64,${Buffer.from(await fs.readFile(fullPath)).toString("base64")}`,
          },
        ],
      }
    }

    // Verificar que no es binario
    if (await isBinaryFile(fullPath, stat.size)) {
      throw new Error(`Cannot read binary file: ${params.path}`)
    }

    // Leer archivo de texto
    return await readTextFile(fullPath, context.workspacePath, params.offset, params.limit)
  },
}

async function readDirectory(
  dirPath: string,
  workspacePath: string,
  offset?: number,
  limit?: number
): Promise<ToolResult> {
  const dirents = await fs.readdir(dirPath, { withFileTypes: true })
  const entries = await Promise.all(
    dirents.map(async (dirent) => {
      if (dirent.isDirectory()) return dirent.name + "/"
      if (dirent.isSymbolicLink()) {
        const target = await fs.stat(path.join(dirPath, dirent.name)).catch(() => undefined)
        if (target?.isDirectory()) return dirent.name + "/"
      }
      return dirent.name
    })
  )
  entries.sort((a, b) => a.localeCompare(b))

  const DEFAULT_LIMIT = 2000
  const maxLimit = limit ?? DEFAULT_LIMIT
  const start = (offset ?? 1) - 1
  const sliced = entries.slice(start, start + maxLimit)
  const truncated = start + sliced.length < entries.length

  const output = [
    `<path>${PathValidator.relative(workspacePath, dirPath)}</path>`,
    `<type>directory</type>`,
    `<entries>`,
    ...sliced,
    truncated
      ? `\n(Showing ${sliced.length} of ${entries.length} entries. Use 'offset' parameter to read beyond entry ${offset + sliced.length})`
      : `\n(${entries.length} entries)`,
    `</entries>`,
  ].join("\n")

  return {
    title: PathValidator.relative(workspacePath, dirPath),
    output,
    metadata: {
      preview: sliced.slice(0, 20).join("\n"),
      truncated,
    },
  }
}

async function readTextFile(
  filePath: string,
  workspacePath: string,
  offset?: number,
  limit?: number
): Promise<ToolResult> {
  const MAX_LINE_LENGTH = 2000
  const MAX_BYTES = 50 * 1024
  const DEFAULT_LIMIT = 2000

  const stream = createReadStream(filePath, { encoding: "utf8" })
  const rl = createInterface({ input: stream, crlfDelay: Infinity })

  const maxLimit = limit ?? DEFAULT_LIMIT
  const start = (offset ?? 1) - 1
  const raw: string[] = []
  let bytes = 0
  let lines = 0
  let truncatedByBytes = false
  let hasMoreLines = false

  try {
    for await (const text of rl) {
      lines += 1
      if (lines <= start) continue

      if (raw.length >= maxLimit) {
        hasMoreLines = true
        continue
      }

      const line =
        text.length > MAX_LINE_LENGTH
          ? text.substring(0, MAX_LINE_LENGTH) + `... (line truncated to ${MAX_LINE_LENGTH} chars)`
          : text
      const size = Buffer.byteLength(line, "utf8") + (raw.length > 0 ? 1 : 0)
      if (bytes + size > MAX_BYTES) {
        truncatedByBytes = true
        hasMoreLines = true
        break
      }

      raw.push(line)
      bytes += size
    }
  } finally {
    rl.close()
    stream.destroy()
  }

  if (lines < offset && !(lines === 0 && offset === 1)) {
    throw new Error(`Offset ${offset} is out of range for this file (${lines} lines)`)
  }

  const content = raw.map((line, index) => `${index + offset}: ${line}`)
  const preview = raw.slice(0, 20).join("\n")

  const totalLines = lines
  const lastReadLine = offset + raw.length - 1
  const nextOffset = lastReadLine + 1
  const truncated = hasMoreLines || truncatedByBytes

  let output = [
    `<path>${PathValidator.relative(workspacePath, filePath)}</path>`,
    `<type>file</type>`,
    "<content>",
    ...content,
  ]

  if (truncatedByBytes) {
    output.push(
      `\n\n(Output capped at ${MAX_BYTES / 1024} KB. Showing lines ${offset}-${lastReadLine}. Use offset=${nextOffset} to continue.)`
    )
  } else if (hasMoreLines) {
    output.push(
      `\n\n(Showing lines ${offset}-${lastReadLine} of ${totalLines}. Use offset=${nextOffset} to continue.)`
    )
  } else {
    output.push(`\n\n(End of file - total ${totalLines} lines)`)
  }

  output.push("</content>")

  return {
    title: PathValidator.relative(workspacePath, filePath),
    output: output.join("\n"),
    metadata: {
      preview,
      truncated,
    },
  }
}

async function isBinaryFile(filepath: string, fileSize: number): Promise<boolean> {
  const ext = path.extname(filepath).toLowerCase()
  const binaryExtensions = [
    ".zip", ".tar", ".gz", ".exe", ".dll", ".so", ".class", ".jar", ".war",
    ".7z", ".doc", ".docx", ".xls", ".xlsx", ".ppt", ".pptx", ".odt",
    ".ods", ".odp", ".bin", ".dat", ".obj", ".o", ".a", ".lib", ".wasm",
    ".pyc", ".pyo",
  ]

  if (binaryExtensions.includes(ext)) return true
  if (fileSize === 0) return false

  const fh = await fs.open(filepath, "r")
  try {
    const sampleSize = Math.min(4096, fileSize)
    const bytes = Buffer.alloc(sampleSize)
    const result = await fh.read(bytes, 0, sampleSize, 0)
    if (result.bytesRead === 0) return false

    let nonPrintableCount = 0
    for (let i = 0; i < result.bytesRead; i++) {
      if (bytes[i] === 0) return true
      if (bytes[i] < 9 || (bytes[i] > 13 && bytes[i] < 32)) {
        nonPrintableCount++
      }
    }
    return nonPrintableCount / result.bytesRead > 0.3
  } finally {
    await fh.close()
  }
}

function getMimeType(filepath: string): string {
  const ext = path.extname(filepath).toLowerCase()
  const mimeTypes: Record<string, string> = {
    ".pdf": "application/pdf",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".gif": "image/gif",
    ".svg": "image/svg+xml",
    ".webp": "image/webp",
  }
  return mimeTypes[ext] || "application/octet-stream"
}
