import { Router } from 'express';
import { ConversationMonitorController } from '../controllers/conversation-monitor.controller';
import { authMiddleware } from '../../auth/middleware/auth.middleware';

const router = Router();
const controller = new ConversationMonitorController();

// All routes require authentication
router.use(authMiddleware);

// Conversation monitoring routes
router.get('/active', (req, res) => controller.getActiveConversations(req, res));
router.get('/takeover', (req, res) => controller.getHumanTakeoverConversations(req, res));
// TODO: Add getStats method to controller
// router.get('/stats', (req, res) => controller.getStats(req, res));
router.get('/:conversationId', (req, res) => controller.getConversation(req, res));

// Human takeover actions
router.post('/:conversationId/takeover', (req, res) => controller.takeOver(req, res));
router.post('/:conversationId/release', (req, res) => controller.releaseControl(req, res));
router.post('/:conversationId/message', (req, res) => controller.sendManualMessage(req, res));
router.post('/:conversationId/close', (req, res) => controller.closeConversation(req, res));

export default router;
