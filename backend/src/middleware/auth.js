import jwt from 'jsonwebtoken';
import { config } from '../config.js';

export const authRequired = () => Boolean(config.passcode);

export function requireAuth(req, res, next) {
  if (!authRequired()) return next();
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  try {
    jwt.verify(token, config.jwtSecret);
    next();
  } catch {
    res.status(401).json({ error: 'Unauthorized' });
  }
}
