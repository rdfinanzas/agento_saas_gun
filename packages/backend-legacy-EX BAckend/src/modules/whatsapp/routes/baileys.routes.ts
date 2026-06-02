import { Router } from 'express';
import { baileysController } from '../controllers/baileys.controller';

const router = Router();

router.post('/:configId/start', baileysController.startSession.bind(baileysController));
router.post('/:configId/stop', baileysController.closeSession.bind(baileysController));
router.get('/:configId/status', baileysController.getStatus.bind(baileysController));
router.post('/:configId/send', baileysController.sendMessage.bind(baileysController));

export default router;
