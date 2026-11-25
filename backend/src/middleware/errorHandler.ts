import { Request, Response, NextFunction } from 'express';
import { AppError } from '../errors/AppError';

export const errorHandler = (
  err: Error | AppError,
  _req: Request,
  res: Response,
  _next: NextFunction
): void => {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      success: false,
      error: err.message
    });
    return;
  }

  const pgErr = err as Error & { code?: string; type?: string };
  if (pgErr.code === '22P02' || pgErr.code === '22007' || pgErr.code === '22003') {
    res.status(400).json({
      success: false,
      error: 'Invalid input identifier or timestamp format'
    });
    return;
  }

  if (pgErr.type === 'entity.too.large') {
    res.status(413).json({
      success: false,
      error: 'Request payload too large'
    });
    return;
  }

  console.error('💥 Unhandled Internal Error:', err);
  res.status(500).json({
    success: false,
    error: 'Internal server error'
  });
};
