/**
 * Users Routes - Migrado a Hono
 */

import { Hono } from "hono"
import { authMiddleware, adminMiddleware } from "../../auth/middleware/auth.middleware"
import { usersController } from "../controllers/users.controller"

const usersRoutes = new Hono()

// Todas las rutas requieren autenticación
usersRoutes.use("*", authMiddleware)

// CRUD básico
usersRoutes.get("/", (c) => usersController.list(c))
usersRoutes.post("/", (c) => usersController.create(c))
usersRoutes.get("/:id", (c) => usersController.getById(c))
usersRoutes.put("/:id", (c) => usersController.update(c))
usersRoutes.delete("/:id", (c) => usersController.delete(c))

// Acciones especiales
usersRoutes.post("/:id/change-password", (c) => usersController.changePassword(c))
usersRoutes.post("/:id/activate", (c) => usersController.activate(c))
usersRoutes.post("/:id/deactivate", (c) => usersController.deactivate(c))

// Rutas de admin (requieren rol admin)
const adminUsersRoutes = new Hono()
adminUsersRoutes.use("*", adminMiddleware)

adminUsersRoutes.post("/:id/reset-password", (c) => usersController.resetPassword(c))

// Montar rutas admin
usersRoutes.route("/admin", adminUsersRoutes)

export { usersRoutes }
