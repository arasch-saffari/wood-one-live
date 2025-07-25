import { NextRequest } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import { withErrorHandler, ApiResponse } from '@/lib/middleware/error-handler';
import { withRateLimit } from '@/lib/middleware/rate-limit';
import { logger } from '@/lib/logger';
import { config } from '@/lib/config';
import { ValidationError } from '@/lib/logger';

async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      throw new ValidationError('No file provided');
    }

    // Validate file type
    if (!file.type.includes('csv') && !file.name.endsWith('.csv')) {
      throw new ValidationError('File must be a CSV file');
    }

    // Validate file size (max 10MB)
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      throw new ValidationError('File size exceeds 10MB limit');
    }

    // Ensure upload directory exists
    const uploadDir = config.csv.uploadDir;
    if (!existsSync(uploadDir)) {
      await mkdir(uploadDir, { recursive: true });
    }

    // Generate unique filename
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `${timestamp}-${file.name}`;
    const filepath = path.join(uploadDir, filename);

    // Save file
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    await writeFile(filepath, buffer);

    logger.info({
      filename,
      size: file.size,
      type: file.type,
      uploadPath: filepath
    }, 'CSV file uploaded successfully');

    // Here you could trigger CSV processing
    // await processCsvFile(filepath);

    return ApiResponse.success({
      message: 'File uploaded successfully',
      filename,
      size: file.size,
      path: filepath
    });

  } catch (error) {
    logger.error({ error }, 'CSV upload failed');
    throw error;
  }
}

// Apply rate limiting with stricter limits for uploads
const rateLimitedPOST = withRateLimit(withErrorHandler(POST), { 
  windowMs: 60000, // 1 minute
  maxRequests: 5    // 5 uploads per minute
});

export { rateLimitedPOST as POST };