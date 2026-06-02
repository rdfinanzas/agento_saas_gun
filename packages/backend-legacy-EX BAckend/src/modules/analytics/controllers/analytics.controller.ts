import { Request, Response } from 'express';
import { AnalyticsService } from '../services/analytics.service';
import { ReportGeneratorService } from '../services/report-generator.service';
import { KPIService } from '../services/kpi.service';

/**
 * Analytics Controller - FASE 3
 *
 * Expone endpoints para obtener métricas, estadísticas, KPIs y reportes.
 * Todos los endpoints requieren autenticación y tenantId.
 */
export class AnalyticsController {
  private analyticsService: AnalyticsService;
  private reportGeneratorService: ReportGeneratorService;
  private kpiService: KPIService;

  constructor() {
    this.analyticsService = new AnalyticsService();
    this.reportGeneratorService = new ReportGeneratorService();
    this.kpiService = new KPIService();
  }

  /**
   * GET /api/v1/analytics/dashboard
   * Obtiene estadísticas generales del dashboard
   */
  async getDashboardStats(req: Request, res: Response) {
    try {
      const tenantId = req.tenantId as string;

      if (!tenantId) {
        return res.status(400).json({
          error: 'tenantId es requerido',
          message: 'El tenantId debe estar en el token JWT'
        });
      }

      const stats = await this.analyticsService.getDashboardStats(tenantId);

      res.json({
        success: true,
        data: stats
      });
    } catch (error) {
      console.error('Error en getDashboardStats:', error);
      res.status(500).json({
        error: 'Error interno del servidor',
        message: error instanceof Error ? error.message : 'Error desconocido'
      });
    }
  }

  /**
   * GET /api/v1/analytics/conversations
   * Métricas de conversaciones por período
   * Query params: period (day|week|month), days (default: 30)
   */
  async getConversationMetrics(req: Request, res: Response) {
    try {
      const tenantId = req.tenantId as string;
      const period = (req.query.period as 'day' | 'week' | 'month') || 'day';
      const days = parseInt(req.query.days as string) || 30;

      if (!tenantId) {
        return res.status(400).json({
          error: 'tenantId es requerido'
        });
      }

      const metrics = await this.analyticsService.getConversationMetrics(
        tenantId,
        period,
        days
      );

      res.json({
        success: true,
        data: metrics
      });
    } catch (error) {
      console.error('Error en getConversationMetrics:', error);
      res.status(500).json({
        error: 'Error interno del servidor',
        message: error instanceof Error ? error.message : 'Error desconocido'
      });
    }
  }

  /**
   * GET /api/v1/analytics/usage
   * Estadísticas de uso desde TenantUsage
   * Query params: days (default: 30)
   */
  async getUsageStats(req: Request, res: Response) {
    try {
      const tenantId = req.tenantId as string;
      const days = parseInt(req.query.days as string) || 30;

      if (!tenantId) {
        return res.status(400).json({
          error: 'tenantId es requerido'
        });
      }

      const stats = await this.analyticsService.getUsageStats(tenantId, days);

      res.json({
        success: true,
        data: stats
      });
    } catch (error) {
      console.error('Error en getUsageStats:', error);
      res.status(500).json({
        error: 'Error interno del servidor',
        message: error instanceof Error ? error.message : 'Error desconocido'
      });
    }
  }

  /**
   * GET /api/v1/analytics/agents/performance
   * Performance por agente (WhatsAppConfig)
   * Query params: days (default: 30)
   */
  async getAgentPerformance(req: Request, res: Response) {
    try {
      const tenantId = req.tenantId as string;
      const days = parseInt(req.query.days as string) || 30;

      if (!tenantId) {
        return res.status(400).json({
          error: 'tenantId es requerido'
        });
      }

      const performance = await this.analyticsService.getAgentPerformance(
        tenantId,
        days
      );

      res.json({
        success: true,
        data: performance
      });
    } catch (error) {
      console.error('Error en getAgentPerformance:', error);
      res.status(500).json({
        error: 'Error interno del servidor',
        message: error instanceof Error ? error.message : 'Error desconocido'
      });
    }
  }

  /**
   * GET /api/v1/analytics/queries/top
   * Top queries extraídas del historial
   * Query params: limit (default: 10), days (default: 30)
   */
  async getTopQueries(req: Request, res: Response) {
    try {
      const tenantId = req.tenantId as string;
      const limit = parseInt(req.query.limit as string) || 10;
      const days = parseInt(req.query.days as string) || 30;

      if (!tenantId) {
        return res.status(400).json({
          error: 'tenantId es requerido'
        });
      }

      const topQueries = await this.analyticsService.getTopQueries(
        tenantId,
        limit,
        days
      );

      res.json({
        success: true,
        data: topQueries
      });
    } catch (error) {
      console.error('Error en getTopQueries:', error);
      res.status(500).json({
        error: 'Error interno del servidor',
        message: error instanceof Error ? error.message : 'Error desconocido'
      });
    }
  }

  /**
   * GET /api/v1/analytics/response-time
   * Métricas de tiempo de respuesta
   * Query params: days (default: 30)
   */
  async getResponseTimeMetrics(req: Request, res: Response) {
    try {
      const tenantId = req.tenantId as string;
      const days = parseInt(req.query.days as string) || 30;

      if (!tenantId) {
        return res.status(400).json({
          error: 'tenantId es requerido'
        });
      }

      const metrics = await this.analyticsService.getResponseTimeMetrics(
        tenantId,
        days
      );

      res.json({
        success: true,
        data: metrics
      });
    } catch (error) {
      console.error('Error en getResponseTimeMetrics:', error);
      res.status(500).json({
        error: 'Error interno del servidor',
        message: error instanceof Error ? error.message : 'Error desconocido'
      });
    }
  }

  /**
   * GET /api/v1/analytics/complete
   * Métricas completas consolidadas
   * Query params: days (default: 30)
   */
  async getCompleteAnalytics(req: Request, res: Response) {
    try {
      const tenantId = req.tenantId as string;
      const days = parseInt(req.query.days as string) || 30;

      if (!tenantId) {
        return res.status(400).json({
          error: 'tenantId es requerido'
        });
      }

      const analytics = await this.analyticsService.getCompleteAnalytics(
        tenantId,
        days
      );

      res.json({
        success: true,
        data: analytics
      });
    } catch (error) {
      console.error('Error en getCompleteAnalytics:', error);
      res.status(500).json({
        error: 'Error interno del servidor',
        message: error instanceof Error ? error.message : 'Error desconocido'
      });
    }
  }

  /**
   * GET /api/v1/analytics/export/pdf
   * Genera y descarga un reporte PDF
   * Query params: startDate, endDate, includeCharts (default: true), language (es|en)
   */
  async exportPDFReport(req: Request, res: Response) {
    try {
      const tenantId = req.tenantId as string;

      if (!tenantId) {
        return res.status(400).json({
          error: 'tenantId es requerido'
        });
      }

      // Parse query parameters
      const startDate = req.query.startDate
        ? new Date(req.query.startDate as string)
        : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

      const endDate = req.query.endDate
        ? new Date(req.query.endDate as string)
        : new Date();

      const includeCharts = req.query.includeCharts !== 'false';
      const language = (req.query.language as 'es' | 'en') || 'es';

      // Validar fechas
      if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
        return res.status(400).json({
          error: 'Formato de fecha inválido',
          message: 'Use formato ISO: YYYY-MM-DD'
        });
      }

      if (startDate > endDate) {
        return res.status(400).json({
          error: 'Rango de fechas inválido',
          message: 'La fecha de inicio debe ser anterior a la fecha fin'
        });
      }

      // Generar y enviar PDF
      await this.reportGeneratorService.generateAndSendPDF(res, tenantId, {
        startDate,
        endDate,
        includeCharts,
        language
      });

    } catch (error) {
      console.error('Error en exportPDFReport:', error);
      res.status(500).json({
        error: 'Error interno del servidor',
        message: error instanceof Error ? error.message : 'Error desconocido'
      });
    }
  }

  /**
   * GET /api/v1/analytics/export/excel
   * Genera y descarga un reporte Excel
   * Query params: startDate, endDate, includeRawData (default: true), includeCharts (default: true)
   */
  async exportExcelReport(req: Request, res: Response) {
    try {
      const tenantId = req.tenantId as string;

      if (!tenantId) {
        return res.status(400).json({
          error: 'tenantId es requerido'
        });
      }

      // Parse query parameters
      const startDate = req.query.startDate
        ? new Date(req.query.startDate as string)
        : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

      const endDate = req.query.endDate
        ? new Date(req.query.endDate as string)
        : new Date();

      const includeRawData = req.query.includeRawData !== 'false';
      const includeCharts = req.query.includeCharts !== 'false';

      // Validar fechas
      if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
        return res.status(400).json({
          error: 'Formato de fecha inválido',
          message: 'Use formato ISO: YYYY-MM-DD'
        });
      }

      if (startDate > endDate) {
        return res.status(400).json({
          error: 'Rango de fechas inválido',
          message: 'La fecha de inicio debe ser anterior a la fecha fin'
        });
      }

      // Generar y enviar Excel
      await this.reportGeneratorService.generateAndSendExcel(res, tenantId, {
        startDate,
        endDate,
        includeRawData,
        includeCharts
      });

    } catch (error) {
      console.error('Error en exportExcelReport:', error);
      res.status(500).json({
        error: 'Error interno del servidor',
        message: error instanceof Error ? error.message : 'Error desconocido'
      });
    }
  }

  /**
   * GET /api/v1/analytics/kpis
   * Obtiene KPIs de negocio para el dashboard
   * Query params: startDate, endDate
   */
  async getKPIs(req: Request, res: Response) {
    try {
      const tenantId = req.tenantId as string;

      if (!tenantId) {
        return res.status(400).json({
          error: 'tenantId es requerido'
        });
      }

      // Parse query parameters
      const startDate = req.query.startDate
        ? new Date(req.query.startDate as string)
        : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

      const endDate = req.query.endDate
        ? new Date(req.query.endDate as string)
        : new Date();

      // Validar fechas
      if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
        return res.status(400).json({
          error: 'Formato de fecha inválido',
          message: 'Use formato ISO: YYYY-MM-DD'
        });
      }

      // Obtener KPIs
      const kpis = await this.kpiService.getKPIs(tenantId, { startDate, endDate });

      res.json({
        success: true,
        data: kpis,
        period: {
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString()
        }
      });

    } catch (error) {
      console.error('Error en getKPIs:', error);
      res.status(500).json({
        error: 'Error interno del servidor',
        message: error instanceof Error ? error.message : 'Error desconocido'
      });
    }
  }

  /**
   * GET /api/v1/analytics/kpis/compare
   * Compara KPIs entre dos períodos
   * Query params: currentStartDate, currentEndDate, previousStartDate, previousEndDate
   */
  async compareKPIs(req: Request, res: Response) {
    try {
      const tenantId = req.tenantId as string;

      if (!tenantId) {
        return res.status(400).json({
          error: 'tenantId es requerido'
        });
      }

      // Parse query parameters
      const currentStartDate = req.query.currentStartDate
        ? new Date(req.query.currentStartDate as string)
        : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

      const currentEndDate = req.query.currentEndDate
        ? new Date(req.query.currentEndDate as string)
        : new Date();

      const previousStartDate = req.query.previousStartDate
        ? new Date(req.query.previousStartDate as string)
        : new Date(currentStartDate.getTime() - (currentEndDate.getTime() - currentStartDate.getTime()));

      const previousEndDate = req.query.previousEndDate
        ? new Date(req.query.previousEndDate as string)
        : currentStartDate;

      // Comparar KPIs
      const comparison = await this.kpiService.compareKPIs(
        tenantId,
        { startDate: currentStartDate, endDate: currentEndDate },
        { startDate: previousStartDate, endDate: previousEndDate }
      );

      res.json({
        success: true,
        data: comparison
      });

    } catch (error) {
      console.error('Error en compareKPIs:', error);
      res.status(500).json({
        error: 'Error interno del servidor',
        message: error instanceof Error ? error.message : 'Error desconocido'
      });
    }
  }

  /**
   * GET /api/v1/analytics/kpis/trends
   * Obtiene tendencias de KPIs a lo largo del tiempo
   * Query params: days (default: 30)
   */
  async getKPITrends(req: Request, res: Response) {
    try {
      const tenantId = req.tenantId as string;

      if (!tenantId) {
        return res.status(400).json({
          error: 'tenantId es requerido'
        });
      }

      const days = parseInt(req.query.days as string) || 30;

      // Limitar a 365 días para no sobrecargar
      if (days > 365) {
        return res.status(400).json({
          error: 'Rango de fechas muy amplio',
          message: 'El máximo es 365 días'
        });
      }

      // Obtener tendencias
      const trends = await this.kpiService.getKPITrends(tenantId, days);

      res.json({
        success: true,
        data: trends,
        meta: {
          days,
          generatedAt: new Date().toISOString()
        }
      });

    } catch (error) {
      console.error('Error en getKPITrends:', error);
      res.status(500).json({
        error: 'Error interno del servidor',
        message: error instanceof Error ? error.message : 'Error desconocido'
      });
    }
  }
}
