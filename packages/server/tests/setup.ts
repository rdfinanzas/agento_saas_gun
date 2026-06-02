/**
 * Test Setup - Configuración global para tests
 *
 * Se ejecuta antes de todos los tests
 */

import { beforeAll, afterAll, afterEach } from "bun:test"
import { spawn, Subprocess } from "bun"

// Configuración global
declare global {
  var testServer: Subprocess | null
  var testServerPort: number
}

// Puerto para el servidor de prueba
const TEST_PORT = 3099
const TEST_WS_PORT = 3100

beforeAll(async () => {
  console.log("🧪 Setting up test environment...")

  // Configurar variables de entorno para tests
  process.env.NODE_ENV = "test"
  process.env.PORT = String(TEST_PORT)
  process.env.DATABASE_URL = process.env.TEST_DATABASE_URL || "postgresql://test:test@localhost:5432/agento_test"
  process.env.JWT_SECRET = "test-secret-key-for-testing-only"
  process.env.REDIS_URL = process.env.TEST_REDIS_URL || "redis://localhost:6379/15"

  global.testServerPort = TEST_PORT

  console.log(`✅ Test environment ready (port: ${TEST_PORT})`)
})

afterEach(async () => {
  // Limpiar después de cada test
})

afterAll(async () => {
  console.log("🧹 Cleaning up test environment...")

  // Cerrar servidor de prueba si existe
  if (global.testServer) {
    global.testServer.kill()
    global.testServer = null
  }

  console.log("✅ Test cleanup complete")
})

export { TEST_PORT, TEST_WS_PORT }
