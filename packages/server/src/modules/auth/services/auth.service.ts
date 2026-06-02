import { eq } from "drizzle-orm"
import { db } from "../../../db"
import { users, tenantUsers, tenants } from "../../../db/schema"
import { jwtService } from "./jwt.service"
import { hash, compare } from "bcrypt"
import { randomUUID } from "node:crypto"

export interface LoginResult {
  token: string
  refreshToken: string
  user: {
    id: string
    email: string
    name: string
    role: string
    tenantId: string
    tenant: {
      id: string
      slug: string
      name: string
      email: string | null
      subscriptionTier: string
    }
    tenants: Array<{
      id: string
      name: string
      slug: string
      role: string
    }>
  }
}

export interface RegisterResult {
  token: string
  refreshToken: string
  user: {
    id: string
    email: string
    name: string
    role: string
    tenantId: string
    tenant: {
      id: string
      slug: string
      name: string
      email: string | null
      subscriptionTier: string
    }
  }
}

class AuthService {
  async login(email: string, password: string, tenantSlug?: string): Promise<LoginResult> {
    // Find user with tenants
    const user = await db.query.users.findFirst({
      where: eq(users.email, email),
      with: {
        tenants: {
          with: {
            tenant: true,
          },
        },
      },
    })

    if (!user) {
      throw new Error("Invalid credentials")
    }

    // Verify password
    const validPassword = await compare(password, user.passwordhash)
    if (!validPassword) {
      throw new Error("Invalid credentials")
    }

    // Find tenant
    let tenantUser = user.tenants[0]
    if (tenantSlug) {
      const found = user.tenants.find((t) => t.tenant.slug === tenantSlug)
      if (found) tenantUser = found
    }

    if (!tenantUser) {
      throw new Error("User has no tenant associated")
    }

    // Generate tokens
    const token = jwtService.generateToken(user.id, tenantUser.tenantId, tenantUser.role)
    const refreshToken = jwtService.generateRefreshToken(user.id)

    return {
      token,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: tenantUser.role,
        tenantId: tenantUser.tenantId,
        tenant: {
          id: tenantUser.tenant.id,
          slug: tenantUser.tenant.slug,
          name: tenantUser.tenant.name,
          email: tenantUser.tenant.email,
          subscriptionTier: tenantUser.tenant.subscriptionTier,
        },
        tenants: user.tenants.map((t) => ({
          id: t.tenantId,
          name: t.tenant.name,
          slug: t.tenant.slug,
          role: t.role,
        })),
      },
    }
  }

  async register(
    email: string,
    password: string,
    name: string,
    tenantName: string,
    tenantSlug: string
  ): Promise<RegisterResult> {
    // Check existing user
    const existingUser = await db.query.users.findFirst({
      where: eq(users.email, email),
    })
    if (existingUser) {
      throw new Error("Email already registered")
    }

    // Check existing tenant
    const existingTenant = await db.query.tenants.findFirst({
      where: eq(tenants.slug, tenantSlug),
    })
    if (existingTenant) {
      throw new Error("Tenant slug already taken")
    }

    // Hash password
    const hashedPassword = await hash(password, 10)
    const now = new Date()
    const tenantId = randomUUID()
    const userId = randomUUID()

    // Create tenant and user in transaction
    const result = await db.transaction(async (tx) => {
      // Create tenant
      const [tenant] = await tx
        .insert(tenants)
        .values({
          id: tenantId,
          name: tenantName,
          slug: tenantSlug,
          createdAt: now,
          updatedAt: now,
        })
        .returning()

      // Create user
      const [user] = await tx
        .insert(users)
        .values({
          id: userId,
          email,
          passwordhash: hashedPassword,
          name,
          createdAt: now,
          updatedAt: now,
        })
        .returning()

      // Create tenant-user relation
      await tx.insert(tenantUsers).values({
        id: randomUUID(),
        tenantId: tenantId,
        userId: userId,
        role: "OWNER",
        createdAt: now,
      })

      return { user, tenant }
    })

    // Generate tokens
    const token = jwtService.generateToken(result.user.id, result.tenant.id, "OWNER")
    const refreshToken = jwtService.generateRefreshToken(result.user.id)

    return {
      token,
      refreshToken,
      user: {
        id: result.user.id,
        email: result.user.email,
        name: result.user.name,
        role: "OWNER",
        tenantId: result.tenant.id,
        tenant: {
          id: result.tenant.id,
          slug: result.tenant.slug,
          name: result.tenant.name,
          email: result.tenant.email,
          subscriptionTier: result.tenant.subscriptionTier,
        },
      },
    }
  }

  async refreshToken(refreshToken: string, tenantId?: string): Promise<{ token: string; refreshToken: string }> {
    const decoded = jwtService.verifyRefreshToken(refreshToken)

    const user = await db.query.users.findFirst({
      where: eq(users.id, decoded.userId),
      with: {
        tenants: {
          with: {
            tenant: true,
          },
        },
      },
    })

    if (!user) {
      throw new Error("Invalid refresh token")
    }

    let tenantUser = user.tenants[0]
    if (tenantId) {
      const found = user.tenants.find((t) => t.tenantId === tenantId)
      if (found) tenantUser = found
    }

    if (!tenantUser) {
      throw new Error("User has no tenant associated")
    }

    const newToken = jwtService.generateToken(user.id, tenantUser.tenantId, tenantUser.role)
    const newRefreshToken = jwtService.generateRefreshToken(user.id)

    return { token: newToken, refreshToken: newRefreshToken }
  }

  async me(userId: string, tenantId?: string) {
    const user = await db.query.users.findFirst({
      where: eq(users.id, userId),
      with: {
        tenants: tenantId
          ? {
              with: {
                tenant: true,
              },
            }
          : {
              with: {
                tenant: true,
              },
            },
      },
    })

    if (!user) {
      throw new Error("User not found")
    }

    const tenantUser = user.tenants[0]

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: tenantUser?.role,
      tenantId: tenantUser?.tenantId,
      tenant: tenantUser?.tenant,
      tenants: user.tenants.map((t) => ({
        id: t.tenantId,
        name: t.tenant.name,
        slug: t.tenant.slug,
        role: t.role,
      })),
      createdAt: user.createdAt,
    }
  }

  async switchTenant(userId: string, tenantId: string) {
    const tenantUser = await db.query.tenantUsers.findFirst({
      where: eq(tenantUsers.userId, userId),
      with: {
        tenant: true,
      },
    })

    if (!tenantUser || tenantUser.tenantId !== tenantId) {
      throw new Error("Access denied to this tenant")
    }

    const token = jwtService.generateToken(userId, tenantId, tenantUser.role)
    const refreshToken = jwtService.generateRefreshToken(userId)

    return {
      token,
      refreshToken,
      tenant: {
        id: tenantUser.tenantId,
        name: tenantUser.tenant.name,
        slug: tenantUser.tenant.slug,
        role: tenantUser.role,
      },
    }
  }
}

export const authService = new AuthService()
