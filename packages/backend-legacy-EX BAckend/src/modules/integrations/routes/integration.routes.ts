import { Router } from 'express';
import { IntegrationController } from '../controllers/integration.controller';
import { upload } from '../../../config/multer';
import { authMiddleware } from '../../auth/middleware/auth.middleware';

const router = Router();
const controller = new IntegrationController();

// Aplicar middleware de autenticación a todas las rutas
router.use(authMiddleware);

// ==================== EXCEL/CSV ====================

// POST - Subir archivo Excel/CSV
router.post('/upload', upload.single('file'), (req, res) => controller.upload(req, res));

// POST - Parsear archivo como preview (sin guardar)
router.post('/parse', upload.single('file'), (req, res) => controller.parsePreview(req, res));

// GET - Listar todas las fuentes de datos
router.get('/data-sources', (req, res) => controller.listDataSources(req, res));

// GET - Obtener estadísticas
router.get('/statistics', (req, res) => controller.getStatistics(req, res));

// GET - Obtener una fuente de datos específica
router.get('/data-sources/:id', (req, res) => controller.getDataSource(req, res));

// GET - Obtener contenido parseado de una fuente de datos
router.get('/data-sources/:id/content', (req, res) => controller.getDataSourceContent(req, res));

// POST - Generar knowledge base desde una fuente de datos
router.post('/data-sources/:id/knowledge-base', (req, res) => controller.generateKnowledgeBase(req, res));

// POST - Actualizar knowledge base del agente WhatsApp
router.post('/data-sources/:id/update-agent', (req, res) => controller.updateAgentKnowledge(req, res));

// DELETE - Eliminar una fuente de datos
router.delete('/data-sources/:id', (req, res) => controller.deleteDataSource(req, res));

// ==================== GOOGLE SHEETS ====================

// POST - Conectar con Google Sheets
router.post('/google-sheets/connect', (req, res) => controller.connectGoogleSheet(req, res));

// GET - Listar conexiones de Google Sheets
router.get('/google-sheets', (req, res) => controller.listGoogleSheets(req, res));

// GET - Obtener nombres de hojas de un spreadsheet
router.get('/google-sheets/:spreadsheetId/sheets', (req, res) => controller.getSheetNames(req, res));

// GET - Leer datos de una hoja
router.get('/google-sheets/:spreadsheetId/data', (req, res) => controller.readGoogleSheet(req, res));

// POST - Generar knowledge base desde Google Sheets
router.post('/google-sheets/:spreadsheetId/knowledge-base', (req, res) => controller.generateGoogleSheetsKnowledgeBase(req, res));

// POST - Sincronizar knowledge base con agente WhatsApp
router.post('/google-sheets/:spreadsheetId/sync-agent/:agentId', (req, res) => controller.syncGoogleSheetsToAgent(req, res));

// DELETE - Desconectar Google Sheets
router.delete('/google-sheets/:spreadsheetId', (req, res) => controller.disconnectGoogleSheet(req, res));

export { router as integrationRoutes };
