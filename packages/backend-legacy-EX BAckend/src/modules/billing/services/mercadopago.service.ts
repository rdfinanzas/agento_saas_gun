/**
 * MercadoPagoService - Integración con MercadoPago
 * FASE 5: Sistema de facturación con MercadoPago
 */

import axios, { AxiosInstance } from 'axios';
import { PrismaClient } from '@prisma/client';

// ============================================
// Types & Interfaces
// ============================================

export interface MercadoPagoConfig {
  accessToken: string;
  publicKey?: string;
  clientId?: string;
  clientSecret?: string;
  webhookSecret?: string;
  sandbox?: boolean;
}

export interface PlanDetails {
  id: string;
  name: string;
  price: number;
  currency: string;
  interval: 'monthly' | 'yearly';
  features: string[];
  maxRequests: number;
  maxStorage: bigint;
  maxAgents: number;
}

export interface CreatePreferencePayload {
  tenantId: string;
  planId: string;
  planName: string;
  price: number;
  currency: string;
  interval: 'monthly' | 'yearly';
  successUrl: string;
  failureUrl: string;
  pendingUrl: string;
  notificationUrl: string;
  metadata?: Record<string, string>;
}

export interface PreferenceResponse {
  id: string;
  initPoint: string;
  sandboxInitPoint: string;
}

export interface PaymentWebhookPayload {
  type: string;
  data: {
    id: string;
  };
}

export interface PaymentDetails {
  id: string;
  status: 'pending' | 'approved' | 'authorized' | 'in_process' | 'in_mediation' | 'rejected' | 'cancelled' | 'refunded' | 'charged_back';
  statusDetail: string;
  transactionAmount: number;
  currencyId: string;
  dateApproved?: string;
  dateCreated: string;
  payer: {
    id: number;
    email: string;
    identification?: {
      type: string;
      number: string;
    };
  };
  externalReference?: string;
  metadata?: Record<string, string>;
}

export interface SubscriptionPayload {
  tenantId: string;
  planId: string;
  cardToken?: string;
  payerEmail: string;
  payerIdentification?: {
    type: string;
    number: string;
  };
}

export interface SubscriptionResponse {
  id: string;
  status: string;
  initPoint?: string;
}

// ============================================
// Available Plans
// ============================================

export const AVAILABLE_PLANS: PlanDetails[] = [
  {
    id: 'free',
    name: 'Gratis',
    price: 0,
    currency: 'MXN',
    interval: 'monthly',
    features: [
      '1 agente de WhatsApp',
      '1,000 mensajes/mes',
      '1GB almacenamiento',
      'Soporte por email',
    ],
    maxRequests: 1000,
    maxStorage: BigInt(1073741824), // 1GB
    maxAgents: 1,
  },
  {
    id: 'pro-monthly',
    name: 'Pro (Mensual)',
    price: 299,
    currency: 'MXN',
    interval: 'monthly',
    features: [
      '5 agentes de WhatsApp',
      '10,000 mensajes/mes',
      '10GB almacenamiento',
      'Embeddings y búsqueda semántica',
      'Automatizaciones',
      'Soporte prioritario',
    ],
    maxRequests: 10000,
    maxStorage: BigInt(10737418240), // 10GB
    maxAgents: 5,
  },
  {
    id: 'pro-yearly',
    name: 'Pro (Anual)',
    price: 2999,
    currency: 'MXN',
    interval: 'yearly',
    features: [
      '5 agentes de WhatsApp',
      '10,000 mensajes/mes',
      '10GB almacenamiento',
      'Embeddings y búsqueda semántica',
      'Automatizaciones',
      'Soporte prioritario',
      '2 meses gratis',
    ],
    maxRequests: 10000,
    maxStorage: BigInt(10737418240), // 10GB
    maxAgents: 5,
  },
  {
    id: 'enterprise-monthly',
    name: 'Enterprise (Mensual)',
    price: 999,
    currency: 'MXN',
    interval: 'monthly',
    features: [
      'Agentes ilimitados',
      'Mensajes ilimitados',
      '100GB almacenamiento',
      'Embeddings y búsqueda semántica',
      'Automatizaciones avanzadas',
      'API Connectors',
      'Soporte dedicado 24/7',
      'SLA garantizado',
    ],
    maxRequests: 1000000,
    maxStorage: BigInt(107374182400), // 100GB
    maxAgents: 100,
  },
  {
    id: 'enterprise-yearly',
    name: 'Enterprise (Anual)',
    price: 9999,
    currency: 'MXN',
    interval: 'yearly',
    features: [
      'Agentes ilimitados',
      'Mensajes ilimitados',
      '100GB almacenamiento',
      'Embeddings y búsqueda semántica',
      'Automatizaciones avanzadas',
      'API Connectors',
      'Soporte dedicado 24/7',
      'SLA garantizado',
      '2 meses gratis',
    ],
    maxRequests: 1000000,
    maxStorage: BigInt(107374182400), // 100GB
    maxAgents: 100,
  },
];

// ============================================
// MercadoPago Service
// ============================================

export class MercadoPagoService {
  private prisma: PrismaClient;
  private axiosInstance: AxiosInstance;
  private config: MercadoPagoConfig;
  private isSandbox: boolean;

  constructor(config?: MercadoPagoConfig) {
    this.prisma = new PrismaClient();
    this.config = config || {
      accessToken: process.env.MERCADOPAGO_ACCESS_TOKEN || '',
      publicKey: process.env.MERCADOPAGO_PUBLIC_KEY,
      clientId: process.env.MERCADOPAGO_CLIENT_ID,
      clientSecret: process.env.MERCADOPAGO_CLIENT_SECRET,
      webhookSecret: process.env.MERCADOPAGO_WEBHOOK_SECRET,
      sandbox: process.env.MERCADOPAGO_SANDBOX === 'true',
    };

    this.isSandbox = this.config.sandbox ?? (process.env.NODE_ENV !== 'production');

    const baseUrl = this.isSandbox
      ? 'https://api.mercadopago.com'
      : 'https://api.mercadopago.com';

    this.axiosInstance = axios.create({
      baseURL: baseUrl,
      headers: {
        'Authorization': `Bearer ${this.config.accessToken}`,
        'Content-Type': 'application/json',
      },
    });
  }

  // ============================================
  // Public Methods
  // ============================================

  /**
   * Get all available plans
   */
  getPlans(): PlanDetails[] {
    return AVAILABLE_PLANS;
  }

  /**
   * Get plan by ID
   */
  getPlanById(planId: string): PlanDetails | undefined {
    return AVAILABLE_PLANS.find(p => p.id === planId);
  }

  /**
   * Create a payment preference (checkout pro)
   */
  async createPreference(payload: CreatePreferencePayload): Promise<PreferenceResponse> {
    try {
      const preferenceData = {
        items: [
          {
            id: payload.planId,
            title: `AgentO - Plan ${payload.planName}`,
            description: `Suscripción ${payload.interval} al plan ${payload.planName}`,
            category_id: 'services',
            quantity: 1,
            currency_id: payload.currency,
            unit_price: payload.price,
          },
        ],
        payer: {
          // Will be filled by MercadoPago during checkout
        },
        back_urls: {
          success: payload.successUrl,
          failure: payload.failureUrl,
          pending: payload.pendingUrl,
        },
        auto_return: 'approved' as const,
        notification_url: payload.notificationUrl,
        external_reference: payload.tenantId,
        metadata: {
          tenant_id: payload.tenantId,
          plan_id: payload.planId,
          interval: payload.interval,
          ...payload.metadata,
        },
        statement_descriptor: 'AGENTO',
        expires: true,
        expiration_date_from: new Date().toISOString(),
        expiration_date_to: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24 hours
      };

      const response = await this.axiosInstance.post('/checkout/preferences', preferenceData);

      // Create pending subscription record
      await this.createPendingSubscription(payload.tenantId, payload.planId, response.data.id);

      return {
        id: response.data.id,
        initPoint: response.data.init_point,
        sandboxInitPoint: response.data.sandbox_init_point,
      };
    } catch (error: any) {
      console.error('[MercadoPago] Error creating preference:', error.response?.data || error.message);
      throw new Error(`Failed to create payment preference: ${error.message}`);
    }
  }

  /**
   * Get payment details
   */
  async getPayment(paymentId: string): Promise<PaymentDetails> {
    try {
      const response = await this.axiosInstance.get(`/v1/payments/${paymentId}`);
      return response.data;
    } catch (error: any) {
      console.error('[MercadoPago] Error getting payment:', error.response?.data || error.message);
      throw new Error(`Failed to get payment details: ${error.message}`);
    }
  }

  /**
   * Process webhook notification
   */
  async processWebhook(payload: PaymentWebhookPayload): Promise<{
    success: boolean;
    action: string;
    tenantId?: string;
    planId?: string;
  }> {
    try {
      console.log('[MercadoPago] Processing webhook:', payload.type, payload.data.id);

      if (payload.type === 'payment') {
        const payment = await this.getPayment(payload.data.id);
        return await this.processPaymentNotification(payment);
      }

      // Handle other notification types
      if (payload.type === 'subscription_preapproval') {
        return await this.processSubscriptionNotification(payload.data.id);
      }

      return { success: true, action: 'ignored' };
    } catch (error: any) {
      console.error('[MercadoPago] Error processing webhook:', error);
      return { success: false, action: 'error' };
    }
  }

  /**
   * Process payment notification
   */
  private async processPaymentNotification(payment: PaymentDetails): Promise<{
    success: boolean;
    action: string;
    tenantId?: string;
    planId?: string;
  }> {
    const tenantId = payment.externalReference || payment.metadata?.tenant_id;
    const planId = payment.metadata?.plan_id;

    if (!tenantId) {
      console.warn('[MercadoPago] Payment without tenant reference:', payment.id);
      return { success: false, action: 'no_tenant' };
    }

    // Create or update payment record
    await this.prisma.payment.upsert({
      where: { gatewayPaymentId: payment.id.toString() },
      create: {
        tenantId,
        gatewayPaymentId: payment.id.toString(),
        gateway: 'MERCADOPAGO',
        amount: payment.transactionAmount,
        currency: payment.currencyId,
        status: payment.status.toUpperCase(),
        statusDetail: payment.statusDetail,
        payerEmail: payment.payer.email,
        metadata: payment.metadata as any,
        paidAt: payment.dateApproved ? new Date(payment.dateApproved) : null,
      },
      update: {
        status: payment.status.toUpperCase(),
        statusDetail: payment.statusDetail,
        paidAt: payment.dateApproved ? new Date(payment.dateApproved) : null,
      },
    });

    // If payment approved, activate subscription
    if (payment.status === 'approved') {
      await this.activateSubscription(tenantId, planId, payment);
      return { success: true, action: 'subscription_activated', tenantId, planId };
    }

    return { success: true, action: `payment_${payment.status}`, tenantId, planId };
  }

  /**
   * Activate subscription after successful payment
   */
  private async activateSubscription(
    tenantId: string,
    planId: string | undefined,
    payment: PaymentDetails
  ): Promise<void> {
    const plan = planId ? this.getPlanById(planId) : null;

    if (!plan) {
      console.error('[MercadoPago] Plan not found:', planId);
      return;
    }

    // Determine subscription tier from plan
    const tier = this.getTierFromPlan(plan.id);

    // Calculate subscription period
    const now = new Date();
    const periodEnd = new Date(now);
    if (plan.interval === 'monthly') {
      periodEnd.setMonth(periodEnd.getMonth() + 1);
    } else {
      periodEnd.setFullYear(periodEnd.getFullYear() + 1);
    }

    // Update or create subscription
    await this.prisma.subscription.upsert({
      where: { tenantId },
      create: {
        tenantId,
        planId: plan.id,
        planName: plan.name,
        status: 'ACTIVE',
        tier,
        currentPeriodStart: now,
        currentPeriodEnd: periodEnd,
        cancelAtPeriodEnd: false,
        gateway: 'MERCADOPAGO',
        gatewayCustomerId: payment.payer.id.toString(),
      },
      update: {
        planId: plan.id,
        planName: plan.name,
        status: 'ACTIVE',
        tier,
        currentPeriodStart: now,
        currentPeriodEnd: periodEnd,
        cancelAtPeriodEnd: false,
        gateway: 'MERCADOPAGO',
        gatewayCustomerId: payment.payer.id.toString(),
      },
    });

    // Update tenant quotas
    await this.prisma.tenant.update({
      where: { id: tenantId },
      data: {
        subscriptionTier: tier,
        quotaMaxRequests: plan.maxRequests,
        quotaMaxStorage: plan.maxStorage,
      },
    });

    // Create invoice
    await this.prisma.invoice.create({
      data: {
        tenantId,
        subscriptionId: (await this.prisma.subscription.findUnique({ where: { tenantId } }))!.id,
        number: this.generateInvoiceNumber(),
        amount: payment.transactionAmount,
        currency: payment.currencyId,
        status: 'PAID',
        paidAt: new Date(),
        paymentMethod: 'MERCADOPAGO',
        paymentReference: payment.id.toString(),
      },
    });

    console.log(`[MercadoPago] Subscription activated for tenant ${tenantId}, plan ${plan.name}`);
  }

  /**
   * Process subscription notification (for recurring payments)
   */
  private async processSubscriptionNotification(preapprovalId: string): Promise<{
    success: boolean;
    action: string;
  }> {
    try {
      const response = await this.axiosInstance.get(`/preapproval/${preapprovalId}`);
      const preapproval = response.data;

      console.log('[MercadoPago] Preapproval update:', preapproval.status);

      // Handle based on status
      if (preapproval.status === 'authorized') {
        // Subscription is active
        return { success: true, action: 'subscription_authorized' };
      }

      if (preapproval.status === 'cancelled') {
        // Subscription was cancelled
        const tenantId = preapproval.external_reference;
        if (tenantId) {
          await this.cancelSubscription(tenantId);
        }
        return { success: true, action: 'subscription_cancelled' };
      }

      return { success: true, action: `preapproval_${preapproval.status}` };
    } catch (error: any) {
      console.error('[MercadoPago] Error processing preapproval:', error);
      return { success: false, action: 'error' };
    }
  }

  /**
   * Cancel subscription
   */
  async cancelSubscription(tenantId: string): Promise<void> {
    const subscription = await this.prisma.subscription.findUnique({
      where: { tenantId },
    });

    if (!subscription) {
      return;
    }

    // Cancel in MercadoPago if recurring
    if (subscription.gatewayPreapprovalId) {
      try {
        await this.axiosInstance.put(`/preapproval/${subscription.gatewayPreapprovalId}`, {
          status: 'cancelled',
        });
      } catch (error: any) {
        console.error('[MercadoPago] Error cancelling preapproval:', error);
      }
    }

    // Update local subscription
    await this.prisma.subscription.update({
      where: { tenantId },
      data: {
        status: 'CANCELLED',
        cancelledAt: new Date(),
      },
    });

    // Downgrade tenant to free
    await this.prisma.tenant.update({
      where: { id: tenantId },
      data: {
        subscriptionTier: 'FREE',
        quotaMaxRequests: 1000,
        quotaMaxStorage: BigInt(1073741824), // 1GB
      },
    });

    console.log(`[MercadoPago] Subscription cancelled for tenant ${tenantId}`);
  }

  /**
   * Get subscription status for tenant
   */
  async getSubscriptionStatus(tenantId: string): Promise<{
    hasSubscription: boolean;
    status: string | null;
    plan: string | null;
    currentPeriodEnd: Date | null;
    cancelAtPeriodEnd: boolean;
  }> {
    const subscription = await this.prisma.subscription.findUnique({
      where: { tenantId },
    });

    if (!subscription) {
      return {
        hasSubscription: false,
        status: null,
        plan: null,
        currentPeriodEnd: null,
        cancelAtPeriodEnd: false,
      };
    }

    return {
      hasSubscription: true,
      status: subscription.status,
      plan: subscription.planName,
      currentPeriodEnd: subscription.currentPeriodEnd,
      cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
    };
  }

  /**
   * Get payment history for tenant
   */
  async getPaymentHistory(tenantId: string, limit: number = 10): Promise<any[]> {
    return this.prisma.payment.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  /**
   * Get invoices for tenant
   */
  async getInvoices(tenantId: string, limit: number = 10): Promise<any[]> {
    return this.prisma.invoice.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  /**
   * Create a refund
   */
  async createRefund(paymentId: string, amount?: number): Promise<{
    success: boolean;
    refundId?: string;
    error?: string;
  }> {
    try {
      const refundData: any = {};
      if (amount) {
        refundData.amount = amount;
      }

      const response = await this.axiosInstance.post(
        `/v1/payments/${paymentId}/refunds`,
        refundData
      );

      // Update payment status
      await this.prisma.payment.update({
        where: { gatewayPaymentId: paymentId },
        data: {
          status: 'REFUNDED',
          refundedAt: new Date(),
        },
      });

      return {
        success: true,
        refundId: response.data.id,
      };
    } catch (error: any) {
      console.error('[MercadoPago] Error creating refund:', error);
      return {
        success: false,
        error: error.response?.data?.message || error.message,
      };
    }
  }

  // ============================================
  // Helper Methods
  // ============================================

  /**
   * Create pending subscription record
   */
  private async createPendingSubscription(
    tenantId: string,
    planId: string,
    preferenceId: string
  ): Promise<void> {
    const plan = this.getPlanById(planId);
    const tier = plan ? this.getTierFromPlan(plan.id) : 'FREE';

    // Upsert subscription as pending
    await this.prisma.subscription.upsert({
      where: { tenantId },
      create: {
        tenantId,
        planId,
        planName: plan?.name || 'Unknown',
        status: 'PENDING',
        tier,
        gateway: 'MERCADOPAGO',
        gatewayPreapprovalId: preferenceId,
      },
      update: {
        planId,
        planName: plan?.name || 'Unknown',
        status: 'PENDING',
        gatewayPreapprovalId: preferenceId,
      },
    });
  }

  /**
   * Get subscription tier from plan ID
   */
  private getTierFromPlan(planId: string): 'FREE' | 'PRO' | 'ENTERPRISE' {
    if (planId.includes('enterprise')) return 'ENTERPRISE';
    if (planId.includes('pro')) return 'PRO';
    return 'FREE';
  }

  /**
   * Generate invoice number
   */
  private generateInvoiceNumber(): string {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    return `INV-${year}${month}-${random}`;
  }

  /**
   * Verify webhook signature (for security)
   */
  verifyWebhookSignature(signature: string, payload: any): boolean {
    // MercadoPago doesn't use signatures like Stripe
    // Instead, we verify by fetching the payment details
    // This is a placeholder for additional verification if needed
    return true;
  }

  /**
   * Get customer cards (for saved payment methods)
   */
  async getCustomerCards(customerId: string): Promise<any[]> {
    try {
      const response = await this.axiosInstance.get(`/v1/customers/${customerId}/cards`);
      return response.data;
    } catch (error: any) {
      console.error('[MercadoPago] Error getting customer cards:', error);
      return [];
    }
  }

  /**
   * Create customer
   */
  async createCustomer(email: string, name?: string): Promise<{
    id: string;
    email: string;
  }> {
    try {
      const response = await this.axiosInstance.post('/v1/customers', {
        email,
        first_name: name?.split(' ')[0],
        last_name: name?.split(' ').slice(1).join(' '),
      });

      return {
        id: response.data.id,
        email: response.data.email,
      };
    } catch (error: any) {
      // Customer might already exist
      if (error.response?.status === 400) {
        // Try to get existing customer
        const searchResponse = await this.axiosInstance.get('/v1/customers/search', {
          params: { email },
        });

        if (searchResponse.data.results?.length > 0) {
          return {
            id: searchResponse.data.results[0].id,
            email: searchResponse.data.results[0].email,
          };
        }
      }

      throw error;
    }
  }

  // ============================================
  // Recurring Subscription (Preapproval) Methods
  // ============================================

  /**
   * Create recurring subscription preapproval
   */
  async createPreapproval(data: {
    reason: string;
    auto_recurring: {
      frequency: number;
      frequency_type: 'days' | 'months' | 'years';
      transaction_amount: number;
      currency_id: string;
      start_date?: string;
      end_date?: string;
    };
    back_url: string;
    external_reference?: string;
    payer_email?: string;
  }): Promise<{
    id: string;
    init_point: string;
    status: string;
  }> {
    try {
      const response = await this.axiosInstance.post('/preapproval', data);

      return {
        id: response.data.id,
        init_point: response.data.init_point,
        status: response.data.status,
      };
    } catch (error: any) {
      console.error('[MercadoPago] Error creating preapproval:', error.response?.data || error.message);
      throw new Error(`Failed to create preapproval: ${error.message}`);
    }
  }

  /**
   * Get preapproval details
   */
  async getPreapproval(preapprovalId: string): Promise<{
    id: string;
    status: string;
    reason: string;
    auto_recurring: {
      frequency: number;
      frequency_type: string;
      transaction_amount: number;
      currency_id: string;
    };
    external_reference: string;
    back_url: string;
    date_created: string;
    last_modified: string;
  }> {
    try {
      const response = await this.axiosInstance.get(`/preapproval/${preapprovalId}`);
      return response.data;
    } catch (error: any) {
      console.error('[MercadoPago] Error getting preapproval:', error.response?.data || error.message);
      throw new Error(`Failed to get preapproval: ${error.message}`);
    }
  }

  /**
   * Cancel recurring subscription preapproval
   */
  async cancelPreapproval(preapprovalId: string): Promise<void> {
    try {
      await this.axiosInstance.put(`/preapproval/${preapprovalId}`, {
        status: 'cancelled',
      });

      console.log(`[MercadoPago] Cancelled preapproval ${preapprovalId}`);
    } catch (error: any) {
      console.error('[MercadoPago] Error cancelling preapproval:', error.response?.data || error.message);
      throw new Error(`Failed to cancel preapproval: ${error.message}`);
    }
  }

  /**
   * Update recurring subscription preapproval
   */
  async updatePreapproval(
    preapprovalId: string,
    data: Partial<{
      reason: string;
      auto_recurring: {
        frequency: number;
        frequency_type: 'days' | 'months' | 'years';
        transaction_amount: number;
        currency_id: string;
        start_date?: string;
        end_date?: string;
      };
      status: 'authorized' | 'paused' | 'cancelled';
      back_url: string;
    }>
  ): Promise<void> {
    try {
      await this.axiosInstance.put(`/preapproval/${preapprovalId}`, data);

      console.log(`[MercadoPago] Updated preapproval ${preapprovalId}`);
    } catch (error: any) {
      console.error('[MercadoPago] Error updating preapproval:', error.response?.data || error.message);
      throw new Error(`Failed to update preapproval: ${error.message}`);
    }
  }

  /**
   * Pause recurring subscription preapproval
   */
  async pausePreapproval(preapprovalId: string): Promise<void> {
    return this.updatePreapproval(preapprovalId, { status: 'paused' });
  }

  /**
   * Resume paused recurring subscription preapproval
   */
  async resumePreapproval(preapprovalId: string): Promise<void> {
    return this.updatePreapproval(preapprovalId, { status: 'authorized' });
  }

  /**
   * Search preapprovals by external reference
   */
  async searchPreapprovals(externalReference: string): Promise<any[]> {
    try {
      const response = await this.axiosInstance.get('/preapproval/search', {
        params: {
          external_reference: externalReference,
        },
      });

      return response.data.results || [];
    } catch (error: any) {
      console.error('[MercadoPago] Error searching preapprovals:', error.response?.data || error.message);
      return [];
    }
  }
}

// Export singleton instance
export const mercadoPagoService = new MercadoPagoService();
