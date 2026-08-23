import { Socket } from 'socket.io';
import jwt from 'jsonwebtoken';

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

  const secret = process.env.JWT_SECRET || 'supersecretjwtkey_12345';

  try {
    const decoded = jwt.verify(token, secret) as {
      userId: string;
      username: string;
    };
    socket.data.user = decoded;
    next();
  } catch (err) {
    return next(new Error('Authentication failed: Invalid or expired token'));
  }
};
