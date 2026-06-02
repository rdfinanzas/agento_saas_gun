/**
 * Test Setup - Configuración global de tests
 * FASE 6: Tests de integración
 */

import { config } from 'dotenv';

// Load test environment variables
config({ path: '.env.test' });

// Set test environment
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret-key-for-testing-min-32-chars';
process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgresql://postgres:password@localhost:5432/agento_test';
process.env.REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

// Mock console.log in tests to reduce noise (optional)
// console.log = jest.fn();

// Global test timeout
jest.setTimeout(30000);

// Clean up after all tests
afterAll(async () => {
  // Close any open connections
  const { PrismaClient } = require('@prisma/client');
  const prisma = new PrismaClient();
  await prisma.$disconnect();
});
