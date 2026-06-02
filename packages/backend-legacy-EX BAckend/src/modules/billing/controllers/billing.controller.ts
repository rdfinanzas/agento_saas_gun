/**
 * Billing Controller - Gestión de facturación
 * FASE 5: MercadoPago integration
 * FASE 1: Suscripciones Recurrentes
 */

import { Request, Response } from 'express';
import { mercadoPagoService, MercadoPagoService } from '../services/mercadopago.service';
import { subscriptionService } from '../services/subscription.service';
import { couponService } from '../services/coupon.service';
import { prorationService } from '../services/proration.service';

export class BillingController {
  // ============================================
  // Plans
  // ============================================

  /**
   * Get all available plans
   */
  async getPlans(req: Request, res: Response): Promise<void> {
    try {
      const plans = mercadoPagoService.getPlans();

      res.json({
        success: true,
        plans: plans.map(p => ({
          id: p.id,
          name: p.name,
          price: p.price,
          currency: p.currency,
          interval: p.interval,
          features: p.features,
          maxRequests: p.maxRequests,
          maxStorage: Number(p.maxStorage),
          maxAgents: p.maxAgents,
        })),
      });
    } catch (error: any) {
      console.error('[Billing] GetPlans error:', error);
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Get plan by ID
   */
  async getPlan(req: Request, res: Response): Promise<void> {
    try {
      const { planId } = req.params;
      const plan = mercadoPagoService.getPlanById(planId);

      if (!plan) {
        res.status(404).json({ error: 'Plan not found' });
        return;
      }

      res.json({
        success: true,
        plan: {
          id: plan.id,
          name: plan.name,
          price: plan.price,
          currency: plan.currency,
          interval: plan.interval,
          features: plan.features,
          maxRequests: plan.maxRequests,
          maxStorage: Number(plan.maxStorage),
          maxAgents: plan.maxAgents,
        },
      });
    } catch (error: any) {
      console.error('[Billing] GetPlan error:', error);
      res.status(500).json({ error: error.message });
    }
  }

  // ============================================
  // Checkout
  // ============================================

  /**
   * Create checkout preference
   */
  async createCheckout(req: Request, res: Response): Promise<void> {
    try {
      const tenantId = req.tenantId!;
      const { planId, successUrl, failureUrl, pendingUrl } = req.body;

      if (!planId) {
        res.status(400).json({ error: 'Plan ID is required' });
        return;
      }

      const plan = mercadoPagoService.getPlanById(planId);
      if (!plan) {
        res.status(404).json({ error: 'Plan not found' });
        return;
      }

      // Free plan doesn't need payment
      if (plan.price === 0) {
        await this.activateFreePlan(tenantId);
        res.json({
          success: true,
          message: 'Free plan activated',
          redirectUrl: successUrl || '/dashboard',
        });
        return;
      }

      // Build notification URL
      const baseUrl = process.env.BASE_URL || 'http://localhost:3001';
      const notificationUrl = `${baseUrl}/api/v1/billing/webhook`;

      const preference = await mercadoPagoService.createPreference({
        tenantId,
        planId: plan.id,
        planName: plan.name,
        price: plan.price,
        currency: plan.currency,
        interval: plan.interval,
        successUrl: successUrl || `${process.env.FRONTEND_URL}/billing/success`,
        failureUrl: failureUrl || `${process.env.FRONTEND_URL}/billing/failure`,
        pendingUrl: pendingUrl || `${process.env.FRONTEND_URL}/billing/pending`,
        notificationUrl,
      });

      res.json({
        success: true,
        preferenceId: preference.id,
        // Use sandbox URL in development
        checkoutUrl: process.env.NODE_ENV === 'production'
          ? preference.initPoint
          : preference.sandboxInitPoint,
      });
    } catch (error: any) {
      console.error('[Billing] CreateCheckout error:', error);
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Activate free plan directly
   */
  private async activateFreePlan(tenantId: string): Promise<void> {
    const { PrismaClient } = await import('@prisma/client');
    const prisma = new PrismaClient();

    await prisma.tenant.update({
      where: { id: tenantId },
      data: {
        subscriptionTier: 'FREE',
        quotaMaxRequests: 1000,
        quotaMaxStorage: BigInt(1073741824), // 1GB
      },
    });

    await prisma.subscription.upsert({
      where: { tenantId },
      create: {
        tenantId,
        planId: 'free',
        planName: 'Gratis',
        status: 'ACTIVE',
        tier: 'FREE',
        gateway: 'NONE',
      },
      update: {
        planId: 'free',
        planName: 'Gratis',
        status: 'ACTIVE',
        tier: 'FREE',
        gateway: 'NONE',
      },
    });
  }

  // ============================================
  // Webhook
  // ============================================

  /**
   * Handle MercadoPago webhook
   */
  async handleWebhook(req: Request, res: Response): Promise<void> {
    try {
      // MercadoPago sends different payload formats
      const payload = req.body;

      console.log('[Billing] Webhook received:', JSON.stringify(payload));

      // Acknowledge immediately
      res.status(200).send('OK');

      // Process async
      const result = await mercadoPagoService.processWebhook(payload);

      console.log('[Billing] Webhook processed:', result);
    } catch (error: any) {
      console.error('[Billing] Webhook error:', error);
      // Still return 200 to avoid retries
      res.status(200).send('OK');
    }
  }

  // ============================================
  // Subscription Management
  // ============================================

  /**
   * Get current subscription status
   */
  async getSubscription(req: Request, res: Response): Promise<void> {
    try {
      const tenantId = req.tenantId!;
      const status = await mercadoPagoService.getSubscriptionStatus(tenantId);

      res.json({
        success: true,
        subscription: status,
      });
    } catch (error: any) {
      console.error('[Billing] GetSubscription error:', error);
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Cancel subscription
   */
  async cancelSubscription(req: Request, res: Response): Promise<void> {
    try {
      const tenantId = req.tenantId!;
      const { immediately } = req.body;

      if (immediately) {
        await mercadoPagoService.cancelSubscription(tenantId);
        res.json({
          success: true,
          message: 'Subscription cancelled immediately',
        });
      } else {
        // Cancel at period end
        const { PrismaClient } = await import('@prisma/client');
        const prisma = new PrismaClient();

        await prisma.subscription.update({
          where: { tenantId },
          data: { cancelAtPeriodEnd: true },
        });

        res.json({
          success: true,
          message: 'Subscription will be cancelled at the end of the current period',
        });
      }
    } catch (error: any) {
      console.error('[Billing] CancelSubscription error:', error);
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Reactivate cancelled subscription
   */
  async reactivateSubscription(req: Request, res: Response): Promise<void> {
    try {
      const tenantId = req.tenantId!;
      const { PrismaClient } = await import('@prisma/client');
      const prisma = new PrismaClient();

      const subscription = await prisma.subscription.findUnique({
        where: { tenantId },
      });

      if (!subscription) {
        res.status(404).json({ error: 'No subscription found' });
        return;
      }

      if (!subscription.cancelAtPeriodEnd) {
        res.status(400).json({ error: 'Subscription is not scheduled for cancellation' });
        return;
      }

      await prisma.subscription.update({
        where: { tenantId },
        data: { cancelAtPeriodEnd: false },
      });

      res.json({
        success: true,
        message: 'Subscription reactivated',
      });
    } catch (error: any) {
      console.error('[Billing] ReactivateSubscription error:', error);
      res.status(500).json({ error: error.message });
    }
  }

  // ============================================
  // Payment History & Invoices
  // ============================================

  /**
   * Get payment history
   */
  async getPaymentHistory(req: Request, res: Response): Promise<void> {
    try {
      const tenantId = req.tenantId!;
      const limit = parseInt(req.query.limit as string) || 10;

      const payments = await mercadoPagoService.getPaymentHistory(tenantId, limit);

      res.json({
        success: true,
        payments: payments.map(p => ({
          id: p.id,
          amount: p.amount,
          currency: p.currency,
          status: p.status,
          payerEmail: p.payerEmail,
          paidAt: p.paidAt,
          createdAt: p.createdAt,
        })),
      });
    } catch (error: any) {
      console.error('[Billing] GetPaymentHistory error:', error);
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Get invoices
   */
  async getInvoices(req: Request, res: Response): Promise<void> {
    try {
      const tenantId = req.tenantId!;
      const limit = parseInt(req.query.limit as string) || 10;

      const invoices = await mercadoPagoService.getInvoices(tenantId, limit);

      res.json({
        success: true,
        invoices: invoices.map(i => ({
          id: i.id,
          number: i.number,
          amount: i.amount,
          currency: i.currency,
          status: i.status,
          paidAt: i.paidAt,
          createdAt: i.createdAt,
          downloadUrl: `/api/v1/billing/invoices/${i.id}/download`,
        })),
      });
    } catch (error: any) {
      console.error('[Billing] GetInvoices error:', error);
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Download invoice as PDF
   */
  async downloadInvoice(req: Request, res: Response): Promise<void> {
    try {
      const tenantId = req.tenantId!;
      const { invoiceId } = req.params;
      const { PrismaClient } = await import('@prisma/client');
      const prisma = new PrismaClient();

      const invoice = await prisma.invoice.findFirst({
        where: {
          id: invoiceId,
          tenantId,
        },
        include: {
          tenant: true,
        },
      });

      if (!invoice) {
        res.status(404).json({ error: 'Invoice not found' });
        return;
      }

      // Generate simple HTML invoice (in production, use a PDF library)
      const html = this.generateInvoiceHtml(invoice);

      res.setHeader('Content-Type', 'text/html');
      res.setHeader('Content-Disposition', `attachment; filename="invoice-${invoice.number}.html"`);
      res.send(html);
    } catch (error: any) {
      console.error('[Billing] DownloadInvoice error:', error);
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Generate invoice HTML
   */
  private generateInvoiceHtml(invoice: any): string {
    return `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>Factura ${invoice.number}</title>
  <style>
    body { font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; }
    .header { text-align: center; border-bottom: 2px solid #333; padding-bottom: 20px; }
    .details { margin: 20px 0; }
    .details th { text-align: left; padding: 5px 10px; }
    .total { font-size: 1.2em; font-weight: bold; margin-top: 20px; }
    .footer { margin-top: 40px; font-size: 0.8em; color: #666; text-align: center; }
  </style>
</head>
<body>
  <div class="header">
    <h1>AgentO</h1>
    <h2>Factura: ${invoice.number}</h2>
  </div>
  <div class="details">
    <p><strong>Cliente:</strong> ${invoice.tenant?.name || 'N/A'}</p>
    <p><strong>Email:</strong> ${invoice.tenant?.email || 'N/A'}</p>
    <p><strong>Fecha:</strong> ${new Date(invoice.createdAt).toLocaleDateString('es-MX')}</p>
    <p><strong>Estado:</strong> ${invoice.status}</p>
  </div>
  <table width="100%" border="1" cellpadding="10">
    <tr>
      <th>Descripción</th>
      <th>Monto</th>
    </tr>
    <tr>
      <td>Suscripción ${invoice.tenant?.subscriptionTier || 'Plan'}</td>
      <td>${invoice.currency} ${invoice.amount.toFixed(2)}</td>
    </tr>
  </table>
  <div class="total">
    Total: ${invoice.currency} ${invoice.amount.toFixed(2)}
  </div>
  <div class="footer">
    <p>Gracias por su preferencia.</p>
    <p>AgentO - Plataforma de Agentes de WhatsApp con IA</p>
  </div>
</body>
</html>
    `;
  }

  // ============================================
  // Refunds
  // ============================================

  /**
   * Request a refund
   */
  async requestRefund(req: Request, res: Response): Promise<void> {
    try {
      const tenantId = req.tenantId!;
      const { paymentId, amount, reason } = req.body;

      if (!paymentId) {
        res.status(400).json({ error: 'Payment ID is required' });
        return;
      }

      const result = await mercadoPagoService.createRefund(paymentId, amount);

      if (result.success) {
        res.json({
          success: true,
          refundId: result.refundId,
          message: 'Refund processed successfully',
        });
      } else {
        res.status(400).json({
          success: false,
          error: result.error,
        });
      }
    } catch (error: any) {
      console.error('[Billing] RequestRefund error:', error);
      res.status(500).json({ error: error.message });
    }
  }

  // ============================================
  // Usage & Quotas
  // ============================================

  /**
   * Get current usage and quotas
   */
  async getUsage(req: Request, res: Response): Promise<void> {
    try {
      const tenantId = req.tenantId!;
      const { PrismaClient } = await import('@prisma/client');
      const prisma = new PrismaClient();

      // Get tenant with quota info
      const tenant = await prisma.tenant.findUnique({
        where: { id: tenantId },
        select: {
          subscriptionTier: true,
          quotaMaxRequests: true,
          quotaMaxStorage: true,
        },
      });

      if (!tenant) {
        res.status(404).json({ error: 'Tenant not found' });
        return;
      }

      // Get current month usage
      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);

      const usage = await prisma.tenantUsage.aggregate({
        where: {
          tenantId,
          date: {
            gte: monthStart,
            lte: monthEnd,
          },
        },
        _sum: {
          requestsCount: true,
          whatsappMessages: true,
        },
      });

      // Get storage usage
      const storageUsage = await prisma.tenantFile.aggregate({
        where: { tenantId },
        _sum: {
          size: true,
        },
      });

      res.json({
        success: true,
        tier: tenant.subscriptionTier,
        quotas: {
          maxRequests: tenant.quotaMaxRequests,
          maxStorage: Number(tenant.quotaMaxStorage),
        },
        usage: {
          requests: usage._sum.requestsCount || 0,
          whatsappMessages: usage._sum.whatsappMessages || 0,
          storage: Number(storageUsage._sum.size || 0),
        },
        period: {
          start: monthStart,
          end: monthEnd,
        },
      });
    } catch (error: any) {
      console.error('[Billing] GetUsage error:', error);
      res.status(500).json({ error: error.message });
    }
  }

  // ============================================
  // Coupon Management
  // ============================================

  /**
   * Create coupon
   */
  async createCoupon(req: Request, res: Response): Promise<void> {
    try {
      const data = req.body;
      const result = await couponService.createCoupon(data);

      if (result.success) {
        res.json({ success: true, coupon: result.coupon });
      } else {
        res.status(400).json({ error: result.error });
      }
    } catch (error: any) {
      console.error('[Billing] CreateCoupon error:', error);
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * List coupons
   */
  async listCoupons(req: Request, res: Response): Promise<void> {
    try {
      const active = req.query.active === 'true' ? true : req.query.active === 'false' ? false : undefined;
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;

      const result = await couponService.listCoupons({ active, page, limit });

      if (result.success) {
        res.json({
          success: true,
          coupons: result.coupons,
          total: result.total,
        });
      } else {
        res.status(400).json({ error: result.error });
      }
    } catch (error: any) {
      console.error('[Billing] ListCoupons error:', error);
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Validate coupon
   */
  async validateCoupon(req: Request, res: Response): Promise<void> {
    try {
      const { code } = req.params;
      const planId = req.query.planId as string;

      const result = await couponService.validateCoupon(code, planId);

      if (result.valid) {
        res.json({ success: true, coupon: result.coupon });
      } else {
        res.status(400).json({ error: result.error });
      }
    } catch (error: any) {
      console.error('[Billing] ValidateCoupon error:', error);
      res.status(500).json({ error: error.message });
    }
  }

  // ============================================
  // Subscription Upgrade/Downgrade
  // ============================================

  /**
   * Upgrade subscription
   */
  async upgradeSubscription(req: Request, res: Response): Promise<void> {
    try {
      const tenantId = req.tenantId!;
      const { id } = req.params;
      const { targetPlanId, prorate = true, effectiveImmediately = true } = req.body;

      const result = await subscriptionService.upgradeSubscription(tenantId, {
        targetPlanId,
        prorate,
        effectiveImmediately,
      });

      if (result.success) {
        res.json({ success: true, message: result.message, proratedAmount: result.proratedAmount });
      } else {
        res.status(400).json({ error: result.message });
      }
    } catch (error: any) {
      console.error('[Billing] UpgradeSubscription error:', error);
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Downgrade subscription
   */
  async downgradeSubscription(req: Request, res: Response): Promise<void> {
    try {
      const tenantId = req.tenantId!;
      const { id } = req.params;
      const { targetPlanId, prorate = true, effectiveImmediately = false } = req.body;

      const result = await subscriptionService.downgradeSubscription(tenantId, {
        targetPlanId,
        prorate,
        effectiveImmediately,
      });

      if (result.success) {
        res.json({ success: true, message: result.message, creditAmount: result.creditAmount });
      } else {
        res.status(400).json({ error: result.message });
      }
    } catch (error: any) {
      console.error('[Billing] DowngradeSubscription error:', error);
      res.status(500).json({ error: error.message });
    }
  }

  // ============================================
  // Subscription Pause/Resume
  // ============================================

  /**
   * Pause subscription
   */
  async pauseSubscription(req: Request, res: Response): Promise<void> {
    try {
      const tenantId = req.tenantId!;
      const { id } = req.params;
      const { reason, resumeAt } = req.body;

      const result = await subscriptionService.pauseSubscription(tenantId, {
        reason,
        resumeAt: resumeAt ? new Date(resumeAt) : undefined,
      });

      if (result.success) {
        res.json({ success: true, message: result.message });
      } else {
        res.status(400).json({ error: result.message });
      }
    } catch (error: any) {
      console.error('[Billing] PauseSubscription error:', error);
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Resume subscription
   */
  async resumeSubscription(req: Request, res: Response): Promise<void> {
    try {
      const tenantId = req.tenantId!;
      const { id } = req.params;

      const result = await subscriptionService.resumeSubscription(tenantId);

      if (result.success) {
        res.json({ success: true, message: result.message });
      } else {
        res.status(400).json({ error: result.message });
      }
    } catch (error: any) {
      console.error('[Billing] ResumeSubscription error:', error);
      res.status(500).json({ error: error.message });
    }
  }

  // ============================================
  // Proration Calculation
  // ============================================

  /**
   * Calculate proration for plan change
   */
  async calculateProration(req: Request, res: Response): Promise<void> {
    try {
      const tenantId = req.tenantId!;
      const { targetPlanId } = req.body;

      if (!targetPlanId) {
        res.status(400).json({ error: 'Target plan ID is required' });
        return;
      }

      const result = await prorationService.calculateUpgradeProration(tenantId, targetPlanId);

      res.json({
        success: true,
        proration: result,
      });
    } catch (error: any) {
      console.error('[Billing] CalculateProration error:', error);
      res.status(500).json({ error: error.message });
    }
  }
}

export const billingController = new BillingController();
