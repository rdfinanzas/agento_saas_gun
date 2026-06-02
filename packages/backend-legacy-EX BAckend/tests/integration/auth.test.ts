/**
 * Auth Integration Tests
 * FASE 6: Tests de integración
 */

import request from 'supertest';
import { createApp } from '../../src/app';
import { testDB } from '../utils/test-db';
import {
  generateTestToken,
  hashPassword,
  randomEmail,
  randomString,
} from '../utils/test-helpers';

describe('Auth Integration Tests', () => {
  let app: ReturnType<typeof createApp>;
  let testTenant: any;
  let testUser: any;

  beforeAll(async () => {
    app = createApp();
  });

  beforeEach(async () => {
    // Create test tenant
    testTenant = await testDB.createTenant({
      slug: `test-auth-${Date.now()}`,
      name: 'Auth Test Tenant',
      email: randomEmail(),
    });

    // Create test user with hashed password
    const hashedPassword = await hashPassword('TestPassword123!');
    testUser = await testDB.createUser({
      email: randomEmail(),
      password: hashedPassword,
      name: 'Test User',
    });

    // Link user to tenant
    await testDB.createTenantUser(testTenant.id, testUser.id, 'OWNER');
  });

  afterEach(async () => {
    await testDB.cleanup();
  });

  afterAll(async () => {
    await testDB.disconnect();
  });

  // ============================================
  // POST /api/v1/auth/register
  // ============================================
  describe('POST /api/v1/auth/register', () => {
    it('should register a new user successfully', async () => {
      const response = await request(app)
        .post('/api/v1/auth/register')
        .send({
          email: randomEmail(),
          password: 'NewPassword123!',
          name: 'New User',
          tenantSlug: `new-tenant-${Date.now()}`,
          tenantName: 'New Tenant',
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.token).toBeDefined();
      expect(response.body.user).toBeDefined();
      expect(response.body.user.email).toBeDefined();
    });

    it('should fail with missing required fields', async () => {
      const response = await request(app)
        .post('/api/v1/auth/register')
        .send({
          email: randomEmail(),
          // Missing password, name, tenantSlug
        });

      expect(response.status).toBe(400);
    });

    it('should fail with duplicate email', async () => {
      const response = await request(app)
        .post('/api/v1/auth/register')
        .send({
          email: testUser.email,
          password: 'Password123!',
          name: 'Another User',
          tenantSlug: `another-tenant-${Date.now()}`,
          tenantName: 'Another Tenant',
        });

      expect(response.status).toBe(409);
    });

    it('should fail with weak password', async () => {
      const response = await request(app)
        .post('/api/v1/auth/register')
        .send({
          email: randomEmail(),
          password: '123', // Too weak
          name: 'New User',
          tenantSlug: `new-tenant-${Date.now()}`,
          tenantName: 'New Tenant',
        });

      expect(response.status).toBe(400);
    });
  });

  // ============================================
  // POST /api/v1/auth/login
  // ============================================
  describe('POST /api/v1/auth/login', () => {
    it('should login successfully with correct credentials', async () => {
      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: testUser.email,
          password: 'TestPassword123!',
          tenantSlug: testTenant.slug,
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.token).toBeDefined();
      expect(response.body.user.email).toBe(testUser.email);
    });

    it('should fail with incorrect password', async () => {
      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: testUser.email,
          password: 'WrongPassword123!',
          tenantSlug: testTenant.slug,
        });

      expect(response.status).toBe(401);
    });

    it('should fail with non-existent user', async () => {
      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'nonexistent@test.com',
          password: 'SomePassword123!',
          tenantSlug: testTenant.slug,
        });

      expect(response.status).toBe(401);
    });

    it('should fail with missing fields', async () => {
      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: testUser.email,
          // Missing password
        });

      expect(response.status).toBe(400);
    });
  });

  // ============================================
  // GET /api/v1/auth/me
  // ============================================
  describe('GET /api/v1/auth/me', () => {
    it('should return current user with valid token', async () => {
      const token = generateTestToken({
        userId: testUser.id,
        tenantId: testTenant.id,
        email: testUser.email,
      });

      const response = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.user).toBeDefined();
      expect(response.body.user.email).toBe(testUser.email);
    });

    it('should fail without token', async () => {
      const response = await request(app)
        .get('/api/v1/auth/me');

      expect(response.status).toBe(401);
    });

    it('should fail with invalid token', async () => {
      const response = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', 'Bearer invalid-token');

      expect(response.status).toBe(401);
    });

    it('should fail with expired token', async () => {
      // Token that expired in the past
      const expiredToken = generateTestToken(
        {
          userId: testUser.id,
          tenantId: testTenant.id,
          email: testUser.email,
        },
        '-1h' // Expired 1 hour ago
      );

      const response = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${expiredToken}`);

      expect(response.status).toBe(401);
    });
  });

  // ============================================
  // POST /api/v1/auth/logout
  // ============================================
  describe('POST /api/v1/auth/logout', () => {
    it('should logout successfully', async () => {
      const token = generateTestToken({
        userId: testUser.id,
        tenantId: testTenant.id,
        email: testUser.email,
      });

      const response = await request(app)
        .post('/api/v1/auth/logout')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });
  });

  // ============================================
  // PUT /api/v1/auth/password
  // ============================================
  describe('PUT /api/v1/auth/password', () => {
    it('should change password successfully', async () => {
      const token = generateTestToken({
        userId: testUser.id,
        tenantId: testTenant.id,
        email: testUser.email,
      });

      const response = await request(app)
        .put('/api/v1/auth/password')
        .set('Authorization', `Bearer ${token}`)
        .send({
          currentPassword: 'TestPassword123!',
          newPassword: 'NewPassword456!',
          confirmPassword: 'NewPassword456!',
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('should fail with incorrect current password', async () => {
      const token = generateTestToken({
        userId: testUser.id,
        tenantId: testTenant.id,
        email: testUser.email,
      });

      const response = await request(app)
        .put('/api/v1/auth/password')
        .set('Authorization', `Bearer ${token}`)
        .send({
          currentPassword: 'WrongPassword123!',
          newPassword: 'NewPassword456!',
          confirmPassword: 'NewPassword456!',
        });

      expect(response.status).toBe(401);
    });

    it('should fail with mismatched new passwords', async () => {
      const token = generateTestToken({
        userId: testUser.id,
        tenantId: testTenant.id,
        email: testUser.email,
      });

      const response = await request(app)
        .put('/api/v1/auth/password')
        .set('Authorization', `Bearer ${token}`)
        .send({
          currentPassword: 'TestPassword123!',
          newPassword: 'NewPassword456!',
          confirmPassword: 'DifferentPassword789!',
        });

      expect(response.status).toBe(400);
    });
  });
});
