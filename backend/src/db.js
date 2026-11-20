import mongoose from 'mongoose';
import { config } from './config.js';

mongoose.set('strictQuery', true);

// Cached across invocations so serverless functions reuse one connection.
let pending = null;
export function ensureDb() {
  if (mongoose.connection.readyState === 1) return Promise.resolve();
  if (!config.mongoUri) return Promise.reject(new Error('MONGODB_URI is not set'));
  if (!pending) {
    pending = mongoose
      .connect(config.mongoUri, { serverSelectionTimeoutMS: 10000 })
      .then(() => console.log('[db] connected'))
      .catch((e) => { pending = null; throw e; });
  }
  return pending;
}

export const dbReady = () => mongoose.connection.readyState === 1;
