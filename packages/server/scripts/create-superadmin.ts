/**
 * Script para crear un superadmin inicial
 * Uso: bun run scripts/create-superadmin.ts
 */

import { db } from "../src/db"
import { users, tenants, tenantUsers } from "../src/db/schema"
import { hash } from "bcrypt"
import { randomUUID } from "node:crypto"

const SUPERADMIN_EMAIL = "admin@agento.local"
const SUPERADMIN_PASSWORD = "Admin123!"
const SUPERADMIN_NAME = "Super Admin"
const TENANT_SLUG = "agento-superadmin"
const TENANT_NAME = "AgenTo SuperAdmin"

async function createSuperadmin() {
  try {
    console.log("🔐 Creando superadmin...")

    // Verificar si ya existe el tenant
    const existingTenant = await db.query.tenants.findFirst({
      where: (tenants, { eq }) => eq(tenants.slug, TENANT_SLUG),
    })

    let tenantId: string

    if (existingTenant) {
      console.log("✅ Tenant ya existe, usando ID:", existingTenant.id)
      tenantId = existingTenant.id
    } else {
      // Crear tenant
      const [newTenant] = await db.insert(tenants).values({
        slug: TENANT_SLUG,
        name: TENANT_NAME,
      }).returning()

      tenantId = newTenant.id
      console.log("✅ Tenant creado:", newTenant.slug)
    }

    // Verificar si ya existe el usuario
    const existingUser = await db.query.users.findFirst({
      where: (users, { eq }) => eq(users.email, SUPERADMIN_EMAIL),
    })

    if (existingUser) {
      console.log("✅ Usuario ya existe:", existingUser.email)
      console.log("   Si quieres cambiar la contraseña, elimina el usuario primero")
      return
    }

    // Hashear contraseña
    const hashedPassword = await hash(SUPERADMIN_PASSWORD, 10)

    // Crear usuario
    const [newUser] = await db.insert(users).values({
      email: SUPERADMIN_EMAIL,
      passwordhash: hashedPassword,
      name: SUPERADMIN_NAME,
    }).returning()

    // Crear relación tenant-user
    await db.insert(tenantUsers).values({
      tenantId: tenantId,
      userId: newUser.id,
      role: "OWNER",
    })

    console.log("✅ Superadmin creado exitosamente!")
    console.log("")
    console.log("📧 Email:", SUPERADMIN_EMAIL)
    console.log("🔑 Password:", SUPERADMIN_PASSWORD)
    console.log("🏢 Tenant:", TENANT_SLUG)
    console.log("")
    console.log("⚠️  IMPORTANTE: Cambia la contraseña después del primer login!")
    console.log("")
    console.log("Para hacer login, usa:")
    console.log(`curl -X POST http://localhost:3000/api/v1/auth/login \\`)
    console.log(`  -H "Content-Type: application/json" \\`)
    console.log(`  -d '{"email":"${SUPERADMIN_EMAIL}","password":"${SUPERADMIN_PASSWORD}","tenantSlug":"${TENANT_SLUG}"}'`)

  } catch (error) {
    console.error("❌ Error creando superadmin:", error)
    process.exit(1)
  } finally {
    process.exit(0)
  }
}

createSuperadmin()
