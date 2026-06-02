/**
 * ApprovalController - Controlador para flujo de aprobación
 * FASE 7: Flujo de Aprobación
 */

import { Request, Response } from 'express';
import { approvalService } from '../services/approval.service';
import { prisma } from '../../../config/database';

export class ApprovalController {
  /**
   * Obtiene todas las respuestas pendientes (con filtros)
   */
  async getPending(req: Request, res: Response): Promise<void> {
    try {
      const tenantId = req.tenantId!;
      const { status, agentId, limit } = req.query;

      let responses = await approvalService.getPendingResponses(tenantId);

      // Apply filters
      if (status && status !== 'all') {
        responses = responses.filter((r) => r.status === status);
      }
      if (agentId) {
        responses = responses.filter((r) => r.agentId === agentId);
      }
      if (limit) {
        responses = responses.slice(0, parseInt(limit as string));
      }

      // Enrich with conversation details
      const enrichedResponses = await Promise.all(
        responses.map(async (response) => {
          const conversation = await prisma.conversation.findFirst({
            where: { id: response.conversationId },
            select: {
              phoneNumber: true,
              messages: {
                where: { direction: 'INCOMING' },
                orderBy: { createdAt: 'desc' },
                take: 1,
              },
            },
          });

          return {
            ...response,
            conversation: conversation
              ? {
                  phoneNumber: conversation.phoneNumber,
                  customerMessage: conversation.messages[0]?.content,
                }
              : undefined,
          };
        })
      );

      res.json({
        success: true,
        responses: enrichedResponses,
        count: enrichedResponses.length,
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Obtiene todas las aprobaciones (incluyendo historial)
   */
  async getAll(req: Request, res: Response): Promise<void> {
    try {
      const tenantId = req.tenantId!;
      const { status, limit = 50 } = req.query;

      const where: any = { tenantId };
      if (status && status !== 'all') {
        where.status = status;
      }

      const responses = await prisma.pendingResponse.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: parseInt(limit as string),
      });

      // Enrich with conversation details
      const enrichedResponses = await Promise.all(
        responses.map(async (response) => {
          const conversation = await prisma.conversation.findFirst({
            where: { id: response.conversationId },
            select: {
              phoneNumber: true,
              messages: {
                where: { direction: 'INCOMING' },
                orderBy: { createdAt: 'desc' },
                take: 1,
              },
            },
          });

          return {
            ...response,
            conversation: conversation
              ? {
                  phoneNumber: conversation.phoneNumber,
                  customerMessage: conversation.messages[0]?.content,
                }
              : undefined,
          };
        })
      );

      res.json({
        success: true,
        responses: enrichedResponses,
        count: enrichedResponses.length,
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Obtiene una respuesta pendiente por ID
   */
  async getById(req: Request, res: Response): Promise<void> {
    try {
      const tenantId = req.tenantId!;
      const { responseId } = req.params;

      const response = await approvalService.getPendingResponseById(tenantId, responseId);

      if (!response) {
        res.status(404).json({ error: 'Respuesta no encontrada' });
        return;
      }

      res.json({
        success: true,
        response,
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Aprueba una respuesta pendiente
   */
  async approve(req: Request, res: Response): Promise<void> {
    try {
      const tenantId = req.tenantId!;
      const { responseId } = req.params;
      const reviewerId = req.user?.userId || req.user?.id || 'unknown';

      await approvalService.approveResponse(tenantId, responseId, reviewerId);

      res.json({
        success: true,
        message: 'Respuesta aprobada y enviada',
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Rechaza una respuesta pendiente
   */
  async reject(req: Request, res: Response): Promise<void> {
    try {
      const tenantId = req.tenantId!;
      const { responseId } = req.params;
      const { notes } = req.body;
      const reviewerId = req.user?.userId || req.user?.id || 'unknown';

      if (!notes) {
        res.status(400).json({ error: 'Notas de rechazo son requeridas' });
        return;
      }

      await approvalService.rejectResponse(tenantId, responseId, reviewerId, notes);

      res.json({
        success: true,
        message: 'Respuesta rechazada',
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Edita una respuesta antes de aprobarla
   */
  async update(req: Request, res: Response): Promise<void> {
    try {
      const tenantId = req.tenantId!;
      const { responseId } = req.params;
      const { proposedResponse } = req.body;

      if (!proposedResponse) {
        res.status(400).json({ error: 'La propuesta de respuesta es requerida' });
        return;
      }

      // Update the pending response
      const updated = await prisma.pendingResponse.updateMany({
        where: { id: responseId, tenantId, status: 'PENDING' },
        data: { proposedResponse },
      });

      if (updated.count === 0) {
        res.status(404).json({ error: 'Respuesta no encontrada o no está pendiente' });
        return;
      }

      res.json({
        success: true,
        message: 'Respuesta actualizada correctamente',
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Obtiene estadísticas de aprobación
   */
  async getStats(req: Request, res: Response): Promise<void> {
    try {
      const tenantId = req.tenantId!;
      const stats = await approvalService.getApprovalStats(tenantId);

      res.json({
        success: true,
        stats,
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Habilita/Deshabilita el flujo de aprobación
   */
  async toggle(req: Request, res: Response): Promise<void> {
    try {
      const { enabled } = req.body;

      approvalService.setEnabled(enabled);

      res.json({
        success: true,
        enabled,
        message: enabled
          ? 'Flujo de aprobación habilitado'
          : 'Flujo de aprobación deshabilitado (auto-aprobación activa)',
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Verifica si el flujo de aprobación está habilitado
   */
  async getStatus(req: Request, res: Response): Promise<void> {
    try {
      const enabled = approvalService.isEnabled();

      res.json({
        success: true,
        approvalEnabled: enabled,
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }
}

export const approvalController = new ApprovalController();
