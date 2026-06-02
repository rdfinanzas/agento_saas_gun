/**
 * Test Helpers - Utilidades para tests
 * FASE 6: Tests de integración
 */

import { sign } from 'jsonwebtoken';
import { hash, compare } from 'bcrypt';

// ============================================
// JWT Helpers
// ============================================

const JWT_SECRET = process.env.JWT_SECRET || 'test-secret-key-for-testing-min-32-chars';

export interface TestTokenPayload {
  userId: string;
  tenantId: string;
  email: string;
  role?: string;
}

/**
 * Generate a test JWT token
 */
export function generateTestToken(payload: TestTokenPayload, expiresIn: string = '1h'): string {
  return sign(payload, JWT_SECRET, { expiresIn });
}

/**
 * Generate admin token
 */
export function generateAdminToken(userId: string, tenantId: string): string {
  return generateTestToken({
    userId,
    tenantId,
    email: 'admin@test.com',
    role: 'ADMIN',
  });
}

/**
 * Generate owner token
 */
export function generateOwnerToken(userId: string, tenantId: string): string {
  return generateTestToken({
    userId,
    tenantId,
    email: 'owner@test.com',
    role: 'OWNER',
  });
}

// ============================================
// Password Helpers
// ============================================

/**
 * Hash a password for testing
 */
export async function hashPassword(password: string): Promise<string> {
  return hash(password, 10);
}

/**
 * Verify a password
 */
export async function verifyPassword(password: string, hashedPassword: string): Promise<boolean> {
  return compare(password, hashedPassword);
}

// ============================================
// Mock Factories
// ============================================

/**
 * Create mock WhatsApp webhook payload
 */
export function createMockWhatsAppWebhook(tenantId: string, options?: {
  phoneNumber?: string;
  message?: string;
  messageId?: string;
}) {
  return {
    entry: [
      {
        id: 'entry-id',
        changes: [
          {
            value: {
              messaging_product: 'whatsapp',
              metadata: {
                display_phone_number: '15551234567',
                phone_number_id: 'test-phone-id',
              },
              contacts: [
                {
                  profile: {
                    name: 'Test Contact',
                  },
                  wa_id: options?.phoneNumber || '521234567890',
                },
              ],
              messages: [
                {
                  from: options?.phoneNumber || '521234567890',
                  id: options?.messageId || `wamid.${Date.now()}`,
                  timestamp: Math.floor(Date.now() / 1000).toString(),
                  text: {
                    body: options?.message || 'Hola, ¿cómo están?',
                  },
                  type: 'text',
                },
              ],
            },
            field: 'messages',
          },
        ],
      },
    ],
  };
}

/**
 * Create mock MercadoPago webhook payload
 */
export function createMockMPWebhook(paymentId: string, type: string = 'payment') {
  return {
    type,
    data: {
      id: paymentId,
    },
  };
}

/**
 * Create mock MercadoPago payment response
 */
export function createMockMPPayment(options?: {
  id?: string;
  status?: string;
  amount?: number;
  currency?: string;
  email?: string;
  tenantId?: string;
  planId?: string;
}) {
  return {
    id: parseInt(options?.id || Date.now().toString()),
    status: options?.status || 'approved',
    status_detail: 'accredited',
    transaction_amount: options?.amount || 299,
    currency_id: options?.currency || 'MXN',
    date_created: new Date().toISOString(),
    date_approved: new Date().toISOString(),
    payer: {
      id: 123456789,
      email: options?.email || 'test@test.com',
    },
    external_reference: options?.tenantId || 'test-tenant-id',
    metadata: {
      tenant_id: options?.tenantId || 'test-tenant-id',
      plan_id: options?.planId || 'pro-monthly',
    },
  };
}

/**
 * Create mock LLM response
 */
export function createMockLLMResponse(content: string = 'This is a test response') {
  return {
    content,
    usage: {
      promptTokens: 100,
      completionTokens: 50,
      totalTokens: 150,
    },
    model: 'gpt-4',
    finishReason: 'stop',
  };
}

/**
 * Create mock embedding vector
 */
export function createMockEmbedding(dimensions: number = 1536): number[] {
  return Array(dimensions).fill(0).map(() => Math.random() * 2 - 1);
}

// ============================================
// Wait Helpers
// ============================================

/**
 * Wait for a specified time
 */
export function wait(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Wait for a condition to be true
 */
export async function waitFor(
  condition: () => Promise<boolean> | boolean,
  options: { timeout?: number; interval?: number } = {}
): Promise<void> {
  const timeout = options.timeout || 5000;
  const interval = options.interval || 100;
  const start = Date.now();

  while (Date.now() - start < timeout) {
    if (await condition()) {
      return;
    }
    await wait(interval);
  }

  throw new Error(`Timeout waiting for condition after ${timeout}ms`);
}

// ============================================
// Assertion Helpers
// ============================================

/**
 * Assert that a value is defined
 */
export function assertDefined<T>(value: T | undefined | null, message?: string): asserts value is T {
  if (value === undefined || value === null) {
    throw new Error(message || 'Expected value to be defined');
  }
}

/**
 * Assert that an array has length
 */
export function assertArrayLength<T>(array: T[], length: number, message?: string): void {
  if (array.length !== length) {
    throw new Error(message || `Expected array length ${length}, got ${array.length}`);
  }
}

/**
 * Assert that a date is recent (within seconds)
 */
export function assertRecentDate(date: Date | string, withinSeconds: number = 10): void {
  const d = typeof date === 'string' ? new Date(date) : date;
  const now = new Date();
  const diff = Math.abs(now.getTime() - d.getTime()) / 1000;

  if (diff > withinSeconds) {
    throw new Error(`Date ${d.toISOString()} is not recent (diff: ${diff}s)`);
  }
}

// ============================================
// String Helpers
// ============================================

/**
 * Generate a random string
 */
export function randomString(length: number = 10): string {
  return Math.random().toString(36).substring(2, length + 2);
}

/**
 * Generate a random email
 */
export function randomEmail(): string {
  return `test-${randomString(8)}@test.com`;
}

/**
 * Generate a random phone number
 */
export function randomPhone(): string {
  return `+52${Math.floor(Math.random() * 9000000000 + 1000000000)}`;
}

/**
 * Generate a random UUID-like string
 */
export function randomUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}
