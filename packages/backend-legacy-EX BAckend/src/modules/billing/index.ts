/**
 * Billing Module - Sistema de facturación
 * FASE 5: MercadoPago integration
 */

export { billingRoutes } from './routes/billing.routes';
export { billingController } from './controllers/billing.controller';
export {
  mercadoPagoService,
  MercadoPagoService,
  AVAILABLE_PLANS,
  type PlanDetails,
  type PreferenceResponse,
  type PaymentDetails,
  type CreatePreferencePayload,
} from './services/mercadopago.service';
