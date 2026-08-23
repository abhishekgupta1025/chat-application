import { Router } from 'express';
import { messageController } from '../controllers/messageController';
import { authenticateToken } from '../middleware/auth';

const router = Router();

router.get('/:conversationId', authenticateToken, messageController.getMessages);
router.delete('/:id', authenticateToken, messageController.deleteMessage);

export default router;
