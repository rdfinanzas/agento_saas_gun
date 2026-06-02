/**
 * Knowledge Controller - Gestión de Base de Conocimiento
 * FASE 4: Embeddings y búsqueda semántica
 */

import { Request, Response } from 'express';
import { embeddingsService } from '../services/embeddings.service';

export class KnowledgeController {
  // ============================================
  // Búsqueda
  // ============================================

  /**
   * Búsqueda semántica en la base de conocimiento
   */
  async search(req: Request, res: Response): Promise<void> {
    try {
      const tenantId = req.tenantId!;
      const query = req.query.query as string;
      const limit = parseInt(req.query.limit as string) || 10;
      const threshold = parseFloat(req.query.threshold as string) || 0.5;
      const hybrid = req.query.hybrid === 'true';

      if (!query) {
        res.status(400).json({ error: 'Query parameter is required' });
        return;
      }

      let results;

      if (hybrid) {
        results = await embeddingsService.hybridSearch(tenantId, query, { limit });
      } else {
        results = await embeddingsService.searchSimilar(tenantId, query, limit, threshold);
      }

      res.json({
        success: true,
        query,
        results: results.map(r => ({
          id: r.id,
          content: r.content.substring(0, 500) + (r.content.length > 500 ? '...' : ''),
          similarity: r.similarity,
          source: r.source,
          metadata: r.metadata,
        })),
        total: results.length,
      });
    } catch (error: any) {
      console.error('[Knowledge] Search error:', error);
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Obtiene contexto relevante para una consulta
   */
  async getContext(req: Request, res: Response): Promise<void> {
    try {
      const tenantId = req.tenantId!;
      const query = req.query.query as string;
      const maxTokens = parseInt(req.query.maxTokens as string) || 2000;

      if (!query) {
        res.status(400).json({ error: 'Query parameter is required' });
        return;
      }

      const result = await embeddingsService.getRelevantContext(tenantId, query, { maxTokens });

      res.json({
        success: true,
        ...result,
      });
    } catch (error: any) {
      console.error('[Knowledge] GetContext error:', error);
      res.status(500).json({ error: error.message });
    }
  }

  // ============================================
  // Indexación
  // ============================================

  /**
   * Indexa contenido en la base de conocimiento
   */
  async indexContent(req: Request, res: Response): Promise<void> {
    try {
      const tenantId = req.tenantId!;
      const { content, source, metadata, chunkSize, overlap } = req.body;

      if (!content || !source) {
        res.status(400).json({ error: 'Content and source are required' });
        return;
      }

      const result = await embeddingsService.indexContent(tenantId, content, source, {
        metadata,
        chunkSize,
        overlap,
      });

      res.json({
        success: result.success,
        chunksCreated: result.chunksCreated,
        message: result.success
          ? `Indexed ${result.chunksCreated} chunks from source "${source}"`
          : 'No content to index',
      });
    } catch (error: any) {
      console.error('[Knowledge] IndexContent error:', error);
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Re-indexa contenido (actualiza)
   */
  async reindexContent(req: Request, res: Response): Promise<void> {
    try {
      const tenantId = req.tenantId!;
      const { content, source, metadata, chunkSize, overlap } = req.body;

      if (!content || !source) {
        res.status(400).json({ error: 'Content and source are required' });
        return;
      }

      const result = await embeddingsService.reindexContent(tenantId, content, source, {
        metadata,
        chunkSize,
        overlap,
      });

      res.json({
        success: result.success,
        chunksCreated: result.chunksCreated,
        chunksDeleted: result.chunksDeleted,
        message: `Re-indexed: ${result.chunksDeleted} deleted, ${result.chunksCreated} created`,
      });
    } catch (error: any) {
      console.error('[Knowledge] ReindexContent error:', error);
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Indexa la base de conocimiento del agente
   */
  async indexAgentKnowledge(req: Request, res: Response): Promise<void> {
    try {
      const tenantId = req.tenantId!;
      const { faq, products, policies, businessInfo, customDocuments } = req.body;

      const result = await embeddingsService.indexAgentKnowledge(tenantId, {
        faq,
        products,
        policies,
        businessInfo,
        customDocuments,
      });

      res.json({
        success: true,
        indexed: result.indexed,
        sources: result.sources,
        message: `Indexed knowledge from ${result.sources.length} sources`,
      });
    } catch (error: any) {
      console.error('[Knowledge] IndexAgentKnowledge error:', error);
      res.status(500).json({ error: error.message });
    }
  }

  // ============================================
  // Gestión de Embeddings
  // ============================================

  /**
   * Obtiene estadísticas de embeddings
   */
  async getStats(req: Request, res: Response): Promise<void> {
    try {
      const tenantId = req.tenantId!;
      const stats = await embeddingsService.getStats(tenantId);

      res.json({
        success: true,
        ...stats,
      });
    } catch (error: any) {
      console.error('[Knowledge] GetStats error:', error);
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Obtiene embeddings por fuente
   */
  async getBySource(req: Request, res: Response): Promise<void> {
    try {
      const tenantId = req.tenantId!;
      const source = req.params.source;

      const embeddings = await embeddingsService.getBySource(tenantId, source);

      res.json({
        success: true,
        source,
        total: embeddings.length,
        embeddings: embeddings.map(e => ({
          id: e.id,
          content: e.content.substring(0, 200) + (e.content.length > 200 ? '...' : ''),
          metadata: e.metadata,
          createdAt: e.createdAt,
        })),
      });
    } catch (error: any) {
      console.error('[Knowledge] GetBySource error:', error);
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Elimina embeddings por fuente
   */
  async deleteBySource(req: Request, res: Response): Promise<void> {
    try {
      const tenantId = req.tenantId!;
      const source = req.params.source;

      const deleted = await embeddingsService.deleteBySource(tenantId, source);

      res.json({
        success: true,
        deleted,
        message: `Deleted ${deleted} embeddings from source "${source}"`,
      });
    } catch (error: any) {
      console.error('[Knowledge] DeleteBySource error:', error);
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Elimina un embedding específico
   */
  async deleteEmbedding(req: Request, res: Response): Promise<void> {
    try {
      const tenantId = req.tenantId!;
      const id = req.params.id;

      const deleted = await embeddingsService.deleteEmbedding(tenantId, id);

      if (deleted) {
        res.json({ success: true, message: 'Embedding deleted' });
      } else {
        res.status(404).json({ error: 'Embedding not found' });
      }
    } catch (error: any) {
      console.error('[Knowledge] DeleteEmbedding error:', error);
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Elimina todos los embeddings del tenant
   */
  async deleteAll(req: Request, res: Response): Promise<void> {
    try {
      const tenantId = req.tenantId!;

      const deleted = await embeddingsService.deleteAll(tenantId);

      res.json({
        success: true,
        deleted,
        message: `Deleted all ${deleted} embeddings`,
      });
    } catch (error: any) {
      console.error('[Knowledge] DeleteAll error:', error);
      res.status(500).json({ error: error.message });
    }
  }

  // ============================================
  // Tests
  // ============================================

  /**
   * Prueba la generación de embeddings
   */
  async testEmbedding(req: Request, res: Response): Promise<void> {
    try {
      const { text, provider } = req.body;

      if (!text) {
        res.status(400).json({ error: 'Text is required' });
        return;
      }

      const startTime = Date.now();
      const embedding = await embeddingsService.generateEmbedding(text, { provider });
      const duration = Date.now() - startTime;

      res.json({
        success: true,
        text: text.substring(0, 100) + (text.length > 100 ? '...' : ''),
        embedding: {
          dimensions: embedding.length,
          sample: embedding.slice(0, 10),
        },
        provider: provider || 'default',
        duration: `${duration}ms`,
      });
    } catch (error: any) {
      console.error('[Knowledge] TestEmbedding error:', error);
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Prueba similitud entre dos textos
   */
  async testSimilarity(req: Request, res: Response): Promise<void> {
    try {
      const { text1, text2 } = req.body;

      if (!text1 || !text2) {
        res.status(400).json({ error: 'Both text1 and text2 are required' });
        return;
      }

      const [embedding1, embedding2] = await Promise.all([
        embeddingsService.generateEmbedding(text1),
        embeddingsService.generateEmbedding(text2),
      ]);

      const similarity = embeddingsService.cosineSimilarity(embedding1, embedding2);

      res.json({
        success: true,
        text1: text1.substring(0, 100),
        text2: text2.substring(0, 100),
        similarity,
        interpretation: this.interpretSimilarity(similarity),
      });
    } catch (error: any) {
      console.error('[Knowledge] TestSimilarity error:', error);
      res.status(500).json({ error: error.message });
    }
  }

  private interpretSimilarity(similarity: number): string {
    if (similarity >= 0.9) return 'Muy similar';
    if (similarity >= 0.7) return 'Similar';
    if (similarity >= 0.5) return 'Parcialmente similar';
    if (similarity >= 0.3) return 'Ligeramente similar';
    return 'No similar';
  }
}

export const knowledgeController = new KnowledgeController();
