/**
 * Controller para gestión de permisos del agente
 */

import { Request, Response } from 'express';
import { getPermissionHandler } from '../internal/classes/PermissionHandler';

export class PermissionsController {
  /**
   * Obtiene permisos pendientes
   */
  async getPending(req: Request, res: Response): Promise<void> {
    try {
      const tenantId = req.tenantId!;
      const handler = getPermissionHandler();

      const pending = handler.getPendingRequests(tenantId);

      res.json({
        pending,
        total: pending.length,
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Responde a una solicitud de permiso
   */
  async respond(req: Request, res: Response): Promise<void> {
    try {
      const tenantId = req.tenantId!;
      const { requestId, granted, reason } = req.body;

      if (!requestId || typeof granted !== 'boolean') {
        res.status(400).json({ error: 'requestId y granted son requeridos' });
        return;
      }

      const handler = getPermissionHandler();
      const success = handler.respondToRequest(requestId, granted, reason, req.userId);

      if (!success) {
        res.status(404).json({ error: 'Solicitud no encontrada' });
        return;
      }

      res.json({
        success: true,
        message: granted ? 'Permiso otorgado' : 'Permiso denegado',
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Obtiene reglas de permisos
   */
  async getRules(req: Request, res: Response): Promise<void> {
    try {
      const tenantId = req.tenantId!;
      const handler = getPermissionHandler();

      const rules = handler.getRules(tenantId);

      res.json(rules);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Crea una regla de permiso
   */
  async createRule(req: Request, res: Response): Promise<void> {
    try {
      const tenantId = req.tenantId!;
      const { operation, pattern, allowed } = req.body;

      if (!operation || !pattern || typeof allowed !== 'boolean') {
        res.status(400).json({ error: 'operation, pattern y allowed son requeridos' });
        return;
      }

      const handler = getPermissionHandler();
      const rule = handler.addRule(tenantId, {
        operation,
        pattern,
        allowed,
        createdBy: req.userId || 'system',
      });

      res.status(201).json(rule);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Elimina una regla de permiso
   */
  async deleteRule(req: Request, res: Response): Promise<void> {
    try {
      const tenantId = req.tenantId!;
      const { ruleId } = req.params;

      const handler = getPermissionHandler();
      const success = handler.removeRule(tenantId, ruleId);

      if (!success) {
        res.status(404).json({ error: 'Regla no encontrada' });
        return;
      }

      res.json({ success: true, message: 'Regla eliminada' });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }
}

export const permissionsController = new PermissionsController();
