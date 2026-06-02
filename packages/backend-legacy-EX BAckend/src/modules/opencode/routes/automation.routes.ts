/**
 * Automation Routes - Rutas para automatizaciones
 * FASE 5: Automatizaciones Autónomas
 */

import { Router } from 'express';
import { automationController } from '../controllers/automation.controller';
import { authMiddleware } from '../../auth/middleware/auth.middleware';

const router = Router();

// All routes require authentication
router.use(authMiddleware);

// Task CRUD
router.post('/tasks', (req, res) => automationController.createTask(req, res));
router.get('/tasks', (req, res) => automationController.listTasks(req, res));
router.get('/tasks/:taskId', (req, res) => automationController.getTask(req, res));
router.put('/tasks/:taskId', (req, res) => automationController.updateTask(req, res));
router.delete('/tasks/:taskId', (req, res) => automationController.deleteTask(req, res));

// Task actions
router.post('/tasks/:taskId/toggle', (req, res) => automationController.toggleTask(req, res));
router.post('/tasks/:taskId/execute', (req, res) => automationController.executeTaskNow(req, res));
router.get('/tasks/:taskId/history', (req, res) => automationController.getExecutionHistory(req, res));

// Stats and utilities
router.get('/stats', (req, res) => automationController.getStats(req, res));
router.post('/validate-cron', (req, res) => automationController.validateCron(req, res));
router.get('/task-types', (req, res) => automationController.getTaskTypes(req, res));

export { router as automationRoutes };
