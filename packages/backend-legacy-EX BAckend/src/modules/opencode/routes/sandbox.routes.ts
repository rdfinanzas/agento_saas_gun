/**
 * Sandbox Routes - Rutas para simulación de agentes
 * FASE 4: Modo Sandbox/Entrenamiento
 * FASE 6: Modo Entrenamiento UI
 */

import { Router } from 'express';
import { sandboxController } from '../controllers/sandbox.controller';
import { authMiddleware } from '../../auth/middleware/auth.middleware';

const router = Router();

// All routes require authentication
router.use(authMiddleware);

// Training scenarios
router.get('/scenarios', (req, res) => sandboxController.getScenarios(req, res));

// Session management (training/sandbox)
router.post('/sessions', (req, res) => sandboxController.startTrainingSession(req, res));
router.get('/sessions', (req, res) => sandboxController.listTrainingSessions(req, res));
router.get('/sessions/:sessionId', (req, res) => sandboxController.getTrainingSession(req, res));
router.post('/sessions/:sessionId/end', (req, res) => sandboxController.endTrainingSession(req, res));

// Legacy simulation endpoints (backwards compatibility)
router.post('/simulate', (req, res) => sandboxController.createSimulation(req, res));
router.get('/simulate', (req, res) => sandboxController.listSessions(req, res));
router.get('/simulate/:sessionId', (req, res) => sandboxController.getSession(req, res));
router.post('/simulate/:sessionId/end', (req, res) => sandboxController.endSession(req, res));

// Messaging
router.post('/:sessionId/message', (req, res) => sandboxController.sendMessage(req, res));
router.post('/:sessionId/simulate-customer', (req, res) => sandboxController.simulateCustomer(req, res));
router.post('/simulate/:sessionId/message', (req, res) => sandboxController.sendMessage(req, res));
router.post('/simulate/:sessionId/customer', (req, res) => sandboxController.simulateCustomer(req, res));

// Logs and metrics
router.get('/simulate/:sessionId/logs', (req, res) => sandboxController.getLogs(req, res));
router.get('/metrics', (req, res) => sandboxController.getMetrics(req, res));

// Validation and production promotion
router.get('/validate-promotion', (req, res) => sandboxController.validateForPromotion(req, res));
router.post('/promote', (req, res) => sandboxController.promoteToProduction(req, res));

export { router as sandboxRoutes };
