/**
 * Accomplish Controller - Controlador HTTP para el módulo Accomplish
 *
 * Maneja las peticiones HTTP para crear, gestionar y monitorear tareas
 */

import type { Context } from "hono"
import { HTTPException } from "hono/http-exception"
import { stream } from "hono/streaming"
import { accomplishService } from "../services/accomplish.service"

class AccomplishController {
  /**
   * Endpoint de prueba SSE
   * POST /api/v1/:tenant/accomplish/test-sse
   */
  async testSSE(c: Context) {
    // TODO: Implement SSE testing
    return c.json({ success: true, message: "SSE test endpoint" })
  }

  /**
   * Crea una nueva tarea
   * POST /api/v1/:tenant/accomplish/tasks
   */
  async createTask(c: Context) {
    try {
      const tenantId = c.get("tenantId") as string
      const userId = c.get("userId") as string | undefined
      const body = await c.req.json()

      if (!body.prompt || body.prompt.trim().length === 0) {
        throw new HTTPException(400, { message: "El prompt es requerido" })
      }

      const task = await accomplishService.executeTask(tenantId, {
        prompt: body.prompt,
        sessionId: body.sessionId,
        userId,
      })

      return c.json(task, 201)
    } catch (error: any) {
      console.error("Error creating task:", error)
      throw new HTTPException(500, { message: error.message || "Error interno del servidor" })
    }
  }

  /**
   * Obtiene una tarea por ID
   * GET /api/v1/:tenant/accomplish/tasks/:id
   */
  async getTask(c: Context) {
    try {
      const { id } = c.req.param()
      const tenantId = c.get("tenantId") as string
      const userId = c.get("userId") as string | undefined

      const task = await accomplishService.getTask(id)

      if (!task) {
        throw new HTTPException(404, { message: "Tarea no encontrada" })
      }

      // Verificar tenantId
      if (task.tenantId !== tenantId) {
        throw new HTTPException(403, { message: "No tienes acceso a esta tarea" })
      }

      // Verificar userId
      if (task.userId && task.userId !== userId) {
        throw new HTTPException(403, { message: "No tienes acceso a esta tarea" })
      }

      return c.json(task)
    } catch (error: any) {
      if (error instanceof HTTPException) throw error
      console.error("Error getting task:", error)
      throw new HTTPException(500, { message: error.message || "Error interno del servidor" })
    }
  }

  /**
   * Envía un follow-up a una tarea
   * POST /api/v1/:tenant/accomplish/tasks/:id/followup
   */
  async sendFollowUp(c: Context) {
    try {
      const { id } = c.req.param()
      const tenantId = c.get("tenantId") as string
      const userId = c.get("userId") as string | undefined
      const body = await c.req.json()

      if (!body.message || body.message.trim().length === 0) {
        throw new HTTPException(400, { message: "El mensaje es requerido" })
      }

      const task = await accomplishService.sendFollowUp(id, tenantId, userId, body.message)

      return c.json(task)
    } catch (error: any) {
      if (error instanceof HTTPException) throw error
      console.error("Error sending follow-up:", error)
      throw new HTTPException(500, { message: error.message || "Error interno del servidor" })
    }
  }

  /**
   * Re-ejecuta una tarea existente
   * POST /api/v1/:tenant/accomplish/tasks/:id/reexecute
   */
  async reExecuteTask(c: Context) {
    try {
      const { id } = c.req.param()
      const tenantId = c.get("tenantId") as string
      const userId = c.get("userId") as string | undefined

      const task = await accomplishService.reExecuteTask(id, tenantId, userId)

      return c.json(task)
    } catch (error: any) {
      if (error instanceof HTTPException) throw error
      console.error("Error re-executing task:", error)
      throw new HTTPException(500, { message: error.message || "Error interno del servidor" })
    }
  }

  /**
   * Elimina una tarea (completa)
   * DELETE /api/v1/:tenant/accomplish/tasks/:id
   */
  async deleteTask(c: Context) {
    try {
      const { id } = c.req.param()
      const tenantId = c.get("tenantId") as string

      const result = await accomplishService.deleteTask(id, tenantId)

      return c.json(result)
    } catch (error: any) {
      if (error instanceof HTTPException) throw error
      console.error("Error deleting task:", error)
      throw new HTTPException(500, { message: error.message || "Error interno del servidor" })
    }
  }

  /**
   * Cancela una tarea
   * DELETE /api/v1/:tenant/accomplish/tasks/:id/cancel
   */
  async cancelTask(c: Context) {
    try {
      const { id } = c.req.param()
      const tenantId = c.get("tenantId") as string

      const result = await accomplishService.cancelTask(id, tenantId)

      return c.json(result)
    } catch (error: any) {
      if (error instanceof HTTPException) throw error
      console.error("Error cancelling task:", error)
      throw new HTTPException(500, { message: error.message || "Error interno del servidor" })
    }
  }

  /**
   * Obtiene eventos SSE de una tarea
   * GET /api/v1/:tenant/accomplish/tasks/:id/events
   */
  async getTaskEvents(c: Context) {
    const { id: taskId } = c.req.param()
    const tenantId = c.get("tenantId") as string

    const task = await accomplishService.getTask(taskId)
    if (!task) {
      return c.json({ error: "Tarea no encontrada" }, 404)
    }
    if (task.tenantId !== tenantId) {
      return c.json({ error: "No tienes acceso a esta tarea" }, 403)
    }

    c.header("Content-Type", "text/event-stream")
    c.header("Cache-Control", "no-cache")
    c.header("Connection", "keep-alive")
    c.header("X-Accel-Buffering", "no")

    return stream(c, async (s) => {
      for (let i = 0; i < 1200; i++) {
        try {
          const t = await accomplishService.getTask(taskId)
          if (!t) {
            await s.write("data: " + JSON.stringify({ type: "error", data: { error: "Task not found" } }) + "\n\n")
            await s.close()
            break
          }

          const progress = t.status === "QUEUED" ? 0 : t.status === "RUNNING" ? 50 : t.status === "COMPLETED" ? 100 : 0
          await s.write("data: " + JSON.stringify({ type: "status", data: { status: t.status, progress } }) + "\n\n")

          if (t.status === "COMPLETED") {
            const msgs = (t.messages as any[]) || []
            // Deduplicate: skip user messages with same content as previous
            const seen: string[] = []
            for (const msg of msgs) {
              const key = msg.role + ":" + msg.content
              if (seen.includes(key)) continue
              seen.push(key)
              await s.write("data: " + JSON.stringify({ type: "message", data: msg }) + "\n\n")
            }
            await s.write("data: " + JSON.stringify({ type: "complete", data: { result: t.result } }) + "\n\n")
            await s.close()
            break
          } else if (t.status === "FAILED") {
            await s.write("data: " + JSON.stringify({ type: "error", data: { error: t.error } }) + "\n\n")
            await s.close()
            break
          } else if (t.status === "CANCELLED") {
            await s.write("data: " + JSON.stringify({ type: "cancelled" }) + "\n\n")
            await s.close()
            break
          }

          await new Promise(r => setTimeout(r, 500))
        } catch (e) {
          console.error("SSE poll error:", e)
          break
        }
      }
    })
  }

  /**
   * Obtiene los resultados de una tarea
   * GET /api/v1/:tenant/accomplish/tasks/:id/results
   */
  async getTaskResults(c: Context) {
    try {
      const { id } = c.req.param()
      const tenantId = c.get("tenantId") as string

      const results = await accomplishService.getTaskResults(id, tenantId)

      return c.json(results)
    } catch (error: any) {
      if (error instanceof HTTPException) throw error
      console.error("Error getting task results:", error)
      throw new HTTPException(500, { message: error.message || "Error interno del servidor" })
    }
  }

  /**
   * Exporta los resultados de una tarea
   * GET /api/v1/:tenant/accomplish/tasks/:id/export
   */
  async exportTaskResults(c: Context) {
    // TODO: Implement export functionality
    return c.json({ error: "Export not implemented yet" })
  }

  /**
   * Obtiene el historial de tareas
   * GET /api/v1/:tenant/accomplish/history
   */
  async getHistory(c: Context) {
    try {
      const tenantId = c.get("tenantId") as string
      const page = parseInt(c.req.query("page") || "1")
      const pageSize = parseInt(c.req.query("pageSize") || "20")

      const history = await accomplishService.getHistory(tenantId, { page, pageSize })

      return c.json(history)
    } catch (error: any) {
      console.error("Error getting history:", error)
      throw new HTTPException(500, { message: error.message || "Error interno del servidor" })
    }
  }

  /**
   * Obtiene el detalle de una tarea del historial
   * GET /api/v1/:tenant/accomplish/history/:id
   */
  async getHistoryDetail(c: Context) {
    try {
      const { id } = c.req.param()
      const tenantId = c.get("tenantId") as string

      const task = await accomplishService.getHistoryDetail(id, tenantId)

      return c.json(task)
    } catch (error: any) {
      if (error instanceof HTTPException) throw error
      console.error("Error getting history detail:", error)
      throw new HTTPException(500, { message: error.message || "Error interno del servidor" })
    }
  }

  /**
   * Obtiene la configuración de permisos
   * GET /api/v1/:tenant/accomplish/permissions/config
   */
  async getPermissionsConfig(c: Context) {
    try {
      const tenantId = c.get("tenantId") as string

      const config = await accomplishService.getPermissionsConfig(tenantId)

      return c.json(config)
    } catch (error: any) {
      console.error("Error getting permissions config:", error)
      throw new HTTPException(500, { message: error.message || "Error interno del servidor" })
    }
  }

  /**
   * Actualiza la configuración de permisos
   * PUT /api/v1/:tenant/accomplish/permissions/config
   */
  async updatePermissionsConfig(c: Context) {
    try {
      const tenantId = c.get("tenantId") as string
      const body = await c.req.json()

      const result = await accomplishService.updatePermissionsConfig(tenantId, body)

      return c.json(result)
    } catch (error: any) {
      console.error("Error updating permissions config:", error)
      throw new HTTPException(500, { message: error.message || "Error interno del servidor" })
    }
  }

  /**
   * Responde a una solicitud de permiso
   * POST /api/v1/:tenant/accomplish/permissions/:requestId/respond
   */
  async respondToPermission(c: Context) {
    // TODO: Implement permission responses
    return c.json({ success: true, message: "Permission response not implemented yet" })
  }

  /**
   * Obtiene el uso del workspace
   * GET /api/v1/:tenant/accomplish/workspace/usage
   */
  async getWorkspaceUsage(c: Context) {
    try {
      const tenantId = c.get("tenantId") as string

      const usage = await accomplishService.getWorkspaceUsage(tenantId)

      return c.json(usage)
    } catch (error: any) {
      console.error("Error getting workspace usage:", error)
      throw new HTTPException(500, { message: error.message || "Error interno del servidor" })
    }
  }

  /**
   * Lista archivos del workspace
   * GET /api/v1/:tenant/accomplish/workspace/files
   */
  async listWorkspaceFiles(c: Context) {
    try {
      const tenantId = c.get("tenantId") as string
      const type = c.req.query("type")
      const search = c.req.query("search")

      const result = await accomplishService.listWorkspaceFiles(tenantId, { type, search })

      return c.json(result)
    } catch (error: any) {
      console.error("Error listing workspace files:", error)
      throw new HTTPException(500, { message: error.message || "Error interno del servidor" })
    }
  }

  /**
   * Elimina un archivo del workspace
   * DELETE /api/v1/:tenant/accomplish/workspace/files/:id
   */
  async deleteWorkspaceFile(c: Context) {
    try {
      const { id } = c.req.param()
      const tenantId = c.get("tenantId") as string

      const result = await accomplishService.deleteWorkspaceFile(id, tenantId)

      return c.json(result)
    } catch (error: any) {
      if (error instanceof HTTPException) throw error
      console.error("Error deleting workspace file:", error)
      throw new HTTPException(500, { message: error.message || "Error interno del servidor" })
    }
  }

  /**
   * Fuerza la limpieza de workspace
   * POST /api/v1/:tenant/accomplish/workspace/cleanup
   */
  async forceCleanup(c: Context) {
    try {
      const tenantId = c.get("tenantId") as string

      const result = await accomplishService.forceCleanup(tenantId)

      return c.json(result)
    } catch (error: any) {
      console.error("Error forcing cleanup:", error)
      throw new HTTPException(500, { message: error.message || "Error interno del servidor" })
    }
  }
}

export const accomplishController = new AccomplishController()
