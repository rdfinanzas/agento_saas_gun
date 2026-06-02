/**
 * WebhookSignatureService - Verificación de firmas HMAC para webhooks
 * FASE 1: Suscripciones Recurrentes
 */

import { createHash, createHmac, timingSafeEqual } from 'crypto';

// ============================================
// Types & Interfaces
// ============================================

export interface SignatureVerificationResult {
  valid: boolean;
  error?: string;
  timestamp?: number;
}

export interface WebhookHeaders {
  'x-signature'?: string;
  'x-request-id'?: string;
  'x-timestamp'?: string;
}

// ============================================
// Webhook Signature Service
// ============================================

export class WebhookSignatureService {
  private secret: string;
  private tolerance: number; // Timestamp tolerance in seconds

  constructor(secret?: string, tolerance?: number) {
    this.secret = secret || process.env.MERCADOPAGO_WEBHOOK_SECRET || '';
    this.tolerance = tolerance || 300; // 5 minutes default
  }

  // ============================================
  // Public Methods
  // ============================================

  /**
   * Verify MercadoPago webhook signature
   */
  verifySignature(
    payload: string | Record<string, unknown>,
    signature: string,
    timestamp?: string
  ): SignatureVerificationResult {
    try {
      // Convert payload to string if object
      const payloadString = typeof payload === 'string' ? payload : JSON.stringify(payload);

      // Verify timestamp if provided
      if (timestamp) {
        const timestampValidation = this.verifyTimestamp(timestamp);
        if (!timestampValidation.valid) {
          return timestampValidation;
        }
      }

      // Calculate expected signature
      const expectedSignature = this.calculateSignature(payloadString, timestamp);

      // Compare signatures using timing-safe comparison
      const signatureBuffer = Buffer.from(signature);
      const expectedBuffer = Buffer.from(expectedSignature);

      if (signatureBuffer.length !== expectedBuffer.length) {
        return { valid: false, error: 'Invalid signature length' };
      }

      const isValid = timingSafeEqual(signatureBuffer, expectedBuffer);

      if (!isValid) {
        return { valid: false, error: 'Signature mismatch' };
      }

      return {
        valid: true,
        timestamp: timestamp ? parseInt(timestamp) : undefined,
      };
    } catch (error: any) {
      console.error('[WebhookSignature] Error verifying signature:', error);
      return { valid: false, error: 'Signature verification failed' };
    }
  }

  /**
   * Verify webhook from request headers
   */
  verifyFromHeaders(
    payload: string | Record<string, unknown>,
    headers: WebhookHeaders
  ): SignatureVerificationResult {
    const signature = headers['x-signature'];
    const timestamp = headers['x-timestamp'];

    if (!signature) {
      return { valid: false, error: 'Missing signature header' };
    }

    return this.verifySignature(payload, signature, timestamp);
  }

  /**
   * Verify timestamp to prevent replay attacks
   */
  verifyTimestamp(timestamp: string): SignatureVerificationResult {
    try {
      const timestampNum = parseInt(timestamp);
      const now = Math.floor(Date.now() / 1000);
      const diff = Math.abs(now - timestampNum);

      if (diff > this.tolerance) {
        return {
          valid: false,
          error: `Timestamp too old or too new. Tolerance: ${this.tolerance}s, difference: ${diff}s`,
        };
      }

      return { valid: true, timestamp: timestampNum };
    } catch (error) {
      return { valid: false, error: 'Invalid timestamp format' };
    }
  }

  /**
   * Calculate HMAC signature
   */
  calculateSignature(payload: string, timestamp?: string): string {
    const data = timestamp ? `${timestamp}.${payload}` : payload;
    return createHmac('sha256', this.secret)
      .update(data)
      .digest('hex');
  }

  /**
   * Generate signature for outgoing webhooks
   */
  generateSignature(payload: string | Record<string, unknown>): {
    signature: string;
    timestamp: number;
  } {
    const timestamp = Math.floor(Date.now() / 1000);
    const payloadString = typeof payload === 'string' ? payload : JSON.stringify(payload);
    const signature = this.calculateSignature(payloadString, timestamp.toString());

    return { signature, timestamp };
  }

  /**
   * Verify MercadoPago specific webhook format
   * MercadoPago uses a different signature format
   */
  verifyMercadoPagoWebhook(
    payload: Record<string, unknown>,
    requestId: string
  ): SignatureVerificationResult {
    try {
      // MercadoPago webhooks are verified by making a request back to their API
      // The requestId is used to verify the webhook's authenticity
      // This is a placeholder for that verification logic

      if (!requestId) {
        return { valid: false, error: 'Missing request ID' };
      }

      // In production, you would:
      // 1. Extract the data.id from the payload
      // 2. Make a GET request to MercadoPago API to verify the payment/preapproval
      // 3. Compare the status to ensure it matches

      return { valid: true };
    } catch (error: any) {
      console.error('[WebhookSignature] Error verifying MercadoPago webhook:', error);
      return { valid: false, error: 'Webhook verification failed' };
    }
  }

  /**
   * Create a hash for replay attack prevention
   */
  createHash(payload: string | Record<string, unknown>): string {
    const payloadString = typeof payload === 'string' ? payload : JSON.stringify(payload);
    return createHash('sha256')
      .update(payloadString)
      .digest('hex');
  }

  /**
   * Check if webhook has been processed (replay prevention)
   */
  async checkReplay(
    webhookId: string,
    processedWebhooks: Set<string>
  ): Promise<boolean> {
    if (processedWebhooks.has(webhookId)) {
      console.warn(`[WebhookSignature] Duplicate webhook detected: ${webhookId}`);
      return true; // Is replay
    }

    // Mark as processed
    processedWebhooks.add(webhookId);

    // Clean up old entries (optional - implement with TTL in production)
    if (processedWebhooks.size > 10000) {
      const firstKey = processedWebhooks.keys().next().value;
      processedWebhooks.delete(firstKey);
    }

    return false; // Not replay
  }

  /**
   * Extract webhook type from payload
   */
  extractWebhookType(payload: Record<string, unknown>): string | null {
    if ('type' in payload && typeof payload.type === 'string') {
      return payload.type;
    }
    return null;
  }

  /**
   * Validate webhook payload structure
   */
  validatePayloadStructure(payload: unknown): {
    valid: boolean;
    error?: string;
  } {
    if (!payload || typeof payload !== 'object') {
      return { valid: false, error: 'Invalid payload: not an object' };
    }

    if (!('type' in payload)) {
      return { valid: false, error: 'Invalid payload: missing type field' };
    }

    if (!('data' in payload)) {
      return { valid: false, error: 'Invalid payload: missing data field' };
    }

    const data = payload.data as Record<string, unknown>;
    if (!data || typeof data !== 'object') {
      return { valid: false, error: 'Invalid payload: data is not an object' };
    }

    if (!('id' in data)) {
      return { valid: false, error: 'Invalid payload: missing data.id field' };
    }

    return { valid: true };
  }
}

// Export singleton instance
export const webhookSignatureService = new WebhookSignatureService();
