import { Response, NextFunction } from 'express';
import { conversationService, ConversationService } from '../services/conversationService';
import { AuthRequest } from '../middleware/auth';
import { invalidateParticipantCache } from '../socket';

export class ConversationController {
  constructor(private service: ConversationService = conversationService) {}

  getConversations = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const currentUserId = req.user?.userId;
      const list = await this.service.getUserConversations(currentUserId);
      res.json(list);
    } catch (error) {
      next(error);
    }
  };

  createDirect = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const currentUserId = req.user?.userId;
      const { recipientId } = req.body;
      const result = await this.service.getOrCreateDirectConversation(currentUserId!, recipientId);
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  };

  createGroup = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const currentUserId = req.user?.userId;
      const { name, participantIds } = req.body;
      const result = await this.service.createGroupConversation(currentUserId!, name, participantIds);
      res.status(201).json(result);
    } catch (error) {
      next(error);
    }
  };

  clearMessages = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const currentUserId = req.user?.userId;
      const conversationId = req.params.id as string;
      const result = await this.service.clearConversationMessages(conversationId, currentUserId!);
      res.json(result);
    } catch (error) {
      next(error);
    }
  };

  deleteConversation = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const currentUserId = req.user?.userId;
      const conversationId = req.params.id as string;
      const result = await this.service.deleteConversation(conversationId, currentUserId!);
      invalidateParticipantCache(conversationId);
      res.json(result);
    } catch (error) {
      next(error);
    }
  };
}

export const conversationController = new ConversationController();
