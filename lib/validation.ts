import { z } from 'zod';

// Common validation schemas
export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
});

export const sortSchema = z.object({
  sortBy: z.enum(['datetime', 'time', 'las', 'ws', 'temperature', 'humidity']).optional(),
  sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),
});

// Station-specific schemas
export const stationParamsSchema = z.object({
  station: z.string().min(1).max(50),
});

export const getMeasurementsSchema = z.object({
  station: z.string().min(1).max(50),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
}).merge(paginationSchema).merge(sortSchema);

export const getTableDataSchema = z.object({
  station: z.string().min(1).max(50).optional().nullable(),
  startDate: z.string().optional().nullable(),
  endDate: z.string().optional().nullable(),
  searchQuery: z.string().optional().nullable(),
  showOnlyAlarms: z.boolean().optional().nullable(),
  dateFilter: z.string().optional().nullable(), // Legacy support
}).merge(paginationSchema).merge(sortSchema);

// CSV upload schema
export const csvUploadSchema = z.object({
  filename: z.string().min(1),
  mimetype: z.string().refine(
    (type) => type === 'text/csv' || type === 'application/csv',
    'File must be a CSV'
  ),
});

// Admin schemas
export const adminActionSchema = z.object({
  action: z.enum(['cleanup', 'reindex', 'backup']),
  confirm: z.boolean().refine(val => val === true, 'Action must be confirmed'),
});

// Weather data schema
export const weatherDataSchema = z.object({
  station: z.string().min(1),
  timestamp: z.string().datetime(),
  temperature: z.number().min(-50).max(60).optional(),
  humidity: z.number().min(0).max(100).optional(),
  windSpeed: z.number().min(0).max(200).optional(),
  windDirection: z.number().min(0).max(360).optional(),
  pressure: z.number().min(800).max(1200).optional(),
});

// Validation helper function
export function validateRequest<T>(schema: z.ZodSchema<T>, data: unknown): { success: true; data: T } | { success: false; errors: z.ZodError } {
  const result = schema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return { success: false, errors: result.error };
}