import { Router } from 'express';
import { userController } from '../controllers/userController';
import { authenticateToken } from '../middleware/auth';

const router = Router();

router.get('/', authenticateToken, userController.getContacts);
router.get('/search', authenticateToken, userController.searchUsers);

export default router;
