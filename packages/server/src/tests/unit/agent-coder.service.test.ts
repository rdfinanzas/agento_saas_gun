/**
 * Agent Coder Service Tests
 * 
 * Tests para el servicio que gestiona la creación y configuración
 * de agentes por parte del Agente Codificador (MASTER)
 */

import { describe, it, expect, beforeEach, mock } from "bun:test"
import { AgentCoderService, CreateAgentInput, CreateToolInput } from "@/modules/agent-ai/services/agent-coder.service"
import { Agent } from "@/db/schema"

// Mock data
const mockAgents: Agent[] = []
const mockTools: any[] = []

// Mock DB
const mockDb = {
  select: () => ({
    from: () => ({
      where: () => ({
        limit: (n: number) => mockAgents.slice(0, n),
      }),
    }),
  }),
  insert: (table: any) => ({
    values: (data: any) => ({
      returning: async () => {
        const newItem = { 
          id: `agent-${crypto.randomUUID()}`, 
          ...data, 
          createdAt: new Date(),
          updatedAt: new Date(),
        }
        if (table.name === "agents") {
          mockAgents.push(newItem as Agent)
        } else {
          mockTools.push(newItem)
        }
        return [newItem]
      },
    }),
  }),
  update: () => ({
    set: (data: any) => ({
      where: () => ({
        returning: async () => [{
          ...data,
          updatedAt: new Date(),
        }],
      }),
    }),
  }),
  delete: () => ({
    where: () => ({
      returning: async () => [{ id: "deleted" }],
    }),
  }),
}

// Mock skill registry
const mockSkillRegistry = {
  initializeCoderSkills: mock(async () => {}),
}

// Mock tool registry
const mockToolRegistry = {
  clearCache: mock(() => {}),
}

mock.module("@/db", () => ({ db: mockDb }))
mock.module("@/modules/agent-ai/services/skill-registry.service", () => ({
  skillRegistry: mockSkillRegistry,
}))
mock.module("@/modules/agent-ai/services/tool-registry.service", () => ({
  toolRegistry: mockToolRegistry,
}))

describe("AgentCoderService", () => {
  let service: AgentCoderService
  const tenantId = "tenant-123"

  beforeEach(() => {
    // Clear mock data
    mockAgents.length = 0
    mockTools.length = 0
    service = new AgentCoderService()
  })

  describe("getOrCreateCoder", () => {
    it("should create a new MASTER agent if none exists", async () => {
      const coder = await service.getOrCreateCoder(tenantId)

      expect(coder).toBeDefined()
      expect(coder.type).toBe("MASTER")
      expect(coder.tenantId).toBe(tenantId)
      expect(coder.name).toBe("Agente Codificador")
      expect(mockSkillRegistry.initializeCoderSkills).toHaveBeenCalledWith(tenantId)
    })

    it("should return existing MASTER agent if one exists", async () => {
      // Create first
      await service.getOrCreateCoder(tenantId)
      const countBefore = mockAgents.length

      // Get existing
      const coder = await service.getOrCreateCoder(tenantId)

      expect(mockAgents.length).toBe(countBefore) // No new agent created
      expect(coder.type).toBe("MASTER")
    })

    it("should initialize coder with correct permissions", async () => {
      const coder = await service.getOrCreateCoder(tenantId)

      expect(coder.allowedTools).toContain("read")
      expect(coder.allowedTools).toContain("write")
      expect(coder.allowedTools).toContain("create_agent")
      expect(coder.allowedTools).toContain("create_tool")
    })
  })

  describe("createAgent", () => {
    const validInput: CreateAgentInput = {
      tenantId,
      name: "Test Agent",
      description: "A test agent for unit tests",
      type: "INTERNAL",
      systemPrompt: "You are a helpful assistant",
      instructions: "Help users",
      role: "Assistant",
      style: "Professional",
      language: "es",
    }

    it("should create a new INTERNAL agent", async () => {
      // First create the coder
      await service.getOrCreateCoder(tenantId)

      const agent = await service.createAgent(validInput)

      expect(agent).toBeDefined()
      expect(agent.name).toBe(validInput.name)
      expect(agent.type).toBe("INTERNAL")
      expect(agent.status).toBe("DRAFT")
      expect(agent.tenantId).toBe(tenantId)
    })

    it("should create a new EXTERNAL agent with restricted tools", async () => {
      await service.getOrCreateCoder(tenantId)

      const agent = await service.createAgent({
        ...validInput,
        type: "EXTERNAL",
      })

      expect(agent.type).toBe("EXTERNAL")
      expect(agent.blockedTools).toContain("write")
      expect(agent.blockedTools).toContain("bash")
      expect(agent.workspaceEnabled).toBe(false)
    })

    it("should throw error if agent name already exists", async () => {
      await service.getOrCreateCoder(tenantId)
      await service.createAgent(validInput)

      try {
        await service.createAgent(validInput)
        expect(false).toBe(true)
      } catch (error: any) {
        expect(error.message).toContain("Ya existe un agente")
      }
    })

    it("should set parentId to the coder agent", async () => {
      const coder = await service.getOrCreateCoder(tenantId)
      const agent = await service.createAgent(validInput)

      expect(agent.parentId).toBe(coder.id)
    })
  })

  describe("createTool", () => {
    const validToolInput: CreateToolInput = {
      tenantId,
      name: "test_tool",
      description: "A test tool",
      code: "console.log('hello')",
      parameters: { arg1: { type: "string" } },
    }

    it("should create a new tool", async () => {
      const tool = await service.createTool(validToolInput)

      expect(tool).toBeDefined()
      expect(tool.name).toBe(validToolInput.name)
      expect(tool.tenantId).toBe(tenantId)
      expect(tool.canExecuteCode).toBe(true)
      expect(mockToolRegistry.clearCache).toHaveBeenCalledWith(tenantId)
    })

    it("should create tool associated with agent", async () => {
      const tool = await service.createTool({
        ...validToolInput,
        agentId: "agent-456",
      })

      expect(tool.agentId).toBe("agent-456")
    })

    it("should throw error if tool name already exists", async () => {
      await service.createTool(validToolInput)

      try {
        await service.createTool(validToolInput)
        expect(false).toBe(true)
      } catch (error: any) {
        expect(error.message).toContain("Ya existe una tool")
      }
    })

    it("should respect canExecuteCode parameter", async () => {
      const tool = await service.createTool({
        ...validToolInput,
        canExecuteCode: false,
      })

      expect(tool.canExecuteCode).toBe(false)
    })
  })

  describe("activateAgent", () => {
    it("should activate a DRAFT agent", async () => {
      await service.getOrCreateCoder(tenantId)
      const agent = await service.createAgent({
        tenantId,
        name: "Draft Agent",
        type: "INTERNAL",
      })

      const activated = await service.activateAgent(agent.id, tenantId)

      expect(activated.status).toBe("ACTIVE")
    })

    it("should throw error if agent not found", async () => {
      try {
        await service.activateAgent("nonexistent-id", tenantId)
        expect(false).toBe(true)
      } catch (error: any) {
        expect(error.message).toContain("no encontrado")
      }
    })
  })

  describe("pauseAgent", () => {
    it("should pause an ACTIVE agent", async () => {
      await service.getOrCreateCoder(tenantId)
      const agent = await service.createAgent({
        tenantId,
        name: "Active Agent",
        type: "INTERNAL",
      })
      await service.activateAgent(agent.id, tenantId)

      const paused = await service.pauseAgent(agent.id, tenantId)

      expect(paused.status).toBe("PAUSED")
    })
  })

  describe("listAgents", () => {
    it("should return all agents for a tenant", async () => {
      await service.getOrCreateCoder(tenantId)
      await service.createAgent({ tenantId, name: "Agent 1", type: "INTERNAL" })
      await service.createAgent({ tenantId, name: "Agent 2", type: "EXTERNAL" })

      const agents = await service.listAgents(tenantId)

      expect(agents.length).toBeGreaterThanOrEqual(2)
    })
  })

  describe("getAgent", () => {
    it("should return agent by id", async () => {
      await service.getOrCreateCoder(tenantId)
      const created = await service.createAgent({
        tenantId,
        name: "Find Me",
        type: "INTERNAL",
      })

      const found = await service.getAgent(created.id, tenantId)

      expect(found).toBeDefined()
      expect(found?.id).toBe(created.id)
    })

    it("should return null for nonexistent agent", async () => {
      const found = await service.getAgent("nonexistent", tenantId)

      expect(found).toBeNull()
    })
  })

  describe("updateAgent", () => {
    it("should update agent properties", async () => {
      await service.getOrCreateCoder(tenantId)
      const agent = await service.createAgent({
        tenantId,
        name: "Original Name",
        type: "INTERNAL",
      })

      const updated = await service.updateAgent(agent.id, tenantId, {
        name: "Updated Name",
        description: "New description",
      })

      expect(updated.name).toBe("Updated Name")
      expect(updated.description).toBe("New description")
    })

    it("should update allowedTools", async () => {
      await service.getOrCreateCoder(tenantId)
      const agent = await service.createAgent({
        tenantId,
        name: "Tool Test",
        type: "INTERNAL",
      })

      const updated = await service.updateAgent(agent.id, tenantId, {
        allowedTools: ["read", "write", "bash"],
      })

      expect(updated.allowedTools).toContain("bash")
    })
  })

  describe("deleteAgent", () => {
    it("should delete non-MASTER agent", async () => {
      await service.getOrCreateCoder(tenantId)
      const agent = await service.createAgent({
        tenantId,
        name: "To Delete",
        type: "INTERNAL",
      })

      const result = await service.deleteAgent(agent.id, tenantId)

      expect(result).toBe(true)
    })

    it("should throw error when trying to delete MASTER agent", async () => {
      const coder = await service.getOrCreateCoder(tenantId)

      try {
        await service.deleteAgent(coder.id, tenantId)
        expect(false).toBe(true)
      } catch (error: any) {
        expect(error.message).toContain("No se puede eliminar el agente codificador")
      }
    })

    it("should throw error for nonexistent agent", async () => {
      try {
        await service.deleteAgent("nonexistent", tenantId)
        expect(false).toBe(true)
      } catch (error: any) {
        expect(error.message).toContain("no encontrado")
      }
    })
  })

  describe("getChildAgents", () => {
    it("should return child agents", async () => {
      const coder = await service.getOrCreateCoder(tenantId)
      await service.createAgent({ tenantId, name: "Child 1", type: "INTERNAL" })
      await service.createAgent({ tenantId, name: "Child 2", type: "INTERNAL" })

      const children = await service.getChildAgents(coder.id, tenantId)

      expect(children.length).toBeGreaterThanOrEqual(2)
    })
  })
})
