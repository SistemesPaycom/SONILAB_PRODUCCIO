import { nanoid } from 'nanoid';
import { Request, Response, NextFunction } from 'express';

export function requestIdMiddleware(req: Request, res: Response, next: NextFunction) {
  const incoming = req.header('x-request-id');
  const requestId = incoming && incoming.trim() ? incoming.trim() : nanoid(12);

  (req as any).requestId = requestId;
  res.setHeader('X-Request-Id', requestId);
  next();
}