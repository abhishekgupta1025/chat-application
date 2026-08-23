import { Router } from 'express';
import { messageController } from '../controllers/messageController';
import { authenticateToken } from '../middleware/auth';

const router = Router();

router.get('/:conversationId', authenticateToken, messageController.getMessages);

export default router;
