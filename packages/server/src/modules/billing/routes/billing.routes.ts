/**
 * Billing Routes
 * Migrado de Express a Hono
 */

import { Hono } from "hono"
import { billingController } from "../controllers/billing.controller"
import { authMiddleware } from "../../auth/middleware/auth.middleware"

const billingRoutes = new Hono()

// All routes require authentication (except webhook)
billingRoutes.use("*", async (c, next) => {
  // Skip auth for webhook endpoint
  if (c.req.path === "/api/v1/billing/webhook/mercadopago") {
    return next()
  }
  return authMiddleware(c, next)
})

// ============================================
// Plans
// ============================================

/**
 * @route GET /api/billing/plans
 * @desc Get all available plans
 * @access Public (with auth)
 */
billingRoutes.get("/plans", (c) => billingController.getPlans(c))

// ============================================
// Subscription Management
// ============================================

/**
 * @route GET /api/billing/subscription
 * @desc Get current subscription
 * @access Private
 */
billingRoutes.get("/subscription", (c) => billingController.getSubscription(c))

/**
 * @route POST /api/billing/subscribe
 * @desc Create subscription
 * @access Private
 */
billingRoutes.post("/subscribe", (c) => billingController.subscribe(c))

/**
 * @route POST /api/billing/cancel
 * @desc Cancel subscription
 * @access Private
 */
billingRoutes.post("/cancel", (c) => billingController.cancel(c))

/**
 * @route POST /api/billing/pause
 * @desc Pause subscription
 * @access Private
 */
billingRoutes.post("/pause", (c) => billingController.pause(c))

/**
 * @route POST /api/billing/resume
 * @desc Resume subscription
 * @access Private
 */
billingRoutes.post("/resume", (c) => billingController.resume(c))

// ============================================
// Invoices & Payments
// ============================================

/**
 * @route GET /api/billing/invoices
 * @desc Get invoices
 * @access Private
 */
billingRoutes.get("/invoices", (c) => billingController.getInvoices(c))

/**
 * @route GET /api/billing/payments
 * @desc Get payment history
 * @access Private
 */
billingRoutes.get("/payments", (c) => billingController.getPayments(c))

// ============================================
// Webhooks
// ============================================

/**
 * @route POST /api/billing/webhook/mercadopago
 * @desc Handle MercadoPago webhook
 * @access Public (verified by signature)
 */
billingRoutes.post("/webhook/mercadopago", (c) => billingController.handleWebhook(c))

export { billingRoutes }
