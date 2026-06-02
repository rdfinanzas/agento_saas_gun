import { Request, Response } from 'express';
import { DataSourceService } from '../services/data-source.service';
import { ExcelParserService } from '../services/excel-parser.service';
import { GoogleSheetsService } from '../services/google-sheets.service';

export class IntegrationController {
  private dataSourceService = new DataSourceService();
  private excelParser = new ExcelParserService();
  private googleSheetsService = new GoogleSheetsService();

  /**
   * POST /api/v1/integrations/upload
   * Sube un archivo Excel/CSV y lo registra como fuente de datos
   */
  async upload(req: Request, res: Response) {
    try {
      const tenantId = (req as any).tenantId;

      if (!tenantId) {
        return res.status(400).json({ error: 'Tenant ID requerido' });
      }

      if (!req.file) {
        return res.status(400).json({ error: 'No se subió ningún archivo' });
      }

      const result = await this.dataSourceService.createFromFile({
        tenantId,
        name: req.file.originalname,
        filePath: req.file.path,
        mimeType: req.file.mimetype,
        size: req.file.size
      });

      res.status(201).json({
        success: true,
        data: result
      });
    } catch (error: any) {
      console.error('Error en upload:', error);
      res.status(500).json({
        error: 'Error al subir archivo',
        message: error.message
      });
    }
  }

  /**
   * GET /api/v1/integrations/data-sources
   * Lista todas las fuentes de datos del tenant
   */
  async listDataSources(req: Request, res: Response) {
    try {
      const tenantId = (req as any).tenantId;
      const category = req.query.category as string;

      if (!tenantId) {
        return res.status(400).json({ error: 'Tenant ID requerido' });
      }

      const sources = await this.dataSourceService.listByTenant(tenantId, category);

      res.json({
        success: true,
        data: sources,
        total: sources.length
      });
    } catch (error: any) {
      console.error('Error listando data sources:', error);
      res.status(500).json({
        error: 'Error al listar fuentes de datos',
        message: error.message
      });
    }
  }

  /**
   * GET /api/v1/integrations/data-sources/:id
   * Obtiene una fuente de datos específica
   */
  async getDataSource(req: Request, res: Response) {
    try {
      const tenantId = (req as any).tenantId;
      const { id } = req.params;

      if (!tenantId) {
        return res.status(400).json({ error: 'Tenant ID requerido' });
      }

      const source = await this.dataSourceService.getById(tenantId, id);

      if (!source) {
        return res.status(404).json({ error: 'Fuente de datos no encontrada' });
      }

      res.json({
        success: true,
        data: source
      });
    } catch (error: any) {
      console.error('Error obteniendo data source:', error);
      res.status(500).json({
        error: 'Error al obtener fuente de datos',
        message: error.message
      });
    }
  }

  /**
   * GET /api/v1/integrations/data-sources/:id/content
   * Obtiene el contenido parseado de una fuente de datos
   */
  async getDataSourceContent(req: Request, res: Response) {
    try {
      const tenantId = (req as any).tenantId;
      const { id } = req.params;

      if (!tenantId) {
        return res.status(400).json({ error: 'Tenant ID requerido' });
      }

      const content = await this.dataSourceService.getParsedContent(tenantId, id);

      res.json({
        success: true,
        data: content
      });
    } catch (error: any) {
      console.error('Error obteniendo contenido:', error);
      res.status(500).json({
        error: 'Error al obtener contenido',
        message: error.message
      });
    }
  }

  /**
   * POST /api/v1/integrations/data-sources/:id/knowledge-base
   * Genera una knowledge base desde una fuente de datos
   */
  async generateKnowledgeBase(req: Request, res: Response) {
    try {
      const tenantId = (req as any).tenantId;
      const { id } = req.params;

      if (!tenantId) {
        return res.status(400).json({ error: 'Tenant ID requerido' });
      }

      const knowledgeBase = await this.dataSourceService.generateKnowledgeBase(tenantId, id);

      res.json({
        success: true,
        data: knowledgeBase
      });
    } catch (error: any) {
      console.error('Error generando knowledge base:', error);
      res.status(500).json({
        error: 'Error al generar knowledge base',
        message: error.message
      });
    }
  }

  /**
   * POST /api/v1/integrations/data-sources/:id/update-agent
   * Actualiza la knowledge base del agente WhatsApp con datos de una fuente
   */
  async updateAgentKnowledge(req: Request, res: Response) {
    try {
      const tenantId = (req as any).tenantId;
      const { id } = req.params;

      if (!tenantId) {
        return res.status(400).json({ error: 'Tenant ID requerido' });
      }

      await this.dataSourceService.updateAgentKnowledge(tenantId, id);

      res.json({
        success: true,
        message: 'Knowledge base del agente actualizada exitosamente'
      });
    } catch (error: any) {
      console.error('Error actualizando agent knowledge:', error);
      res.status(500).json({
        error: 'Error al actualizar knowledge base del agente',
        message: error.message
      });
    }
  }

  /**
   * DELETE /api/v1/integrations/data-sources/:id
   * Elimina una fuente de datos
   */
  async deleteDataSource(req: Request, res: Response) {
    try {
      const tenantId = (req as any).tenantId;
      const { id } = req.params;

      if (!tenantId) {
        return res.status(400).json({ error: 'Tenant ID requerido' });
      }

      await this.dataSourceService.delete(tenantId, id);

      res.json({
        success: true,
        message: 'Fuente de datos eliminada exitosamente'
      });
    } catch (error: any) {
      console.error('Error eliminando data source:', error);
      res.status(500).json({
        error: 'Error al eliminar fuente de datos',
        message: error.message
      });
    }
  }

  /**
   * GET /api/v1/integrations/statistics
   * Obtiene estadísticas de uso de integraciones
   */
  async getStatistics(req: Request, res: Response) {
    try {
      const tenantId = (req as any).tenantId;

      if (!tenantId) {
        return res.status(400).json({ error: 'Tenant ID requerido' });
      }

      const stats = await this.dataSourceService.getStatistics(tenantId);

      res.json({
        success: true,
        data: stats
      });
    } catch (error: any) {
      console.error('Error obteniendo estadísticas:', error);
      res.status(500).json({
        error: 'Error al obtener estadísticas',
        message: error.message
      });
    }
  }

  /**
   * POST /api/v1/integrations/parse
   * Parsea un archivo Excel/CSV sin guardarlo (preview)
   */
  async parsePreview(req: Request, res: Response) {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'No se subió ningún archivo' });
      }

      const parsed = await this.excelParser.parse(req.file.path);
      const statistics = this.excelParser.getStatistics(parsed);

      // Eliminar archivo temporal después del parse
      const fs = require('fs');
      if (fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }

      res.json({
        success: true,
        data: {
          parsed,
          statistics
        }
      });
    } catch (error: any) {
      console.error('Error en parse preview:', error);
      res.status(500).json({
        error: 'Error al parsear archivo',
        message: error.message
      });
    }
  }

  // ==================== GOOGLE SHEETS ====================

  /**
   * POST /api/v1/integrations/google-sheets/connect
   * Conecta con una hoja de Google Sheets
   */
  async connectGoogleSheet(req: Request, res: Response) {
    try {
      const tenantId = (req as any).tenantId;
      const { clientEmail, privateKey, spreadsheetId } = req.body;

      if (!tenantId) {
        return res.status(400).json({ error: 'Tenant ID requerido' });
      }

      if (!clientEmail || !privateKey || !spreadsheetId) {
        return res.status(400).json({
          error: 'clientEmail, privateKey y spreadsheetId son requeridos'
        });
      }

      const result = await this.googleSheetsService.connect(tenantId, {
        clientEmail,
        privateKey,
        spreadsheetId
      });

      if (!result.success) {
        return res.status(400).json({
          error: 'Error al conectar con Google Sheets',
          message: result.error
        });
      }

      res.status(201).json({
        success: true,
        message: 'Conexión establecida exitosamente',
        data: { title: result.title, spreadsheetId }
      });
    } catch (error: any) {
      console.error('Error conectando Google Sheets:', error);
      res.status(500).json({
        error: 'Error al conectar con Google Sheets',
        message: error.message
      });
    }
  }

  /**
   * GET /api/v1/integrations/google-sheets
   * Lista todas las conexiones de Google Sheets
   */
  async listGoogleSheets(req: Request, res: Response) {
    try {
      const tenantId = (req as any).tenantId;

      if (!tenantId) {
        return res.status(400).json({ error: 'Tenant ID requerido' });
      }

      const connections = await this.googleSheetsService.listConnections(tenantId);

      res.json({
        success: true,
        data: connections,
        total: connections.length
      });
    } catch (error: any) {
      console.error('Error listando Google Sheets:', error);
      res.status(500).json({
        error: 'Error al listar conexiones',
        message: error.message
      });
    }
  }

  /**
   * GET /api/v1/integrations/google-sheets/:spreadsheetId/sheets
   * Obtiene los nombres de las hojas dentro de un spreadsheet
   */
  async getSheetNames(req: Request, res: Response) {
    try {
      const tenantId = (req as any).tenantId;
      const { spreadsheetId } = req.params;

      if (!tenantId) {
        return res.status(400).json({ error: 'Tenant ID requerido' });
      }

      const sheets = await this.googleSheetsService.getSheetNames(tenantId, spreadsheetId);

      res.json({
        success: true,
        data: sheets
      });
    } catch (error: any) {
      console.error('Error obteniendo nombres de hojas:', error);
      res.status(500).json({
        error: 'Error al obtener nombres de hojas',
        message: error.message
      });
    }
  }

  /**
   * GET /api/v1/integrations/google-sheets/:spreadsheetId/data
   * Lee los datos de una hoja de Google Sheets
   */
  async readGoogleSheet(req: Request, res: Response) {
    try {
      const tenantId = (req as any).tenantId;
      const { spreadsheetId } = req.params;
      const range = req.query.range as string;

      if (!tenantId) {
        return res.status(400).json({ error: 'Tenant ID requerido' });
      }

      const data = await this.googleSheetsService.readSheet(tenantId, spreadsheetId, range);

      if (!data) {
        return res.status(404).json({ error: 'No se pudieron leer los datos' });
      }

      res.json({
        success: true,
        data
      });
    } catch (error: any) {
      console.error('Error leyendo Google Sheet:', error);
      res.status(500).json({
        error: 'Error al leer hoja',
        message: error.message
      });
    }
  }

  /**
   * POST /api/v1/integrations/google-sheets/:spreadsheetId/knowledge-base
   * Genera una knowledge base desde Google Sheets
   */
  async generateGoogleSheetsKnowledgeBase(req: Request, res: Response) {
    try {
      const tenantId = (req as any).tenantId;
      const { spreadsheetId } = req.params;
      const { sheetName } = req.body;

      if (!tenantId) {
        return res.status(400).json({ error: 'Tenant ID requerido' });
      }

      const knowledgeBase = await this.googleSheetsService.generateKnowledgeBase(
        tenantId,
        spreadsheetId,
        sheetName
      );

      if (!knowledgeBase) {
        return res.status(400).json({ error: 'Error al generar knowledge base' });
      }

      res.json({
        success: true,
        message: 'Knowledge base generada exitosamente',
        data: knowledgeBase
      });
    } catch (error: any) {
      console.error('Error generando knowledge base:', error);
      res.status(500).json({
        error: 'Error al generar knowledge base',
        message: error.message
      });
    }
  }

  /**
   * POST /api/v1/integrations/google-sheets/:spreadsheetId/sync-agent/:agentId
   * Sincroniza la knowledge base con un agente WhatsApp
   */
  async syncGoogleSheetsToAgent(req: Request, res: Response) {
    try {
      const tenantId = (req as any).tenantId;
      const { spreadsheetId, agentId } = req.params;

      if (!tenantId) {
        return res.status(400).json({ error: 'Tenant ID requerido' });
      }

      const success = await this.googleSheetsService.syncKnowledgeBaseToAgent(
        tenantId,
        spreadsheetId,
        agentId
      );

      if (!success) {
        return res.status(400).json({ error: 'Error al sincronizar con el agente' });
      }

      res.json({
        success: true,
        message: 'Knowledge base sincronizada con el agente exitosamente'
      });
    } catch (error: any) {
      console.error('Error sincronizando con agente:', error);
      res.status(500).json({
        error: 'Error al sincronizar con agente',
        message: error.message
      });
    }
  }

  /**
   * DELETE /api/v1/integrations/google-sheets/:spreadsheetId
   * Desconecta una hoja de Google Sheets
   */
  async disconnectGoogleSheet(req: Request, res: Response) {
    try {
      const tenantId = (req as any).tenantId;
      const { spreadsheetId } = req.params;

      if (!tenantId) {
        return res.status(400).json({ error: 'Tenant ID requerido' });
      }

      const success = await this.googleSheetsService.disconnect(tenantId, spreadsheetId);

      if (!success) {
        return res.status(400).json({ error: 'Error al desconectar' });
      }

      res.json({
        success: true,
        message: 'Conexión eliminada exitosamente'
      });
    } catch (error: any) {
      console.error('Error desconectando Google Sheets:', error);
      res.status(500).json({
        error: 'Error al desconectar',
        message: error.message
      });
    }
  }
}
