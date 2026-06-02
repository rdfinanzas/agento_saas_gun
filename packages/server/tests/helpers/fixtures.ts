/**
 * Test Fixtures - Datos de prueba para tests
 */

export const testUser = {
  email: "test@example.com",
  password: "TestPassword123!",
  name: "Test User",
}

export const testAdmin = {
  email: "admin@example.com",
  password: "AdminPassword123!",
  name: "Admin User",
}

export const testTenant = {
  name: "Test Tenant",
  slug: "test-tenant",
  plan: "PRO" as const,
}

export const testAgent = {
  name: "Test Agent",
  description: "A test agent for E2E testing",
  systemPrompt: "You are a helpful test assistant.",
  model: "gpt-4",
  temperature: 0.7,
}

export const testConversation = {
  messages: [
    { role: "user" as const, content: "Hello, this is a test message" },
  ],
}

export const testWhatsAppConfig = {
  phoneNumberId: "123456789",
  accessToken: "test-access-token",
  webhookVerifyToken: "test-verify-token",
}

// Helper para generar datos únicos
export function generateUniqueEmail(): string {
  return `test-${Date.now()}-${Math.random().toString(36).substring(7)}@example.com`
}

export function generateUniqueSlug(): string {
  return `test-${Date.now()}-${Math.random().toString(36).substring(7)}`
}

// Helper para crear usuario de prueba
export async function createTestUser(
  baseUrl: string,
  userData?: Partial<typeof testUser>
): Promise<{ user: any; token: string }> {
  const data = {
    ...testUser,
    ...userData,
    tenantName: `Test Tenant ${Date.now()}`,
    tenantSlug: `test-tenant-${Date.now()}-${Math.random().toString(36).substring(7)}`,
  }

  const response = await fetch(`${baseUrl}/api/v1/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  })

  if (!response.ok) {
    throw new Error(`Failed to create test user: ${await response.text()}`)
  }

  const result = await response.json()
  return result
}

// Helper para hacer login
export async function loginTestUser(
  baseUrl: string,
  email: string,
  password: string
): Promise<{ token: string; user: any }> {
  const response = await fetch(`${baseUrl}/api/v1/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  })

  if (!response.ok) {
    throw new Error(`Failed to login: ${await response.text()}`)
  }

  const data = await response.json()
  return data
}

// Helper para crear headers autenticados
export function authHeaders(token: string): Record<string, string> {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  }
}
