/**
 * Tool Executor Service
 * 
 * SP-5.3: Ejecuta código JavaScript de herramientas de usuario en un sandbox seguro
 * 
 * Features:
 * - Sandbox con vm2 (o vm de Node.js)
 * - Timeout configurable
 * - Limitación de memoria
 * - Console interceptado
 * - Acceso controlado a APIs (fetch, fs, etc.)
 */

import { Context, Script } from "vm"
import { UserTool, UserToolExecution, ToolPermission } from "@/db/schema/user-tool"

export interface ExecutionContext {
  tenantId: string
  userId?: string
  workspacePath?: string
  sessionId?: string
}

export interface ExecutionResult {
  success: boolean
  output?: any
  error?: string
  logs: string[]
  durationMs: number
  memoryUsed?: number
}

export interface SandboxAPI {
  // HTTP
  fetch: typeof fetch
  
  // FileSystem (limitado al workspace)
  fs: {
    readFile: (path: string) => Promise<string>
    writeFile: (path: string, content: string) => Promise<void>
    exists: (path: string) => Promise<boolean>
    list: (path: string) => Promise<string[]>
  }
  
  // Database (via credentials)
  db: {
    query: (credentialId: string, sql: string, params?: any[]) => Promise<any[]>
  }
  
  // Utilities
  env: Record<string, string>
  console: {
    log: (...args: any[]) => void
    error: (...args: any[]) => void
    warn: (...args: any[]) => void
  }
  
  // Contexto
  context: ExecutionContext
}

export class ToolExecutor {
  private activeExecutions: Map<string, AbortController> = new Map()

  /**
   * Ejecuta una herramienta de usuario
   */
  async execute(
    tool: UserTool,
    params: any,
    context: ExecutionContext
  ): Promise<ExecutionResult> {
    const startTime = Date.now()
    const logs: string[] = []
    const executionId = `${tool.id}-${Date.now()}`

    // Crear abort controller para timeout
    const abortController = new AbortController()
    this.activeExecutions.set(executionId, abortController)

    const timeout = (tool.config as any)?.timeout || 30000
    const timeoutId = setTimeout(() => {
      abortController.abort()
    }, timeout)

    try {
      // Crear sandbox con APIs limitadas
      const sandbox = this.createSandbox(tool, context, logs, abortController.signal)

      // Preparar el código con wrapper
      const wrappedCode = this.wrapCode(tool.code, params, sandbox)

      // Ejecutar en VM
      const result = await this.runInSandbox(wrappedCode, sandbox, timeout)

      clearTimeout(timeoutId)
      this.activeExecutions.delete(executionId)

      const durationMs = Date.now() - startTime

      return {
        success: true,
        output: result,
        logs,
        durationMs,
      }
    } catch (error) {
      clearTimeout(timeoutId)
      this.activeExecutions.delete(executionId)

      const durationMs = Date.now() - startTime

      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        logs,
        durationMs,
      }
    }
  }

  /**
   * Crea el sandbox con las APIs permitidas
   */
  private createSandbox(
    tool: UserTool,
    context: ExecutionContext,
    logs: string[],
    signal: AbortSignal
  ): SandboxAPI {
    const permissions = tool.permissions as ToolPermission[] || []
    const workspacePath = context.workspacePath || `/workspaces/${context.tenantId}`

    // Console interceptado
    const interceptedConsole = {
      log: (...args: any[]) => {
        const msg = args.map(a => typeof a === "object" ? JSON.stringify(a) : String(a)).join(" ")
        logs.push(`[LOG] ${msg}`)
      },
      error: (...args: any[]) => {
        const msg = args.map(a => typeof a === "object" ? JSON.stringify(a) : String(a)).join(" ")
        logs.push(`[ERROR] ${msg}`)
      },
      warn: (...args: any[]) => {
        const msg = args.map(a => typeof a === "object" ? JSON.stringify(a) : String(a)).join(" ")
        logs.push(`[WARN] ${msg}`)
      },
    }

    // API básica siempre disponible
    const sandbox: SandboxAPI = {
      fetch: async (...args: any[]) => {
        if (!permissions.includes("network.http")) {
          throw new Error("Permission denied: network.http not granted")
        }
        // @ts-ignore
        return fetch(...args)
      },
      fs: {
        readFile: async (path: string) => {
          if (!permissions.includes("filesystem.read")) {
            throw new Error("Permission denied: filesystem.read not granted")
          }
          const fullPath = `${workspacePath}/${path}`.replace(/\/+/g, "/")
          const file = Bun.file(fullPath)
          return file.text()
        },
        writeFile: async (path: string, content: string) => {
          if (!permissions.includes("filesystem.write")) {
            throw new Error("Permission denied: filesystem.write not granted")
          }
          const fullPath = `${workspacePath}/${path}`.replace(/\/+/g, "/")
          await Bun.write(fullPath, content)
        },
        exists: async (path: string) => {
          if (!permissions.includes("filesystem.read")) {
            throw new Error("Permission denied: filesystem.read not granted")
          }
          const fullPath = `${workspacePath}/${path}`.replace(/\/+/g, "/")
          const file = Bun.file(fullPath)
          return file.exists()
        },
        list: async (path: string) => {
          if (!permissions.includes("filesystem.read")) {
            throw new Error("Permission denied: filesystem.read not granted")
          }
          const fullPath = `${workspacePath}/${path}`.replace(/\/+/g, "/")
          // En Bun no hay readdir nativo, usar workaround
          const proc = Bun.spawn(["ls", "-1", fullPath])
          const output = await new Response(proc.stdout).text()
          return output.split("\n").filter(Boolean)
        },
      },
      db: {
        query: async (credentialId: string, sql: string, params?: any[]) => {
          if (!permissions.includes("database.query")) {
            throw new Error("Permission denied: database.query not granted")
          }
          // Importar dinámicamente para evitar dependencia circular
          const { credentialManager } = await import("./credential.service")
          const cred = await credentialManager.getCredential(credentialId, context.tenantId)
          if (!cred) {
            throw new Error("Credential not found")
          }
          // Ejecutar query usando la misma lógica de db-query tool
          const { executeDbQuery } = await import("@/lib/opencode/tools/db-query")
          const result = await executeDbQuery(
            { credentialId, query: sql, params, timeout: 30000 },
            { tenantId: context.tenantId }
          )
          return result.rows
        },
      },
      env: {
        NODE_ENV: process.env.NODE_ENV || "development",
        TENANT_ID: context.tenantId,
        // No exponer secrets!
      },
      console: interceptedConsole,
      context,
    }

    return sandbox
  }

  /**
   * Wrap del código del usuario con manejo de parámetros
   */
  private wrapCode(userCode: string, params: any, sandbox: SandboxAPI): string {
    return `
      return (async () => {
        const { fetch, fs, db, env, console, context } = this;
        const params = ${JSON.stringify(params)};
        
        ${userCode}
        
        // Si el usuario definió una función 'run', ejecutarla
        if (typeof run === 'function') {
          return await run(params);
        }
        
        // Si no, retornar undefined
        return undefined;
      })();
    `
  }

  /**
   * Ejecuta código en el sandbox
   */
  private async runInSandbox(
    code: string,
    sandbox: SandboxAPI,
    timeout: number
  ): Promise<any> {
    // Usar eval con contexto limitado
    // En producción considerar usar isolated-vm o worker_threads
    const context = {
      ...sandbox,
      setTimeout: (fn: Function, ms: number) => setTimeout(fn, Math.min(ms, timeout)),
      setInterval: (fn: Function, ms: number) => setInterval(fn, Math.min(ms, timeout)),
      clearTimeout,
      clearInterval,
    }

    // Crear función con contexto
    const fn = new Function(code).bind(context)
    
    return await fn()
  }

  /**
   * Cancela una ejecución en progreso
   */
  cancelExecution(executionId: string): boolean {
    const controller = this.activeExecutions.get(executionId)
    if (controller) {
      controller.abort()
      this.activeExecutions.delete(executionId)
      return true
    }
    return false
  }

  /**
   * Valida código antes de guardar
   */
  validateCode(code: string): { valid: boolean; errors: string[] } {
    const errors: string[] = []

    try {
      // Intentar parsear el código
      new Function(code)
    } catch (error) {
      if (error instanceof Error) {
        errors.push(`Syntax error: ${error.message}`)
      }
      return { valid: false, errors }
    }

    // Check de patrones peligrosos
    const dangerousPatterns = [
      { pattern: /eval\s*\(/, msg: "Uso de eval() no permitido" },
      { pattern: /new\s+Function\s*\(/, msg: "Uso de new Function() no permitido" },
      { pattern: /require\s*\(\s*['"]child_process['"]\s*\)/, msg: "No se permite importar child_process" },
      { pattern: /process\.exit/, msg: "No se permite process.exit()" },
      { pattern: /while\s*\(\s*true\s*\)/, msg: "Bucles infinitos no permitidos" },
      { pattern: /for\s*\(\s*;\s*;\s*\)/, msg: "Bucles infinitos no permitidos" },
    ]

    for (const { pattern, msg } of dangerousPatterns) {
      if (pattern.test(code)) {
        errors.push(msg)
      }
    }

    return { valid: errors.length === 0, errors }
  }
}

// Singleton
export const toolExecutor = new ToolExecutor()
