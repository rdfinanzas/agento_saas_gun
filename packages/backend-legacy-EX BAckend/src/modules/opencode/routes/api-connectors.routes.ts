/**
 * API Connectors Routes - Rutas para conectores de API
 * FASE 6: Integración Agéntica
 */

import { Router } from 'express';
import { apiConnectorsController } from '../controllers/api-connectors.controller';
import { authMiddleware } from '../../auth/middleware/auth.middleware';

const router = Router();

// All routes require authentication
router.use(authMiddleware);

// Documentation
router.post('/read-docs', (req, res) => apiConnectorsController.readDocs(req, res));

// Connectors
router.post('/connectors', (req, res) => apiConnectorsController.generate(req, res));
router.get('/connectors', (req, res) => apiConnectorsController.listConnectors(req, res));
router.get('/connectors/:connectorId', (req, res) => apiConnectorsController.getConnector(req, res));
router.delete('/connectors/:connectorId', (req, res) => apiConnectorsController.deleteConnector(req, res));
router.post('/connectors/:connectorId/test', (req, res) => apiConnectorsController.test(req, res));

// Tools
router.get('/connectors/:connectorId/tools', (req, res) => apiConnectorsController.getTools(req, res));
router.post('/connectors/:connectorId/tools/:toolId/execute', (req, res) => apiConnectorsController.executeTool(req, res));

export { router as apiConnectorsRoutes };
