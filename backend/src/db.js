import mongoose from 'mongoose';
import { config } from './config.js';

mongoose.set('strictQuery', true);

export async function connectDb() {
  if (!config.mongoUri) {
    console.warn('[db] MONGODB_URI is not set: API will start, but data routes will fail until it is configured.');
    return false;
  }
  await mongoose.connect(config.mongoUri, { serverSelectionTimeoutMS: 10000 });
  console.log('[db] connected');
  return true;
}

export const dbReady = () => mongoose.connection.readyState === 1;
