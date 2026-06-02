/**
 * ApiConnectorsController - Controlador para conectores de API
 * FASE 6: Integración Agéntica
 */

import { Request, Response } from 'express';
import { apiDocsService, ApiDocumentation, ConnectorConfig, GeneratedConnector } from '../services/api-docs.service';

export class ApiConnectorsController {
  /**
   * Lee documentación de API desde URL
   */
  async readDocs(req: Request, res: Response): Promise<void> {
    try {
      const { url } = req.body;

      if (!url) {
        res.status(400).json({ error: 'URL es requerida' });
        return;
      }

      const documentation = await apiDocsService.readDocumentation(url);

      res.json({
        success: true,
        documentation: {
        info: documentation.info,
        servers: documentation.servers,
        paths: Object.keys(documentation.paths).length,
        components: documentation.components,
      },
    });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Genera un conector desde documentación
   */
  async generate(req: Request, res: Response): Promise<void> {
    try {
      const tenantId = req.tenantId!;
      const config: ConnectorConfig = req.body;

      if (!config.name || !config.baseUrl) {
        res.status(400).json({
          error: 'Campos requeridos: name, baseUrl',
      });
        return;
      }

      // Si hay documentación, usarla
      let documentation: ApiDocumentation | undefined;
      if (config.documentationUrl) {
        documentation = await apiDocsService.readDocumentation(config.documentationUrl);
      }

      // Si no hay documentación, crear una mínima desde config
      if (!documentation) {
        documentation = {
          info: { title: config.name, version: '1.0' },
          servers: [{ url: config.baseUrl || '' }],
          paths: {},
        };
      }

      const connector = await apiDocsService.generateConnector(tenantId, documentation, config);

      res.status(201).json({
        success: true,
        connector: {
          id: connector.id,
          name: connector.name,
          description: connector.description,
          baseUrl: connector.baseUrl,
          authType: connector.authType,
          toolsCount: connector.tools.length,
        },
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Prueba un conector
   */
  async test(req: Request, res: Response): Promise<void> {
    try {
      const tenantId = req.tenantId!;
      const { connectorId } = req.params;
      const { toolName, input = {} } = req.body;

      if (!toolName) {
        res.status(400).json({ error: 'toolName es requerido' });
        return;
      }

      const result = await apiDocsService.testConnector(tenantId, connectorId, toolName, input);

      res.json({
        success: result.success,
        result,
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Lista conectores de un tenant
   */
  async listConnectors(req: Request, res: Response): Promise<void> {
    try {
      const tenantId = req.tenantId!;
      const connectors = await apiDocsService.listConnectors(tenantId);

      res.json({
        success: true,
        connectors,
        count: connectors.length,
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Obtiene un conector por ID
   */
  async getConnector(req: Request, res: Response): Promise<void> {
    try {
      const tenantId = req.tenantId!;
      const { connectorId } = req.params;

      const connector = await apiDocsService.getConnector(tenantId, connectorId);

      if (!connector) {
        res.status(404).json({ error: 'Conector no encontrado' });
        return;
      }

      res.json({
        success: true,
        connector,
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Elimina un conector
   */
  async deleteConnector(req: Request, res: Response): Promise<void> {
    try {
      const tenantId = req.tenantId!;
      const { connectorId } = req.params;

      await apiDocsService.deleteConnector(tenantId, connectorId);

      res.json({
        success: true,
        message: 'Conector eliminado',
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Obtiene herramientas de un conector
   */
  async getTools(req: Request, res: Response): Promise<void> {
    try {
      const tenantId = req.tenantId!;
      const { connectorId } = req.params;

      const tools = await apiDocsService.getConnectorTools(connectorId);

      res.json({
        success: true,
        tools,
        count: tools.length,
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Ejecuta una herramienta específica
   */
  async executeTool(req: Request, res: Response): Promise<void> {
    try {
      const tenantId = req.tenantId!;
      const { connectorId, toolId } = req.params;
      const input = req.body.input || {};

      const result = await apiDocsService.executeTool(
        tenantId,
        connectorId,
        toolId,
        input
      );

      res.json({
        success: result.success,
        result,
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }
}

export const apiConnectorsController = new ApiConnectorsController();
