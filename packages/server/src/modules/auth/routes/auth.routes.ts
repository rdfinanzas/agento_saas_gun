import { Hono } from "hono"
import { authController } from "../controllers/auth.controller"
import { authMiddleware } from "../middleware/auth.middleware"
import { jwtService } from "../services/jwt.service"

export const authRoutes = new Hono()

// Public routes
authRoutes.post("/register", (c) => authController.register(c))
authRoutes.post("/login", (c) => authController.login(c))
authRoutes.post("/refresh-token", (c) => authController.refreshToken(c))
authRoutes.post("/refresh", (c) => authController.refreshToken(c)) // Alias for compatibility

// Debug route - decode JWT without verification (for debugging)
authRoutes.post("/debug-token", (c) => {
  const { token } = c.req.json() as { token?: string }
  if (!token) {
    return c.json({ error: "Token is required" }, 400)
  }

  try {
    const jwt = require("jsonwebtoken")
    const decoded = jwt.decode(token)
    return c.json({ decoded })
  } catch (error) {
    return c.json({ error: "Invalid token", details: error instanceof Error ? error.message : "Unknown error" }, 400)
  }
})

// Protected routes
authRoutes.get("/me", authMiddleware, (c) => authController.me(c))
authRoutes.post("/switch-tenant", authMiddleware, (c) => authController.switchTenant(c))
authRoutes.post("/logout", authMiddleware, (c) => authController.logout(c))
authRoutes.post("/revoke", authMiddleware, (c) => authController.revokeTokens(c))
