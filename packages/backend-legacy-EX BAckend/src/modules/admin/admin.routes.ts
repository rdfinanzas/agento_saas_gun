/**
 * Admin Routes
 */

import { Router } from 'express';
import { adminController } from './admin.controller';
import { authMiddleware } from '../auth/middleware/auth.middleware';
import { adminMiddleware } from './admin.middleware';

const router = Router();

router.use(authMiddleware);
router.use(adminMiddleware);

// Public AI Providers endpoint (para usuarios autenticados, no requiere admin)
// Se agrega antes del adminMiddleware para que todos los usuarios autenticados puedan acceder
router.get('/ai-providers/public', (req, res) => adminController.listPublicAIProviders(req, res));

// Exportar router público por separado (para montar en otra ruta)
export const publicRouter = Router();
publicRouter.use(authMiddleware);
publicRouter.get('/ai-providers', (req, res) => adminController.listPublicAIProviders(req, res));

// Stats & Overview
router.get('/stats', (req, res) => adminController.getStats(req, res));
router.get('/metrics', (req, res) => adminController.getMetrics(req, res));

// Tenants Management
router.get('/tenants', (req, res) => adminController.listTenants(req, res));
router.get('/tenants/:tenantId', (req, res) => adminController.getTenantDetails(req, res));
router.patch('/tenants/:tenantId/plan', (req, res) => adminController.updateTenantPlan(req, res));

// Users Management
router.get('/users', (req, res) => adminController.listUsers(req, res));

// AI Providers & Models Management
router.get('/ai-providers', (req, res) => adminController.listAIProviders(req, res));
router.get('/ai-providers/:providerId', (req, res) => adminController.getAIProvider(req, res));
router.put('/ai-providers/:providerId', (req, res) => adminController.upsertAIProvider(req, res));
router.post('/ai-providers', (req, res) => adminController.upsertAIProvider(req, res));
router.put('/ai-models/:modelId', (req, res) => adminController.upsertAIModel(req, res));
router.post('/ai-models', (req, res) => adminController.upsertAIModel(req, res));
router.delete('/ai-models/:modelId', (req, res) => adminController.deleteAIModel(req, res));

// Payment Plans Management
router.get('/plans', (req, res) => adminController.listPlans(req, res));
router.get('/plans/:planId', (req, res) => adminController.getPlan(req, res));
router.put('/plans/:planId', (req, res) => adminController.upsertPlan(req, res));
router.post('/plans', (req, res) => adminController.upsertPlan(req, res));
router.delete('/plans/:planId', (req, res) => adminController.deletePlan(req, res));

// API Keys Management (Global)
router.post('/api-keys', (req, res) => adminController.saveApiKeys(req, res));
router.post('/api-keys/validate', (req, res) => adminController.validateApiKeys(req, res));
router.get('/api-keys/status', (req, res) => adminController.getApiKeysStatus(req, res));

export { router as adminRoutes };
