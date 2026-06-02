/**
 * Users Service - Migrado a Drizzle
 */

import { eq, and, desc, or, like } from "drizzle-orm"
import { db } from "../../../db"
import { users, tenants } from "../../../db/schema"
import bcrypt from "bcrypt"

export interface CreateUserInput {
  tenantId: string
  email: string
  password: string
  name: string
  role?: string
}

export interface UpdateUserInput {
  name?: string
  email?: string
  role?: string
  status?: string
}

export interface UserFilterOptions {
  tenantId?: string
  role?: string
  status?: string
  search?: string
  page?: number
  limit?: number
}

class UsersService {
  /**
   * Crea un nuevo usuario
   */
  async create(data: CreateUserInput) {
    // Verificar que el email no existe
    const existing = await db.query.users.findFirst({
      where: eq(users.email, data.email),
    })

    if (existing) {
      throw new Error("Email already registered")
    }

    // Hashear contraseña
    const hashedPassword = await bcrypt.hash(data.password, 10)

    const [user] = await db
      .insert(users)
      .values({
        tenantId: data.tenantId,
        email: data.email,
        password: hashedPassword,
        name: data.name,
        role: data.role || "MEMBER",
        status: "ACTIVE",
      })
      .returning()

    // No devolver la contraseña
    const { password: _, ...userWithoutPassword } = user
    return userWithoutPassword
  }

  /**
   * Obtiene un usuario por ID
   */
  async getById(id: string) {
    const user = await db.query.users.findFirst({
      where: eq(users.id, id),
      with: {
        tenant: true,
      },
    })

    if (!user) return null

    const { password: _, ...userWithoutPassword } = user
    return userWithoutPassword
  }

  /**
   * Obtiene un usuario por email
   */
  async getByEmail(email: string) {
    const user = await db.query.users.findFirst({
      where: eq(users.email, email),
      with: {
        tenant: true,
      },
    })

    return user || null
  }

  /**
   * Lista usuarios con filtros y paginación
   */
  async list(options: UserFilterOptions) {
    const { tenantId, role, status, search, page = 1, limit = 20 } = options
    const skip = (page - 1) * limit

    // Build where conditions
    const conditions = []

    if (tenantId) {
      conditions.push(eq(users.tenantId, tenantId))
    }
    if (role) {
      conditions.push(eq(users.role, role))
    }
    if (status) {
      conditions.push(eq(users.status, status))
    }

    const allUsers = await db.query.users.findMany({
      where: conditions.length > 0 ? and(...conditions) : undefined,
      with: {
        tenant: true,
      },
      orderBy: [desc(users.createdAt)],
    })

    // Filter by search if provided
    let filtered = allUsers
    if (search) {
      const searchLower = search.toLowerCase()
      filtered = allUsers.filter(
        (u) =>
          u.name.toLowerCase().includes(searchLower) ||
          u.email.toLowerCase().includes(searchLower)
      )
    }

    // Get total count
    const total = filtered.length

    // Paginate
    const paginated = filtered.slice(skip, skip + limit)

    // Remove passwords
    const usersWithoutPasswords = paginated.map((user) => {
      const { password: _, ...userWithoutPassword } = user
      return userWithoutPassword
    })

    return {
      users: usersWithoutPasswords,
      total,
      page,
      limit,
    }
  }

  /**
   * Actualiza un usuario
   */
  async update(id: string, data: UpdateUserInput) {
    const existing = await this.getById(id)

    if (!existing) {
      throw new Error("User not found")
    }

    // Verificar email único si se está cambiando
    if (data.email && data.email !== existing.email) {
      const emailExists = await db.query.users.findFirst({
        where: eq(users.email, data.email),
      })

      if (emailExists) {
        throw new Error("Email already registered")
      }
    }

    const [updated] = await db
      .update(users)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(eq(users.id, id))
      .returning()

    const { password: _, ...userWithoutPassword } = updated
    return userWithoutPassword
  }

  /**
   * Cambia la contraseña de un usuario
   */
  async changePassword(id: string, currentPassword: string, newPassword: string) {
    const user = await db.query.users.findFirst({
      where: eq(users.id, id),
    })

    if (!user) {
      throw new Error("User not found")
    }

    // Verificar contraseña actual
    const isValid = await bcrypt.compare(currentPassword, user.password)
    if (!isValid) {
      throw new Error("Current password is incorrect")
    }

    // Hashear nueva contraseña
    const hashedPassword = await bcrypt.hash(newPassword, 10)

    const [updated] = await db
      .update(users)
      .set({
        password: hashedPassword,
        updatedAt: new Date(),
      })
      .where(eq(users.id, id))
      .returning()

    const { password: _, ...userWithoutPassword } = updated
    return userWithoutPassword
  }

  /**
   * Resetea la contraseña de un usuario (admin)
   */
  async resetPassword(id: string, newPassword: string) {
    const existing = await this.getById(id)

    if (!existing) {
      throw new Error("User not found")
    }

    // Hashear nueva contraseña
    const hashedPassword = await bcrypt.hash(newPassword, 10)

    const [updated] = await db
      .update(users)
      .set({
        password: hashedPassword,
        updatedAt: new Date(),
      })
      .where(eq(users.id, id))
      .returning()

    const { password: _, ...userWithoutPassword } = updated
    return userWithoutPassword
  }

  /**
   * Elimina un usuario (soft delete)
   */
  async delete(id: string) {
    const existing = await this.getById(id)

    if (!existing) {
      throw new Error("User not found")
    }

    const [deleted] = await db
      .update(users)
      .set({ status: "DELETED", updatedAt: new Date() })
      .where(eq(users.id, id))
      .returning()

    const { password: _, ...userWithoutPassword } = deleted
    return userWithoutPassword
  }

  /**
   * Activa un usuario
   */
  async activate(id: string) {
    return this.update(id, { status: "ACTIVE" })
  }

  /**
   * Desactiva un usuario
   */
  async deactivate(id: string) {
    return this.update(id, { status: "INACTIVE" })
  }

  /**
   * Verifica credenciales de usuario
   */
  async verifyCredentials(email: string, password: string) {
    const user = await db.query.users.findFirst({
      where: eq(users.email, email),
    })

    if (!user) {
      return null
    }

    const isValid = await bcrypt.compare(password, user.password)
    if (!isValid) {
      return null
    }

    const { password: _, ...userWithoutPassword } = user
    return userWithoutPassword
  }
}

export const usersService = new UsersService()
