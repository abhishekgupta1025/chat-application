import { Response, NextFunction } from 'express';
import { messageService, MessageService } from '../services/messageService';
import { AuthRequest } from '../middleware/auth';

export class MessageController {
  constructor(private service: MessageService = messageService) {}

  getMessages = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const rawConversationId = req.params.conversationId;
      const conversationId = Array.isArray(rawConversationId)
        ? rawConversationId[0]
        : rawConversationId;

      const { before, limit = '50' } = req.query;
      const currentUserId = req.user?.userId;

      const limitNum = Math.min(parseInt(limit as string, 10) || 50, 100);

      const messages = await this.service.getConversationMessages(
        conversationId,
        currentUserId!,
        before as string | undefined,
        limitNum
      );

      res.json(messages);
    } catch (error) {
      next(error);
    }
  };
}

export const messageController = new MessageController();
