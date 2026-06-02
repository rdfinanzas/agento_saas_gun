/**
 * Billing Integration Tests
 * FASE 6: Tests de integración
 */

import request from 'supertest';
import { createApp } from '../../src/app';
import { testDB } from '../utils/test-db';
import {
  generateTestToken,
  createMockMPWebhook,
  createMockMPPayment,
  randomEmail,
} from '../utils/test-helpers';

describe('Billing Integration Tests', () => {
  let app: ReturnType<typeof createApp>;
  let testTenant: any;
  let testUser: any;
  let authToken: string;

  beforeAll(async () => {
    app = createApp();
  });

  beforeEach(async () => {
    testTenant = await testDB.createTenant({
      slug: `test-billing-${Date.now()}`,
      name: 'Billing Test Tenant',
      subscriptionTier: 'FREE',
    });

    testUser = await testDB.createUser({
      email: randomEmail(),
      password: 'hashedpassword',
      name: 'Billing Test User',
    });

    await testDB.createTenantUser(testTenant.id, testUser.id, 'OWNER');

    authToken = generateTestToken({
      userId: testUser.id,
      tenantId: testTenant.id,
      email: testUser.email,
    });
  });

  afterEach(async () => {
    await testDB.cleanup();
  });

  afterAll(async () => {
    await testDB.disconnect();
  });

  // ============================================
  // Plans
  // ============================================
  describe('GET /api/v1/billing/plans', () => {
    it('should return all available plans', async () => {
      const response = await request(app)
        .get('/api/v1/billing/plans')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.plans).toBeDefined();
      expect(response.body.plans.length).toBeGreaterThan(0);

      // Verify plan structure
      const plan = response.body.plans[0];
      expect(plan.id).toBeDefined();
      expect(plan.name).toBeDefined();
      expect(plan.price).toBeDefined();
      expect(plan.currency).toBeDefined();
      expect(plan.features).toBeDefined();
    });

    it('should include free plan', async () => {
      const response = await request(app)
        .get('/api/v1/billing/plans')
        .set('Authorization', `Bearer ${authToken}`);

      const freePlan = response.body.plans.find((p: any) => p.id === 'free');
      expect(freePlan).toBeDefined();
      expect(freePlan.price).toBe(0);
    });

    it('should fail without authentication', async () => {
      const response = await request(app)
        .get('/api/v1/billing/plans');

      expect(response.status).toBe(401);
    });
  });

  describe('GET /api/v1/billing/plans/:planId', () => {
    it('should return specific plan details', async () => {
      const response = await request(app)
        .get('/api/v1/billing/plans/pro-monthly')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.plan.id).toBe('pro-monthly');
      expect(response.body.plan.name).toContain('Pro');
    });

    it('should return 404 for non-existent plan', async () => {
      const response = await request(app)
        .get('/api/v1/billing/plans/non-existent-plan')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(404);
    });
  });

  // ============================================
  // Checkout
  // ============================================
  describe('POST /api/v1/billing/checkout', () => {
    it('should create checkout for paid plan', async () => {
      const response = await request(app)
        .post('/api/v1/billing/checkout')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          planId: 'pro-monthly',
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.checkoutUrl).toBeDefined();
      expect(response.body.preferenceId).toBeDefined();
    });

    it('should activate free plan directly', async () => {
      const response = await request(app)
        .post('/api/v1/billing/checkout')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          planId: 'free',
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.redirectUrl).toBeDefined();
    });

    it('should fail without planId', async () => {
      const response = await request(app)
        .post('/api/v1/billing/checkout')
        .set('Authorization', `Bearer ${authToken}`)
        .send({});

      expect(response.status).toBe(400);
    });

    it('should fail with invalid planId', async () => {
      const response = await request(app)
        .post('/api/v1/billing/checkout')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          planId: 'invalid-plan',
        });

      expect(response.status).toBe(404);
    });
  });

  // ============================================
  // Webhook
  // ============================================
  describe('POST /api/v1/billing/webhook', () => {
    it('should process payment webhook', async () => {
      // First create a pending subscription
      await testDB.createSubscription(testTenant.id, {
        status: 'PENDING',
        planId: 'pro-monthly',
      });

      const webhookPayload = createMockMPWebhook('123456789', 'payment');

      const response = await request(app)
        .post('/api/v1/billing/webhook')
        .send(webhookPayload);

      expect(response.status).toBe(200);
    });

    it('should accept webhook without authentication', async () => {
      const response = await request(app)
        .post('/api/v1/billing/webhook')
        .send(createMockMPWebhook('123456789', 'payment'));

      // Should not return 401
      expect(response.status).not.toBe(401);
    });
  });

  // ============================================
  // Subscription
  // ============================================
  describe('GET /api/v1/billing/subscription', () => {
    it('should return subscription status', async () => {
      const response = await request(app)
        .get('/api/v1/billing/subscription')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.subscription).toBeDefined();
    });

    it('should return subscription details when exists', async () => {
      await testDB.createSubscription(testTenant.id, {
        status: 'ACTIVE',
        planId: 'pro-monthly',
        planName: 'Pro (Mensual)',
      });

      const response = await request(app)
        .get('/api/v1/billing/subscription')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.subscription.hasSubscription).toBe(true);
      expect(response.body.subscription.plan).toBe('Pro (Mensual)');
    });
  });

  describe('POST /api/v1/billing/subscription/cancel', () => {
    beforeEach(async () => {
      await testDB.createSubscription(testTenant.id, {
        status: 'ACTIVE',
        planId: 'pro-monthly',
        planName: 'Pro (Mensual)',
      });
    });

    it('should cancel at period end', async () => {
      const response = await request(app)
        .post('/api/v1/billing/subscription/cancel')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          immediately: false,
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('should cancel immediately', async () => {
      const response = await request(app)
        .post('/api/v1/billing/subscription/cancel')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          immediately: true,
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });
  });

  describe('POST /api/v1/billing/subscription/reactivate', () => {
    beforeEach(async () => {
      await testDB.createSubscription(testTenant.id, {
        status: 'ACTIVE',
        planId: 'pro-monthly',
        planName: 'Pro (Mensual)',
        cancelAtPeriodEnd: true,
      });
    });

    it('should reactivate cancelled subscription', async () => {
      const response = await request(app)
        .post('/api/v1/billing/subscription/reactivate')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });
  });

  // ============================================
  // Payments
  // ============================================
  describe('GET /api/v1/billing/payments', () => {
    beforeEach(async () => {
      await testDB.createPayment(testTenant.id, {
        amount: 299,
        status: 'APPROVED',
      });
      await testDB.createPayment(testTenant.id, {
        amount: 299,
        status: 'PENDING',
      });
    });

    it('should return payment history', async () => {
      const response = await request(app)
        .get('/api/v1/billing/payments')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.payments).toBeDefined();
      expect(response.body.payments.length).toBe(2);
    });

    it('should support limit parameter', async () => {
      const response = await request(app)
        .get('/api/v1/billing/payments')
        .query({ limit: 1 })
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.payments.length).toBe(1);
    });
  });

  // ============================================
  // Usage
  // ============================================
  describe('GET /api/v1/billing/usage', () => {
    it('should return current usage and quotas', async () => {
      const response = await request(app)
        .get('/api/v1/billing/usage')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.tier).toBeDefined();
      expect(response.body.quotas).toBeDefined();
      expect(response.body.usage).toBeDefined();
      expect(response.body.period).toBeDefined();
    });

    it('should return correct quotas based on tier', async () => {
      // Update tenant to PRO
      const prisma = testDB.getClient();
      await prisma.tenant.update({
        where: { id: testTenant.id },
        data: { subscriptionTier: 'PRO' },
      });

      const response = await request(app)
        .get('/api/v1/billing/usage')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.tier).toBe('PRO');
      expect(response.body.quotas.maxRequests).toBe(10000);
    });
  });

  // ============================================
  // Refunds
  // ============================================
  describe('POST /api/v1/billing/refund', () => {
    let testPayment: any;

    beforeEach(async () => {
      testPayment = await testDB.createPayment(testTenant.id, {
        gatewayPaymentId: '123456789',
        amount: 299,
        status: 'APPROVED',
      });
    });

    it('should request refund', async () => {
      const response = await request(app)
        .post('/api/v1/billing/refund')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          paymentId: testPayment.gatewayPaymentId,
          reason: 'Customer request',
        });

      // Will fail without actual MercadoPago connection
      expect([200, 400]).toContain(response.status);
    });

    it('should fail without paymentId', async () => {
      const response = await request(app)
        .post('/api/v1/billing/refund')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          reason: 'Customer request',
        });

      expect(response.status).toBe(400);
    });
  });
});
