/**
 * Agent AI Service
 * Servicio wrapper para el agente AI
 */

import { OpenCodeRuntimeAdapter, ExecutionContext, ExecutionResult } from "../adapter/OpenCodeRuntimeAdapter"

interface AiSession {
  sessionId: string
  tenantId: string
  createdAt: Date
  lastActivity: Date
  status: "active" | "completed" | "error"
  messageCount: number
}

class AgentAiService {
  private adapter: OpenCodeRuntimeAdapter
  private sessions: Map<string, AiSession> = new Map()

  constructor() {
    this.adapter = new OpenCodeRuntimeAdapter()
  }

  async healthCheck(): Promise<{ status: string; adapter: string; runtime: string }> {
    try {
      return {
        status: "ok",
        adapter: "OpenCodeRuntimeAdapter",
        runtime: "bun",
      }
    } catch (error) {
      return {
        status: "error",
        adapter: "OpenCodeRuntimeAdapter",
        runtime: "bun",
      }
    }
  }

  async execute(prompt: string, tenantId: string, sessionId?: string): Promise<ExecutionResult> {
    const execContext: ExecutionContext = {
      tenantId,
      taskId: crypto.randomUUID(),
      sessionId: sessionId || crypto.randomUUID(),
    }

    // Registrar sesion
    this.sessions.set(execContext.sessionId!, {
      sessionId: execContext.sessionId!,
      tenantId,
      createdAt: new Date(),
      lastActivity: new Date(),
      status: "active",
      messageCount: 0,
    })

    try {
      const result = await this.adapter.execute(prompt, execContext)

      // Actualizar sesion
      const session = this.sessions.get(execContext.sessionId!)
      if (session) {
        session.status = result.success ? "completed" : "error"
        session.lastActivity = new Date()
        session.messageCount = result.messages?.length || 0
      }

      return result
    } catch (error) {
      const session = this.sessions.get(execContext.sessionId!)
      if (session) {
        session.status = "error"
      }
      throw error
    }
  }

  async listSessions(tenantId: string): Promise<AiSession[]> {
    const tenantSessions: AiSession[] = []
    for (const session of this.sessions.values()) {
      if (session.tenantId === tenantId) {
        tenantSessions.push(session)
      }
    }
    return tenantSessions
  }

  async getSession(tenantId: string, sessionId: string): Promise<AiSession | null> {
    const session = this.sessions.get(sessionId)
    if (!session || session.tenantId !== tenantId) {
      return null
    }
    return session
  }

  async deleteSession(tenantId: string, sessionId: string): Promise<boolean> {
    const session = this.sessions.get(sessionId)
    if (!session || session.tenantId !== tenantId) {
      return false
    }
    this.sessions.delete(sessionId)
    return true
  }

  async getStats(tenantId: string): Promise<{
    activeSessions: number
    totalSessions: number
    completedSessions: number
    errorSessions: number
  }> {
    const tenantSessions = await this.listSessions(tenantId)
    return {
      activeSessions: tenantSessions.filter(s => s.status === "active").length,
      totalSessions: tenantSessions.length,
      completedSessions: tenantSessions.filter(s => s.status === "completed").length,
      errorSessions: tenantSessions.filter(s => s.status === "error").length,
    }
  }
}

export const agentAiService = new AgentAiService()
