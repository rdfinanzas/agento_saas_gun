/**
 * EvolvingMemoryService - Sistema de memoria evolutiva
 * El agente aprende de las interacciones para mejorar sus respuestas
 * FASE 3: Memoria evolutiva
 */

import { prisma } from '../../../config/database';
import { embeddingsService, SearchResult } from './embeddings.service';

export interface LearnedKnowledge {
  id?: string;
  tenantId: string;
  category: 'faq' | 'product' | 'procedure' | 'preference' | 'pattern' | 'insight';
  key: string;
  content: string;
  examples?: string[];
  confidence: number;
  usageCount: number;
  lastUsedAt?: Date;
  source: 'conversation' | 'manual' | 'integration';
  metadata?: Record<string, any>;
}

export interface ConversationAnalysis {
  tenantId: string;
  conversationId: string;
  messages: Array<{
    role: 'user' | 'assistant';
    content: string;
    timestamp: Date;
  }>;
}

export interface KnowledgeExtraction {
  faqs: Array<{ question: string; answer: string }>;
  products: Array<{ name: string; details: string }>;
  procedures: Array<{ name: string; steps: string[] }>;
  preferences: Array<{ key: string; value: string }>;
  patterns: Array<{ pattern: string; frequency: number }>;
  insights: Array<{ insight: string; confidence: number }>;
}

export class EvolvingMemoryService {
  private MIN_CONFIDENCE_THRESHOLD = 0.7;
  private MIN_USAGE_FOR_LEARNING = 3;

  /**
   * Analiza una conversación y extrae conocimiento
   */
  async analyzeConversation(analysis: ConversationAnalysis): Promise<KnowledgeExtraction> {
    const extraction: KnowledgeExtraction = {
      faqs: [],
      products: [],
      procedures: [],
      preferences: [],
      patterns: [],
      insights: []
    };

    const messages = analysis.messages;
    
    for (let i = 0; i < messages.length - 1; i++) {
      const userMsg = messages[i];
      const assistantMsg = messages[i + 1];

      if (userMsg.role === 'user' && assistantMsg.role === 'assistant') {
        if (this.isQuestion(userMsg.content)) {
          extraction.faqs.push({
            question: userMsg.content,
            answer: assistantMsg.content
          });
        }

        if (this.mentionsProduct(userMsg.content)) {
          const product = this.extractProduct(userMsg.content);
          if (product) {
            extraction.products.push(product);
          }
        }

        if (this.describesProcedure(userMsg.content)) {
          const procedure = this.extractProcedure(userMsg.content);
          if (procedure) extraction.procedures.push(procedure);
        }
      }
    }

    extraction.patterns = this.identifyPatterns(messages);
    extraction.insights = this.generateInsights(analysis);

    return extraction;
  }

  /**
   * Aprende del conocimiento extraído
   */
  async learnFromExtraction(
    tenantId: string,
    extraction: KnowledgeExtraction,
    conversationId: string
  ): Promise<number> {
    let learned = 0;

    for (const faq of extraction.faqs) {
      const existing = await this.findSimilarFAQ(tenantId, faq.question);
      if (!existing) {
        await this.storeKnowledge({
          tenantId,
          category: 'faq',
          key: `faq_${Date.now()}`,
          content: `Q: ${faq.question}\nA: ${faq.answer}`,
          examples: [faq.question],
          confidence: 0.5,
          usageCount: 0,
          source: 'conversation'
        });
        learned++;

        await this.indexToVectorStore(tenantId, faq.question, faq.answer, 'faq');
      }
    }

    for (const product of extraction.products) {
      await this.storeKnowledge({
        tenantId,
        category: 'product',
        key: `product_${product.name.toLowerCase().replace(/\s+/g, '_')}`,
        content: `${product.name}: ${product.details}`,
        confidence: 0.6,
        usageCount: 0,
        source: 'conversation'
      });
      learned++;

      await this.indexToVectorStore(tenantId, product.name, product.details, 'product');
    }

    for (const procedure of extraction.procedures) {
      await this.storeKnowledge({
        tenantId,
        category: 'procedure',
        key: `procedure_${procedure.name.toLowerCase().replace(/\s+/g, '_')}`,
        content: `${procedure.name}: ${procedure.steps.join(' → ')}`,
        examples: procedure.steps,
        confidence: 0.7,
        usageCount: 0,
        source: 'conversation'
      });
      learned++;

      await this.indexToVectorStore(tenantId, procedure.name, procedure.steps.join(' → '), 'procedure');
    }

    for (const insight of extraction.insights) {
      if (insight.confidence >= this.MIN_CONFIDENCE_THRESHOLD) {
        await this.storeKnowledge({
          tenantId,
          category: 'insight',
          key: `insight_${Date.now()}`,
          content: insight.insight,
          confidence: insight.confidence,
          usageCount: 0,
          source: 'conversation'
        });
        learned++;
      }
    }

    return learned;
  }

  /**
   * Recupera conocimiento relevante para una consulta
   */
  async retrieveRelevantKnowledge(
    tenantId: string,
    query: string,
    category?: string,
    limit: number = 5
  ): Promise<LearnedKnowledge[]> {
    const vectorResults = await embeddingsService.searchSimilar(tenantId, query, limit);
    
    if (vectorResults.length === 0) {
      return this.getStoredKnowledge(tenantId, category, limit);
    }

    return vectorResults.map(r => ({
      tenantId,
      category: (r.metadata?.category as any) || 'insight',
      key: r.source,
      content: r.content,
      confidence: 0.8,
      usageCount: 0,
      source: 'conversation' as const,
      metadata: r.metadata
    }));
  }

  /**
   * Actualiza el contador de uso y confianza
   */
  async recordUsage(tenantId: string, key: string): Promise<void> {
    const embeddings = await prisma.knowledgeEmbedding.findMany({
      where: { tenantId, source: key }
    });

    if (embeddings.length === 0) return;

    for (const knowledge of embeddings) {
      const meta = knowledge.metadata as Record<string, any> || {};
      const currentCount = meta.usageCount || 0;
      const newConfidence = Math.min(1, 0.5 + (currentCount + 1) * 0.05);

      await prisma.knowledgeEmbedding.update({
        where: { id: knowledge.id },
        data: {
          metadata: {
            ...meta,
            usageCount: currentCount + 1,
            confidence: newConfidence,
            lastUsedAt: new Date().toISOString()
          }
        }
      });
    }
  }

  /**
   * Obtiene conocimiento almacenado sin vector search
   */
  private async getStoredKnowledge(
    tenantId: string,
    _category?: string,
    limit: number = 5
  ): Promise<LearnedKnowledge[]> {
    const embeddings = await prisma.knowledgeEmbedding.findMany({
      where: { tenantId },
      take: limit,
      orderBy: { createdAt: 'desc' }
    });

    return embeddings.map(e => {
      const meta = e.metadata as Record<string, any> || {};
      return {
        tenantId: e.tenantId,
        category: (meta.category || 'insight') as any,
        key: e.source,
        content: e.content,
        confidence: meta.confidence || 0.5,
        usageCount: meta.usageCount || 0,
        source: 'conversation' as const,
        metadata: meta
      };
    });
  }

  /**
   * Almacena conocimiento en la base de datos
   */
  private async storeKnowledge(knowledge: LearnedKnowledge): Promise<void> {
    await prisma.knowledgeEmbedding.create({
      data: {
        tenantId: knowledge.tenantId,
        content: knowledge.content,
        embedding: '[]',
        source: knowledge.key,
        metadata: {
          category: knowledge.category,
          confidence: knowledge.confidence,
          usageCount: knowledge.usageCount,
          source: knowledge.source,
          examples: knowledge.examples,
          ...knowledge.metadata
        }
      }
    });
  }

  /**
   * Indexa contenido en el store vectorial
   */
  private async indexToVectorStore(
    tenantId: string,
    title: string,
    content: string,
    category: string
  ): Promise<void> {
    try {
      await embeddingsService.indexContent(
        tenantId,
        `${title}: ${content}`,
        title,
        { metadata: { category, source: title } }
      );
    } catch (error) {
      console.error('[EvolvingMemory] Error indexing to vector store:', error);
    }
  }

  /**
   * Busca FAQs similares
   */
  private async findSimilarFAQ(tenantId: string, question: string): Promise<boolean> {
    const results = await embeddingsService.searchSimilar(tenantId, question, 1);
    return results.length > 0 && results[0].similarity > 0.9;
  }

  /**
   * Detecta si un mensaje es una pregunta
   */
  private isQuestion(text: string): boolean {
    const questionPatterns = [
      /^\?/,
      /^(qué|como|cuál|cuáles|dónde|cuándo|por qué|quién|es posible|se puede|tienen|tienen)\s/i,
      /(?:tienes?|hay)\s.+\?/i
    ];
    return questionPatterns.some(p => p.test(text.trim()));
  }

  /**
   * Extrae menciones de productos
   */
  private mentionsProduct(text: string): boolean {
    const productPatterns = [
      /producto|precio|stock|disponible|modelo|marca|cómprar|vender/i,
      /\$\d+|MXN|pesos/i
    ];
    return productPatterns.some(p => p.test(text));
  }

  /**
   * Extrae información de producto
   */
  private extractProduct(text: string): { name: string; details: string } | null {
    const match = text.match(/(?:el|un|una)\s+([^,\.]+)/i);
    if (!match) return null;
    return { name: match[1].trim(), details: text };
  }

  /**
   * Detecta si describe un procedimiento
   */
  private describesProcedure(text: string): boolean {
    return /cómo (se )?(hace|llama|contacta| logra|obtiene)|pasos|procedimiento|instrucciones/i.test(text);
  }

  /**
   * Extrae procedimiento
   */
  private extractProcedure(text: string): { name: string; steps: string[] } | null {
    const match = text.match(/cómo (?:se )?(hace|llama|contacta)\s+(.+)/i);
    if (!match) return null;
    return { name: match[2].trim(), steps: [text] };
  }

  /**
   * Identifica patrones en las conversaciones
   */
  private identifyPatterns(messages: ConversationAnalysis['messages']): Array<{ pattern: string; frequency: number }> {
    const patterns: Map<string, number> = new Map();

    for (const msg of messages) {
      if (msg.role === 'user') {
        const words = msg.content.toLowerCase().split(/\s+/);
        for (const word of words) {
          if (word.length > 4) {
            patterns.set(word, (patterns.get(word) || 0) + 1);
          }
        }
      }
    }

    return Array.from(patterns.entries())
      .filter(([_, count]) => count >= 2)
      .map(([pattern, frequency]) => ({ pattern, frequency }))
      .sort((a, b) => b.frequency - a.frequency)
      .slice(0, 10);
  }

  /**
   * Genera insights usando análisis simple
   */
  private generateInsights(analysis: ConversationAnalysis): Array<{ insight: string; confidence: number }> {
    const insights: Array<{ insight: string; confidence: number }> = [];
    
    const messageCount = analysis.messages.length;
    const userMessages = analysis.messages.filter(m => m.role === 'user');
    const avgLength = userMessages.reduce((sum, m) => sum + m.content.length, 0) / (userMessages.length || 1);

    if (messageCount > 10) {
      insights.push({
        insight: 'Conversación extensa con múltiples intercambios',
        confidence: 0.8
      });
    }

    if (avgLength > 100) {
      insights.push({
        insight: 'Cliente proporciona información detallada',
        confidence: 0.7
      });
    }

    const hasQuestion = analysis.messages.some(m => m.role === 'user' && this.isQuestion(m.content));
    if (hasQuestion) {
      insights.push({
        insight: 'Cliente tiene consultas específicas',
        confidence: 0.9
      });
    }

    return insights;
  }

  /**
   * Obtiene estadísticas de aprendizaje
   */
  async getLearningStats(tenantId: string) {
    const embeddings = await prisma.knowledgeEmbedding.findMany({
      where: { tenantId }
    });

    const byCategory: Record<string, number> = {};
    let totalUsage = 0;

    for (const e of embeddings) {
      const meta = e.metadata as Record<string, any> || {};
      const cat = meta.category || 'unknown';
      byCategory[cat] = (byCategory[cat] || 0) + 1;
      totalUsage += meta.usageCount || 0;
    }

    return {
      totalKnowledge: embeddings.length,
      byCategory,
      totalUsage,
      avgConfidence: embeddings.reduce((sum, e) => {
        const meta = e.metadata as Record<string, any> || {};
        return sum + (meta.confidence || 0);
      }, 0) / (embeddings.length || 1)
    };
  }
}

export const evolvingMemoryService = new EvolvingMemoryService();
