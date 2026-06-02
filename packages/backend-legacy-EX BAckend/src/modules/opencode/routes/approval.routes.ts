/**
 * Approval Routes - Rutas para flujo de aprobación
 * FASE 7: Flujo de Aprobación
 */

import { Router } from 'express';
import { approvalController } from '../controllers/approval.controller';
import { authMiddleware } from '../../auth/middleware/auth.middleware';

const router = Router();

// All routes require authentication
router.use(authMiddleware);

// Pending responses (with filters)
router.get('/', (req, res) => approvalController.getAll(req, res));
router.get('/pending', (req, res) => approvalController.getPending(req, res));
router.get('/pending/:responseId', (req, res) => approvalController.getById(req, res));

// Actions
router.post('/:responseId/approve', (req, res) => approvalController.approve(req, res));
router.post('/:responseId/reject', (req, res) => approvalController.reject(req, res));
router.put('/:responseId', (req, res) => approvalController.update(req, res));

// Stats and configuration
router.get('/stats', (req, res) => approvalController.getStats(req, res));
router.get('/status', (req, res) => approvalController.getStatus(req, res));
router.post('/toggle', (req, res) => approvalController.toggle(req, res));

export { router as approvalRoutes };
