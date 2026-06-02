/**
 * Billing Service - Frontend billing API client
 * FASE 5: MercadoPago integration
 */

import { api } from './api';

// ============================================
// Types
// ============================================

export interface Plan {
  id: string;
  name: string;
  price: number;
  currency: string;
  interval: 'monthly' | 'yearly';
  features: string[];
  maxRequests: number;
  maxStorage: number;
  maxAgents: number;
}

export interface Subscription {
  hasSubscription: boolean;
  status: string | null;
  plan: string | null;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
}

export interface Payment {
  id: string;
  amount: number;
  currency: string;
  status: string;
  payerEmail: string;
  paidAt: string;
  createdAt: string;
}

export interface Invoice {
  id: string;
  number: string;
  amount: number;
  currency: string;
  status: string;
  paidAt: string;
  createdAt: string;
  downloadUrl: string;
}

export interface Usage {
  tier: string;
  quotas: {
    maxRequests: number;
    maxStorage: number;
  };
  usage: {
    requests: number;
    whatsappMessages: number;
    storage: number;
  };
  period: {
    start: string;
    end: string;
  };
}

export interface CheckoutResponse {
  success: boolean;
  preferenceId?: string;
  checkoutUrl?: string;
  redirectUrl?: string;
  message?: string;
}

// ============================================
// Billing Service
// ============================================

export const billingService = {
  // Plans
  async getPlans(): Promise<{ success: boolean; plans: Plan[] }> {
    return api.get('/billing/plans');
  },

  async getPlan(planId: string): Promise<{ success: boolean; plan: Plan }> {
    return api.get(`/billing/plans/${planId}`);
  },

  // Checkout
  async createCheckout(
    planId: string,
    urls?: {
      successUrl?: string;
      failureUrl?: string;
      pendingUrl?: string;
    }
  ): Promise<CheckoutResponse> {
    return api.post('/billing/checkout', {
      planId,
      ...urls,
    });
  },

  // Subscription
  async getSubscription(): Promise<{ success: boolean; subscription: Subscription }> {
    return api.get('/billing/subscription');
  },

  async cancelSubscription(immediately: boolean = false): Promise<{ success: boolean; message: string }> {
    return api.post('/billing/subscription/cancel', { immediately });
  },

  async reactivateSubscription(): Promise<{ success: boolean; message: string }> {
    return api.post('/billing/subscription/reactivate', {});
  },

  // Payments
  async getPaymentHistory(limit: number = 10): Promise<{ success: boolean; payments: Payment[] }> {
    return api.get(`/billing/payments?limit=${limit}`);
  },

  // Invoices
  async getInvoices(limit: number = 10): Promise<{ success: boolean; invoices: Invoice[] }> {
    return api.get(`/billing/invoices?limit=${limit}`);
  },

  async downloadInvoice(invoiceId: string): Promise<Blob> {
    const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
    const token = localStorage.getItem('token');

    const response = await fetch(
      `${API_URL}/api/v1/billing/invoices/${invoiceId}/download`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    if (!response.ok) {
      throw new Error('Failed to download invoice');
    }

    return response.blob();
  },

  // Refunds
  async requestRefund(
    paymentId: string,
    amount?: number,
    reason?: string
  ): Promise<{ success: boolean; refundId?: string; error?: string }> {
    return api.post('/billing/refund', { paymentId, amount, reason });
  },

  // Usage
  async getUsage(): Promise<{ success: boolean; tier: string; quotas: any; usage: any; period: any }> {
    return api.get('/billing/usage');
  },
};

// ============================================
// Helper Functions
// ============================================

export function formatPrice(price: number, currency: string = 'MXN'): string {
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency,
  }).format(price);
}

export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

export function getUsagePercentage(used: number, max: number): number {
  if (max === 0) return 0;
  return Math.min(100, Math.round((used / max) * 100));
}

export function getTierBadgeColor(tier: string): string {
  switch (tier) {
    case 'ENTERPRISE':
      return 'bg-purple-100 text-purple-800';
    case 'PRO':
      return 'bg-blue-100 text-blue-800';
    default:
      return 'bg-gray-100 text-gray-800';
  }
}

export function getStatusBadgeColor(status: string): string {
  switch (status.toUpperCase()) {
    case 'ACTIVE':
    case 'APPROVED':
    case 'PAID':
      return 'bg-green-100 text-green-800';
    case 'PENDING':
    case 'IN_PROCESS':
      return 'bg-yellow-100 text-yellow-800';
    case 'CANCELLED':
    case 'REJECTED':
    case 'REFUNDED':
      return 'bg-red-100 text-red-800';
    default:
      return 'bg-gray-100 text-gray-800';
  }
}
