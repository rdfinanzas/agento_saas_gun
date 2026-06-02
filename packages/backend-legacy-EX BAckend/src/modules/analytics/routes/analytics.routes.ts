import { Router } from 'express';
import { AnalyticsController } from '../controllers/analytics.controller';
import { authMiddleware } from '../../auth/middleware/auth.middleware';

/**
 * Analytics Routes - FASE 3.2
 *
 * Todas las rutas están protegidas por autenticación.
 * El tenantId se extrae del token JWT.
 */
const router = Router();
const analyticsController = new AnalyticsController();

// Aplicar middleware de autenticación a todas las rutas
router.use(authMiddleware);

/**
 * @route   GET /api/v1/analytics/dashboard
 * @desc    Obtiene estadísticas generales del dashboard
 * @access  Private (requiere autenticación)
 */
router.get('/dashboard', (req, res) => analyticsController.getDashboardStats(req, res));

/**
 * @route   GET /api/v1/analytics/conversations
 * @desc    Métricas de conversaciones por período
 * @query   period - day|week|month (default: day)
 * @query   days - número de días (default: 30)
 * @access  Private
 */
router.get('/conversations', (req, res) => analyticsController.getConversationMetrics(req, res));

/**
 * @route   GET /api/v1/analytics/usage
 * @desc    Estadísticas de uso desde TenantUsage
 * @query   days - número de días (default: 30)
 * @access  Private
 */
router.get('/usage', (req, res) => analyticsController.getUsageStats(req, res));

/**
 * @route   GET /api/v1/analytics/agents/performance
 * @desc    Performance por agente (WhatsAppConfig)
 * @query   days - número de días (default: 30)
 * @access  Private
 */
router.get('/agents/performance', (req, res) => analyticsController.getAgentPerformance(req, res));

/**
 * @route   GET /api/v1/analytics/queries/top
 * @desc    Top queries extraídas del historial
 * @query   limit - número de resultados (default: 10)
 * @query   days - número de días (default: 30)
 * @access  Private
 */
router.get('/queries/top', (req, res) => analyticsController.getTopQueries(req, res));

/**
 * @route   GET /api/v1/analytics/response-time
 * @desc    Métricas de tiempo de respuesta
 * @query   days - número de días (default: 30)
 * @access  Private
 */
router.get('/response-time', (req, res) => analyticsController.getResponseTimeMetrics(req, res));

/**
 * @route   GET /api/v1/analytics/complete
 * @desc    Métricas completas consolidadas (todas las anteriores en una sola llamada)
 * @query   days - número de días (default: 30)
 * @access  Private
 */
router.get('/complete', (req, res) => analyticsController.getCompleteAnalytics(req, res));

// ============================================================
// RUTAS DE EXPORTACIÓN - FASE 3
// ============================================================

/**
 * @route   GET /api/v1/analytics/export/pdf
 * @desc    Genera y descarga un reporte PDF con métricas y KPIs
 * @query   startDate - fecha de inicio (ISO format)
 * @query   endDate - fecha de fin (ISO format)
 * @query   includeCharts - incluir gráficos (default: true)
 * @query   language - idioma (es|en, default: es)
 * @access  Private
 */
router.get('/export/pdf', (req, res) => analyticsController.exportPDFReport(req, res));

/**
 * @route   GET /api/v1/analytics/export/excel
 * @desc    Genera y descarga un reporte Excel con datos crudos y métricas
 * @query   startDate - fecha de inicio (ISO format)
 * @query   endDate - fecha de fin (ISO format)
 * @query   includeRawData - incluir datos crudos (default: true)
 * @query   includeCharts - incluir gráficos (default: true)
 * @access  Private
 */
router.get('/export/excel', (req, res) => analyticsController.exportExcelReport(req, res));

// ============================================================
// RUTAS DE KPIS - FASE 3
// ============================================================

/**
 * @route   GET /api/v1/analytics/kpis
 * @desc    Obtiene KPIs de negocio para el dashboard
 * @query   startDate - fecha de inicio (ISO format)
 * @query   endDate - fecha de fin (ISO format)
 * @access  Private
 */
router.get('/kpis', (req, res) => analyticsController.getKPIs(req, res));

/**
 * @route   GET /api/v1/analytics/kpis/compare
 * @desc    Compara KPIs entre dos períodos
 * @query   currentStartDate - fecha de inicio del período actual
 * @query   currentEndDate - fecha de fin del período actual
 * @query   previousStartDate - fecha de inicio del período anterior
 * @query   previousEndDate - fecha de fin del período anterior
 * @access  Private
 */
router.get('/kpis/compare', (req, res) => analyticsController.compareKPIs(req, res));

/**
 * @route   GET /api/v1/analytics/kpis/trends
 * @desc    Obtiene tendencias de KPIs a lo largo del tiempo
 * @query   days - número de días (default: 30, max: 365)
 * @access  Private
 */
router.get('/kpis/trends', (req, res) => analyticsController.getKPITrends(req, res));

export { router as analyticsRoutes };
