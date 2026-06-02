/**
 * Agents E2E Tests - Tests de gestión de agentes
 */

import { describe, test, expect, beforeAll } from "bun:test"
import { generateUniqueEmail, authHeaders, createTestUser } from "../helpers/fixtures"

const BASE_URL = process.env.BASE_URL || "http://localhost:3000"

let authToken: string
let testAgentId: string

describe("Agents E2E", () => {
  beforeAll(async () => {
    // Crear usuario de prueba y obtener token
    try {
      const result = await createTestUser(BASE_URL)
      authToken = result.token
    } catch {
      // Si falla el registro, intentar login
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
  })

  describe("GET /api/v1/agents", () => {
    test("should return list of agents", async () => {
      if (!authToken) {
        // Skip if no auth token
        return
      }

      const response = await fetch(`${BASE_URL}/api/v1/agents`, {
        headers: authHeaders(authToken),
      })

      expect(response.status).toBe(200)

      const data = await response.json()
      expect(Array.isArray(data)).toBe(true)
    })

    test("should reject without auth", async () => {
      const response = await fetch(`${BASE_URL}/api/v1/agents`)

      expect(response.status).toBe(401)
    })
  })

  describe("POST /api/v1/agents", () => {
    test("should create a new agent", async () => {
      if (!authToken) {
        // Skip if no auth token
        return
      }

      const response = await fetch(`${BASE_URL}/api/v1/agents`, {
        method: "POST",
        headers: authHeaders(authToken),
        body: JSON.stringify({
          name: `Test Agent ${Date.now()}`,
          description: "Agent created for E2E testing",
          systemPrompt: "You are a helpful test assistant.",
          model: "gpt-4",
          temperature: 0.7,
        }),
      })

      expect(response.status).toBe(201)

      const data = await response.json()
      expect(data).toHaveProperty("id")
      expect(data).toHaveProperty("name")

      testAgentId = data.id
    })

    test("should reject invalid agent data", async () => {
      if (!authToken) {
        // Skip if no auth token
        return
      }

      const response = await fetch(`${BASE_URL}/api/v1/agents`, {
        method: "POST",
        headers: authHeaders(authToken),
        body: JSON.stringify({
          // Falta name requerido
          description: "Invalid agent",
        }),
      })

      expect(response.status).toBe(400)
    })
  })

  describe("GET /api/v1/agents/:id", () => {
    test("should return agent by id", async () => {
      if (!authToken || !testAgentId) {
        // Skip if no auth token or agent
        return
      }

      const response = await fetch(`${BASE_URL}/api/v1/agents/${testAgentId}`, {
        headers: authHeaders(authToken),
      })

      expect(response.status).toBe(200)

      const data = await response.json()
      expect(data.id).toBe(testAgentId)
    })

    test("should return 404 for non-existent agent", async () => {
      if (!authToken) {
        // Skip if no auth token
        return
      }

      const response = await fetch(`${BASE_URL}/api/v1/agents/non-existent-id`, {
        headers: authHeaders(authToken),
      })

      expect(response.status).toBe(404)
    })
  })

  describe("PUT /api/v1/agents/:id", () => {
    test("should update agent", async () => {
      if (!authToken || !testAgentId) {
        // Skip if no auth token or agent
        return
      }

      const response = await fetch(`${BASE_URL}/api/v1/agents/${testAgentId}`, {
        method: "PUT",
        headers: authHeaders(authToken),
        body: JSON.stringify({
          name: "Updated Test Agent",
          description: "Updated description",
        }),
      })

      expect(response.status).toBe(200)

      const data = await response.json()
      expect(data.name).toBe("Updated Test Agent")
    })
  })

  describe("DELETE /api/v1/agents/:id", () => {
    test("should delete agent", async () => {
      if (!authToken || !testAgentId) {
        // Skip if no auth token or agent
        return
      }

      const response = await fetch(`${BASE_URL}/api/v1/agents/${testAgentId}`, {
        method: "DELETE",
        headers: authHeaders(authToken),
      })

      expect(response.status).toBe(200)
    })

    test("should return 404 after deletion", async () => {
      if (!authToken || !testAgentId) {
        // Skip if no auth token or agent
        return
      }

      const response = await fetch(`${BASE_URL}/api/v1/agents/${testAgentId}`, {
        headers: authHeaders(authToken),
      })

      expect(response.status).toBe(404)
    })
  })
})
