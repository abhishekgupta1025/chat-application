import { Request, Response, NextFunction } from 'express';
import { authService, AuthService } from '../services/authService';

export class AuthController {
  constructor(private service: AuthService = authService) {}

  register = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { username, password } = req.body;
      const result = await this.service.register(username, password);
      res.status(201).json(result);
    } catch (error) {
      next(error);
    }
  };

  login = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { username, password } = req.body;
      const result = await this.service.login(username, password);
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  };
}

export const authController = new AuthController();
