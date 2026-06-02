/**
 * WhatsApp Integration Tests
 * FASE 6: Tests de integración
 */

import request from 'supertest';
import { createApp } from '../../src/app';
import { testDB } from '../utils/test-db';
import {
  generateTestToken,
  createMockWhatsAppWebhook,
  randomPhone,
} from '../utils/test-helpers';

describe('WhatsApp Integration Tests', () => {
  let app: ReturnType<typeof createApp>;
  let testTenant: any;
  let testUser: any;
  let testConfig: any;
  let authToken: string;

  beforeAll(async () => {
    app = createApp();
  });

  beforeEach(async () => {
    // Create test data
    testTenant = await testDB.createTenant({
      slug: `test-wa-${Date.now()}`,
      name: 'WhatsApp Test Tenant',
    });

    testUser = await testDB.createUser({
      email: `wa-test-${Date.now()}@test.com`,
      password: 'hashedpassword',
      name: 'WA Test User',
    });

    await testDB.createTenantUser(testTenant.id, testUser.id, 'OWNER');

    testConfig = await testDB.createWhatsAppConfig(testTenant.id, {
      phoneNumberId: 'test-phone-id-123',
      accessToken: 'test-access-token',
      webhookVerifyToken: 'test-verify-token',
      isActive: true,
      isDraft: false,
      agentInstructions: 'You are a helpful assistant.',
      knowledgeBase: {
        businessInfo: {
          name: 'Test Business',
          description: 'A test business',
        },
        products: [
          { name: 'Product A', price: '$100', stock: '10' },
        ],
        faq: {
          '¿Cuál es el horario?': 'Lunes a Viernes 9-18',
        },
      },
    });

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
  // Webhook Verification
  // ============================================
  describe('GET /api/v1/whatsapp/webhook/:tenantId', () => {
    it('should verify webhook with correct token', async () => {
      const response = await request(app)
        .get(`/api/v1/whatsapp/webhook/${testTenant.id}`)
        .query({
          'hub.mode': 'subscribe',
          'hub.verify_token': testConfig.webhookVerifyToken,
          'hub.challenge': 'challenge-accepted',
        });

      expect(response.status).toBe(200);
      expect(response.text).toBe('challenge-accepted');
    });

    it('should reject webhook verification with wrong token', async () => {
      const response = await request(app)
        .get(`/api/v1/whatsapp/webhook/${testTenant.id}`)
        .query({
          'hub.mode': 'subscribe',
          'hub.verify_token': 'wrong-token',
          'hub.challenge': 'challenge-accepted',
        });

      expect(response.status).toBe(403);
    });

    it('should reject for non-existent tenant', async () => {
      const response = await request(app)
        .get('/api/v1/whatsapp/webhook/non-existent-tenant')
        .query({
          'hub.mode': 'subscribe',
          'hub.verify_token': 'some-token',
          'hub.challenge': 'challenge-accepted',
        });

      expect(response.status).toBe(404);
    });
  });

  // ============================================
  // Webhook Message Processing
  // ============================================
  describe('POST /api/v1/whatsapp/webhook/:tenantId', () => {
    it('should accept incoming message webhook', async () => {
      const webhookPayload = createMockWhatsAppWebhook(testTenant.id, {
        phoneNumber: '521234567890',
        message: 'Hola, ¿qué productos tienen?',
      });

      const response = await request(app)
        .post(`/api/v1/whatsapp/webhook/${testTenant.id}`)
        .send(webhookPayload);

      expect(response.status).toBe(200);
      expect(response.body.received).toBe(true);
    });

    it('should handle status update webhooks', async () => {
      const statusPayload = {
        entry: [
          {
            changes: [
              {
                value: {
                  messaging_product: 'whatsapp',
                  statuses: [
                    {
                      id: 'wamid.123',
                      status: 'delivered',
                      timestamp: Math.floor(Date.now() / 1000).toString(),
                      recipient_id: '521234567890',
                    },
                  ],
                },
              },
            ],
          },
        ],
      };

      const response = await request(app)
        .post(`/api/v1/whatsapp/webhook/${testTenant.id}`)
        .send(statusPayload);

      expect(response.status).toBe(200);
    });

    it('should return 404 for non-existent tenant', async () => {
      const response = await request(app)
        .post('/api/v1/whatsapp/webhook/non-existent')
        .send(createMockWhatsAppWebhook('non-existent'));

      expect(response.status).toBe(404);
    });
  });

  // ============================================
  // Agent Configuration
  // ============================================
  describe('GET /api/v1/whatsapp/agents/status', () => {
    it('should return agent status for authenticated user', async () => {
      const response = await request(app)
        .get('/api/v1/whatsapp/agents/status')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.isActive).toBe(true);
      expect(response.body.mode).toBe('LIMITED');
    });

    it('should fail without authentication', async () => {
      const response = await request(app)
        .get('/api/v1/whatsapp/agents/status');

      expect(response.status).toBe(401);
    });
  });

  describe('PUT /api/v1/whatsapp/agents/config', () => {
    it('should update agent configuration', async () => {
      const response = await request(app)
        .put('/api/v1/whatsapp/agents/config')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          agentName: 'Updated Agent',
          agentRole: 'ventas',
          agentInstructions: 'New instructions for the agent',
          knowledgeBase: {
            businessInfo: {
              name: 'Updated Business',
            },
          },
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('should fail without authentication', async () => {
      const response = await request(app)
        .put('/api/v1/whatsapp/agents/config')
        .send({
          agentName: 'Updated Agent',
        });

      expect(response.status).toBe(401);
    });
  });

  describe('POST /api/v1/whatsapp/agents/toggle', () => {
    it('should toggle agent active status', async () => {
      const response = await request(app)
        .post('/api/v1/whatsapp/agents/toggle')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          isActive: false,
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });
  });

  describe('POST /api/v1/whatsapp/agents/draft-mode', () => {
    it('should toggle draft mode', async () => {
      const response = await request(app)
        .post('/api/v1/whatsapp/agents/draft-mode')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          isDraft: true,
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });
  });

  // ============================================
  // Conversations
  // ============================================
  describe('GET /api/v1/whatsapp/conversations', () => {
    beforeEach(async () => {
      // Create test conversations
      await testDB.createConversation(testTenant.id, testConfig.id, {
        phoneNumber: '+521111111111',
        contactName: 'Contact 1',
      });
      await testDB.createConversation(testTenant.id, testConfig.id, {
        phoneNumber: '+522222222222',
        contactName: 'Contact 2',
      });
    });

    it('should list conversations for tenant', async () => {
      const response = await request(app)
        .get('/api/v1/whatsapp/conversations')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.conversations).toBeDefined();
      expect(response.body.conversations.length).toBe(2);
    });

    it('should support pagination', async () => {
      const response = await request(app)
        .get('/api/v1/whatsapp/conversations')
        .query({ limit: 1, offset: 0 })
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.conversations.length).toBe(1);
    });

    it('should filter by status', async () => {
      const response = await request(app)
        .get('/api/v1/whatsapp/conversations')
        .query({ status: 'ACTIVE' })
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
    });
  });

  describe('GET /api/v1/whatsapp/conversations/:id', () => {
    let testConversation: any;

    beforeEach(async () => {
      testConversation = await testDB.createConversation(
        testTenant.id,
        testConfig.id,
        { phoneNumber: '+521111111111' }
      );

      // Add some messages
      await testDB.createMessage(testTenant.id, testConversation.id, {
        fromPhone: '+521111111111',
        toPhone: '+529999999999',
        direction: 'INCOMING',
        content: 'Hello',
      });
      await testDB.createMessage(testTenant.id, testConversation.id, {
        fromPhone: '+529999999999',
        toPhone: '+521111111111',
        direction: 'OUTGOING',
        content: 'Hi there!',
      });
    });

    it('should return conversation with messages', async () => {
      const response = await request(app)
        .get(`/api/v1/whatsapp/conversations/${testConversation.id}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.conversation).toBeDefined();
      expect(response.body.messages).toBeDefined();
      expect(response.body.messages.length).toBe(2);
    });

    it('should return 404 for non-existent conversation', async () => {
      const response = await request(app)
        .get('/api/v1/whatsapp/conversations/non-existent-id')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(404);
    });
  });

  // ============================================
  // Test Agent Response
  // ============================================
  describe('POST /api/v1/whatsapp/agents/test', () => {
    it('should test agent with a message', async () => {
      const response = await request(app)
        .post('/api/v1/whatsapp/agents/test')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          message: '¿Qué productos tienen disponibles?',
        });

      // Response depends on whether LLM is configured
      expect([200, 503]).toContain(response.status);

      if (response.status === 200) {
        expect(response.body.response).toBeDefined();
      }
    }, 30000); // Longer timeout for LLM calls

    it('should fail without message', async () => {
      const response = await request(app)
        .post('/api/v1/whatsapp/agents/test')
        .set('Authorization', `Bearer ${authToken}`)
        .send({});

      expect(response.status).toBe(400);
    });
  });

  // ============================================
  // LLM Status Check
  // ============================================
  describe('GET /api/v1/whatsapp/agents/llm-status', () => {
    it('should return LLM availability status', async () => {
      const response = await request(app)
        .get('/api/v1/whatsapp/agents/llm-status')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.available).toBeDefined();
      expect(typeof response.body.available).toBe('boolean');
    });
  });
});
