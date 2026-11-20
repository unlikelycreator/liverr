import app from './app.js';
import { config } from './config.js';
import { ensureDb } from './db.js';

app.listen(config.port, () => console.log(`[api] listening on :${config.port}`));
ensureDb().catch((e) => console.error('[db] connection failed:', e.message));
