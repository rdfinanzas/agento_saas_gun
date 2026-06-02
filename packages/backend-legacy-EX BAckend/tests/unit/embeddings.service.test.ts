/**
 * Embeddings Service Unit Tests
 * FASE 6: Tests de integración
 */

import { embeddingsService } from '../../src/modules/memory/services/embeddings.service';

describe('Embeddings Service Unit Tests', () => {
  const testTenantId = 'test-tenant-embeddings';

  // ============================================
  // Service Instance
  // ============================================
  describe('Service Instance', () => {
    it('should be defined', () => {
      expect(embeddingsService).toBeDefined();
    });

    it('should have required public methods', () => {
      expect(embeddingsService.generateEmbedding).toBeDefined();
      expect(embeddingsService.generateEmbeddings).toBeDefined();
      expect(embeddingsService.searchSimilar).toBeDefined();
      expect(embeddingsService.hybridSearch).toBeDefined();
      expect(embeddingsService.getRelevantContext).toBeDefined();
      expect(embeddingsService.indexContent).toBeDefined();
      expect(embeddingsService.reindexContent).toBeDefined();
      expect(embeddingsService.indexAgentKnowledge).toBeDefined();
      expect(embeddingsService.getStats).toBeDefined();
      expect(embeddingsService.getBySource).toBeDefined();
      expect(embeddingsService.deleteBySource).toBeDefined();
      expect(embeddingsService.deleteEmbedding).toBeDefined();
      expect(embeddingsService.deleteAll).toBeDefined();
      expect(embeddingsService.cosineSimilarity).toBeDefined();
    });
  });

  // ============================================
  // Cosine Similarity
  // ============================================
  describe('cosineSimilarity', () => {
    it('should return 1 for identical vectors', () => {
      const vector = [0.1, 0.2, 0.3, 0.4, 0.5];
      const similarity = embeddingsService.cosineSimilarity(vector, vector);

      expect(similarity).toBeCloseTo(1, 5);
    });

    it('should return 0 for orthogonal vectors', () => {
      const vector1 = [1, 0, 0, 0];
      const vector2 = [0, 1, 0, 0];
      const similarity = embeddingsService.cosineSimilarity(vector1, vector2);

      expect(similarity).toBeCloseTo(0, 5);
    });

    it('should return -1 for opposite vectors', () => {
      const vector1 = [1, 1, 1];
      const vector2 = [-1, -1, -1];
      const similarity = embeddingsService.cosineSimilarity(vector1, vector2);

      expect(similarity).toBeCloseTo(-1, 5);
    });

    it('should handle vectors of different lengths', () => {
      const vector1 = [0.1, 0.2, 0.3];
      const vector2 = [0.1, 0.2];

      const similarity = embeddingsService.cosineSimilarity(vector1, vector2);
      expect(similarity).toBe(0);
    });

    it('should handle empty vectors', () => {
      const similarity = embeddingsService.cosineSimilarity([], []);
      expect(similarity).toBe(0);
    });
  });

  // ============================================
  // Embedding Generation
  // ============================================
  describe('generateEmbedding', () => {
    it('should generate embedding with local provider', async () => {
      const text = 'Test for local embeddings';
      const embedding = await embeddingsService.generateEmbedding(text, {
        provider: 'local',
      });

      expect(embedding).toBeDefined();
      expect(Array.isArray(embedding)).toBe(true);
      expect(embedding.length).toBeGreaterThan(0);
    });

    it('should handle empty text gracefully', async () => {
      const embedding = await embeddingsService.generateEmbedding('', {
        provider: 'local',
      });

      expect(embedding).toBeDefined();
    });
  });

  // ============================================
  // Batch Embeddings
  // ============================================
  describe('generateEmbeddings', () => {
    it('should generate embeddings for multiple texts', async () => {
      const texts = [
        'First text',
        'Second text',
        'Third text',
      ];

      const embeddings = await embeddingsService.generateEmbeddings(texts, {
        provider: 'local',
      });

      expect(embeddings).toBeDefined();
      expect(embeddings.length).toBe(3);
    });

    it('should handle empty array', async () => {
      const embeddings = await embeddingsService.generateEmbeddings([], {
        provider: 'local',
      });

      expect(embeddings).toBeDefined();
      expect(embeddings.length).toBe(0);
    });
  });

  // ============================================
  // Stats
  // ============================================
  describe('getStats', () => {
    it('should return statistics', async () => {
      const stats = await embeddingsService.getStats(testTenantId);

      expect(stats).toBeDefined();
      expect(stats.totalEmbeddings).toBeDefined();
      expect(stats.sources).toBeDefined();
      expect(Array.isArray(stats.sources)).toBe(true);
    });
  });

  // ============================================
  // Get By Source
  // ============================================
  describe('getBySource', () => {
    it('should return embeddings by source', async () => {
      const embeddings = await embeddingsService.getBySource(testTenantId, 'non-existent');

      expect(embeddings).toBeDefined();
      expect(Array.isArray(embeddings)).toBe(true);
    });
  });

  // ============================================
  // Delete Operations
  // ============================================
  describe('deleteBySource', () => {
    it('should delete embeddings by source', async () => {
      const deleted = await embeddingsService.deleteBySource(
        testTenantId,
        'delete-test-source'
      );

      expect(deleted).toBeGreaterThanOrEqual(0);
    });
  });

  describe('deleteEmbedding', () => {
    it('should return false for non-existent embedding', async () => {
      const deleted = await embeddingsService.deleteEmbedding(
        testTenantId,
        'non-existent-id'
      );

      expect(deleted).toBe(false);
    });
  });

  describe('deleteAll', () => {
    it('should delete all embeddings for tenant', async () => {
      const deleted = await embeddingsService.deleteAll(testTenantId);
      expect(deleted).toBeGreaterThanOrEqual(0);
    });
  });

  // ============================================
  // Search
  // ============================================
  describe('searchSimilar', () => {
    it('should search for similar content', async () => {
      const results = await embeddingsService.searchSimilar(
        testTenantId,
        'test query',
        5,
        0
      );

      expect(results).toBeDefined();
      expect(Array.isArray(results)).toBe(true);
    });
  });

  // ============================================
  // Hybrid Search
  // ============================================
  describe('hybridSearch', () => {
    it('should combine semantic and keyword search', async () => {
      const results = await embeddingsService.hybridSearch(
        testTenantId,
        'test query',
        { limit: 5 }
      );

      expect(results).toBeDefined();
      expect(Array.isArray(results)).toBe(true);
    });
  });

  // ============================================
  // Context Retrieval
  // ============================================
  describe('getRelevantContext', () => {
    it('should get relevant context for query', async () => {
      const result = await embeddingsService.getRelevantContext(
        testTenantId,
        'test query',
        { maxTokens: 1000 }
      );

      expect(result).toBeDefined();
      expect(result.context).toBeDefined();
      expect(result.sources).toBeDefined();
      expect(result.totalResults).toBeDefined();
    });
  });

  // ============================================
  // Indexing
  // ============================================
  describe('indexContent', () => {
    it('should index content', async () => {
      const result = await embeddingsService.indexContent(
        testTenantId,
        'Test content for indexing with enough text to create a meaningful chunk for the embedding service.',
        'unit-test-source'
      );

      expect(result).toBeDefined();
      expect(typeof result.success).toBe('boolean');
      expect(result.chunksCreated).toBeGreaterThanOrEqual(0);
    });
  });

  describe('reindexContent', () => {
    it('should reindex content', async () => {
      const result = await embeddingsService.reindexContent(
        testTenantId,
        'Updated content for reindexing with enough text to create a meaningful chunk for the embedding service.',
        'unit-test-source'
      );

      expect(result).toBeDefined();
      expect(typeof result.success).toBe('boolean');
    });
  });

  describe('indexAgentKnowledge', () => {
    it('should index various knowledge types', async () => {
      const result = await embeddingsService.indexAgentKnowledge(testTenantId, {
        faq: {
          '¿Qué venden?': 'Vendemos productos electrónicos',
        },
        products: [
          { name: 'Laptop', price: '$15000' },
        ],
        policies: {
          'Garantía': '1 año de garantía',
        },
        businessInfo: {
          name: 'Test Store',
        },
      });

      expect(result).toBeDefined();
      expect(result.indexed).toBeGreaterThanOrEqual(0);
      expect(Array.isArray(result.sources)).toBe(true);
    });
  });
});
