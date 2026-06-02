import { Router } from 'express';
import { webhookController } from '../controllers/webhook.controller';

const router = Router();

// Webhook verification (GET) - Meta verification challenge
router.get('/:tenantSlug', (req, res) => webhookController.verify(req, res));

// Webhook messages (POST) - Receive messages from WhatsApp
router.post('/:tenantSlug', (req, res) => webhookController.handleIncoming(req, res));

// Health check
router.get('/:tenantSlug/health', (req, res) => webhookController.health(req, res));

export { router as webhookRoutes };
