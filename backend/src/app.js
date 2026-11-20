import express from 'express';
import cors from 'cors';
import { config } from './config.js';
import { ensureDb, dbReady } from './db.js';
import { requireAuth } from './middleware/auth.js';
import { CATEGORIES } from './categories.js';
import authRoutes from './routes/auth.js';
import entryRoutes from './routes/entries.js';
import recordRoutes from './routes/records.js';
import statsRoutes from './routes/stats.js';

const app = express();
app.set('trust proxy', 1);
app.disable('x-powered-by');
app.use(
  cors({
    origin: (origin, cb) => {
      if (!origin || !config.corsOrigins.length || config.corsOrigins.includes(origin)) return cb(null, true);
      cb(null, false);
    },
  })
);
app.use(express.json({ limit: '200kb' }));

app.get('/', (_req, res) => res.json({ name: 'liverr-api', ok: true }));
app.get('/api/health', (_req, res) =>
  res.json({ ok: true, db: dbReady(), dbConfigured: Boolean(config.mongoUri), ai: Boolean(config.geminiKey), model: config.geminiKey ? config.geminiModel : null, currency: config.currency, timezone: config.timezone })
);
app.use('/api/auth', authRoutes);
app.get('/api/categories', (_req, res) => res.json({ categories: CATEGORIES }));

app.use('/api', requireAuth, async (_req, res, next) => {
  try {
    await ensureDb();
    next();
  } catch (e) {
    console.error('[db]', e.message);
    res.status(503).json({ error: 'Database is not connected. Check MONGODB_URI and Atlas network access.' });
  }
});
app.use('/api/entries', entryRoutes);
app.use('/api/records', recordRoutes);
app.use('/api/stats', statsRoutes);

app.use('/api', (_req, res) => res.status(404).json({ error: 'Not found' }));
// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  console.error(err);
  const status = err.name === 'ValidationError' ? 400 : err.status || 500;
  res.status(status).json({ error: status === 500 ? 'Something went wrong' : err.message });
});

export default app;
