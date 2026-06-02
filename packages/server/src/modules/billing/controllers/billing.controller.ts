/**
 * Billing Controller
 * Migrado de Express a Hono
 */

import type { Context } from "hono"
import { subscriptionService } from "../services/subscription.service"
import { HTTPException } from "hono/http-exception"

export class BillingController {
  /**
   * GET /api/billing/plans
   * Get all available plans
   */
  async getPlans(c: Context) {
    const plans = subscriptionService.getPlans()
    return c.json(plans)
  }

  /**
   * GET /api/billing/subscription
   * Get current subscription
   */
  async getSubscription(c: Context) {
    const tenantId = c.get("tenantId") as string
    if (!tenantId) {
      throw new HTTPException(401, { message: "Unauthorized" })
    }

    const subscription = await subscriptionService.getSubscriptionDetails(tenantId)
    return c.json(subscription || { status: "none" })
  }

  /**
   * POST /api/billing/subscribe
   * Create subscription
   */
  async subscribe(c: Context) {
    const tenantId = c.get("tenantId") as string
    if (!tenantId) {
      throw new HTTPException(401, { message: "Unauthorized" })
    }

    const body = await c.req.json()
    const subscription = await subscriptionService.createSubscription({
      tenantId,
      planId: body.planId,
      payerEmail: body.payerEmail,
      gatewayPreapprovalId: body.gatewayPreapprovalId,
    })

    return c.json(subscription, 201)
  }

  /**
   * POST /api/billing/cancel
   * Cancel subscription
   */
  async cancel(c: Context) {
    const tenantId = c.get("tenantId") as string
    if (!tenantId) {
      throw new HTTPException(401, { message: "Unauthorized" })
    }

    const body = await c.req.json().catch(() => ({}))
    const immediately = body.immediately !== false

    const subscription = await subscriptionService.cancelSubscription(tenantId, immediately)
    return c.json({ message: "Subscription cancelled", subscription })
  }

  /**
   * POST /api/billing/pause
   * Pause subscription
   */
  async pause(c: Context) {
    const tenantId = c.get("tenantId") as string
    if (!tenantId) {
      throw new HTTPException(401, { message: "Unauthorized" })
    }

    const subscription = await subscriptionService.pauseSubscription(tenantId)
    return c.json(subscription)
  }

  /**
   * POST /api/billing/resume
   * Resume subscription
   */
  async resume(c: Context) {
    const tenantId = c.get("tenantId") as string
    if (!tenantId) {
      throw new HTTPException(401, { message: "Unauthorized" })
    }

    const subscription = await subscriptionService.resumeSubscription(tenantId)
    return c.json(subscription)
  }

  /**
   * GET /api/billing/invoices
   * Get invoices
   */
  async getInvoices(c: Context) {
    const tenantId = c.get("tenantId") as string
    if (!tenantId) {
      throw new HTTPException(401, { message: "Unauthorized" })
    }

    const limit = parseInt(c.req.query("limit") || "10")
    const invoices = await subscriptionService.getInvoices(tenantId, limit)
    return c.json(invoices)
  }

  /**
   * GET /api/billing/payments
   * Get payment history
   */
  async getPayments(c: Context) {
    const tenantId = c.get("tenantId") as string
    if (!tenantId) {
      throw new HTTPException(401, { message: "Unauthorized" })
    }

    const limit = parseInt(c.req.query("limit") || "10")
    const payments = await subscriptionService.getPaymentHistory(tenantId, limit)
    return c.json(payments)
  }

  /**
   * POST /api/billing/webhook/mercadopago
   * Handle MercadoPago webhook
   */
  async handleWebhook(c: Context) {
    try {
      const body = await c.req.json()
      console.log("[Billing] Webhook received:", body.type, body.data?.id)

      // Process webhook based on type
      if (body.type === "payment") {
        // Handle payment notification
        // This would integrate with MercadoPagoService
        return c.json({ success: true, action: "payment_processed" })
      }

      if (body.type === "subscription_preapproval") {
        // Handle subscription notification
        return c.json({ success: true, action: "subscription_processed" })
      }

      return c.json({ success: true, action: "ignored" })
    } catch (error) {
      console.error("[Billing] Webhook error:", error)
      throw new HTTPException(500, { message: "Webhook processing failed" })
    }
  }
}

export const billingController = new BillingController()
