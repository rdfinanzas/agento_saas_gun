/**
 * Knowledge Routes - Rutas para gestión de base de conocimiento
 * FASE 4: Embeddings y búsqueda semántica
 */

import { Router } from 'express';
import { knowledgeController } from '../controllers/knowledge.controller';
import { authMiddleware } from '../../auth/middleware/auth.middleware';

const router = Router();

// Todas las rutas requieren autenticación
router.use(authMiddleware);

// ============================================
// Búsqueda
// ============================================

/**
 * @route GET /api/v1/knowledge/search
 * @description Búsqueda semántica en la base de conocimiento
 * @query {string} query - Texto a buscar
 * @query {number} limit - Límite de resultados (default: 10)
 * @query {number} threshold - Umbral de similitud (default: 0.5)
 * @query {boolean} hybrid - Usar búsqueda híbrida (default: false)
 */
router.get('/search', (req, res) => knowledgeController.search(req, res));

/**
 * @route GET /api/v1/knowledge/context
 * @description Obtiene contexto relevante para una consulta
 * @query {string} query - Consulta
 * @query {number} maxTokens - Máximo de tokens (default: 2000)
 */
router.get('/context', (req, res) => knowledgeController.getContext(req, res));

// ============================================
// Indexación
// ============================================

/**
 * @route POST /api/v1/knowledge/index
 * @description Indexa contenido en la base de conocimiento
 * @body {string} content - Contenido a indexar
 * @body {string} source - Fuente del contenido
 * @body {object} metadata - Metadatos opcionales
 * @body {number} chunkSize - Tamaño de chunk (default: 500)
 * @body {number} overlap - Overlap entre chunks (default: 50)
 */
router.post('/index', (req, res) => knowledgeController.indexContent(req, res));

/**
 * @route POST /api/v1/knowledge/reindex
 * @description Re-indexa contenido (elimina anteriores y vuelve a indexar)
 */
router.post('/reindex', (req, res) => knowledgeController.reindexContent(req, res));

/**
 * @route POST /api/v1/knowledge/index-agent
 * @description Indexa toda la base de conocimiento del agente
 * @body {object} faq - FAQs
 * @body {array} products - Productos
 * @body {object} policies - Políticas
 * @body {object} businessInfo - Información del negocio
 * @body {array} customDocuments - Documentos personalizados
 */
router.post('/index-agent', (req, res) => knowledgeController.indexAgentKnowledge(req, res));

// ============================================
// Gestión de Embeddings
// ============================================

/**
 * @route GET /api/v1/knowledge/stats
 * @description Obtiene estadísticas de embeddings
 */
router.get('/stats', (req, res) => knowledgeController.getStats(req, res));

/**
 * @route GET /api/v1/knowledge/source/:source
 * @description Obtiene embeddings por fuente
 */
router.get('/source/:source', (req, res) => knowledgeController.getBySource(req, res));

/**
 * @route DELETE /api/v1/knowledge/source/:source
 * @description Elimina embeddings por fuente
 */
router.delete('/source/:source', (req, res) => knowledgeController.deleteBySource(req, res));

/**
 * @route DELETE /api/v1/knowledge/:id
 * @description Elimina un embedding específico
 */
router.delete('/:id', (req, res) => knowledgeController.deleteEmbedding(req, res));

/**
 * @route DELETE /api/v1/knowledge/
 * @description Elimina todos los embeddings del tenant
 */
router.delete('/', (req, res) => knowledgeController.deleteAll(req, res));

// ============================================
// Tests
// ============================================

/**
 * @route POST /api/v1/knowledge/test/embedding
 * @description Prueba la generación de embeddings
 */
router.post('/test/embedding', (req, res) => knowledgeController.testEmbedding(req, res));

/**
 * @route POST /api/v1/knowledge/test/similarity
 * @description Prueba similitud entre dos textos
 */
router.post('/test/similarity', (req, res) => knowledgeController.testSimilarity(req, res));

export { router as knowledgeRoutes };
