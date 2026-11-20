import 'dotenv/config';

const list = (v) => (v || '').split(',').map((s) => s.trim()).filter(Boolean);

export const config = {
  port: Number(process.env.PORT) || 4000,
  mongoUri: process.env.MONGODB_URI || '',
  geminiKey: process.env.GEMINI_API_KEY || '',
  geminiModel: process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite',
  passcode: process.env.ACCESS_PASSCODE || '',
  jwtSecret: process.env.JWT_SECRET || 'liverr-dev-secret-change-me',
  currency: process.env.DEFAULT_CURRENCY || 'INR',
  timezone: process.env.TIMEZONE || 'Asia/Kolkata',
  corsOrigins: list(process.env.CORS_ORIGINS),
};
