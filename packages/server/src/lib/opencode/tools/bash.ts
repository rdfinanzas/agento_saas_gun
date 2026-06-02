/**
 * bash - Herramienta para ejecutar comandos en la terminal
 *
 * Adaptada para AgenTo SaaS - usa Bun.spawn y valida workspace
 */

import { ToolContext, ToolResult, PathValidator } from "../types/tool-context"

export interface BashParams {
  /** Comando a ejecutar */
  command: string
  /** Directorio de trabajo (default: workspace) */
  cwd?: string
  /** Timeout en milisegundos (default: 30000) */
  timeout?: number
  /** Descripción del comando */
  description?: string
}

const DEFAULT_TIMEOUT = 30000
const MAX_METADATA_LENGTH = 30000

export const bash = {
  name: "bash",
  description:
    "Ejecuta comandos de shell en el workspace. " +
    "Usa esto para instalar dependencias, ejecutar tests, hacer build, etc. " +
    "IMPORTANTE: Usa 'cwd' para cambiar directorio en vez de 'cd'.",

  async execute(params: BashParams, context: ToolContext): Promise<ToolResult> {
    // Validar comando
    if (!params.command || params.command.trim().length === 0) {
      throw new Error("command is required and cannot be empty")
    }

    // Validar cwd si se proporciona
    const cwd = params.cwd || context.workspacePath
    const resolvedCwd = PathValidator.resolve(context.workspacePath, cwd)
    PathValidator.validate(context.workspacePath, resolvedCwd)

    // Validar timeout
    const timeout = params.timeout ?? DEFAULT_TIMEOUT
    if (timeout < 0) {
      throw new Error(`Invalid timeout value: ${timeout}. Timeout must be a positive number.`)
    }

    // Solicitar permiso
    if (context.askPermission) {
      const response = await context.askPermission({
        permission: "bash",
        patterns: [params.command],
        always: [params.command.split(" ")[0] + " *"],
        metadata: {
          cwd: resolvedCwd,
          description: params.description,
        },
      })
      if (!response.granted) {
        throw new Error(response.reason || "Permission denied")
      }
    }

    // Actualizar metadatos iniciales
    if (context.metadata) {
      context.metadata({
        metadata: {
          output: "",
          description: params.description || params.command.split(" ")[0],
        },
      })
    }

    // Ejecutar comando con Bun.spawn
    const args = params.command.split(" ")
    const cmd = args[0]
    const cmdArgs = args.slice(1)

    const proc = Bun.spawn([cmd, ...cmdArgs], {
      cwd: resolvedCwd,
      env: process.env,
      stdout: "pipe",
      stderr: "pipe",
    })

    let output = ""
    let timedOut = false

    // Timeout
    const timeoutTimer = setTimeout(() => {
      timedOut = true
      proc.kill()
    }, timeout + 100)

    // Leer stdout
    const stdoutReader = proc.stdout.getReader()
    const stderrReader = proc.stderr.getReader()

    try {
      // Leer stdout
      while (true) {
        const { done, value } = await stdoutReader.read()
        if (done) break
        const chunk = Buffer.from(value).toString()
        output += chunk

        // Actualizar metadatos
        if (context.metadata) {
          const truncatedOutput =
            output.length > MAX_METADATA_LENGTH
              ? output.slice(0, MAX_METADATA_LENGTH) + "\n\n..."
              : output
          context.metadata({
            metadata: {
              output: truncatedOutput,
              description: params.description || cmd,
            },
          })
        }
      }
    } catch (error) {
      // Error leyendo stdout
    }

    try {
      // Leer stderr
      while (true) {
        const { done, value } = await stderrReader.read()
        if (done) break
        const chunk = Buffer.from(value).toString()
        output += chunk
      }
    } catch (error) {
      // Error leyendo stderr
    }

    // Esperar a que termine el proceso
    const exitCode = await proc.exited
    clearTimeout(timeoutTimer)

    // Agregar metadata si hubo timeout
    if (timedOut) {
      output += `\n\n<bash_metadata>\nbash tool terminated command after exceeding timeout ${timeout} ms\n</bash_metadata>`
    }

    return {
      title: params.description || params.command.split(" ")[0],
      output,
      metadata: {
        exitCode,
        cwd: PathValidator.relative(context.workspacePath, resolvedCwd),
        timedOut,
      },
    }
  },
}
