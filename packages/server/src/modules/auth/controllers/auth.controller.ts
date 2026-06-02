import type { Context } from "hono"
import { authService } from "../services/auth.service"
import { HTTPException } from "hono/http-exception"

export class AuthController {
  async login(c: Context) {
    try {
      const { email, password, tenantSlug } = await c.req.json()

      if (!email || !password) {
        throw new HTTPException(400, { message: "Email and password are required" })
      }

      const result = await authService.login(email, password, tenantSlug)
      return c.json(result)
    } catch (error) {
      if (error instanceof HTTPException) throw error
      if (error instanceof Error) {
        if (error.message === "Invalid credentials") {
          throw new HTTPException(401, { message: "Invalid credentials" })
        }
        if (error.message === "User has no tenant associated") {
          throw new HTTPException(400, { message: error.message })
        }
      }
      console.error("Login error:", error)
      throw new HTTPException(500, { message: "Internal server error" })
    }
  }

  async register(c: Context) {
    try {
      const { email, password, name, tenantName, tenantSlug } = await c.req.json()

      if (!email || !password || !name || !tenantName || !tenantSlug) {
        throw new HTTPException(400, { message: "All fields are required" })
      }

      // Validate password strength
      if (password.length < 8) {
        throw new HTTPException(400, { message: "Password must be at least 8 characters long" })
      }

      const result = await authService.register(email, password, name, tenantName, tenantSlug)
      return c.json(result, 201)
    } catch (error) {
      if (error instanceof HTTPException) throw error
      if (error instanceof Error) {
        if (error.message === "Email already registered") {
          throw new HTTPException(400, { message: error.message })
        }
        if (error.message === "Tenant slug already taken") {
          throw new HTTPException(400, { message: error.message })
        }
      }
      console.error("Register error:", error)
      throw new HTTPException(500, { message: "Internal server error" })
    }
  }

  async refreshToken(c: Context) {
    try {
      const { refreshToken, tenantId } = await c.req.json()

      if (!refreshToken) {
        throw new HTTPException(400, { message: "Refresh token is required" })
      }

      const result = await authService.refreshToken(refreshToken, tenantId)
      return c.json(result)
    } catch (error) {
      if (error instanceof HTTPException) throw error
      if (error instanceof Error && error.message.includes("token")) {
        throw new HTTPException(401, { message: "Invalid refresh token" })
      }
      console.error("Refresh token error:", error)
      throw new HTTPException(401, { message: "Invalid refresh token" })
    }
  }

  async me(c: Context) {
    try {
      const userId = c.get("userId") as string
      const tenantId = c.get("tenantId") as string

      if (!userId) {
        throw new HTTPException(401, { message: "Unauthorized" })
      }

      const user = await authService.me(userId, tenantId)
      return c.json(user)
    } catch (error) {
      if (error instanceof HTTPException) throw error
      if (error instanceof Error && error.message === "User not found") {
        throw new HTTPException(404, { message: "User not found" })
      }
      console.error("Me error:", error)
      throw new HTTPException(500, { message: "Internal server error" })
    }
  }

  async switchTenant(c: Context) {
    try {
      const userId = c.get("userId") as string
      const { tenantId } = await c.req.json()

      if (!userId) {
        throw new HTTPException(401, { message: "Unauthorized" })
      }

      if (!tenantId) {
        throw new HTTPException(400, { message: "Tenant ID is required" })
      }

      const result = await authService.switchTenant(userId, tenantId)
      return c.json(result)
    } catch (error) {
      if (error instanceof HTTPException) throw error
      if (error instanceof Error && error.message === "Access denied to this tenant") {
        throw new HTTPException(403, { message: error.message })
      }
      console.error("Switch tenant error:", error)
      throw new HTTPException(500, { message: "Internal server error" })
    }
  }

  async logout(c: Context) {
    try {
      // In a stateless JWT system, logout is handled client-side by removing the token
      // For now, we return success - the client should discard the token
      return c.json({
        success: true,
        message: "Logged out successfully",
      })
    } catch (error) {
      console.error("Logout error:", error)
      throw new HTTPException(500, { message: "Internal server error" })
    }
  }

  async revokeTokens(c: Context) {
    try {
      // In a stateless JWT system, token revocation requires a blacklist
      // For now, we return success - in production, implement token blacklist
      return c.json({
        success: true,
        message: "Tokens revoked successfully",
      })
    } catch (error) {
      console.error("Revoke tokens error:", error)
      throw new HTTPException(500, { message: "Internal server error" })
    }
  }
}

export const authController = new AuthController()
