import { Router } from 'express';
import { conversationController } from '../controllers/conversationController';
import { authenticateToken } from '../middleware/auth';

const router = Router();

router.get('/', authenticateToken, conversationController.getConversations);
router.post('/', authenticateToken, conversationController.createDirect);
router.post('/group', authenticateToken, conversationController.createGroup);
router.delete('/:id/messages', authenticateToken, conversationController.clearMessages);
router.delete('/:id', authenticateToken, conversationController.deleteConversation);

export default router;
