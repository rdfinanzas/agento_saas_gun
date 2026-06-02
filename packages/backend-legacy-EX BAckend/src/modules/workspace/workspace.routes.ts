/**
 * Workspace Routes
 */

import { Router } from 'express';
import { workspaceController } from './workspace.controller';
import { authMiddleware } from '../auth/middleware/auth.middleware';
import multer from 'multer';

const router = Router();
const upload = multer({ dest: 'uploads/' });

router.use(authMiddleware);

router.get('/structure', (req, res) => workspaceController.getStructure(req, res));
router.get('/files', (req, res) => workspaceController.listFiles(req, res));
router.get('/files/:filePath(*)', (req, res) => workspaceController.readFile(req, res));
router.post('/files', (req, res) => workspaceController.writeFile(req, res));
router.post('/directories', (req, res) => workspaceController.createDirectory(req, res));
router.delete('/items/:itemPath(*)', (req, res) => workspaceController.deleteItem(req, res));
router.post('/upload', upload.single('file'), (req, res) => workspaceController.uploadFile(req, res));
router.post('/search', (req, res) => workspaceController.searchContent(req, res));

export { router as workspaceRoutes };
