import { Router } from 'express';
import { ChatController } from './chat.controller';
import { authMiddleware } from '../auth/middleware/auth.middleware';
import { tenantMiddleware } from '../tenants/middleware/tenant.middleware';

const router = Router();
const controller = new ChatController();

// All routes require authentication and tenant context
router.use(authMiddleware);
router.use(tenantMiddleware);

router.post('/message', (req, res) => controller.sendMessage(req, res).catch(console.error));
router.get('/context', (req, res) => controller.getContext(req, res).catch(console.error));
router.delete('/context', (req, res) => controller.clearContext(req, res).catch(console.error));
router.get('/history', (req, res) => controller.getHistory(req, res).catch(console.error));
router.delete('/history', (req, res) => controller.clearHistory(req, res).catch(console.error));

export { router as chatRouter };
