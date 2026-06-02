/**
 * Test Setup - Configuración global para tests
 * 
 * Este archivo se ejecuta antes de todos los tests para:
 * - Configurar el entorno de pruebas
 * - Mockear dependencias externas
 * - Establecer variables de entorno de test
 */

import { mock } from "bun:test"

// ============================================
// Environment Configuration
// ============================================
process.env.NODE_ENV = "test"
process.env.DATABASE_URL = "postgresql://test:test@localhost:5433/agento_test"
process.env.REDIS_URL = "redis://localhost:6379/1"
process.env.JWT_SECRET = "test-secret-key-for-testing-only"
process.env.ENCRYPTION_KEY = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef"

// ============================================
// Global Mocks
// ============================================

// Mock Bun.spawn para evitar ejecutar comandos reales
mock.module("bun", () => ({
  ...Bun,
  spawn: mock((cmd: string[], options?: any) => {
    return {
      stdout: {
        getReader: () => ({
          read: async () => ({ done: true, value: new Uint8Array() }),
        }),
      },
      stderr: {
        getReader: () => ({
          read: async () => ({ done: true, value: new Uint8Array() }),
        }),
      },
      exited: Promise.resolve(0),
      kill: () => {},
      exitCode: 0,
    }
  }),
}))

// Mock logger para tests silenciosos
mock.module("@/utils/logger", () => ({
  createLogger: () => ({
    info: () => {},
    error: () => {},
    warn: () => {},
    debug: () => {},
  }),
  logger: {
    info: () => {},
    error: () => {},
    warn: () => {},
    debug: () => {},
  },
}))

console.log("✅ Test environment configured")
