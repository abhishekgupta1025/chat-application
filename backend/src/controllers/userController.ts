import { Response, NextFunction } from 'express';
import { userService, UserService } from '../services/userService';
import { AuthRequest } from '../middleware/auth';

export class UserController {
  constructor(private service: UserService = userService) {}

  getContacts = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const currentUserId = req.user?.userId;
      const contacts = await this.service.getContacts(currentUserId);
      res.json(contacts);
    } catch (error) {
      next(error);
    }
  };

  searchUsers = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const query = (req.query.q as string) || '';
      const currentUserId = req.user?.userId;
      const results = await this.service.searchUsers(query, currentUserId);
      res.json(results);
    } catch (error) {
      next(error);
    }
  };
}

export const userController = new UserController();
