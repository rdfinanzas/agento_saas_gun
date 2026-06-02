/**
 * ApprovalService - Flujo de aprobación en Human Loop
 * FASE 7: Flujo de Aprobación
 *
 * PLAN #7: Conectado a envío de WhatsApp
 */

import { v4 as uuidv4 } from 'uuid';
import { prisma } from '../../../config/database';
import { Decimal } from '@prisma/client/runtime/library';
import type { Server as SocketServer } from 'socket.io';
import type { Socket } from 'socket.io';
import { WhatsAppCloudApiService } from '../../whatsapp/services/whatsapp-cloud-api.service';

// Interfaces
export interface PendingResponse {
  id: string;
  tenantId: string;
  conversationId: string;
  agentId: string;
  proposedResponse: string;
  reason: string | null | undefined;
  confidence: number | Decimal | null | undefined;
  status: ApprovalStatus | string;
  reviewedBy: string | null | undefined;
  reviewedAt: Date | null | undefined;
  reviewNotes: string | null | undefined;
  createdAt: Date;
  expiresAt: Date;
}

export type ApprovalStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'EXPIRED';

export interface ApprovalConfig {
  enabled: boolean;
  expiresInMinutes: number;
  notifyOnPending: boolean;
  notifyChannels: ('websocket' | 'email')[];
  autoApproveAfterMinutes?: number;
  minConfidenceForAutoApprove?: number;
}
export interface ApprovalStats {
  totalPending: number;
  totalApproved: number;
  totalRejected: number;
  totalExpired: number;
  avgResponseTime: number;
}
export class ApprovalService {
  private io: SocketServer | null;
  private config: ApprovalConfig = {
    enabled: true,
    expiresInMinutes: 5,
    notifyOnPending: true,
    notifyChannels: ['websocket'],
  };

  constructor(io?: SocketServer | null) {
    this.io = io ?? null;
  }
  setConfig(config: Partial<ApprovalConfig>): void {
    this.config = { ...this.config, ...config };
  }
  /**
   * Crea una respuesta pendiente de aprobación
   */
  async createPendingResponse(
    tenantId: string,
    conversationId: string,
    response: string,
    reason?: string,
    confidence?: number
  ): Promise<PendingResponse> {
    if (!this.config.enabled) {
      // Si no está habilitado, auto-aprobar
      await this.sendResponseDirectly(tenantId, conversationId, response);
      return {
        id: uuidv4(),
        tenantId,
        conversationId,
        agentId: 'agent',
        proposedResponse: response,
        reason: reason ?? null,
        confidence: confidence ?? null,
        status: 'APPROVED',
        reviewedBy: null,
        reviewedAt: null,
        reviewNotes: null,
        createdAt: new Date(),
        expiresAt: new Date()
      };
    }
    const expiresAt = new Date(Date.now() + this.config.expiresInMinutes * 60 * 1000);
    const pendingResponse = await prisma.pendingResponse.create({
      data: {
        id: uuidv4(),
        tenantId,
        conversationId,
        agentId: 'agent',
        proposedResponse: response,
        reason,
        confidence,
        status: 'PENDING',
        expiresAt,
      },
    });
    // Notificar via WebSocket
    if (this.config.notifyOnPending && this.io) {
      this.notifyReviewers(tenantId, {
        type: 'pending_response',
        responseId: pendingResponse.id,
        conversationId,
        proposedResponse: pendingResponse.proposedResponse,
        reason: pendingResponse.reason,
        confidence: pendingResponse.confidence,
        expiresAt: pendingResponse.expiresAt,
      });
    }
    // Configurar auto-expiración
    this.setupAutoExpiration(pendingResponse.id, expiresAt);
    return pendingResponse;
  }
  /**
   * Aprueba una respuesta pendiente
   */
  async approveResponse(
    tenantId: string,
    responseId: string,
    reviewerId: string
  ): Promise<void> {
    const pending = await prisma.pendingResponse.findFirst({
      where: { id: responseId, tenantId, status: 'PENDING' },
    });
    if (!pending) {
      throw new Error('Respuesta pendiente no encontrada o ya aprobada');
    }
    if (pending.expiresAt < new Date()) {
      await this.expireResponse(responseId);
      throw new Error('La respuesta ha expirado');
    }
    // Actualizar estado
    await prisma.pendingResponse.update({
      where: { id: responseId },
      data: {
        status: 'APPROVED',
        reviewedBy: reviewerId,
        reviewedAt: new Date(),
      },
    });
    // Enviar mensaje a WhatsApp
    await this.sendApprovedMessage(tenantId, pending.conversationId, pending.proposedResponse);
    // Notificar via WebSocket
    if (this.io) {
      this.io.to(`tenant:${tenantId}`).emit('response_approved', {
      responseId,
      conversationId: pending.conversationId,
      reviewedBy: reviewerId,
      });
    }
  }
  /**
   * Rechaza una respuesta pendiente
   */
  async rejectResponse(
    tenantId: string,
    responseId: string,
    reviewerId: string,
    notes: string
  ): Promise<void> {
    const pending = await prisma.pendingResponse.findFirst({
      where: { id: responseId, tenantId, status: 'PENDING' },
    });
    if (!pending) {
      throw new Error('Respuesta pendiente no encontrada');
    }
    // Actualizar estado
    await prisma.pendingResponse.update({
      where: { id: responseId },
      data: {
        status: 'REJECTED',
        reviewedBy: reviewerId,
        reviewedAt: new Date(),
        reviewNotes: notes,
      },
    });
    // Notificar via WebSocket
    if (this.io) {
      this.io.to(`tenant:${tenantId}`).emit('response_rejected', {
        responseId,
        conversationId: pending.conversationId,
        reviewedBy: reviewerId,
        notes,
      });
    }
    // Registrar feedback para mejora futura
    await this.recordRejectionFeedback(tenantId, pending, notes);
  }
  /**
   * Obtiene respuestas pendientes de un tenant
   */
  async getPendingResponses(tenantId: string): Promise<PendingResponse[]> {
    // Primero expirar las que ya vencieron
    await this.expireOldResponses();
    const responses = await prisma.pendingResponse.findMany({
      where: { tenantId, status: 'PENDING' },
      orderBy: { createdAt: 'desc' },
    });
    return responses.map(r => ({
      id: r.id,
      tenantId: r.tenantId,
      conversationId: r.conversationId,
      agentId: r.agentId,
      proposedResponse: r.proposedResponse,
      reason: r.reason || undefined,
      confidence: r.confidence || undefined,
      status: r.status as ApprovalStatus,
      reviewedBy: r.reviewedBy || undefined,
      reviewedAt: r.reviewedAt || undefined,
      reviewNotes: r.reviewNotes || undefined,
      createdAt: r.createdAt,
      expiresAt: r.expiresAt,
    }));
  }
  /**
   * Obtiene una respuesta pendiente por ID
   */
  async getPendingResponseById(tenantId: string, responseId: string): Promise<PendingResponse | null> {
    const response = await prisma.pendingResponse.findFirst({
      where: { id: responseId, tenantId },
    });
    if (!response) return null;
    return {
      id: response.id,
      tenantId: response.tenantId,
      conversationId: response.conversationId,
      agentId: response.agentId,
      proposedResponse: response.proposedResponse,
      reason: response.reason || undefined,
      confidence: response.confidence ? Number(response.confidence) : undefined,
      status: response.status as ApprovalStatus,
      reviewedBy: response.reviewedBy || undefined,
      reviewedAt: response.reviewedAt || undefined,
      reviewNotes: response.reviewNotes || undefined,
      createdAt: response.createdAt,
      expiresAt: response.expiresAt,
    };
  }
  /**
   * Obtiene estadísticas de aprobación
   */
  async getApprovalStats(tenantId: string): Promise<ApprovalStats> {
    const [totalPending, totalApproved, totalRejected, totalExpired] = await Promise.all([
      prisma.pendingResponse.count({ where: { tenantId, status: 'PENDING' } }),
      prisma.pendingResponse.count({ where: { tenantId, status: 'APPROVED' } }),
      prisma.pendingResponse.count({ where: { tenantId, status: 'REJECTED' } }),
      prisma.pendingResponse.count({ where: { tenantId, status: 'EXPIRED' } }),
    ]);
    // Calcular tiempo promedio de respuesta
    const approvedResponses = await prisma.pendingResponse.findMany({
      where: { tenantId, status: 'APPROVED' },
      select: { createdAt: true, reviewedAt: true },
    });
    let avgResponseTime = 0;
    if (approvedResponses.length > 0) {
      const totalMs = approvedResponses.reduce((sum, r) => {
        const reviewedAt = r.reviewedAt?.getTime() || 0;
        const createdAt = r.createdAt.getTime();
        return sum + (reviewedAt - createdAt);
      }, 0);
      avgResponseTime = Math.round(totalMs / approvedResponses.length);
    }
    return {
      totalPending,
      totalApproved,
      totalRejected,
      totalExpired,
      avgResponseTime,
    };
  }
  /**
   * Verifica si el flujo de aprobación está habilitado
   */
  isEnabled(): boolean {
    return this.config.enabled;
  }
  /**
   * Habilita/Deshabilita el flujo de aprobación
   */
  setEnabled(enabled: boolean): void {
    this.config.enabled = enabled;
  }
  // ============================================
  // Métodos privados
  // ============================================
  private async sendResponseDirectly(
    tenantId: string,
    conversationId: string,
    response: string
  ): Promise<void> {
    // Buscar configuración de WhatsApp
    const waConfig = await prisma.whatsAppConfig.findFirst({
      where: { tenantId },
    });
    if (!waConfig) {
      throw new Error('No hay configuración de WhatsApp');
    }
    // Crear mensaje en la conversación
    await prisma.message.create({
      data: {
        id: uuidv4(),
        tenantId,
        conversationId,
        fromPhone: waConfig.phoneNumber || 'agent',
        toPhone: '', // Se obtiene del contexto de la conversación
        direction: 'OUTGOING',
        type: 'text',
        content: response,
        status: 'SENT',
      },
    });
  }
  private notifyReviewers(tenantId: string, data: any): void {
    if (!this.io) return;
    // Emitir a todos los sockets del tenant
    this.io.to(`tenant:${tenantId}`).emit('pending_approval', data);
  }
  private setupAutoExpiration(responseId: string, expiresAt: Date): void {
    // Configurar timeout para expirar automáticamente
    const timeoutMs = expiresAt.getTime() - Date.now();
    setTimeout(async () => {
      try {
        await this.expireResponse(responseId);
      } catch (error) {
        console.error('Error expiring response:', error);
      }
    }, timeoutMs);
  }
  private async expireResponse(responseId: string): Promise<void> {
    const response = await prisma.pendingResponse.updateMany({
      where: { id: responseId, status: 'PENDING' },
      data: { status: 'EXPIRED' },
    });
    if (response.count > 0) {
      // Notificar expiración
      const pending = await prisma.pendingResponse.findUnique({
        where: { id: responseId },
      });
      if (pending && this.io) {
        this.io.to(`tenant:${pending.tenantId}`).emit('response_expired', {
          responseId,
          conversationId: pending.conversationId,
        });
      }
    }
  }
  private async expireOldResponses(): Promise<void> {
    await prisma.pendingResponse.updateMany({
      where: {
        status: 'PENDING',
        expiresAt: { lt: new Date() },
      },
      data: { status: 'EXPIRED' },
    });
  }
  private async recordRejectionFeedback(
    tenantId: string,
    pending: any,
    notes: string
  ): Promise<void> {
    // Guardar feedback para mejora futura
    await prisma.approvalFeedback.create({
      data: {
        id: uuidv4(),
        tenantId,
        responseId: pending.id,
        conversationId: pending.conversationId,
        proposedResponse: pending.proposedResponse,
        rejectionReason: notes,
        createdAt: new Date(),
      },
    });
  }
  /**
   * PLAN #7: Envía mensaje aprobado a WhatsApp
   * Conecta el flujo de aprobación con el servicio real de WhatsApp
   */
  private async sendApprovedMessage(
    tenantId: string,
    conversationId: string,
    message: string
  ): Promise<void> {
    try {
      // 1. Obtener la conversación para saber el phoneNumber
      const conversation = await prisma.conversation.findUnique({
        where: { id: conversationId },
        select: { phoneNumber: true }
      });

      if (!conversation) {
        console.error(`[Approval] Conversation ${conversationId} not found`);
        return;
      }

      // 2. Obtener configuración de WhatsApp del tenant
      const config = await prisma.whatsAppConfig.findUnique({
        where: { tenantId },
        select: { phoneNumberId: true, accessToken: true, isActive: true }
      });

      if (!config || !config.isActive) {
        console.error(`[Approval] WhatsApp not configured or inactive for tenant ${tenantId}`);
        return;
      }

      // 3. Enviar mensaje usando WhatsAppCloudApiService
      const whatsappApi = new WhatsAppCloudApiService();
      await whatsappApi.sendTextMessage({
        phoneNumberId: config.phoneNumberId,
        to: conversation.phoneNumber,
        message: message,
        accessToken: config.accessToken
      });

      console.log(`[Approval] Successfully sent approved message to ${conversation.phoneNumber}`);

      // 4. Guardar el mensaje en la base de datos
      await prisma.message.create({
        data: {
          id: uuidv4(),
          tenantId,
          conversationId,
          fromPhone: 'SYSTEM',
          toPhone: conversation.phoneNumber,
          direction: 'OUTGOING',
          type: 'text',
          content: message,
          status: 'SENT'
        } as any
      });

      // 5. Actualizar lastMessageAt de la conversación
      await prisma.conversation.update({
        where: { id: conversationId },
        data: { lastMessageAt: new Date() }
      });

    } catch (error) {
      console.error(`[Approval] Error sending approved message:`, error);
      throw error;
    }
  }

  /**
   * PLAN #7: Inicializa el servicio con la instancia de Socket.io
   * Debe llamarse después de que el servidor WebSocket esté inicializado
   */
  initializeWithIO(io: SocketServer): void {
    this.io = io;
    console.log('[Approval] ApprovalService initialized with Socket.io');
  }
}
export const approvalService = new ApprovalService();

/**
 * PLAN #7: Inicializa el ApprovalService con Socket.io
 * Debe llamarse desde server.ts después de inicializar el WebSocket
 */
export function initializeApprovalService(io: SocketServer): void {
  approvalService.initializeWithIO(io);
}
