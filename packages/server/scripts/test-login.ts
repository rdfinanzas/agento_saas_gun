/**
 * Script para probar el login de superadmin
 */

import { db } from "../src/db"
import { users, tenantUsers, tenants } from "../src/db/schema"
import { eq } from "drizzle-orm"

const SUPERADMIN_EMAIL = "admin@agento.local"
const SUPERADMIN_PASSWORD = "Admin123!"
const TENANT_SLUG = "agento-superadmin"

async function testLogin() {
  try {
    console.log("🔍 Probando login de superadmin...")

    // 1. Verificar si el usuario existe
    const user = await db.query.users.findFirst({
      where: eq(users.email, SUPERADMIN_EMAIL),
    })

    if (!user) {
      console.log("❌ Usuario no encontrado:", SUPERADMIN_EMAIL)
      return
    }

    console.log("✅ Usuario encontrado:", user.email)
    console.log("   Tiene passwordhash:", !!user.passwordhash)

    // 2. Verificar si el tenant existe
    const tenant = await db.query.tenants.findFirst({
      where: eq(tenants.slug, TENANT_SLUG),
    })

    if (!tenant) {
      console.log("❌ Tenant no encontrado:", TENANT_SLUG)
      return
    }

    console.log("✅ Tenant encontrado:", tenant.slug)

    // 3. Verificar la relación tenant-user
    const tenantUser = await db.query.tenantUsers.findFirst({
      where: (tu, { eq }) => eq(tu.userId, user.id),
    })

    if (!tenantUser) {
      console.log("❌ Usuario no tiene tenant asociado")
      console.log("   Creando relación tenant-user...")

      await db.insert(tenantUsers).values({
        userId: user.id,
        tenantId: tenant.id,
        role: "SUPERADMIN",
      })

      console.log("✅ Relación tenant-user creada")
    } else {
      console.log("✅ Relación tenant-user existe:", tenantUser.role)
    }

    // 4. Verificar la contraseña
    const { compare } = await import("bcrypt")

    if (!user.passwordhash) {
      console.log("❌ Usuario no tiene passwordhash")
      console.log("   Password campo:", user.password ? "existe (pero debería ser passwordhash)" : "no existe")
      return
    }

    const validPassword = await compare(SUPERADMIN_PASSWORD, user.passwordhash)

    if (validPassword) {
      console.log("✅ Contraseña válida!")
      console.log("")
      console.log("🎉 El login debería funcionar")
      console.log("   Email:", SUPERADMIN_EMAIL)
      console.log("   Password:", SUPERADMIN_PASSWORD)
      console.log("   Tenant:", TENANT_SLUG)
    } else {
      console.log("❌ Contraseña inválida")
      console.log("   Guardada:", user.passwordhash.substring(0, 20) + "...")
    }

  } catch (error) {
    console.error("❌ Error:", error)
  } finally {
    process.exit(0)
  }
}

testLogin()
