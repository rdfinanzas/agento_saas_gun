/**
 * Health E2E Tests - Tests de health check
 */

import { describe, test, expect, beforeAll } from "bun:test"

const BASE_URL = process.env.BASE_URL || "http://localhost:3000"

describe("Health Check E2E", () => {
  describe("GET /health", () => {
    test("should return 200 OK", async () => {
      const response = await fetch(`${BASE_URL}/health`)

      expect(response.status).toBe(200)

      const data = await response.json()
      expect(data).toHaveProperty("status")
      expect(data.status).toBe("ok")
    })

    test("should include timestamp", async () => {
      const response = await fetch(`${BASE_URL}/health`)
      const data = await response.json()

      expect(data).toHaveProperty("timestamp")
      expect(new Date(data.timestamp).getTime()).toBeGreaterThan(0)
    })

    test("should include version", async () => {
      const response = await fetch(`${BASE_URL}/health`)
      const data = await response.json()

      expect(data).toHaveProperty("version")
    })

    test("should include uptime", async () => {
      const response = await fetch(`${BASE_URL}/health`)
      const data = await response.json()

      expect(data).toHaveProperty("uptime")
      expect(data.uptime).toBeGreaterThanOrEqual(0)
    })
  })

  describe("GET /api/v1/health", () => {
    test("should return detailed health info", async () => {
      const response = await fetch(`${BASE_URL}/api/v1/health`)

      expect(response.status).toBe(200)

      const data = await response.json()
      expect(data).toHaveProperty("status")
    })
  })

  describe("GET /ready", () => {
    test("should return readiness status", async () => {
      const response = await fetch(`${BASE_URL}/ready`)

      // Puede ser 200 o 503 dependiendo del estado
      expect([200, 503]).toContain(response.status)

      const data = await response.json()
      expect(data).toHaveProperty("ready")
    })
  })

  describe("GET /live", () => {
    test("should return liveness status", async () => {
      const response = await fetch(`${BASE_URL}/live`)

      expect(response.status).toBe(200)

      const data = await response.json()
      expect(data).toHaveProperty("alive")
      expect(data.alive).toBe(true)
    })
  })
})
