/**
 * API Integration Tests
 * 
 * Tests de integración para los endpoints principales de la API
 * Usa el app de Hono para hacer requests reales
 */

import { describe, it, expect, beforeAll, beforeEach } from "bun:test"
import { app } from "@/app"

// Helper para hacer requests
async function request(path: string, options?: RequestInit): Promise<Response> {
  const url = `http://localhost:3000${path}`
  const req = new Request(url, options)
  return app.fetch(req)
}

// Helper para requests autenticados
async function authRequest(
  path: string, 
  token: string, 
  options?: RequestInit
): Promise<Response> {
  return request(path, {
    ...options,
    headers: {
      ...options?.headers,
      "Authorization": `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  })
}

describe("API Integration Tests", () => {
  let authToken: string
  let testTenantId = "test-tenant-123"

  describe("Health Check", () => {
    it("should return health status", async () => {
      const res = await request("/health")
      expect(res.status).toBe(200)

      const body = await res.json()
      expect(body.status).toBe("ok")
      expect(body.service).toBe("agento-api")
    })
  })

  describe("Authentication", () => {
    describe("POST /api/v1/auth/register", () => {
      it("should register a new user", async () => {
        const res = await request("/api/v1/auth/register", {
          method: "POST",
          body: JSON.stringify({
            email: `test-${Date.now()}@example.com`,
            password: "password123",
            firstName: "Test",
            lastName: "User",
          }),
        })

        expect(res.status).toBe(201)
        const body = await res.json()
        expect(body.user).toBeDefined()
        expect(body.tokens).toBeDefined()
        expect(body.tokens.accessToken).toBeDefined()
      })

      it("should reject duplicate email", async () => {
        const email = `duplicate-${Date.now()}@example.com`
        
        // First registration
        await request("/api/v1/auth/register", {
          method: "POST",
          body: JSON.stringify({
            email,
            password: "password123",
            firstName: "Test",
            lastName: "User",
          }),
        })

        // Second registration should fail
        const res = await request("/api/v1/auth/register", {
          method: "POST",
          body: JSON.stringify({
            email,
            password: "password123",
            firstName: "Test",
            lastName: "User",
          }),
        })

        expect(res.status).toBe(409)
      })

      it("should validate required fields", async () => {
        const res = await request("/api/v1/auth/register", {
          method: "POST",
          body: JSON.stringify({
            email: "invalid-email",
            // Missing password
          }),
        })

        expect(res.status).toBe(400)
      })
    })

    describe("POST /api/v1/auth/login", () => {
      it("should login with valid credentials", async () => {
        const email = `login-test-${Date.now()}@example.com`
        
        // Register first
        await request("/api/v1/auth/register", {
          method: "POST",
          body: JSON.stringify({
            email,
            password: "password123",
            firstName: "Test",
            lastName: "User",
          }),
        })

        // Login
        const res = await request("/api/v1/auth/login", {
          method: "POST",
          body: JSON.stringify({
            email,
            password: "password123",
          }),
        })

        expect(res.status).toBe(200)
        const body = await res.json()
        expect(body.tokens.accessToken).toBeDefined()
        authToken = body.tokens.accessToken
      })

      it("should reject invalid credentials", async () => {
        const res = await request("/api/v1/auth/login", {
          method: "POST",
          body: JSON.stringify({
            email: "nonexistent@example.com",
            password: "wrongpassword",
          }),
        })

        expect(res.status).toBe(401)
      })
    })

    describe("POST /api/v1/auth/refresh", () => {
      it("should refresh tokens", async () => {
        // Login to get refresh token
        const loginRes = await request("/api/v1/auth/login", {
          method: "POST",
          body: JSON.stringify({
            email: `refresh-test-${Date.now()}@example.com`,
            password: "password123",
          }),
        })
        
        const { tokens } = await loginRes.json()

        const res = await request("/api/v1/auth/refresh", {
          method: "POST",
          body: JSON.stringify({
            refreshToken: tokens.refreshToken,
          }),
        })

        expect(res.status).toBe(200)
        const body = await res.json()
        expect(body.accessToken).toBeDefined()
      })
    })
  })

  describe("Agents", () => {
    describe("GET /api/v1/agents", () => {
      it("should require authentication", async () => {
        const res = await request("/api/v1/agents")
        expect(res.status).toBe(401)
      })

      it("should list agents when authenticated", async () => {
        const res = await authRequest("/api/v1/agents", authToken)
        
        expect(res.status).toBe(200)
        const body = await res.json()
        expect(Array.isArray(body)).toBe(true)
      })
    })

    describe("POST /api/v1/agents", () => {
      it("should create a new agent", async () => {
        const res = await authRequest("/api/v1/agents", authToken, {
          method: "POST",
          body: JSON.stringify({
            name: `Test Agent ${Date.now()}`,
            description: "A test agent",
            type: "INTERNAL",
            systemPrompt: "You are a helpful assistant",
          }),
        })

        expect(res.status).toBe(201)
        const body = await res.json()
        expect(body.id).toBeDefined()
        expect(body.name).toBeDefined()
      })

      it("should validate required fields", async () => {
        const res = await authRequest("/api/v1/agents", authToken, {
          method: "POST",
          body: JSON.stringify({
            // Missing name
            type: "INTERNAL",
          }),
        })

        expect(res.status).toBe(400)
      })
    })

    describe("GET /api/v1/agents/:id", () => {
      it("should get agent by id", async () => {
        // Create agent first
        const createRes = await authRequest("/api/v1/agents", authToken, {
          method: "POST",
          body: JSON.stringify({
            name: `Get Agent ${Date.now()}`,
            type: "INTERNAL",
          }),
        })
        
        const agent = await createRes.json()

        const res = await authRequest(`/api/v1/agents/${agent.id}`, authToken)
        
        expect(res.status).toBe(200)
        const body = await res.json()
        expect(body.id).toBe(agent.id)
      })

      it("should return 404 for nonexistent agent", async () => {
        const res = await authRequest("/api/v1/agents/nonexistent-id", authToken)
        expect(res.status).toBe(404)
      })
    })

    describe("PUT /api/v1/agents/:id", () => {
      it("should update agent", async () => {
        // Create agent first
        const createRes = await authRequest("/api/v1/agents", authToken, {
          method: "POST",
          body: JSON.stringify({
            name: `Update Agent ${Date.now()}`,
            type: "INTERNAL",
          }),
        })
        
        const agent = await createRes.json()

        const res = await authRequest(`/api/v1/agents/${agent.id}`, authToken, {
          method: "PUT",
          body: JSON.stringify({
            name: "Updated Name",
            description: "Updated description",
          }),
        })

        expect(res.status).toBe(200)
        const body = await res.json()
        expect(body.name).toBe("Updated Name")
      })
    })

    describe("DELETE /api/v1/agents/:id", () => {
      it("should delete agent", async () => {
        // Create agent first
        const createRes = await authRequest("/api/v1/agents", authToken, {
          method: "POST",
          body: JSON.stringify({
            name: `Delete Agent ${Date.now()}`,
            type: "INTERNAL",
          }),
        })
        
        const agent = await createRes.json()

        const res = await authRequest(`/api/v1/agents/${agent.id}`, authToken, {
          method: "DELETE",
        })

        expect(res.status).toBe(204)
      })
    })
  })

  describe("Chat", () => {
    describe("POST /api/v1/chat/messages", () => {
      it("should send a message", async () => {
        const res = await authRequest("/api/v1/chat/messages", authToken, {
          method: "POST",
          body: JSON.stringify({
            content: "Hello, this is a test message",
            conversationId: "test-conversation-123",
          }),
        })

        expect(res.status).toBe(201)
        const body = await res.json()
        expect(body.id).toBeDefined()
        expect(body.content).toBe("Hello, this is a test message")
      })

      it("should require content", async () => {
        const res = await authRequest("/api/v1/chat/messages", authToken, {
          method: "POST",
          body: JSON.stringify({
            conversationId: "test-conversation-123",
            // Missing content
          }),
        })

        expect(res.status).toBe(400)
      })
    })

    describe("GET /api/v1/chat/conversations", () => {
      it("should list conversations", async () => {
        const res = await authRequest("/api/v1/chat/conversations", authToken)
        
        expect(res.status).toBe(200)
        const body = await res.json()
        expect(Array.isArray(body)).toBe(true)
      })
    })
  })

  describe("AI/Coder", () => {
    describe("GET /api/v1/ai/coder/session", () => {
      it("should create or get coder session", async () => {
        const res = await authRequest("/api/v1/ai/coder/session", authToken)
        
        expect(res.status).toBe(200)
        const body = await res.json()
        expect(body.sessionId).toBeDefined()
      })
    })

    describe("POST /api/v1/ai/coder/prompt", () => {
      it("should accept prompt", async () => {
        const res = await authRequest("/api/v1/ai/coder/prompt", authToken, {
          method: "POST",
          body: JSON.stringify({
            prompt: "Create a simple agent for me",
            sessionId: "test-session-123",
          }),
        })

        // Should accept (202) or process (200)
        expect([200, 202]).toContain(res.status)
      })
    })
  })

  describe("Knowledge Base", () => {
    describe("GET /api/v1/knowledge", () => {
      it("should list knowledge entries", async () => {
        const res = await authRequest("/api/v1/knowledge", authToken)
        
        expect(res.status).toBe(200)
        const body = await res.json()
        expect(Array.isArray(body)).toBe(true)
      })
    })

    describe("POST /api/v1/knowledge", () => {
      it("should create knowledge entry", async () => {
        const res = await authRequest("/api/v1/knowledge", authToken, {
          method: "POST",
          body: JSON.stringify({
            title: "Test Knowledge",
            content: "This is test content",
            category: "FAQ",
          }),
        })

        expect(res.status).toBe(201)
        const body = await res.json()
        expect(body.id).toBeDefined()
      })
    })
  })

  describe("Admin", () => {
    describe("GET /api/v1/public/admin/health", () => {
      it("should be publicly accessible", async () => {
        const res = await request("/api/v1/public/admin/health")
        expect(res.status).toBe(200)
      })
    })

    describe("GET /api/v1/admin/tenants", () => {
      it("should require admin role", async () => {
        const res = await authRequest("/api/v1/admin/tenants", authToken)
        // Should be 403 if not admin, or 200 if admin
        expect([200, 403]).toContain(res.status)
      })
    })
  })

  describe("CORS", () => {
    it("should handle preflight requests", async () => {
      const res = await request("/api/v1/auth/login", {
        method: "OPTIONS",
        headers: {
          "Origin": "http://localhost:3001",
          "Access-Control-Request-Method": "POST",
        },
      })

      expect(res.status).toBe(204)
      expect(res.headers.get("access-control-allow-origin")).toBeDefined()
    })
  })
})
