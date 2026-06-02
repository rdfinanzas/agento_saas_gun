/**
 * Accomplish Service - Servicio de gestión de tareas agenticas
 *
 * Maneja la lógica de negocio para crear, ejecutar y gestionar tareas
 */

import { db } from "../../../db"
import { accomplishTasks } from "../../../db/schema/workspace"
import { eq, and, desc } from "drizzle-orm"

// Importar el servicio del agente AI
import { agentAiService } from "../../agent-ai/services/agent-ai.service"

export interface CreateTaskInput {
  prompt: string
  sessionId?: string
  userId?: string
}

export interface TaskMessage {
  id: string
  role: "user" | "assistant" | "system" | "tool"
  content: string
  timestamp: string
  metadata?: any
}

class AccomplishService {
  /**
   * Ejecuta una nueva tarea usando el agente AI real
   */
  async executeTask(tenantId: string, input: CreateTaskInput) {
    console.log('[AccomplishService] executeTask called - Using REAL AI agent')

    // Crear tarea en BD
    const task = await this.createTaskInDb(tenantId, input)

    // Ejecutar en background usando el agente AI real
    this.executeWithAgent(task.id, tenantId, input)

    return task
  }

  /**
   * Ejecuta una tarea con el agente AI real (en background)
   */
  public async executeWithAgent(taskId: string, tenantId: string, input: CreateTaskInput) {
    console.log('[AccomplishService] executeWithAgent called - Starting AI execution')

    try {
      // Marcar como RUNNING
      await db
        .update(accomplishTasks)
        .set({
          status: "RUNNING",
          startedAt: new Date(),
        })
        .where(eq(accomplishTasks.id, taskId))

      console.log('[AccomplishService] Task marked as RUNNING, calling agentAiService.execute')

      // Ejecutar con el agente AI
      // Build history from existing messages (exclude the current prompt)
      const existingMsgs = (currentTask?.messages as TaskMessage[]) || []
      const historyMessages = existingMsgs
        .filter(m => m.role === 'user' || m.role === 'assistant')
        .map(m => ({ role: m.role, content: m.content }))

      const result = await agentAiService.execute(input.prompt, tenantId, input.sessionId, historyMessages)

      console.log('[AccomplishService] AI execution completed:', result.success, result.content?.substring(0, 50))

      // Obtener la tarea actualizada
      const currentTask = await this.getTask(taskId)
      const currentMessages = (currentTask?.messages as TaskMessage[]) || []

      // Convertir mensajes del agente AI a nuestro formato
      const newMessages: TaskMessage[] = result.messages.filter((msg) => msg.role !== 'user').map((msg, idx) => ({
        id: `msg-${Date.now()}-${idx}`,
        role: msg.role,
        content: msg.content,
        timestamp: msg.timestamp || new Date().toISOString(),
      }))

      // Actualizar tarea con el resultado
      const updatedMessages = [...currentMessages, ...newMessages]

      await db
        .update(accomplishTasks)
        .set({
          status: result.success ? "COMPLETED" : "FAILED",
          messages: updatedMessages as any,
          result: {
            success: result.success,
            content: result.content,
            sessionId: result.sessionId,
            tokensUsed: result.tokensUsed,
            executionTime: result.executionTime,
            toolsUsed: result.toolsUsed,
          } as any,
          error: result.error || null,
          completedAt: new Date(),
        })
        .where(eq(accomplishTasks.id, taskId))

    } catch (error: any) {
      console.error(`[AccomplishService] Error executing task ${taskId}:`, error)

      // Marcar como FAILED
      await db
        .update(accomplishTasks)
        .set({
          status: "FAILED",
          error: error.message || "Error desconocido",
          completedAt: new Date(),
        })
        .where(eq(accomplishTasks.id, taskId))
    }
  }

  /**
   * Obtiene una tarea por ID
   */
  async getTask(taskId: string) {
    const task = await db.query.accomplishTasks.findFirst({
      where: eq(accomplishTasks.id, taskId),
    })

    return task || null
  }

  /**
   * Envía un follow-up a una tarea existente
   */
  async sendFollowUp(taskId: string, tenantId: string, userId: string | undefined, message: string) {
    const task = await this.getTask(taskId)

    if (!task) {
      throw new Error("Tarea no encontrada")
    }

    if (task.tenantId !== tenantId) {
      throw new Error("No tienes acceso a esta tarea")
    }

    if (task.status === "COMPLETED" || task.status === "CANCELLED") {
      // Append the NEW user message to existing history
      const existingMessages = (task.messages as TaskMessage[]) || []
      const newMessage = {
        id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        role: "user",
        content: message,
        timestamp: new Date().toISOString(),
      }
      await db.update(accomplishTasks).set({
        status: "QUEUED",
        messages: [...existingMessages, newMessage] as any,
        result: null,
        error: null,
        startedAt: null,
        completedAt: null,
      }).where(eq(accomplishTasks.id, taskId))
      // Execute with just the new message
      this.executeWithAgent(taskId, tenantId, { prompt: message, userId })
      return this.getTask(taskId)
    }

    // Agregar mensaje del usuario
    const newMessage: TaskMessage = {
      id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      role: "user",
      content: message,
      timestamp: new Date().toISOString(),
    }

    const updatedMessages = [...(task.messages as TaskMessage[]), newMessage]

    // Actualizar tarea
    const [updated] = await db
      .update(accomplishTasks)
      .set({
        messages: updatedMessages as any,
      })
      .where(eq(accomplishTasks.id, taskId))
      .returning()

    // TODO: Continuar ejecución con el nuevo mensaje

    return updated
  }

  /**
   * Cancela una tarea
   */
  async cancelTask(taskId: string, tenantId: string) {
    const task = await this.getTask(taskId)

    if (!task) {
      throw new Error("Tarea no encontrada")
    }

    if (task.tenantId !== tenantId) {
      throw new Error("No tienes acceso a esta tarea")
    }

    if (task.status === "COMPLETED" || task.status === "CANCELLED") {
      throw new Error("No se puede cancelar una tarea finalizada")
    }

    const [cancelled] = await db
      .update(accomplishTasks)
      .set({
        status: "CANCELLED",
        completedAt: new Date(),
      })
      .where(eq(accomplishTasks.id, taskId))
      .returning()

    return { success: true, message: "Tarea cancelada", task: cancelled }
  }

  /**
   * Obtiene el historial de tareas
   */
  async getHistory(tenantId: string, options: { page: number; pageSize: number }) {
    const { page = 1, pageSize = 20 } = options
    const offset = (page - 1) * pageSize

    const tasks = await db.query.accomplishTasks.findMany({
      where: eq(accomplishTasks.tenantId, tenantId),
      orderBy: [desc(accomplishTasks.createdAt)],
      limit: pageSize,
      offset,
    })

    // Obtener total
    const allTasks = await db.query.accomplishTasks.findMany({
      where: eq(accomplishTasks.tenantId, tenantId),
    })

    return {
      tasks,
      total: allTasks.length,
      page,
      pageSize,
    }
  }

  /**
   * Obtiene el detalle de una tarea del historial
   */
  async getHistoryDetail(taskId: string, tenantId: string) {
    const task = await this.getTask(taskId)

    if (!task) {
      throw new Error("Tarea no encontrada")
    }

    if (task.tenantId !== tenantId) {
      throw new Error("No tienes acceso a esta tarea")
    }

    return task
  }

  /**
   * Re-ejecuta una tarea existente
   */
  async reExecuteTask(taskId: string, tenantId: string, userId?: string) {
    const task = await this.getTask(taskId)

    if (!task) {
      throw new Error("Tarea no encontrada")
    }

    if (task.tenantId !== tenantId) {
      throw new Error("No tienes acceso a esta tarea")
    }

    // Crear nueva tarea con el mismo prompt
    return this.executeTask(tenantId, {
      prompt: task.prompt,
      sessionId: task.sessionId,
      userId,
    })
  }

  /**
   * Elimina una tarea (completa)
   */
  async deleteTask(taskId: string, tenantId: string) {
    const task = await this.getTask(taskId)

    if (!task) {
      throw new Error("Tarea no encontrada")
    }

    if (task.tenantId !== tenantId) {
      throw new Error("No tienes acceso a esta tarea")
    }

    await db.delete(accomplishTasks).where(eq(accomplishTasks.id, taskId))

    return { success: true, message: "Tarea eliminada" }
  }

  /**
   * Obtiene los resultados de una tarea
   */
  async getTaskResults(taskId: string, tenantId: string) {
    const task = await this.getTask(taskId)

    if (!task) {
      throw new Error("Tarea no encontrada")
    }

    if (task.tenantId !== tenantId) {
      throw new Error("No tienes acceso a esta tarea")
    }

    return {
      taskId: task.id,
      prompt: task.prompt,
      status: task.status,
      messages: task.messages,
      result: task.result,
      createdAt: task.createdAt,
      completedAt: task.completedAt,
      workspaceFiles: [], // TODO: Implementar si se guardan archivos de workspace
    }
  }

  /**
   * Obtiene la configuración de permisos
   */
  async getPermissionsConfig(tenantId: string) {
    // TODO: Implementar configuración de permisos real
    return {
      tenantId,
      autoApprove: false,
      timeout: 300,
      tools: [],
    }
  }

  /**
   * Actualiza la configuración de permisos
   */
  async updatePermissionsConfig(tenantId: string, config: any) {
    // TODO: Implementar guardado de configuración de permisos
    return {
      success: true,
      message: "Configuración de permisos actualizada",
      config,
    }
  }

  /**
   * Lista archivos del workspace
   */
  async listWorkspaceFiles(tenantId: string, options: { type?: string; search?: string }) {
    // TODO: Implementar listado de archivos de workspace real
    return {
      files: [],
      count: 0,
    }
  }

  /**
   * Elimina un archivo del workspace
   */
  async deleteWorkspaceFile(fileId: string, tenantId: string) {
    // TODO: Implementar eliminación de archivos de workspace real
    return {
      success: true,
      message: "Archivo eliminado",
    }
  }

  /**
   * Fuerza la limpieza de workspace
   */
  async forceCleanup(tenantId: string) {
    // TODO: Implementar limpieza de workspace real
    return {
      success: true,
      message: "Workspace limpiado",
      result: {
        deletedFiles: 0,
        freedSpace: 0,
      },
    }
  }

  /**
   * Obtiene el uso del workspace
   */
  async getWorkspaceUsage(tenantId: string) {
    // TODO: Implementar cálculo real de uso
    return {
      tenantId,
      used: 0,
      quota: 1000,
      percentUsed: 0,
      userFiles: 0,
      tasks: 0,
      temp: 0,
    }
  }

  /**
   * Crea una tarea en la base de datos
   */
  private async createTaskInDb(tenantId: string, input: CreateTaskInput) {
    const taskId = `task-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`

    const initialMessage: TaskMessage = {
      id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      role: "user",
      content: input.prompt,
      timestamp: new Date().toISOString(),
    }

    const [task] = await db
      .insert(accomplishTasks)
      .values({
        id: taskId,
        tenantId,
        userId: input.userId,
        prompt: input.prompt,
        sessionId: input.sessionId,
        status: "QUEUED",
        messages: [initialMessage] as any,
      })
      .returning()

    return task
  }
}

export const accomplishService = new AccomplishService()
