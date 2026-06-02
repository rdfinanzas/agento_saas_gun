/**
 * Embeddings/Knowledge Integration Tests
 * FASE 6: Tests de integración
 */

import request from 'supertest';
import { createApp } from '../../src/app';
import { testDB } from '../utils/test-db';
import {
  generateTestToken,
  createMockEmbedding,
  randomString,
} from '../utils/test-helpers';

describe('Knowledge/Embeddings Integration Tests', () => {
  let app: ReturnType<typeof createApp>;
  let testTenant: any;
  let testUser: any;
  let authToken: string;

  beforeAll(async () => {
    app = createApp();
  });

  beforeEach(async () => {
    testTenant = await testDB.createTenant({
      slug: `test-kb-${Date.now()}`,
      name: 'Knowledge Test Tenant',
    });

    testUser = await testDB.createUser({
      email: `kb-test-${Date.now()}@test.com`,
      password: 'hashedpassword',
      name: 'KB Test User',
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
  // Search
  // ============================================
  describe('GET /api/v1/knowledge/search', () => {
    beforeEach(async () => {
      // Create test embeddings
      await testDB.createEmbedding(testTenant.id, {
        content: 'Nuestro horario de atención es de lunes a viernes de 9am a 6pm.',
        source: 'faq',
        metadata: { category: 'horarios' },
      });
      await testDB.createEmbedding(testTenant.id, {
        content: 'El producto A cuesta $100 pesos y el producto B cuesta $200 pesos.',
        source: 'productos',
        metadata: { category: 'precios' },
      });
      await testDB.createEmbedding(testTenant.id, {
        content: 'Para devoluciones, tiene 30 días a partir de la compra.',
        source: 'politicas',
        metadata: { category: 'devoluciones' },
      });
    });

    it('should search for relevant content', async () => {
      const response = await request(app)
        .get('/api/v1/knowledge/search')
        .query({ query: 'horario atención' })
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.results).toBeDefined();
    });

    it('should support limit parameter', async () => {
      const response = await request(app)
        .get('/api/v1/knowledge/search')
        .query({ query: 'producto', limit: 1 })
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.results.length).toBeLessThanOrEqual(1);
    });

    it('should support threshold parameter', async () => {
      const response = await request(app)
        .get('/api/v1/knowledge/search')
        .query({ query: 'xyznonexistent', threshold: 0.9 })
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      // With high threshold, should return few or no results
    });

    it('should fail without query parameter', async () => {
      const response = await request(app)
        .get('/api/v1/knowledge/search')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(400);
    });

    it('should fail without authentication', async () => {
      const response = await request(app)
        .get('/api/v1/knowledge/search')
        .query({ query: 'test' });

      expect(response.status).toBe(401);
    });
  });

  // ============================================
  // Context
  // ============================================
  describe('GET /api/v1/knowledge/context', () => {
    beforeEach(async () => {
      await testDB.createEmbedding(testTenant.id, {
        content: 'Información importante sobre el servicio al cliente.',
        source: 'manual',
      });
    });

    it('should get relevant context for a query', async () => {
      const response = await request(app)
        .get('/api/v1/knowledge/context')
        .query({ query: 'servicio cliente' })
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.context).toBeDefined();
    });

    it('should support maxTokens parameter', async () => {
      const response = await request(app)
        .get('/api/v1/knowledge/context')
        .query({ query: 'servicio', maxTokens: 500 })
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
    });

    it('should fail without query parameter', async () => {
      const response = await request(app)
        .get('/api/v1/knowledge/context')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(400);
    });
  });

  // ============================================
  // Indexing
  // ============================================
  describe('POST /api/v1/knowledge/index', () => {
    it('should index new content', async () => {
      const response = await request(app)
        .post('/api/v1/knowledge/index')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          content: 'Este es un documento de prueba para indexar en la base de conocimiento.',
          source: 'test-document',
          metadata: {
            type: 'test',
            language: 'es',
          },
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.chunksCreated).toBeGreaterThan(0);
    });

    it('should fail without content', async () => {
      const response = await request(app)
        .post('/api/v1/knowledge/index')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          source: 'test-document',
        });

      expect(response.status).toBe(400);
    });

    it('should fail without source', async () => {
      const response = await request(app)
        .post('/api/v1/knowledge/index')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          content: 'Test content',
        });

      expect(response.status).toBe(400);
    });

    it('should support custom chunk settings', async () => {
      const longContent = 'Este es un contenido largo. '.repeat(100);

      const response = await request(app)
        .post('/api/v1/knowledge/index')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          content: longContent,
          source: 'long-document',
          chunkSize: 200,
          overlap: 50,
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });
  });

  describe('POST /api/v1/knowledge/index-agent', () => {
    it('should index agent knowledge base', async () => {
      const response = await request(app)
        .post('/api/v1/knowledge/index-agent')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          faq: {
            '¿Cuál es el horario?': 'Lunes a viernes 9-18',
            '¿Hacen envíos?': 'Sí, envíos gratis arriba de $500',
          },
          products: [
            { name: 'Producto A', price: '$100', description: 'Descripción del producto A' },
          ],
          policies: {
            'Devoluciones': '30 días para devoluciones',
          },
          businessInfo: {
            name: 'Mi Negocio',
            description: 'Tienda de productos varios',
          },
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.indexed).toBeGreaterThan(0);
    });
  });

  describe('POST /api/v1/knowledge/reindex', () => {
    beforeEach(async () => {
      await testDB.createEmbedding(testTenant.id, {
        content: 'Old content to be replaced',
        source: 'updateable-source',
      });
    });

    it('should reindex content (delete old and create new)', async () => {
      const response = await request(app)
        .post('/api/v1/knowledge/reindex')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          content: 'New updated content for this source.',
          source: 'updateable-source',
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.chunksDeleted).toBeGreaterThanOrEqual(0);
      expect(response.body.chunksCreated).toBeGreaterThan(0);
    });
  });

  // ============================================
  // Stats
  // ============================================
  describe('GET /api/v1/knowledge/stats', () => {
    beforeEach(async () => {
      await testDB.createEmbedding(testTenant.id, {
        content: 'Test content 1',
        source: 'source-a',
      });
      await testDB.createEmbedding(testTenant.id, {
        content: 'Test content 2',
        source: 'source-b',
      });
    });

    it('should return embedding statistics', async () => {
      const response = await request(app)
        .get('/api/v1/knowledge/stats')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.totalEmbeddings).toBeDefined();
      expect(response.body.sources).toBeDefined();
    });
  });

  // ============================================
  // Delete
  // ============================================
  describe('DELETE /api/v1/knowledge/source/:source', () => {
    beforeEach(async () => {
      await testDB.createEmbedding(testTenant.id, {
        content: 'Content to delete',
        source: 'deletable-source',
      });
    });

    it('should delete embeddings by source', async () => {
      const response = await request(app)
        .delete('/api/v1/knowledge/source/deletable-source')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.deleted).toBeGreaterThanOrEqual(0);
    });
  });

  // ============================================
  // Tests
  // ============================================
  describe('POST /api/v1/knowledge/test/embedding', () => {
    it('should test embedding generation', async () => {
      const response = await request(app)
        .post('/api/v1/knowledge/test/embedding')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          text: 'Este es un texto de prueba para generar embeddings.',
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.embedding).toBeDefined();
      expect(response.body.embedding.dimensions).toBeDefined();
    });

    it('should fail without text', async () => {
      const response = await request(app)
        .post('/api/v1/knowledge/test/embedding')
        .set('Authorization', `Bearer ${authToken}`)
        .send({});

      expect(response.status).toBe(400);
    });
  });

  describe('POST /api/v1/knowledge/test/similarity', () => {
    it('should test similarity between two texts', async () => {
      const response = await request(app)
        .post('/api/v1/knowledge/test/similarity')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          text1: 'El perro ladra en la noche',
          text2: 'El canino hace ruido durante la noche',
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.similarity).toBeDefined();
      expect(response.body.similarity).toBeGreaterThanOrEqual(0);
      expect(response.body.similarity).toBeLessThanOrEqual(1);
      expect(response.body.interpretation).toBeDefined();
    });

    it('should fail without both texts', async () => {
      const response = await request(app)
        .post('/api/v1/knowledge/test/similarity')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          text1: 'Only one text',
        });

      expect(response.status).toBe(400);
    });

    it('should return high similarity for identical texts', async () => {
      const response = await request(app)
        .post('/api/v1/knowledge/test/similarity')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          text1: 'Exactamente el mismo texto',
          text2: 'Exactamente el mismo texto',
        });

      expect(response.status).toBe(200);
      expect(response.body.similarity).toBeGreaterThan(0.9);
    });
  });
});
