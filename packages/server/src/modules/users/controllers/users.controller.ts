/**
 * Users Controller - Migrado a Hono
 */

import type { Context } from "hono"
import { HTTPException } from "hono/http-exception"
import { usersService } from "../services/users.service"

class UsersController {
  /**
   * GET /api/v1/users
   * Lista usuarios (filtrado por tenant del usuario autenticado)
   */
  async list(c: Context) {
    const tenantId = c.get("tenantId") as string
    const userRole = c.get("userRole") as string

    // Si es admin, puede ver todos los usuarios
    const role = c.req.query("role")
    const status = c.req.query("status")
    const search = c.req.query("search")
    const page = parseInt(c.req.query("page") || "1")
    const limit = parseInt(c.req.query("limit") || "20")

    const result = await usersService.list({
      tenantId: userRole === "ADMIN" ? undefined : tenantId,
      role: role || undefined,
      status: status || undefined,
      search: search || undefined,
      page,
      limit,
    })

    return c.json({
      success: true,
      data: result.users,
      pagination: {
        total: result.total,
        page: result.page,
        limit: result.limit,
      },
    })
  }

  /**
   * GET /api/v1/users/:id
   * Obtiene un usuario por ID
   */
  async getById(c: Context) {
    const id = c.req.param("id")

    const user = await usersService.getById(id)

    if (!user) {
      throw new HTTPException(404, { message: "User not found" })
    }

    return c.json({
      success: true,
      data: user,
    })
  }

  /**
   * POST /api/v1/users
   * Crea un nuevo usuario
   */
  async create(c: Context) {
    const tenantId = c.get("tenantId") as string
    const body = await c.req.json()

    const user = await usersService.create({
      tenantId,
      ...body,
    })

    return c.json({
      success: true,
      data: user,
    })
  }

  /**
   * PUT /api/v1/users/:id
   * Actualiza un usuario
   */
  async update(c: Context) {
    const id = c.req.param("id")
    const body = await c.req.json()

    const user = await usersService.update(id, body)

    return c.json({
      success: true,
      data: user,
    })
  }

  /**
   * DELETE /api/v1/users/:id
   * Elimina un usuario (soft delete)
   */
  async delete(c: Context) {
    const id = c.req.param("id")

    await usersService.delete(id)

    return c.json({
      success: true,
      message: "User deleted successfully",
    })
  }

  /**
   * POST /api/v1/users/:id/change-password
   * Cambia la contraseña de un usuario
   */
  async changePassword(c: Context) {
    const id = c.req.param("id")
    const body = await c.req.json()

    if (!body.currentPassword || !body.newPassword) {
      throw new HTTPException(400, {
        message: "currentPassword and newPassword are required",
      })
    }

    const user = await usersService.changePassword(
      id,
      body.currentPassword,
      body.newPassword
    )

    return c.json({
      success: true,
      data: user,
    })
  }

  /**
   * POST /api/v1/users/:id/reset-password
   * Resetea la contraseña de un usuario (admin)
   */
  async resetPassword(c: Context) {
    const id = c.req.param("id")
    const body = await c.req.json()

    if (!body.newPassword) {
      throw new HTTPException(400, { message: "newPassword is required" })
    }

    const user = await usersService.resetPassword(id, body.newPassword)

    return c.json({
      success: true,
      data: user,
    })
  }

  /**
   * POST /api/v1/users/:id/activate
   * Activa un usuario
   */
  async activate(c: Context) {
    const id = c.req.param("id")

    const user = await usersService.activate(id)

    return c.json({
      success: true,
      data: user,
    })
  }

  /**
   * POST /api/v1/users/:id/deactivate
   * Desactiva un usuario
   */
  async deactivate(c: Context) {
    const id = c.req.param("id")

    const user = await usersService.deactivate(id)

    return c.json({
      success: true,
      data: user,
    })
  }
}

export const usersController = new UsersController()
