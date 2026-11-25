import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { userRepository, UserRepository } from '../repositories/userRepository';
import { BadRequestError, ConflictError, UnauthorizedError } from '../errors/AppError';
import { env } from '../config/env';

export class AuthService {
  constructor(private userRepo: UserRepository = userRepository) {}

  async register(usernameRaw?: string, passwordRaw?: string): Promise<{ message: string }> {
    if (!usernameRaw || !passwordRaw) {
      throw new BadRequestError('Username and password are required');
    }

    const username = usernameRaw.trim();
    if (username.length < 3) {
      throw new BadRequestError('Username must be at least 3 characters long');
    }

    if (passwordRaw.length < 6) {
      throw new BadRequestError('Password must be at least 6 characters long');
    }

    const existingUser = await this.userRepo.findByUsername(username);
    if (existingUser) {
      throw new ConflictError('Username is already taken');
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(passwordRaw, salt);

    await this.userRepo.create({
      username,
      password: hashedPassword
    });

    return { message: 'User registered successfully! You may now log in.' };
  }

  async login(usernameRaw?: string, passwordRaw?: string): Promise<{ token: string; user: { id: string; username: string } }> {
    if (!usernameRaw || !passwordRaw) {
      throw new BadRequestError('Username and password are required');
    }

    const username = usernameRaw.trim();
    const user = await this.userRepo.findByUsername(username);

    if (!user) {
      throw new UnauthorizedError('Invalid username or password');
    }

    const isMatch = await bcrypt.compare(passwordRaw, user.password);
    if (!isMatch) {
      throw new UnauthorizedError('Invalid username or password');
    }

    const payload = { userId: user.id, username: user.username };
    const token = jwt.sign(payload, env.jwtSecret, { expiresIn: '7d' });

    return {
      token,
      user: {
        id: user.id,
        username: user.username
      }
    };
  }
}

export const authService = new AuthService();
