import { Router } from 'express';
import { agentController } from '../controllers/agent.controller';
import { authMiddleware } from '../../auth/middleware/auth.middleware';

const router = Router();

// All routes require authentication
router.use(authMiddleware);

// Agent CRUD routes
router.post('/', (req, res) => agentController.create(req, res));
router.get('/', (req, res) => agentController.findAll(req, res));
router.get('/:id', (req, res) => agentController.findOne(req, res));
router.put('/:id', (req, res) => agentController.update(req, res));
router.patch('/:id/knowledge', (req, res) => agentController.updateKnowledge(req, res));
router.patch('/:id/toggle', (req, res) => agentController.toggleActive(req, res));
router.get('/:id/stats', (req, res) => agentController.getStats(req, res));
router.delete('/:id', (req, res) => agentController.delete(req, res));

// Test and status endpoints
router.post('/test', (req, res) => agentController.testAgent(req, res));
router.get('/llm-status', (req, res) => agentController.checkLLMStatus(req, res));
router.get('/status', (req, res) => agentController.getAgentStatus(req, res));
router.post('/draft-mode', (req, res) => agentController.setDraftMode(req, res));

// Conversations routes
router.get('/:id/conversations', (req, res) => agentController.getConversations(req, res));
router.get('/conversations/:conversationId/messages', (req, res) => agentController.getConversationMessages(req, res));
router.post('/conversations/:conversationId/takeover', (req, res) => agentController.takeOverConversation(req, res));
router.post('/conversations/:conversationId/release', (req, res) => agentController.releaseConversation(req, res));

// Skills execution route
router.post('/skills/execute', (req, res) => agentController.executeSkill(req, res));

export { router as agentRoutes };
