/**
 * ApprovalDecisionService - Decide cuándo una respuesta requiere aprobación humana
 *
 * PLAN #7: Human in the Loop
 *
 * Evalúa si una respuesta generada por el agente debe ser revisada por un humano
 * antes de ser enviada al cliente.
 */

import { PrismaClient, PendingResponse } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';

const prisma = new PrismaClient();

// Interfaces
export interface ApprovalContext {
  tenantId: string;
  conversationId: string;
  confidence?: number;
  proposedResponse: string;
  agentId?: string;
}

export interface ApprovalDecision {
  requiresApproval: boolean;
  reason?: string;
  pendingResponse?: PendingResponse;
}

export class ApprovalDecisionService {
  private readonly DEFAULT_APPROVAL_THRESHOLD = 0.7;
  private readonly DEFAULT_APPROVAL_KEYWORDS = [
    'reembolso', 'cancelar', 'devolver', 'garantía',
    'descuento', 'promoción', 'oferta especial',
    'gerente', 'supervisor', 'encargado'
  ];

  /**
   * Determina si una respuesta requiere aprobación humana
   */
  async shouldRequireApproval(context: ApprovalContext): Promise<ApprovalDecision> {
    const { tenantId, conversationId, confidence, proposedResponse, agentId } = context;

    // Obtener configuración del tenant
    const config = await this.getTenantApprovalConfig(tenantId);

    // Condiciones que requieren aprobación
    const conditions: { name: string; required: boolean; reason: string }[] = [
      {
        name: 'global_setting',
        required: config.requireApproval === true,
        reason: 'Aprobación requerida por configuración del tenant'
      },
      {
        name: 'low_confidence',
        required: confidence !== undefined && confidence < (config.approvalThreshold || this.DEFAULT_APPROVAL_THRESHOLD),
        reason: `Confidencia baja (${confidence?.toFixed(2)} < ${(config.approvalThreshold || this.DEFAULT_APPROVAL_THRESHOLD).toFixed(2)})`
      },
      {
        name: 'sensitive_keywords',
        required: this.containsSensitiveKeywords(proposedResponse, config.approvalKeywords || this.DEFAULT_APPROVAL_KEYWORDS),
        reason: 'Contiene palabras clave sensibles'
      },
      {
        name: 'high_risk_operations',
        required: this.containsHighRiskOperations(proposedResponse),
        reason: 'Contiene operación de alto riesgo'
      }
    ];

    // Verificar si alguna condición requiere aprobación
    const triggeringCondition = conditions.find(c => c.required);

    if (triggeringCondition) {
      // Crear pending response
      const pendingResponse = await this.createPendingApproval({
        tenantId,
        conversationId,
        agentId: agentId || 'unknown',
        proposedResponse,
        confidence,
        reason: triggeringCondition.reason
      });

      return {
        requiresApproval: true,
        reason: triggeringCondition.reason,
        pendingResponse
      };
    }

    return {
      requiresApproval: false
    };
  }

  /**
   * Crea un pending response y retorna el registro creado
   */
  async createPendingApproval(data: {
    tenantId: string;
    conversationId: string;
    agentId: string;
    proposedResponse: string;
    confidence?: number;
    reason?: string;
  }): Promise<PendingResponse> {
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24); // Expira en 24 horas

    return await prisma.pendingResponse.create({
      data: {
        id: uuidv4(),
        tenantId: data.tenantId,
        conversationId: data.conversationId,
        agentId: data.agentId,
        proposedResponse: data.proposedResponse,
        confidence: data.confidence,
        reason: data.reason,
        status: 'PENDING',
        expiresAt
      }
    });
  }

  /**
   * Obtiene la configuración de aprobación del tenant
   */
  private async getTenantApprovalConfig(tenantId: string): Promise<{
    requireApproval: boolean;
    approvalThreshold?: number;
    approvalKeywords?: string[];
  }> {
    const config = await prisma.whatsAppConfig.findUnique({
      where: { tenantId }
    }) as any;

    return {
      requireApproval: config?.requireApproval || false,
      approvalThreshold: config?.approvalThreshold || undefined,
      approvalKeywords: config?.approvalKeywords || undefined
    };
  }

  /**
   * Verifica si la respuesta contiene palabras clave sensibles
   */
  private containsSensitiveKeywords(response: string, keywords: string[]): boolean {
    const lowerResponse = response.toLowerCase();
    return keywords.some(keyword => lowerResponse.includes(keyword.toLowerCase()));
  }

  /**
   * Verifica si la respuesta contiene operaciones de alto riesgo
   */
  private containsHighRiskOperations(response: string): boolean {
    const lowerResponse = response.toLowerCase();

    // Operaciones financieras de riesgo
    const financialPatterns = [
      /\d+%\s*descuento/i,  // Descuentos grandes
      /\$\s*\d{3,}/,        // Cantidades grandes de dinero
      /reembolsar/i,
      /bonificaci/i
    ];

    // Operaciones de cancelación
    const cancellationPatterns = [
      /cancelar/i,
      /anular/i,
      /dar de baja/i
    ];

    // Promesas de gerencia/supervisor
    const escalationPatterns = [
      /hablar con el gerente/i,
      /pasar con supervisor/i,
      /solicitar encargado/i
    ];

    return [
      ...financialPatterns,
      ...cancellationPatterns,
      ...escalationPatterns
    ].some(pattern => pattern.test(lowerResponse));
  }

  /**
   * Obtiene pending responses pendientes de un tenant
   */
  async getPendingResponses(tenantId: string): Promise<PendingResponse[]> {
    return await prisma.pendingResponse.findMany({
      where: {
        tenantId,
        status: 'PENDING'
      },
      orderBy: {
        createdAt: 'desc'
      }
    });
  }

  /**
   * Obtiene un pending response por ID
   */
  async getPendingResponseById(id: string): Promise<PendingResponse | null> {
    return await prisma.pendingResponse.findUnique({
      where: { id }
    });
  }

  /**
   * Marca pending responses como expiradas
   */
  async markExpiredResponses(): Promise<void> {
    await prisma.pendingResponse.updateMany({
      where: {
        status: 'PENDING',
        expiresAt: {
          lt: new Date()
        }
      },
      data: {
        status: 'EXPIRED'
      }
    });
  }
}

// Singleton instance
export const approvalDecisionService = new ApprovalDecisionService();
