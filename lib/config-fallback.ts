// Simple fallback configuration to avoid circular dependencies
export const fallbackConfig = {
  database: {
    path: process.env.DB_PATH || './data.sqlite',
  },
  server: {
    port: parseInt(process.env.PORT || '3000', 10),
    nodeEnv: (process.env.NODE_ENV || 'development') as 'development' | 'production' | 'test',
  },
  cors: {
    origin: process.env.CORS_ORIGIN || '*',
  },
  logging: {
    level: process.env.LOG_LEVEL || 'info',
  },
  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10),
    maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100', 10),
  },
  csv: {
    uploadDir: process.env.CSV_UPLOAD_DIR || './uploads',
    watchDir: process.env.CSV_WATCH_DIR || './csv-data',
  },
  cache: {
    ttlSeconds: parseInt(process.env.CACHE_TTL_SECONDS || '300', 10),
  },
  thresholds: {
    windSpeed: parseFloat(process.env.WIND_SPEED_THRESHOLD || '25'),
    temperature: parseFloat(process.env.TEMPERATURE_THRESHOLD || '30'),
  },
};