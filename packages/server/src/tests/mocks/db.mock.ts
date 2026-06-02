/**
 * Database Mock - Mock completo para la base de datos
 * 
 * Proporciona funciones mock para simular operaciones de Drizzle ORM
 * sin necesidad de conexión real a PostgreSQL.
 */

import { type InferSelectModel } from "drizzle-orm"
import type { tenants, users, agents, tools, agentSessions, agentMessages } from "@/db/schema"

// Types
export type Tenant = InferSelectModel<typeof tenants>
export type User = InferSelectModel<typeof users>
export type Agent = InferSelectModel<typeof agents>
export type Tool = InferSelectModel<typeof tools>
export type AgentSession = InferSelectModel<typeof agentSessions>
export type AgentMessage = InferSelectModel<typeof agentMessages>

// Mock data store
class MockDataStore {
  private data: Map<string, any[]> = new Map()

  constructor() {
    this.data.set("tenants", [])
    this.data.set("users", [])
    this.data.set("agents", [])
    this.data.set("tools", [])
    this.data.set("agentSessions", [])
    this.data.set("agentMessages", [])
  }

  getTable<T>(name: string): T[] {
    return (this.data.get(name) || []) as T[]
  }

  setTable<T>(name: string, data: T[]) {
    this.data.set(name, data)
  }

  clear() {
    this.data.forEach((_, key) => this.data.set(key, []))
  }

  reset() {
    this.clear()
  }
}

export const mockStore = new MockDataStore()

// ============================================
// Mock Builders
// ============================================

export function createMockTenant(overrides?: Partial<Tenant>): Tenant {
  return {
    id: "tenant-" + crypto.randomUUID(),
    name: "Test Tenant",
    slug: "test-tenant",
    status: "ACTIVE",
    planId: "plan-basic",
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }
}

export function createMockUser(overrides?: Partial<User>): User {
  return {
    id: "user-" + crypto.randomUUID(),
    email: "test@example.com",
    passwordHash: "hashed_password",
    firstName: "Test",
    lastName: "User",
    role: "USER",
    emailVerified: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    lastLoginAt: null,
    ...overrides,
  }
}

export function createMockAgent(overrides?: Partial<Agent>): Agent {
  return {
    id: "agent-" + crypto.randomUUID(),
    tenantId: "tenant-123",
    parentId: null,
    name: "Test Agent",
    description: "A test agent",
    type: "INTERNAL",
    status: "ACTIVE",
    role: "Assistant",
    style: "Professional",
    language: "es",
    systemPrompt: "You are a helpful assistant",
    instructions: "Help users with their questions",
    accessType: "PRIVATE",
    workspaceEnabled: true,
    allowedTools: ["read", "write"],
    blockedTools: [],
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }
}

export function createMockTool(overrides?: Partial<Tool>): Tool {
  return {
    id: "tool-" + crypto.randomUUID(),
    tenantId: "tenant-123",
    agentId: null,
    name: "test_tool",
    description: "A test tool",
    code: "console.log('hello')",
    parameters: {},
    canExecuteCode: false,
    isSystem: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }
}

export function createMockSession(overrides?: Partial<AgentSession>): AgentSession {
  return {
    id: "session-" + crypto.randomUUID(),
    tenantId: "tenant-123",
    userId: "user-123",
    agentId: "agent-123",
    title: "Test Session",
    directory: "/workspace/test",
    isActive: true,
    isArchived: false,
    metadata: {},
    createdAt: new Date(),
    updatedAt: new Date(),
    archivedAt: null,
    ...overrides,
  }
}

export function createMockMessage(overrides?: Partial<AgentMessage>): AgentMessage {
  return {
    id: "msg-" + crypto.randomUUID(),
    sessionId: "session-123",
    tenantId: "tenant-123",
    role: "user",
    content: "Hello",
    toolName: null,
    toolInput: null,
    toolOutput: null,
    parts: [],
    metadata: {},
    createdAt: new Date(),
    ...overrides,
  }
}

// ============================================
// Query Builder Mock
// ============================================

export function createMockDb() {
  return {
    query: {
      tenants: { findFirst: async () => null, findMany: async () => [] },
      users: { findFirst: async () => null, findMany: async () => [] },
      agents: { findFirst: async () => null, findMany: async () => [] },
      tools: { findFirst: async () => null, findMany: async () => [] },
      agentSessions: { findFirst: async () => null, findMany: async () => [] },
      agentMessages: { findFirst: async () => null, findMany: async () => [] },
    },
    select: () => ({
      from: (table: any) => ({
        where: (condition: any) => ({
          limit: (n: number) => mockStore.getTable(table.name || "agents").slice(0, n),
        }),
      }),
    }),
    insert: (table: any) => ({
      values: (data: any) => ({
        returning: async () => {
          const tableName = table.name || "unknown"
          const items = mockStore.getTable(tableName)
          const newItem = { id: crypto.randomUUID(), ...data, createdAt: new Date() }
          items.push(newItem)
          mockStore.setTable(tableName, items)
          return [newItem]
        },
      }),
    }),
    update: (table: any) => ({
      set: (data: any) => ({
        where: (condition: any) => ({
          returning: async () => {
            // Mock update
            return [{ ...data, updatedAt: new Date() }]
          },
        }),
      }),
    }),
    delete: (table: any) => ({
      where: (condition: any) => ({
        returning: async () => {
          return [{ id: "deleted-id" }]
        },
      }),
    }),
  }
}
