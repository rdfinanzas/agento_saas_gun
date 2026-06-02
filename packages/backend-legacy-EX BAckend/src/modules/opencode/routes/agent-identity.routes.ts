import { Router } from 'express';
import { agentIdentityController } from '../controllers/agent-identity.controller';
import { authMiddleware } from '../../auth/middleware/auth.middleware';

const router = Router();

// All routes require authentication
router.use(authMiddleware);

// Identity management
router.get('/', (req, res) => agentIdentityController.getIdentity(req, res));
router.put('/', (req, res) => agentIdentityController.updateIdentity(req, res));

// Validation and activation
router.get('/validate', (req, res) => agentIdentityController.validate(req, res));
router.post('/activate', (req, res) => agentIdentityController.activate(req, res));
router.post('/deactivate', (req, res) => agentIdentityController.deactivate(req, res));

// Specific sections
router.patch('/faq', (req, res) => agentIdentityController.updateFaq(req, res));
router.patch('/policies', (req, res) => agentIdentityController.updatePolicies(req, res));
router.patch('/hours', (req, res) => agentIdentityController.updateBusinessHours(req, res));

// Templates
router.get('/templates', (req, res) => agentIdentityController.getTemplates(req, res));
router.post('/templates/:templateId/apply', (req, res) => agentIdentityController.applyTemplate(req, res));

// Sandbox mode
router.post('/sandbox/toggle', (req, res) => agentIdentityController.toggleDraftMode(req, res));
router.post('/sandbox/test', (req, res) => agentIdentityController.testAgent(req, res));

// Utilities
router.get('/system-prompt', (req, res) => agentIdentityController.getSystemPrompt(req, res));
router.delete('/history', (req, res) => agentIdentityController.clearHistory(req, res));
router.get('/stats', (req, res) => agentIdentityController.getStats(req, res));

export { router as agentIdentityRoutes };
