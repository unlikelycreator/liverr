import { Router } from 'express';
import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import { config } from '../config.js';
import { authRequired } from '../middleware/auth.js';

const r = Router();

r.get('/status', (_req, res) => res.json({ required: authRequired() }));

const attempts = new Map(); // ip -> { n, until }
r.post('/login', (req, res) => {
  if (!authRequired()) return res.json({ token: 'open' });
  const ip = req.ip;
  const a = attempts.get(ip) || { n: 0, until: 0 };
  if (a.until > Date.now()) return res.status(429).json({ error: 'Too many attempts. Try again in a minute.' });
  const given = Buffer.from(String(req.body?.passcode || ''));
  const want = Buffer.from(config.passcode);
  const ok = given.length === want.length && crypto.timingSafeEqual(given, want);
  if (!ok) {
    a.n += 1;
    if (a.n >= 5) Object.assign(a, { n: 0, until: Date.now() + 60_000 });
    attempts.set(ip, a);
    return res.status(401).json({ error: 'Wrong passcode' });
  }
  attempts.delete(ip);
  res.json({ token: jwt.sign({ sub: 'owner' }, config.jwtSecret, { expiresIn: '90d' }) });
});

export default r;
