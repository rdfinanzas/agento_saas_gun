/**
 * Billing Module - Subscription Service
 * Migrado de Prisma a Drizzle ORM para Bun
 */

import { eq, and } from "drizzle-orm"
import { db } from "../../../db"
import { subscriptions, tenants, invoices, payments } from "../../../db/schema"
import { SubscriptionStatus, SubscriptionTier } from "../../../db/schema/enums"

export interface PlanDetails {
  id: string
  name: string
  price: number
  currency: string
  interval: "monthly" | "yearly"
  features: string[]
  maxRequests: number
  maxStorage: bigint
  maxAgents: number
}

// Available plans
export const AVAILABLE_PLANS: PlanDetails[] = [
  {
    id: "free",
    name: "Gratis",
    price: 0,
    currency: "MXN",
    interval: "monthly",
    features: ["1 agente de WhatsApp", "1,000 mensajes/mes", "1GB almacenamiento"],
    maxRequests: 1000,
    maxStorage: BigInt(1073741824),
    maxAgents: 1,
  },
  {
    id: "pro-monthly",
    name: "Pro (Mensual)",
    price: 299,
    currency: "MXN",
    interval: "monthly",
    features: ["5 agentes", "10,000 mensajes/mes", "10GB almacenamiento"],
    maxRequests: 10000,
    maxStorage: BigInt(10737418240),
    maxAgents: 5,
  },
  {
    id: "pro-yearly",
    name: "Pro (Anual)",
    price: 2999,
    currency: "MXN",
    interval: "yearly",
    features: ["5 agentes", "10,000 mensajes/mes", "10GB almacenamiento", "2 meses gratis"],
    maxRequests: 10000,
    maxStorage: BigInt(10737418240),
    maxAgents: 5,
  },
  {
    id: "enterprise-monthly",
    name: "Enterprise (Mensual)",
    price: 999,
    currency: "MXN",
    interval: "monthly",
    features: ["Agentes ilimitados", "Mensajes ilimitados", "100GB almacenamiento"],
    maxRequests: 100000,
    maxStorage: BigInt(107374182400),
    maxAgents: 100,
  },
  {
    id: "enterprise-yearly",
    name: "Enterprise (Anual)",
    price: 9999,
    currency: "MXN",
    interval: "yearly",
    features: ["Agentes ilimitados", "Mensajes ilimitados", "100GB almacenamiento", "2 meses gratis"],
    maxRequests: 100000,
    maxStorage: BigInt(107374182400),
    maxAgents: 100,
  },
]

class SubscriptionService {
  /**
   * Get all available plans
   */
  getPlans(): PlanDetails[] {
    return AVAILABLE_PLANS
  }

  /**
   * Get plan by ID
   */
  getPlanById(planId: string): PlanDetails | undefined {
    return AVAILABLE_PLANS.find((p) => p.id === planId)
  }

  /**
   * Get subscription by tenant
   */
  async getSubscriptionByTenant(tenantId: string) {
    return db.query.subscriptions.findFirst({
      where: eq(subscriptions.tenantId, tenantId),
    })
  }

  /**
   * Get subscription with details
   */
  async getSubscriptionDetails(tenantId: string) {
    const subscription = await this.getSubscriptionByTenant(tenantId)
    if (!subscription) return null

    const plan = this.getPlanById(subscription.planId)
    return {
      ...subscription,
      plan,
    }
  }

  /**
   * Create subscription
   */
  async createSubscription(data: {
    tenantId: string
    planId: string
    payerEmail: string
    gatewayPreapprovalId?: string
  }) {
    const plan = this.getPlanById(data.planId)
    if (!plan) {
      throw new Error("Plan not found")
    }

    const tier = this.getTierFromPlan(plan.id)
    const now = new Date()
    const periodEnd = this.calculatePeriodEnd(now, plan)

    const [subscription] = await db
      .insert(subscriptions)
      .values({
        tenantId: data.tenantId,
        planId: plan.id,
        planName: plan.name,
        tier,
        status: SubscriptionStatus.PENDING,
        currentPeriodStart: now,
        currentPeriodEnd: periodEnd,
        gatewayPreapprovalId: data.gatewayPreapprovalId,
        autoRenew: true,
      })
      .returning()

    return subscription
  }

  /**
   * Activate subscription
   */
  async activateSubscription(tenantId: string) {
    const subscription = await this.getSubscriptionByTenant(tenantId)
    if (!subscription) {
      throw new Error("Subscription not found")
    }

    const plan = this.getPlanById(subscription.planId)
    if (!plan) {
      throw new Error("Plan not found")
    }

    const now = new Date()
    const periodEnd = this.calculatePeriodEnd(now, plan)

    await db
      .update(subscriptions)
      .set({
        status: SubscriptionStatus.ACTIVE,
        currentPeriodStart: now,
        currentPeriodEnd: periodEnd,
      })
      .where(eq(subscriptions.tenantId, tenantId))

    // Update tenant quotas
    await db
      .update(tenants)
      .set({
        subscriptionTier: subscription.tier,
        quotaMaxRequests: plan.maxRequests,
        quotaMaxStorage: plan.maxStorage,
      })
      .where(eq(tenants.id, tenantId))

    return subscription
  }

  /**
   * Cancel subscription
   */
  async cancelSubscription(tenantId: string, immediately: boolean = true) {
    const subscription = await this.getSubscriptionByTenant(tenantId)
    if (!subscription) {
      throw new Error("Subscription not found")
    }

    if (immediately) {
      await db
        .update(subscriptions)
        .set({
          status: SubscriptionStatus.CANCELLED,
          cancelledAt: new Date(),
          autoRenew: false,
        })
        .where(eq(subscriptions.tenantId, tenantId))

      // Downgrade to free
      await this.downgradeTenantToFree(tenantId)
    } else {
      await db
        .update(subscriptions)
        .set({ cancelAtPeriodEnd: true })
        .where(eq(subscriptions.tenantId, tenantId))
    }

    return subscription
  }

  /**
   * Pause subscription
   */
  async pauseSubscription(tenantId: string) {
    await db
      .update(subscriptions)
      .set({
        status: SubscriptionStatus.PAUSED,
        pausedAt: new Date(),
      })
      .where(eq(subscriptions.tenantId, tenantId))

    return this.getSubscriptionByTenant(tenantId)
  }

  /**
   * Resume subscription
   */
  async resumeSubscription(tenantId: string) {
    await db
      .update(subscriptions)
      .set({
        status: SubscriptionStatus.ACTIVE,
        pausedAt: null,
      })
      .where(eq(subscriptions.tenantId, tenantId))

    return this.getSubscriptionByTenant(tenantId)
  }

  /**
   * Get invoices for tenant
   */
  async getInvoices(tenantId: string, limit: number = 10) {
    return db.query.invoices.findMany({
      where: eq(invoices.tenantId, tenantId),
      limit,
      orderBy: (invoices, { desc }) => [desc(invoices.createdAt)],
    })
  }

  /**
   * Get payment history
   */
  async getPaymentHistory(tenantId: string, limit: number = 10) {
    return db.query.payments.findMany({
      where: eq(payments.tenantId, tenantId),
      limit,
      orderBy: (payments, { desc }) => [desc(payments.createdAt)],
    })
  }

  /**
   * Get subscriptions due for renewal
   */
  async getSubscriptionsDueForRenewal() {
    const now = new Date()
    return db.query.subscriptions.findMany({
      where: and(
        eq(subscriptions.status, SubscriptionStatus.ACTIVE),
        eq(subscriptions.autoRenew, true)
      ),
    })
  }

  // Helper methods
  private getTierFromPlan(planId: string): SubscriptionTier {
    if (planId.includes("enterprise")) return SubscriptionTier.ENTERPRISE
    if (planId.includes("pro")) return SubscriptionTier.PRO
    return SubscriptionTier.FREE
  }

  private calculatePeriodEnd(start: Date, plan: PlanDetails): Date {
    const end = new Date(start)
    if (plan.interval === "monthly") {
      end.setMonth(end.getMonth() + 1)
    } else {
      end.setFullYear(end.getFullYear() + 1)
    }
    return end
  }

  private async downgradeTenantToFree(tenantId: string) {
    await db
      .update(tenants)
      .set({
        subscriptionTier: SubscriptionTier.FREE,
        quotaMaxRequests: 1000,
        quotaMaxStorage: BigInt(1073741824),
      })
      .where(eq(tenants.id, tenantId))
  }
}

export const subscriptionService = new SubscriptionService()
