/**
 * Auth E2E Tests - Tests de autenticación
 */

import { describe, test, expect, beforeAll } from "bun:test"
import { generateUniqueEmail, authHeaders } from "../helpers/fixtures"

const BASE_URL = process.env.BASE_URL || "http://localhost:3000"

// Usuario de prueba único para esta suite
let testUserEmail: string
let testUserPassword = "TestPassword123!"
let authToken: string
let refreshToken: string

describe("Auth E2E", () => {
  beforeAll(() => {
    testUserEmail = generateUniqueEmail()
  })

  describe("POST /api/v1/auth/register", () => {
    test("should register a new user", async () => {
      const response = await fetch(`${BASE_URL}/api/v1/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: testUserEmail,
          password: testUserPassword,
          name: "Test User",
          tenantName: "Test Tenant",
          tenantSlug: `test-tenant-${Date.now()}`,
        }),
      })

      // Puede ser 201 (creado) o 409 (ya existe)
      expect([201, 409]).toContain(response.status)

      if (response.status === 201) {
        const data = await response.json()
        expect(data).toHaveProperty("token")
        expect(data).toHaveProperty("user")
        expect(data.user.email).toBe(testUserEmail)
      }
    })

    test("should reject invalid email", async () => {
      const response = await fetch(`${BASE_URL}/api/v1/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: "invalid-email",
          password: testUserPassword,
          name: "Test User",
          tenantName: "Test Tenant",
          tenantSlug: `test-tenant-${Date.now()}-2`,
        }),
      })

      expect(response.status).toBe(400)
    })

    test("should reject short password", async () => {
      const response = await fetch(`${BASE_URL}/api/v1/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: generateUniqueEmail(),
          password: "short",
          name: "Test User",
          tenantName: "Test Tenant",
          tenantSlug: `test-tenant-${Date.now()}-3`,
        }),
      })

      expect(response.status).toBe(400)
    })
  })

  describe("POST /api/v1/auth/login", () => {
    test("should login with valid credentials", async () => {
      // Primero registrar si no existe
      await fetch(`${BASE_URL}/api/v1/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: testUserEmail,
          password: testUserPassword,
          name: "Test User",
          tenantName: "Test Tenant",
          tenantSlug: `test-tenant-${Date.now()}-login`,
        }),
      })

      const response = await fetch(`${BASE_URL}/api/v1/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: testUserEmail,
          password: testUserPassword,
        }),
      })

      expect(response.status).toBe(200)

      const data = await response.json()
      expect(data).toHaveProperty("token")
      expect(data).toHaveProperty("user")

      authToken = data.token
      if (data.refreshToken) {
        refreshToken = data.refreshToken
      }
    })

    test("should reject invalid credentials", async () => {
      const response = await fetch(`${BASE_URL}/api/v1/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: testUserEmail,
          password: "WrongPassword123",
        }),
      })

      expect(response.status).toBe(401)
    })

    test("should reject non-existent user", async () => {
      const response = await fetch(`${BASE_URL}/api/v1/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: "nonexistent@example.com",
          password: "SomePassword123",
        }),
      })

      expect(response.status).toBe(401)
    })
  })

  describe("GET /api/v1/auth/me", () => {
    test("should return current user with valid token", async () => {
      if (!authToken) {
        // Skip test if no auth token available
        return
      }

      const response = await fetch(`${BASE_URL}/api/v1/auth/me`, {
        headers: authHeaders(authToken),
      })

      expect(response.status).toBe(200)

      const data = await response.json()
      expect(data).toHaveProperty("email")
      expect(data.email).toBe(testUserEmail)
    })

    test("should reject without token", async () => {
      const response = await fetch(`${BASE_URL}/api/v1/auth/me`)

      expect(response.status).toBe(401)
    })

    test("should reject with invalid token", async () => {
      const response = await fetch(`${BASE_URL}/api/v1/auth/me`, {
        headers: authHeaders("invalid-token"),
      })

      expect(response.status).toBe(401)
    })
  })

  describe("POST /api/v1/auth/refresh", () => {
    test("should refresh token if refresh token available", async () => {
      if (!refreshToken) {
        // Skip test if no refresh token available
        return
      }

      const response = await fetch(`${BASE_URL}/api/v1/auth/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken }),
      })

      expect(response.status).toBe(200)

      const data = await response.json()
      expect(data).toHaveProperty("token")
    })
  })

  describe("POST /api/v1/auth/logout", () => {
    test("should logout successfully", async () => {
      if (!authToken) {
        // Skip test if no auth token available
        return
      }

      const response = await fetch(`${BASE_URL}/api/v1/auth/logout`, {
        method: "POST",
        headers: authHeaders(authToken),
      })

      expect(response.status).toBe(200)
    })
  })
})
