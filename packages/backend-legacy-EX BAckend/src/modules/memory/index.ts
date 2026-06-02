/**
 * Memory Module - Export all memory-related services
 * FASE 4: Embeddings y búsqueda semántica
 */

// Services
export { MemoryService, memoryService } from './services/memory.service';
export { EmbeddingsService, embeddingsService } from './services/embeddings.service';

// Types
export type {
  EmbeddingVector,
  SearchResult,
  EmbeddingOptions,
  IndexContentOptions,
  EmbeddingProvider,
} from './services/embeddings.service';

// Controller
export { KnowledgeController, knowledgeController } from './controllers/knowledge.controller';

// Routes
export { knowledgeRoutes } from './routes/knowledge.routes';
