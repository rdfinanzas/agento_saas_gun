/**
 * Billing Routes - Rutas de facturación
 * FASE 5: MercadoPago integration
 */

import { Router } from 'express';
import { billingController } from '../controllers/billing.controller';
import { authMiddleware } from '../../auth/middleware/auth.middleware';

const router = Router();

// ============================================
// Public Routes (Webhook)
// ============================================

/**
 * @route POST /api/v1/billing/webhook
 * @desc Handle MercadoPago webhook notifications
 * @access Public (verified by MercadoPago)
 */
router.post('/webhook', billingController.handleWebhook.bind(billingController));

// ============================================
// Protected Routes
// ============================================

/**
 * @route GET /api/v1/billing/plans
 * @desc Get all available subscription plans
 * @access Private
 */
router.get('/plans', authMiddleware, billingController.getPlans.bind(billingController));

/**
 * @route GET /api/v1/billing/plans/:planId
 * @desc Get plan details by ID
 * @access Private
 */
router.get('/plans/:planId', authMiddleware, billingController.getPlan.bind(billingController));

/**
 * @route POST /api/v1/billing/checkout
 * @desc Create a checkout preference for a plan
 * @access Private
 */
router.post('/checkout', authMiddleware, billingController.createCheckout.bind(billingController));

/**
 * @route GET /api/v1/billing/subscription
 * @desc Get current subscription status
 * @access Private
 */
router.get('/subscription', authMiddleware, billingController.getSubscription.bind(billingController));

/**
 * @route POST /api/v1/billing/subscription/cancel
 * @desc Cancel subscription
 * @access Private
 */
router.post('/subscription/cancel', authMiddleware, billingController.cancelSubscription.bind(billingController));

/**
 * @route POST /api/v1/billing/subscription/reactivate
 * @desc Reactivate a cancelled subscription
 * @access Private
 */
router.post('/subscription/reactivate', authMiddleware, billingController.reactivateSubscription.bind(billingController));

/**
 * @route GET /api/v1/billing/payments
 * @desc Get payment history
 * @access Private
 */
router.get('/payments', authMiddleware, billingController.getPaymentHistory.bind(billingController));

/**
 * @route GET /api/v1/billing/invoices
 * @desc Get invoices
 * @access Private
 */
router.get('/invoices', authMiddleware, billingController.getInvoices.bind(billingController));

/**
 * @route GET /api/v1/billing/invoices/:invoiceId/download
 * @desc Download invoice as HTML/PDF
 * @access Private
 */
router.get('/invoices/:invoiceId/download', authMiddleware, billingController.downloadInvoice.bind(billingController));

/**
 * @route POST /api/v1/billing/refund
 * @desc Request a refund
 * @access Private
 */
router.post('/refund', authMiddleware, billingController.requestRefund.bind(billingController));

/**
 * @route GET /api/v1/billing/usage
 * @desc Get current usage and quotas
 * @access Private
 */
router.get('/usage', authMiddleware, billingController.getUsage.bind(billingController));

// ============================================
// Coupon Routes
// ============================================

/**
 * @route POST /api/v1/billing/coupons
 * @desc Create a new coupon
 * @access Private (Admin)
 */
router.post('/coupons', authMiddleware, billingController.createCoupon.bind(billingController));

/**
 * @route GET /api/v1/billing/coupons
 * @desc List all coupons
 * @access Private (Admin)
 */
router.get('/coupons', authMiddleware, billingController.listCoupons.bind(billingController));

/**
 * @route POST /api/v1/billing/coupons/:code/validate
 * @desc Validate a coupon code
 * @access Private
 */
router.post('/coupons/:code/validate', authMiddleware, billingController.validateCoupon.bind(billingController));

// ============================================
// Subscription Upgrade/Downgrade Routes
// ============================================

/**
 * @route POST /api/v1/billing/subscriptions/:id/upgrade
 * @desc Upgrade subscription to higher tier
 * @access Private
 */
router.post('/subscriptions/:id/upgrade', authMiddleware, billingController.upgradeSubscription.bind(billingController));

/**
 * @route POST /api/v1/billing/subscriptions/:id/downgrade
 * @desc Downgrade subscription to lower tier
 * @access Private
 */
router.post('/subscriptions/:id/downgrade', authMiddleware, billingController.downgradeSubscription.bind(billingController));

// ============================================
// Subscription Pause/Resume Routes
// ============================================

/**
 * @route POST /api/v1/billing/subscriptions/:id/pause
 * @desc Pause subscription
 * @access Private
 */
router.post('/subscriptions/:id/pause', authMiddleware, billingController.pauseSubscription.bind(billingController));

/**
 * @route POST /api/v1/billing/subscriptions/:id/resume
 * @desc Resume paused subscription
 * @access Private
 */
router.post('/subscriptions/:id/resume', authMiddleware, billingController.resumeSubscription.bind(billingController));

// ============================================
// Proration Routes
// ============================================

/**
 * @route POST /api/v1/billing/proration/calculate
 * @desc Calculate proration for plan change
 * @access Private
 */
router.post('/proration/calculate', authMiddleware, billingController.calculateProration.bind(billingController));

export { router as billingRoutes };
