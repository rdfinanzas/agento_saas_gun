import { Router } from 'express';
import { providersController } from '../controllers/providers.controller';
import { authMiddleware } from '../../auth/middleware/auth.middleware';

const router = Router();

// All routes require authentication
router.use(authMiddleware);

// Provider management
router.get('/', (req, res) => providersController.listProviders(req, res));
router.get('/status', (req, res) => providersController.getApiKeysStatus(req, res));
router.get('/:provider/models', (req, res) => providersController.getProviderModels(req, res));

// API Key management
router.post('/api-keys', (req, res) => providersController.storeApiKey(req, res));
router.post('/api-keys/validate', (req, res) => providersController.validateApiKey(req, res));
router.delete('/api-keys/:provider', (req, res) => providersController.deleteApiKey(req, res));

// Connection testing
router.post('/:provider/test', (req, res) => providersController.testConnection(req, res));

export { router as providersRoutes };
