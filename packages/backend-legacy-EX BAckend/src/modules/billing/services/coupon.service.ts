/**
 * CouponService - Gestión de códigos promocionales
 * FASE 1: Suscripciones Recurrentes
 */

import { PrismaClient } from '@prisma/client';

// ============================================
// Types & Interfaces
// ============================================

export interface CreateCouponData {
  code: string;
  description?: string;
  discountType: 'percentage' | 'fixed';
  discountValue: number;
  maxUses?: number;
  validFrom: Date;
  validUntil: Date;
  applicablePlanIds?: string[];
}

export interface ValidateCouponResult {
  valid: boolean;
  coupon?: {
    id: string;
    code: string;
    description: string | null;
    discountType: string;
    discountValue: number;
  };
  discountAmount?: number;
  error?: string;
}

export interface ApplyCouponData {
  tenantId: string;
  subscriptionId: string;
  couponCode: string;
  amount: number;
}

// ============================================
// Coupon Service
// ============================================

export class CouponService {
  private prisma: PrismaClient;

  constructor() {
    this.prisma = new PrismaClient();
  }

  // ============================================
  // Public Methods
  // ============================================

  /**
   * Create a new coupon
   */
  async createCoupon(data: CreateCouponData): Promise<{
    success: boolean;
    coupon?: any;
    error?: string;
  }> {
    try {
      // Check if coupon code already exists
      const existing = await this.prisma.coupon.findUnique({
        where: { code: data.code },
      });

      if (existing) {
        return { success: false, error: 'Coupon code already exists' };
      }

      const coupon = await this.prisma.coupon.create({
        data: {
          code: data.code.toUpperCase(),
          description: data.description,
          discountType: data.discountType,
          discountValue: data.discountValue,
          maxUses: data.maxUses,
          validFrom: data.validFrom,
          validUntil: data.validUntil,
          active: true,
          planIds: data.applicablePlanIds ? JSON.stringify(data.applicablePlanIds) : null,
        },
      });

      console.log(`[Coupon] Created coupon ${coupon.code}`);

      return { success: true, coupon };
    } catch (error: any) {
      console.error('[Coupon] Error creating coupon:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get coupon by code
   */
  async getCoupon(code: string): Promise<{
    success: boolean;
    coupon?: any;
    error?: string;
  }> {
    try {
      const coupon = await this.prisma.coupon.findUnique({
        where: { code: code.toUpperCase() },
      });

      if (!coupon) {
        return { success: false, error: 'Coupon not found' };
      }

      return { success: true, coupon };
    } catch (error: any) {
      console.error('[Coupon] Error getting coupon:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * List all coupons
   */
  async listCoupons(options: {
    active?: boolean;
    page?: number;
    limit?: number;
  } = {}): Promise<{
    success: boolean;
    coupons?: any[];
    total?: number;
    error?: string;
  }> {
    try {
      const { active, page = 1, limit = 20 } = options;

      const where: any = {};
      if (active !== undefined) {
        where.active = active;
      }

      const [coupons, total] = await Promise.all([
        this.prisma.coupon.findMany({
          where,
          skip: (page - 1) * limit,
          take: limit,
          orderBy: { createdAt: 'desc' },
        }),
        this.prisma.coupon.count({ where }),
      ]);

      // Parse planIds for each coupon
      const formattedCoupons = coupons.map(coupon => ({
        ...coupon,
        planIds: coupon.planIds ? JSON.parse(coupon.planIds) : null,
      }));

      return { success: true, coupons: formattedCoupons, total };
    } catch (error: any) {
      console.error('[Coupon] Error listing coupons:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Validate coupon
   */
  async validateCoupon(
    code: string,
    planId?: string
  ): Promise<ValidateCouponResult> {
    try {
      const coupon = await this.prisma.coupon.findUnique({
        where: { code: code.toUpperCase() },
      });

      if (!coupon) {
        return { valid: false, error: 'Coupon not found' };
      }

      // Check if active
      if (!coupon.active) {
        return { valid: false, error: 'Coupon is inactive' };
      }

      // Check dates
      const now = new Date();
      if (now < coupon.validFrom) {
        return { valid: false, error: 'Coupon is not yet valid' };
      }

      if (now > coupon.validUntil) {
        return { valid: false, error: 'Coupon has expired' };
      }

      // Check usage limit
      if (coupon.maxUses !== null && coupon.usedCount >= coupon.maxUses) {
        return { valid: false, error: 'Coupon has reached maximum uses' };
      }

      // Check plan applicability
      if (coupon.planIds && planId) {
        const applicablePlans = JSON.parse(coupon.planIds);
        if (!applicablePlans.includes(planId)) {
          return { valid: false, error: 'Coupon is not applicable to this plan' };
        }
      }

      return {
        valid: true,
        coupon: {
          id: coupon.id,
          code: coupon.code,
          description: coupon.description,
          discountType: coupon.discountType,
          discountValue: coupon.discountValue,
        },
      };
    } catch (error: any) {
      console.error('[Coupon] Error validating coupon:', error);
      return { valid: false, error: 'Error validating coupon' };
    }
  }

  /**
   * Calculate discount amount
   */
  calculateDiscount(
    discountType: 'percentage' | 'fixed',
    discountValue: number,
    amount: number
  ): number {
    if (discountType === 'percentage') {
      return (amount * discountValue) / 100;
    }
    return Math.min(discountValue, amount);
  }

  /**
   * Validate and calculate discount
   */
  async validateAndCalculate(
    code: string,
    amount: number,
    planId?: string
  ): Promise<ValidateCouponResult> {
    const result = await this.validateCoupon(code, planId);

    if (!result.valid || !result.coupon) {
      return result;
    }

    const discountAmount = this.calculateDiscount(
      result.coupon.discountType as 'percentage' | 'fixed',
      result.coupon.discountValue,
      amount
    );

    return {
      ...result,
      discountAmount,
    };
  }

  /**
   * Apply coupon to subscription/invoice
   */
  async applyCoupon(data: ApplyCouponData): Promise<{
    success: boolean;
    discountAmount?: number;
    finalAmount?: number;
    error?: string;
  }> {
    try {
      // Get subscription to find plan
      const subscription = await this.prisma.subscription.findUnique({
        where: { id: data.subscriptionId },
      });

      if (!subscription) {
        return { success: false, error: 'Subscription not found' };
      }

      // Validate coupon
      const result = await this.validateAndCalculate(
        data.couponCode,
        data.amount,
        subscription.planId
      );

      if (!result.valid) {
        return { success: false, error: result.error };
      }

      // Increment coupon usage
      await this.prisma.coupon.update({
        where: { code: data.couponCode.toUpperCase() },
        data: { usedCount: { increment: 1 } },
      });

      // Create invoice with discount
      const discountAmount = result.discountAmount || 0;
      const finalAmount = data.amount - discountAmount;

      await this.prisma.invoice.create({
        data: {
          tenantId: data.tenantId,
          subscriptionId: data.subscriptionId,
          number: this.generateInvoiceNumber(),
          amount: finalAmount,
          currency: 'MXN',
          discount: discountAmount,
          couponId: result.coupon?.id,
          status: 'OPEN',
        },
      });

      console.log(`[Coupon] Applied coupon ${data.couponCode} to subscription ${data.subscriptionId}`);

      return {
        success: true,
        discountAmount,
        finalAmount,
      };
    } catch (error: any) {
      console.error('[Coupon] Error applying coupon:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Update coupon
   */
  async updateCoupon(
    code: string,
    data: Partial<CreateCouponData>
  ): Promise<{
    success: boolean;
    coupon?: any;
    error?: string;
  }> {
    try {
      const coupon = await this.prisma.coupon.update({
        where: { code: code.toUpperCase() },
        data: {
          ...(data.description !== undefined && { description: data.description }),
          ...(data.discountType !== undefined && { discountType: data.discountType }),
          ...(data.discountValue !== undefined && { discountValue: data.discountValue }),
          ...(data.maxUses !== undefined && { maxUses: data.maxUses }),
          ...(data.validFrom !== undefined && { validFrom: data.validFrom }),
          ...(data.validUntil !== undefined && { validUntil: data.validUntil }),
          ...(data.applicablePlanIds !== undefined && {
            planIds: JSON.stringify(data.applicablePlanIds),
          }),
        },
      });

      console.log(`[Coupon] Updated coupon ${coupon.code}`);

      return { success: true, coupon };
    } catch (error: any) {
      console.error('[Coupon] Error updating coupon:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Deactivate coupon
   */
  async deactivateCoupon(code: string): Promise<{
    success: boolean;
    error?: string;
  }> {
    try {
      await this.prisma.coupon.update({
        where: { code: code.toUpperCase() },
        data: { active: false },
      });

      console.log(`[Coupon] Deactivated coupon ${code}`);

      return { success: true };
    } catch (error: any) {
      console.error('[Coupon] Error deactivating coupon:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Delete coupon
   */
  async deleteCoupon(code: string): Promise<{
    success: boolean;
    error?: string;
  }> {
    try {
      await this.prisma.coupon.delete({
        where: { code: code.toUpperCase() },
      });

      console.log(`[Coupon] Deleted coupon ${code}`);

      return { success: true };
    } catch (error: any) {
      console.error('[Coupon] Error deleting coupon:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get coupon usage statistics
   */
  async getCouponStats(code: string): Promise<{
    success: boolean;
    stats?: {
      usedCount: number;
      maxUses: number | null;
      remainingUses: number | null;
      totalDiscount: number;
    };
    error?: string;
  }> {
    try {
      const coupon = await this.prisma.coupon.findUnique({
        where: { code: code.toUpperCase() },
        include: {
          invoices: {
            select: {
              discount: true,
            },
          },
        },
      });

      if (!coupon) {
        return { success: false, error: 'Coupon not found' };
      }

      const totalDiscount = coupon.invoices.reduce((sum, inv) => sum + (inv.discount || 0), 0);

      return {
        success: true,
        stats: {
          usedCount: coupon.usedCount,
          maxUses: coupon.maxUses,
          remainingUses: coupon.maxUses !== null ? coupon.maxUses - coupon.usedCount : null,
          totalDiscount,
        },
      };
    } catch (error: any) {
      console.error('[Coupon] Error getting coupon stats:', error);
      return { success: false, error: error.message };
    }
  }

  // ============================================
  // Helper Methods
  // ============================================

  /**
   * Generate invoice number
   */
  private generateInvoiceNumber(prefix: string = ''): string {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    return `INV-${prefix}${year}${month}-${random}`;
  }
}

// Export singleton instance
export const couponService = new CouponService();
