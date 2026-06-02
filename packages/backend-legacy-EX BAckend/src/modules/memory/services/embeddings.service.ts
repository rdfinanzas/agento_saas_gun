/**
 * EmbeddingsService - Servicio de Embeddings para búsqueda vectorial
 * FASE 4: Búsqueda semántica en base de conocimiento
 *
 * Soporta múltiples providers: OpenAI, Google, local
 * NOTA: Por ahora usa almacenamiento en memoria. El modelo Prisma
 * KnowledgeEmbedding está disponible pero requiere regenerar el cliente.
 */

import { v4 as uuidv4 } from 'uuid';

// ============================================
// Interfaces
// ============================================

export interface EmbeddingVector {
  id: string;
  tenantId: string;
  content: string;
  embedding: number[];
  metadata: Record<string, any>;
  source: string;
  createdAt: Date;
}

export interface SearchResult {
  id: string;
  content: string;
  similarity: number;
  metadata: Record<string, any>;
  source: string;
}

export interface EmbeddingOptions {
  model?: string;
  dimensions?: number;
  provider?: EmbeddingProvider;
}

export interface IndexContentOptions {
  chunkSize?: number;
  overlap?: number;
  metadata?: Record<string, any>;
}

export type EmbeddingProvider = 'openai' | 'google' | 'local';

// ============================================
// Almacenamiento en memoria (temporal)
// ============================================

// Map<tenantId, EmbeddingVector[]>
const embeddingStore = new Map<string, EmbeddingVector[]>();

// ============================================
// Servicio Principal
// ============================================

export class EmbeddingsService {
  private defaultProvider: EmbeddingProvider;
  private defaultModel: string;
  private defaultDimensions: number;

  constructor() {
    this.defaultProvider = (process.env.EMBEDDING_PROVIDER as EmbeddingProvider) || 'openai';
    this.defaultModel = process.env.EMBEDDING_MODEL || 'text-embedding-3-small';
    this.defaultDimensions = parseInt(process.env.EMBEDDING_DIMENSIONS || '1536');
  }

  // ============================================
  // Generación de Embeddings
  // ============================================

  /**
   * Genera embeddings para un texto
   */
  async generateEmbedding(text: string, options?: EmbeddingOptions): Promise<number[]> {
    const provider = options?.provider || this.defaultProvider;

    switch (provider) {
      case 'openai':
        return this.generateOpenAIEmbedding(text, options);
      case 'google':
        return this.generateGoogleEmbedding(text, options);
      default:
        return this.generateLocalEmbedding(text, options?.dimensions);
    }
  }

  /**
   * Genera embeddings para múltiples textos en batch
   */
  async generateEmbeddings(texts: string[], options?: EmbeddingOptions): Promise<number[][]> {
    const provider = options?.provider || this.defaultProvider;

    // Para batches grandes con OpenAI, usar endpoint de batch
    if (provider === 'openai' && texts.length > 1) {
      return this.generateOpenAIEmbeddings(texts, options);
    }

    // Fallback: generar uno por uno
    const embeddings: number[][] = [];
    for (const text of texts) {
      embeddings.push(await this.generateEmbedding(text, options));
    }
    return embeddings;
  }

  /**
   * Genera embeddings usando OpenAI
   */
  private async generateOpenAIEmbedding(text: string, options?: EmbeddingOptions): Promise<number[]> {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      console.warn('[Embeddings] No OPENAI_API_KEY, using local fallback');
      return this.generateLocalEmbedding(text, options?.dimensions);
    }

    try {
      const response = await fetch('https://api.openai.com/v1/embeddings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          input: text,
          model: options?.model || this.defaultModel,
          dimensions: options?.dimensions,
        }),
      });

      if (!response.ok) {
        const error = await response.json() as any;
        throw new Error(error.error?.message || `OpenAI API error: ${response.status}`);
      }

      const data = await response.json() as any;
      return data.data[0].embedding;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('[Embeddings] OpenAI error:', errorMessage);
      return this.generateLocalEmbedding(text, options?.dimensions);
    }
  }

  /**
   * Genera embeddings en batch usando OpenAI
   */
  private async generateOpenAIEmbeddings(texts: string[], options?: EmbeddingOptions): Promise<number[][]> {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return Promise.all(texts.map(t => this.generateLocalEmbedding(t, options?.dimensions)));
    }

    try {
      const response = await fetch('https://api.openai.com/v1/embeddings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          input: texts,
          model: options?.model || this.defaultModel,
          dimensions: options?.dimensions,
        }),
      });

      if (!response.ok) {
        throw new Error(`OpenAI API error: ${response.status}`);
      }

      const data = await response.json() as any;
      return data.data.sort((a: any, b: any) => a.index - b.index).map((d: any) => d.embedding);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('[Embeddings] OpenAI batch error:', errorMessage);
      return Promise.all(texts.map(t => this.generateLocalEmbedding(t, options?.dimensions)));
    }
  }

  /**
   * Genera embeddings usando Google AI
   */
  private async generateGoogleEmbedding(text: string, options?: EmbeddingOptions): Promise<number[]> {
    const apiKey = process.env.GOOGLE_API_KEY;
    if (!apiKey) {
      console.warn('[Embeddings] No GOOGLE_API_KEY, using local fallback');
      return this.generateLocalEmbedding(text, options?.dimensions);
    }

    try {
      const model = options?.model || 'text-embedding-004';
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:embedContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: `models/${model}`,
            content: { parts: [{ text }] },
          }),
        }
      );

      if (!response.ok) {
        throw new Error(`Google AI API error: ${response.status}`);
      }

      const data = await response.json() as any;
      return data.embedding.values;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('[Embeddings] Google error:', errorMessage);
      return this.generateLocalEmbedding(text, options?.dimensions);
    }
  }

  /**
   * Genera embeddings locales (hash-based, para desarrollo/sin API)
   */
  private generateLocalEmbedding(text: string, dimensions?: number): number[] {
    const dims = dimensions || this.defaultDimensions;
    const embedding: number[] = [];
    const normalizedText = text.toLowerCase().trim();

    // Usar características del texto para crear embedding determinista
    const words = normalizedText.split(/\s+/);

    for (let i = 0; i < dims; i++) {
      let value = 0;

      for (let j = 0; j < words.length; j++) {
        const word = words[j];
        const charIndex = i % Math.max(word.length, 1);
        const charCode = word.charCodeAt(charIndex) || 0;
        value += (charCode * (j + 1) * (i + 1)) % 1000;
      }

      embedding.push((value % 1000) / 1000);
    }

    // Normalizar el vector
    const magnitude = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
    return magnitude > 0 ? embedding.map(val => val / magnitude) : embedding;
  }

  // ============================================
  // Operaciones de Almacenamiento
  // ============================================

  /**
   * Almacena un embedding
   */
  async storeEmbedding(
    tenantId: string,
    content: string,
    source: string,
    metadata: Record<string, any> = {},
    options?: EmbeddingOptions
  ): Promise<EmbeddingVector> {
    const embedding = await this.generateEmbedding(content, options);

    const vector: EmbeddingVector = {
      id: uuidv4(),
      tenantId,
      content,
      embedding,
      metadata,
      source,
      createdAt: new Date(),
    };

    // Almacenar en memoria
    if (!embeddingStore.has(tenantId)) {
      embeddingStore.set(tenantId, []);
    }
    embeddingStore.get(tenantId)!.push(vector);

    return vector;
  }

  /**
   * Indexa contenido largo dividiéndolo en chunks
   */
  async indexContent(
    tenantId: string,
    content: string,
    source: string,
    options?: IndexContentOptions
  ): Promise<{
    success: boolean;
    chunksCreated: number;
    embeddings: EmbeddingVector[];
  }> {
    const chunkSize = options?.chunkSize || 500;
    const overlap = options?.overlap || 50;
    const chunks = this.chunkText(content, chunkSize, overlap);

    if (chunks.length === 0) {
      return { success: false, chunksCreated: 0, embeddings: [] };
    }

    // Generar embeddings en batch
    const embeddings = await this.generateEmbeddings(chunks);

    // Almacenar
    const results: EmbeddingVector[] = [];

    for (let i = 0; i < chunks.length; i++) {
      const chunkMetadata = {
        ...options?.metadata,
        chunkIndex: i,
        totalChunks: chunks.length,
        charCount: chunks[i].length,
      };

      const vector: EmbeddingVector = {
        id: uuidv4(),
        tenantId,
        content: chunks[i],
        embedding: embeddings[i],
        metadata: chunkMetadata,
        source,
        createdAt: new Date(),
      };

      // Almacenar
      if (!embeddingStore.has(tenantId)) {
        embeddingStore.set(tenantId, []);
      }
      embeddingStore.get(tenantId)!.push(vector);
      results.push(vector);
    }

    return {
      success: true,
      chunksCreated: chunks.length,
      embeddings: results,
    };
  }

  /**
   * Re-indexa contenido (elimina anteriores y vuelve a indexar)
   */
  async reindexContent(
    tenantId: string,
    content: string,
    source: string,
    options?: IndexContentOptions
  ): Promise<{
    success: boolean;
    chunksCreated: number;
    chunksDeleted: number;
    embeddings: EmbeddingVector[];
  }> {
    const deleted = await this.deleteBySource(tenantId, source);
    const result = await this.indexContent(tenantId, content, source, options);

    return {
      ...result,
      chunksDeleted: deleted,
    };
  }

  // ============================================
  // Búsqueda Semántica
  // ============================================

  /**
   * Busca embeddings similares
   */
  async searchSimilar(
    tenantId: string,
    query: string,
    limit: number = 10,
    threshold: number = 0.5
  ): Promise<SearchResult[]> {
    const queryEmbedding = await this.generateEmbedding(query);

    const storedEmbeddings = embeddingStore.get(tenantId) || [];

    if (storedEmbeddings.length === 0) {
      return [];
    }

    const results: SearchResult[] = [];

    for (const stored of storedEmbeddings) {
      const similarity = this.cosineSimilarity(queryEmbedding, stored.embedding);

      if (similarity >= threshold) {
        results.push({
          id: stored.id,
          content: stored.content,
          similarity,
          metadata: stored.metadata,
          source: stored.source,
        });
      }
    }

    results.sort((a, b) => b.similarity - a.similarity);
    return results.slice(0, limit);
  }

  /**
   * Obtiene contexto relevante para una consulta
   */
  async getRelevantContext(
    tenantId: string,
    query: string,
    options?: {
      maxTokens?: number;
      threshold?: number;
      maxResults?: number;
    }
  ): Promise<{
    context: string;
    sources: string[];
    totalResults: number;
  }> {
    const maxTokens = options?.maxTokens || 2000;
    const threshold = options?.threshold || 0.5;
    const maxResults = options?.maxResults || 20;

    const results = await this.searchSimilar(tenantId, query, maxResults, threshold);

    if (results.length === 0) {
      return { context: '', sources: [], totalResults: 0 };
    }

    let context = '';
    let currentTokens = 0;
    const sources = new Set<string>();

    for (const result of results) {
      const tokens = Math.ceil(result.content.length / 4);

      if (currentTokens + tokens > maxTokens) {
        break;
      }

      context += `\n---\n[Fuente: ${result.source}]\n${result.content}`;
      sources.add(result.source);
      currentTokens += tokens;
    }

    return {
      context: context.trim(),
      sources: Array.from(sources),
      totalResults: results.length,
    };
  }

  /**
   * Búsqueda híbrida: semántica + keywords
   */
  async hybridSearch(
    tenantId: string,
    query: string,
    options?: {
      limit?: number;
      semanticWeight?: number;
      keywordWeight?: number;
    }
  ): Promise<SearchResult[]> {
    const limit = options?.limit || 10;
    const semanticWeight = options?.semanticWeight || 0.7;
    const keywordWeight = options?.keywordWeight || 0.3;

    // Búsqueda semántica
    const semanticResults = await this.searchSimilar(tenantId, query, limit * 2, 0.3);

    // Búsqueda por keywords
    const keywords = query.toLowerCase().split(/\s+/).filter(k => k.length > 2);
    const storedEmbeddings = embeddingStore.get(tenantId) || [];

    const keywordResults = storedEmbeddings.filter(e =>
      keywords.some(kw => e.content.toLowerCase().includes(kw))
    );

    // Combinar resultados
    const combined = new Map<string, SearchResult>();

    for (const result of semanticResults) {
      combined.set(result.id, {
        ...result,
        similarity: result.similarity * semanticWeight,
      });
    }

    for (const kw of keywordResults) {
      const existing = combined.get(kw.id);
      if (existing) {
        existing.similarity += keywordWeight;
      } else {
        combined.set(kw.id, {
          id: kw.id,
          content: kw.content,
          similarity: keywordWeight,
          metadata: kw.metadata,
          source: kw.source,
        });
      }
    }

    const results = Array.from(combined.values());
    results.sort((a, b) => b.similarity - a.similarity);
    return results.slice(0, limit);
  }

  // ============================================
  // Utilidades
  // ============================================

  /**
   * Calcula similitud coseno entre dos vectores
   */
  cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) return 0;

    let dotProduct = 0;
    let magnitudeA = 0;
    let magnitudeB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      magnitudeA += a[i] * a[i];
      magnitudeB += b[i] * b[i];
    }

    magnitudeA = Math.sqrt(magnitudeA);
    magnitudeB = Math.sqrt(magnitudeB);

    if (magnitudeA === 0 || magnitudeB === 0) return 0;

    return dotProduct / (magnitudeA * magnitudeB);
  }

  /**
   * Divide texto en chunks inteligentes
   */
  private chunkText(text: string, chunkSize: number, overlap: number): string[] {
    const chunks: string[] = [];
    const paragraphs = text.split(/\n\n+/);

    let currentChunk = '';

    for (const paragraph of paragraphs) {
      if (paragraph.length > chunkSize) {
        if (currentChunk) {
          chunks.push(currentChunk.trim());
          currentChunk = '';
        }

        const sentences = paragraph.match(/[^.!?]+[.!?]+/g) || [paragraph];
        let sentenceChunk = '';

        for (const sentence of sentences) {
          if (sentenceChunk.length + sentence.length > chunkSize) {
            if (sentenceChunk) {
              chunks.push(sentenceChunk.trim());
              const overlapText = sentenceChunk.slice(-overlap);
              sentenceChunk = overlapText + sentence;
            } else {
              sentenceChunk = sentence;
            }
          } else {
            sentenceChunk += sentence;
          }
        }

        if (sentenceChunk.trim()) {
          currentChunk = sentenceChunk;
        }
      } else {
        if (currentChunk.length + paragraph.length > chunkSize) {
          chunks.push(currentChunk.trim());
          const overlapText = currentChunk.slice(-overlap);
          currentChunk = overlapText + paragraph;
        } else {
          currentChunk += '\n\n' + paragraph;
        }
      }
    }

    if (currentChunk.trim()) {
      chunks.push(currentChunk.trim());
    }

    return chunks.filter(chunk => chunk.length > 50);
  }

  // ============================================
  // Operaciones CRUD
  // ============================================

  /**
   * Elimina un embedding específico
   */
  async deleteEmbedding(tenantId: string, embeddingId: string): Promise<boolean> {
    const embeddings = embeddingStore.get(tenantId);
    if (!embeddings) return false;

    const index = embeddings.findIndex(e => e.id === embeddingId);
    if (index === -1) return false;

    embeddings.splice(index, 1);
    return true;
  }

  /**
   * Elimina todos los embeddings de una fuente
   */
  async deleteBySource(tenantId: string, source: string): Promise<number> {
    const embeddings = embeddingStore.get(tenantId);
    if (!embeddings) return 0;

    const initialLength = embeddings.length;
    const filtered = embeddings.filter(e => e.source !== source);
    embeddingStore.set(tenantId, filtered);

    return initialLength - filtered.length;
  }

  /**
   * Elimina todos los embeddings de un tenant
   */
  async deleteAll(tenantId: string): Promise<number> {
    const embeddings = embeddingStore.get(tenantId);
    const count = embeddings?.length || 0;
    embeddingStore.delete(tenantId);
    return count;
  }

  /**
   * Obtiene embeddings por fuente
   */
  async getBySource(tenantId: string, source: string): Promise<EmbeddingVector[]> {
    const embeddings = embeddingStore.get(tenantId) || [];
    return embeddings.filter(e => e.source === source);
  }

  /**
   * Obtiene estadísticas de embeddings
   */
  async getStats(tenantId: string): Promise<{
    totalEmbeddings: number;
    totalSources: number;
    sources: { source: string; count: number; lastUpdated: Date }[];
    estimatedTokens: number;
  }> {
    const embeddings = embeddingStore.get(tenantId) || [];

    const sourceMap = new Map<string, { count: number; lastUpdated: Date }>();

    let totalChars = 0;
    for (const emb of embeddings) {
      totalChars += emb.content.length;

      const existing = sourceMap.get(emb.source);
      if (existing) {
        existing.count++;
        if (emb.createdAt > existing.lastUpdated) {
          existing.lastUpdated = emb.createdAt;
        }
      } else {
        sourceMap.set(emb.source, { count: 1, lastUpdated: emb.createdAt });
      }
    }

    return {
      totalEmbeddings: embeddings.length,
      totalSources: sourceMap.size,
      sources: Array.from(sourceMap.entries()).map(([source, data]) => ({
        source,
        count: data.count,
        lastUpdated: data.lastUpdated,
      })),
      estimatedTokens: Math.ceil(totalChars / 4),
    };
  }

  // ============================================
  // Gestión de Knowledge Base del Agente
  // ============================================

  /**
   * Indexa la base de conocimiento del agente WhatsApp
   */
  async indexAgentKnowledge(
    tenantId: string,
    knowledge: {
      faq?: Record<string, string>;
      products?: any[];
      policies?: Record<string, string>;
      businessInfo?: any;
      customDocuments?: { title: string; content: string }[];
    }
  ): Promise<{
    indexed: number;
    sources: string[];
  }> {
    let indexed = 0;
    const sources: string[] = [];

    // Indexar FAQs
    if (knowledge.faq && Object.keys(knowledge.faq).length > 0) {
      const faqContent = Object.entries(knowledge.faq)
        .map(([q, a]) => `Pregunta: ${q}\nRespuesta: ${a}`)
        .join('\n\n');

      await this.indexContent(tenantId, faqContent, 'knowledge:faq', {
        metadata: { type: 'faq' },
      });
      indexed++;
      sources.push('faq');
    }

    // Indexar productos
    if (knowledge.products && knowledge.products.length > 0) {
      for (const product of knowledge.products) {
        const productContent = `Producto: ${product.name}\n` +
          `Descripción: ${product.description || 'Sin descripción'}\n` +
          `Precio: ${product.price || 'Consultar'}\n` +
          `Stock: ${product.stock || 'Disponible'}`;

        await this.storeEmbedding(tenantId, productContent, 'knowledge:products', {
          productId: product.id || product.name,
          type: 'product',
        });
        indexed++;
      }
      sources.push('products');
    }

    // Indexar políticas
    if (knowledge.policies && Object.keys(knowledge.policies).length > 0) {
      const policiesContent = Object.entries(knowledge.policies)
        .map(([key, value]) => `Política de ${key}: ${value}`)
        .join('\n\n');

      await this.indexContent(tenantId, policiesContent, 'knowledge:policies', {
        metadata: { type: 'policies' },
      });
      indexed++;
      sources.push('policies');
    }

    // Indexar información del negocio
    if (knowledge.businessInfo) {
      const businessContent = Object.entries(knowledge.businessInfo)
        .filter(([, v]) => v)
        .map(([k, v]) => `${k}: ${v}`)
        .join('\n');

      if (businessContent) {
        await this.storeEmbedding(tenantId, businessContent, 'knowledge:business', {
          type: 'business-info',
        });
        indexed++;
        sources.push('business');
      }
    }

    // Indexar documentos personalizados
    if (knowledge.customDocuments && knowledge.customDocuments.length > 0) {
      for (const doc of knowledge.customDocuments) {
        await this.indexContent(tenantId, doc.content, `knowledge:custom:${doc.title}`, {
          metadata: { title: doc.title, type: 'custom-document' },
        });
        indexed++;
      }
      sources.push('custom-documents');
    }

    return { indexed, sources };
  }

  /**
   * Actualiza la base de conocimiento del agente
   */
  async updateAgentKnowledge(
    tenantId: string,
    knowledge: any
  ): Promise<void> {
    // Eliminar embeddings anteriores del conocimiento
    const embeddings = embeddingStore.get(tenantId);
    if (embeddings) {
      const filtered = embeddings.filter(e => !e.source.startsWith('knowledge:'));
      embeddingStore.set(tenantId, filtered);
    }

    // Re-indexar
    await this.indexAgentKnowledge(tenantId, knowledge);
  }
}

// Singleton
export const embeddingsService = new EmbeddingsService();
