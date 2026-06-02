/**
 * Auth Service Tests
 * 
 * Tests unitarios para el servicio de autenticación
 * cubriendo: login, registro, JWT, refresh tokens
 */

import { describe, it, expect, beforeEach, mock } from "bun:test"
import { AuthService } from "@/modules/auth/services/auth.service"
import { JwtService } from "@/modules/auth/services/jwt.service"
import bcrypt from "bcrypt"

// Mock bcrypt
mock.module("bcrypt", () => ({
  hash: async (password: string, salt: number) => `hashed_${password}`,
  compare: async (password: string, hash: string) => hash === `hashed_${password}`,
}))

// Mock DB
const mockDb = {
  query: {
    users: {
      findFirst: mock(async ({ where }: any) => {
        if (where.and?.some((c: any) => c.value === "test@example.com")) {
          return {
            id: "user-123",
            email: "test@example.com",
            passwordHash: "hashed_password123",
            firstName: "Test",
            lastName: "User",
            role: "USER",
            emailVerified: true,
          }
        }
        return null
      }),
    },
    tenantUsers: {
      findMany: mock(async () => [{
        tenantId: "tenant-123",
        role: "ADMIN",
      }]),
    },
  },
  insert: () => ({
    values: () => ({
      returning: mock(async () => [{
        id: "user-new",
        email: "new@example.com",
        firstName: "New",
        lastName: "User",
      }]),
    }),
  }),
}

mock.module("@/db", () => ({ db: mockDb }))

describe("AuthService", () => {
  let authService: AuthService
  let jwtService: JwtService

  beforeEach(() => {
    jwtService = new JwtService()
    authService = new AuthService()
  })

  describe("login", () => {
    it("should login with valid credentials", async () => {
      const result = await authService.login({
        email: "test@example.com",
        password: "password123",
      })

      expect(result).toBeDefined()
      expect(result.user).toBeDefined()
      expect(result.user.email).toBe("test@example.com")
      expect(result.tokens).toBeDefined()
      expect(result.tokens.accessToken).toBeDefined()
      expect(result.tokens.refreshToken).toBeDefined()
    })

    it("should throw error for invalid email", async () => {
      mockDb.query.users.findFirst = mock(async () => null)

      try {
        await authService.login({
          email: "nonexistent@example.com",
          password: "password123",
        })
        expect(false).toBe(true) // Should not reach here
      } catch (error: any) {
        expect(error.message).toContain("Invalid credentials")
      }
    })

    it("should throw error for invalid password", async () => {
      mockDb.query.users.findFirst = mock(async () => ({
        id: "user-123",
        email: "test@example.com",
        passwordHash: "hashed_password123",
      }))

      try {
        await authService.login({
          email: "test@example.com",
          password: "wrongpassword",
        })
        expect(false).toBe(true)
      } catch (error: any) {
        expect(error.message).toContain("Invalid credentials")
      }
    })

    it("should throw error for unverified email", async () => {
      mockDb.query.users.findFirst = mock(async () => ({
        id: "user-123",
        email: "test@example.com",
        passwordHash: "hashed_password123",
        emailVerified: false,
      }))

      try {
        await authService.login({
          email: "test@example.com",
          password: "password123",
        })
        expect(false).toBe(true)
      } catch (error: any) {
        expect(error.message).toContain("Email not verified")
      }
    })
  })

  describe("register", () => {
    it("should register a new user", async () => {
      mockDb.query.users.findFirst = mock(async () => null)

      const result = await authService.register({
        email: "new@example.com",
        password: "password123",
        firstName: "New",
        lastName: "User",
      })

      expect(result).toBeDefined()
      expect(result.user.email).toBe("new@example.com")
    })

    it("should throw error for existing email", async () => {
      mockDb.query.users.findFirst = mock(async () => ({
        id: "user-existing",
        email: "existing@example.com",
      }))

      try {
        await authService.register({
          email: "existing@example.com",
          password: "password123",
          firstName: "Test",
          lastName: "User",
        })
        expect(false).toBe(true)
      } catch (error: any) {
        expect(error.message).toContain("Email already registered")
      }
    })

    it("should validate password strength", async () => {
      try {
        await authService.register({
          email: "new@example.com",
          password: "123", // Too short
          firstName: "Test",
          lastName: "User",
        })
        expect(false).toBe(true)
      } catch (error: any) {
        expect(error.message).toContain("Password")
      }
    })
  })

  describe("refreshToken", () => {
    it("should refresh valid token", async () => {
      const tokens = await authService.refreshToken("valid-refresh-token")
      
      expect(tokens).toBeDefined()
      expect(tokens.accessToken).toBeDefined()
      expect(tokens.refreshToken).toBeDefined()
    })

    it("should throw error for invalid token", async () => {
      try {
        await authService.refreshToken("invalid-token")
        expect(false).toBe(true)
      } catch (error: any) {
        expect(error.message).toContain("Invalid")
      }
    })
  })

  describe("logout", () => {
    it("should logout successfully", async () => {
      await authService.logout("user-123")
      // Should complete without error
      expect(true).toBe(true)
    })
  })
})

describe("JwtService", () => {
  let jwtService: JwtService

  beforeEach(() => {
    jwtService = new JwtService()
  })

  describe("generateTokens", () => {
    it("should generate access and refresh tokens", () => {
      const payload = {
        userId: "user-123",
        email: "test@example.com",
        role: "USER",
      }

      const tokens = jwtService.generateTokens(payload)

      expect(tokens.accessToken).toBeDefined()
      expect(tokens.refreshToken).toBeDefined()
      expect(typeof tokens.accessToken).toBe("string")
      expect(typeof tokens.refreshToken).toBe("string")
    })

    it("should include all payload fields in token", () => {
      const payload = {
        userId: "user-123",
        email: "test@example.com",
        role: "ADMIN",
        tenantId: "tenant-456",
      }

      const tokens = jwtService.generateTokens(payload)
      const decoded = jwtService.verifyAccessToken(tokens.accessToken)

      expect(decoded.userId).toBe(payload.userId)
      expect(decoded.email).toBe(payload.email)
      expect(decoded.role).toBe(payload.role)
    })
  })

  describe("verifyAccessToken", () => {
    it("should verify valid token", () => {
      const payload = { userId: "user-123", email: "test@example.com" }
      const tokens = jwtService.generateTokens(payload)
      const decoded = jwtService.verifyAccessToken(tokens.accessToken)

      expect(decoded).toBeDefined()
      expect(decoded.userId).toBe(payload.userId)
    })

    it("should throw error for expired token", () => {
      // Mock expired token
      const expiredToken = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
      
      try {
        jwtService.verifyAccessToken(expiredToken)
        expect(false).toBe(true)
      } catch (error: any) {
        expect(error.message).toContain("expired")
      }
    })

    it("should throw error for invalid token", () => {
      try {
        jwtService.verifyAccessToken("invalid-token")
        expect(false).toBe(true)
      } catch (error: any) {
        expect(error.message).toContain("Invalid")
      }
    })
  })
})
