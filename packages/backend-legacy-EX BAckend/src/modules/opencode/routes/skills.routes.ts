import { Router } from 'express';
import { skillsController } from '../controllers/skills.controller';
import { authMiddleware } from '../../auth/middleware/auth.middleware';

const router = Router();

// All routes require authentication
router.use(authMiddleware);

// Skills CRUD
router.get('/', (req, res) => skillsController.getAll(req, res));
router.get('/enabled', (req, res) => skillsController.getEnabled(req, res));
router.get('/:skillId', (req, res) => skillsController.getById(req, res));
router.get('/:skillId/content', (req, res) => skillsController.getContent(req, res));

router.post('/', (req, res) => skillsController.create(req, res));
router.post('/add', (req, res) => skillsController.addFromSource(req, res));

router.patch('/:skillId/enabled', (req, res) => skillsController.setEnabled(req, res));

router.delete('/:skillId', (req, res) => skillsController.delete(req, res));

export { router as skillsRoutes };
