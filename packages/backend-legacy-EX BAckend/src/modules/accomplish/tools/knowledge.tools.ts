/**
 * Knowledge Tools - Herramientas para base de conocimiento
 *
 * Proporciona herramientas para búsqueda semántica y gestión de conocimiento
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export interface KnowledgeQueryInput {
  tenantId: string;
  query: string;
  topK?: number;
  filters?: {
    source?: string;
    category?: string;
  };
}

export interface KnowledgeAddInput {
  tenantId: string;
  content: string;
  source: string;
  metadata?: Record<string, any>;
}

export interface KnowledgeQueryOutput {
  success: boolean;
  results?: Array<{
    content: string;
    source: string;
    score: number;
    metadata?: Record<string, any>;
  }>;
  error?: string;
}

export interface KnowledgeAddOutput {
  success: boolean;
  id?: string;
  error?: string;
}

/**
 * Busca en la base de conocimiento del tenant
 */
export async function knowledgeQuery(input: KnowledgeQueryInput): Promise<KnowledgeQueryOutput> {
  try {
    const { tenantId, query, topK = 5, filters } = input;

    // Búsqueda simple por texto (en producción se usaría búsqueda vectorial)
    const embeddings = await prisma.knowledgeEmbedding.findMany({
      where: {
        tenantId,
        ...(filters?.source && { source: filters.source }),
      },
      take: topK * 2, // Obtener más para luego filtrar
    });

    // Búsqueda por similitud de texto simple
    const queryLower = query.toLowerCase();
    const results = embeddings
      .map((emb) => ({
        content: emb.content,
        source: emb.source,
        score: calculateTextSimilarity(queryLower, emb.content.toLowerCase()),
        metadata: emb.metadata as Record<string, any>,
      }))
      .filter((r) => r.score > 0.1) // Filtrar resultados muy bajos
      .sort((a, b) => b.score - a.score)
      .slice(0, topK);

    return {
      success: true,
      results,
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message || 'Error buscando en base de conocimiento',
    };
  }
}

/**
 * Agrega contenido a la base de conocimiento
 */
export async function knowledgeAdd(input: KnowledgeAddInput): Promise<KnowledgeAddOutput> {
  try {
    const { tenantId, content, source, metadata } = input;

    // En producción, aquí se generaría el embedding usando un modelo de ML
    // Por ahora, guardamos sin embedding
    const embedding = await prisma.knowledgeEmbedding.create({
      data: {
        tenantId,
        content,
        source,
        metadata: metadata || {},
        embedding: '[]', // Placeholder - en producción sería el vector
      },
    });

    return {
      success: true,
      id: embedding.id,
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message || 'Error agregando a base de conocimiento',
    };
  }
}

/**
 * Calcula similitud simple entre dos textos
 */
function calculateTextSimilarity(query: string, text: string): number {
  // Tokenizar
  const queryTokens = query.split(/\s+/);
  const textTokens = text.split(/\s+/);

  // Contar coincidencias
  let matches = 0;
  for (const queryToken of queryTokens) {
    for (const textToken of textTokens) {
      if (queryToken === textToken || textToken.includes(queryToken)) {
        matches++;
        break;
      }
    }
  }

  // Normalizar score
  return matches / queryTokens.length;
}

/**
 * Obtiene estadísticas de la base de conocimiento
 */
export async function knowledgeStats(tenantId: string): Promise<{
  success: boolean;
  stats?: {
    totalEntries: number;
    bySource: Record<string, number>;
    totalCharacters: number;
  };
}> {
  try {
    const embeddings = await prisma.knowledgeEmbedding.findMany({
      where: { tenantId },
      select: {
        content: true,
        source: true,
      },
    });

    const bySource: Record<string, number> = {};
    let totalCharacters = 0;

    for (const emb of embeddings) {
      bySource[emb.source] = (bySource[emb.source] || 0) + 1;
      totalCharacters += emb.content.length;
    }

    return {
      success: true,
      stats: {
        totalEntries: embeddings.length,
        bySource,
        totalCharacters,
      },
    };
  } catch (error: any) {
    return {
      success: false,
    };
  }
}

/**
 * Elimina entradas de la base de conocimiento
 */
export async function knowledgeDelete(
  tenantId: string,
  source?: string
): Promise<{ success: boolean; deletedCount?: number }> {
  try {
    const where: any = { tenantId };
    if (source) {
      where.source = source;
    }

    const result = await prisma.knowledgeEmbedding.deleteMany({
      where,
    });

    return {
      success: true,
      deletedCount: result.count,
    };
  } catch (error: any) {
    return {
      success: false,
    };
  }
}

/**
 * Definiciones de herramientas para OpenCode
 */
export const knowledgeTools = {
  knowledge_query: {
    name: 'knowledge_query',
    description: 'Busca información en la base de conocimiento del tenant',
    inputSchema: {
      type: 'object',
      properties: {
        tenantId: {
          type: 'string',
          description: 'ID del tenant',
        },
        query: {
          type: 'string',
          description: 'Consulta a buscar',
        },
        topK: {
          type: 'number',
          description: 'Cantidad de resultados (default: 5)',
        },
        filters: {
          type: 'object',
          properties: {
            source: {
              type: 'string',
              description: 'Filtrar por fuente',
            },
            category: {
              type: 'string',
              description: 'Filtrar por categoría',
            },
          },
        },
      },
      required: ['tenantId', 'query'],
    },
    category: 'data',
    dangerous: false,
    handler: knowledgeQuery as any,
  },

  knowledge_add: {
    name: 'knowledge_add',
    description: 'Agrega contenido a la base de conocimiento del tenant',
    inputSchema: {
      type: 'object',
      properties: {
        tenantId: {
          type: 'string',
          description: 'ID del tenant',
        },
        content: {
          type: 'string',
          description: 'Contenido a agregar',
        },
        source: {
          type: 'string',
          description: 'Fuente del contenido (archivo, URL, manual, etc.)',
        },
        metadata: {
          type: 'object',
          description: 'Metadatos adicionales',
        },
      },
      required: ['tenantId', 'content', 'source'],
    },
    category: 'data',
    dangerous: true,
    handler: knowledgeAdd as any,
  },

  knowledge_stats: {
    name: 'knowledge_stats',
    description: 'Obtiene estadísticas de la base de conocimiento',
    inputSchema: {
      type: 'object',
      properties: {
        tenantId: {
          type: 'string',
          description: 'ID del tenant',
        },
      },
      required: ['tenantId'],
    },
    category: 'data',
    dangerous: false,
    handler: async (input: { tenantId: string }) => {
      return await knowledgeStats(input.tenantId);
    },
  },

  knowledge_delete: {
    name: 'knowledge_delete',
    description: 'Elimina entradas de la base de conocimiento',
    inputSchema: {
      type: 'object',
      properties: {
        tenantId: {
          type: 'string',
          description: 'ID del tenant',
        },
        source: {
          type: 'string',
          description: 'Fuente a eliminar (opcional, si no se especifica elimina todo)',
        },
      },
      required: ['tenantId'],
    },
    category: 'data',
    dangerous: true,
    handler: async (input: { tenantId: string; source?: string }) => {
      return await knowledgeDelete(input.tenantId, input.source);
    },
  },
};
