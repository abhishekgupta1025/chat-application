import { Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';

export interface AuthenticatedSocket extends Socket {
  data: {
    user?: {
      userId: string;
      username: string;
    };
  };
}

export const socketAuthMiddleware = (
  socket: Socket,
  next: (err?: Error) => void
): void => {
  const token =
    socket.handshake.auth?.token ||
    (socket.handshake.headers?.authorization &&
      socket.handshake.headers.authorization.split(' ')[1]);

  if (!token) {
    return next(new Error('Authentication failed: Missing token in socket handshake'));
  }

  try {
    const decoded = jwt.verify(token, env.jwtSecret) as {
      userId: string;
      username: string;
    };
    socket.data.user = decoded;
    next();
  } catch (err) {
    return next(new Error('Authentication failed: Invalid or expired token'));
  }
};
