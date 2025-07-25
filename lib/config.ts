import { z } from 'zod';
import { logger } from './logger';

// Configuration schema
const configSchema = z.object({
  database: z.object({
    path: z.string().default('./data.sqlite'),
  }),
  server: z.object({
    port: z.coerce.number().int().min(1).max(65535).default(3000),
    nodeEnv: z.enum(['development', 'production', 'test']).default('development'),
  }),
  cors: z.object({
    origin: z.string().default('*'),
  }),
  logging: z.object({
    level: z.enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal']).default('info'),
  }),
  rateLimit: z.object({
    windowMs: z.coerce.number().int().min(1000).default(900000), // 15 minutes
    maxRequests: z.coerce.number().int().min(1).default(100),
  }),
  csv: z.object({
    uploadDir: z.string().default('./uploads'),
    watchDir: z.string().default('./csv-data'),
  }),
  cache: z.object({
    ttlSeconds: z.coerce.number().int().min(1).default(300), // 5 minutes
  }),
  thresholds: z.object({
    windSpeed: z.coerce.number().min(0).default(25),
    temperature: z.coerce.number().min(-50).max(60).default(30),
  }),
});

// Load and validate configuration
function loadConfig() {
  const rawConfig = {
    database: {
      path: process.env.DB_PATH,
    },
    server: {
      port: process.env.PORT,
      nodeEnv: process.env.NODE_ENV,
    },
    cors: {
      origin: process.env.CORS_ORIGIN,
    },
    logging: {
      level: process.env.LOG_LEVEL,
    },
    rateLimit: {
      windowMs: process.env.RATE_LIMIT_WINDOW_MS,
      maxRequests: process.env.RATE_LIMIT_MAX_REQUESTS,
    },
    csv: {
      uploadDir: process.env.CSV_UPLOAD_DIR,
      watchDir: process.env.CSV_WATCH_DIR,
    },
    cache: {
      ttlSeconds: process.env.CACHE_TTL_SECONDS,
    },
    thresholds: {
      windSpeed: process.env.WIND_SPEED_THRESHOLD,
      temperature: process.env.TEMPERATURE_THRESHOLD,
    },
  };

  try {
    const config = configSchema.parse(rawConfig);
    logger.info({ config: { ...config, database: { path: '[REDACTED]' } } }, 'Configuration loaded');
    return config;
  } catch (error) {
    logger.error({ error }, 'Configuration validation failed');
    throw new Error('Invalid configuration');
  }
}

export const config = loadConfig();
export type Config = z.infer<typeof configSchema>;