/**
 * Chat E2E Tests - Tests de chat con agentes
 */

import { describe, test, expect, beforeAll } from "bun:test"
import { authHeaders, createTestUser } from "../helpers/fixtures"

const BASE_URL = process.env.BASE_URL || "http://localhost:3000"

let authToken: string
let testAgentId: string
let testConversationId: string

describe("Chat E2E", () => {
  beforeAll(async () => {
    // Obtener token de autenticación
    try {
      const result = await createTestUser(BASE_URL)
      authToken = result.token
    } catch {
      // Intentar login si ya existe
      const loginResponse = await fetch(`${BASE_URL}/api/v1/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: "test@example.com",
          password: "TestPassword123!",
        }),
      })

      if (loginResponse.ok) {
        const data = await loginResponse.json()
        authToken = data.token
      }
    }

    // Crear agente de prueba
    if (authToken) {
      const agentResponse = await fetch(`${BASE_URL}/api/v1/agents`, {
        method: "POST",
        headers: authHeaders(authToken),
        body: JSON.stringify({
          name: `Chat Test Agent ${Date.now()}`,
          description: "Agent for chat testing",
          systemPrompt: "You are a helpful assistant for testing.",
          model: "gpt-4",
        }),
      })

      if (agentResponse.ok) {
        const agent = await agentResponse.json()
        testAgentId = agent.id
      }
    }
  })

  describe("POST /api/v1/chat", () => {
    test("should create a new chat session", async () => {
      if (!authToken || !testAgentId) {
        return
      }

      const response = await fetch(`${BASE_URL}/api/v1/chat`, {
        method: "POST",
        headers: authHeaders(authToken),
        body: JSON.stringify({
          agentId: testAgentId,
        }),
      })

      expect(response.status).toBe(201)

      const data = await response.json()
      expect(data).toHaveProperty("sessionId")
      expect(data).toHaveProperty("agentId")

      testConversationId = data.sessionId
    })
  })

  describe("POST /api/v1/chat/:sessionId/message", () => {
    test("should send a message to the chat", async () => {
      if (!authToken || !testConversationId) {
        return
      }

      const response = await fetch(
        `${BASE_URL}/api/v1/chat/${testConversationId}/message`,
        {
          method: "POST",
          headers: authHeaders(authToken),
          body: JSON.stringify({
            content: "Hello, this is a test message",
          }),
        }
      )

      // Puede ser 200 o 202 dependiendo de si es async
      expect([200, 202]).toContain(response.status)

      const data = await response.json()
      expect(data).toHaveProperty("messageId")
    })
  })

  describe("GET /api/v1/chat/:sessionId", () => {
    test("should get chat session details", async () => {
      if (!authToken || !testConversationId) {
        return
      }

      const response = await fetch(
        `${BASE_URL}/api/v1/chat/${testConversationId}`,
        {
          headers: authHeaders(authToken),
        }
      )

      expect(response.status).toBe(200)

      const data = await response.json()
      expect(data).toHaveProperty("sessionId")
      expect(data).toHaveProperty("messages")
    })
  })

  describe("GET /api/v1/chat/:sessionId/messages", () => {
    test("should get chat messages", async () => {
      if (!authToken || !testConversationId) {
        return
      }

      const response = await fetch(
        `${BASE_URL}/api/v1/chat/${testConversationId}/messages`,
        {
          headers: authHeaders(authToken),
        }
      )

      expect(response.status).toBe(200)

      const data = await response.json()
      expect(Array.isArray(data)).toBe(true)
    })
  })

  describe("DELETE /api/v1/chat/:sessionId", () => {
    test("should delete chat session", async () => {
      if (!authToken || !testConversationId) {
        return
      }

      const response = await fetch(
        `${BASE_URL}/api/v1/chat/${testConversationId}`,
        {
          method: "DELETE",
          headers: authHeaders(authToken),
        }
      )

      expect(response.status).toBe(200)
    })
  })
})
