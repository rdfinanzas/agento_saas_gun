import { Router } from 'express';
import { permissionsController } from '../controllers/agent-tools.controller';
import { authMiddleware } from '../../auth/middleware/auth.middleware';

const router = Router();

// All routes require authentication
router.use(authMiddleware);

// Permission management
router.get('/pending', (req, res) => permissionsController.getPending(req, res));
router.post('/respond', (req, res) => permissionsController.respond(req, res));

// Permission rules
router.get('/rules', (req, res) => permissionsController.getRules(req, res));
router.post('/rules', (req, res) => permissionsController.createRule(req, res));
router.delete('/rules/:ruleId', (req, res) => permissionsController.deleteRule(req, res));

export { router as permissionsRoutes };
