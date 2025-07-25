import { NextRequest, NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { logger, ValidationError, DatabaseError, ImportError, ExternalApiError } from '../logger';

export interface ApiError extends Error {
  status?: number;
  code?: string;
}

export class ApiResponse {
  static success<T>(data: T, status: number = 200) {
    return NextResponse.json({ success: true, data }, { status });
  }

  static error(message: string, status: number = 500, code?: string, details?: any) {
    const errorResponse = {
      success: false,
      error: {
        message,
        code,
        ...(process.env.NODE_ENV === 'development' && details && { details })
      }
    };
    
    logger.error({
      error: {
        message,
        status,
        code,
        details
      }
    }, 'API error response');

    return NextResponse.json(errorResponse, { status });
  }

  static validationError(errors: ZodError) {
    const formattedErrors = errors.errors.map(err => ({
      field: err.path.join('.'),
      message: err.message,
      code: err.code
    }));

    logger.warn({ validationErrors: formattedErrors }, 'Validation error');

    return NextResponse.json({
      success: false,
      error: {
        message: 'Validation failed',
        code: 'VALIDATION_ERROR',
        details: formattedErrors
      }
    }, { status: 400 });
  }
}

// Higher-order function to wrap API route handlers with error handling
export function withErrorHandler<T extends any[]>(
  handler: (...args: T) => Promise<NextResponse>
) {
  return async (...args: T): Promise<NextResponse> => {
    try {
      return await handler(...args);
    } catch (error) {
      logger.error({ error }, 'Unhandled API error');

      // Handle different error types
      if (error instanceof ZodError) {
        return ApiResponse.validationError(error);
      }

      if (error instanceof ValidationError) {
        return ApiResponse.error(error.message, 400, 'VALIDATION_ERROR', error.context);
      }

      if (error instanceof DatabaseError) {
        return ApiResponse.error(
          'Database operation failed',
          500,
          'DATABASE_ERROR',
          process.env.NODE_ENV === 'development' ? error.context : undefined
        );
      }

      if (error instanceof ImportError) {
        return ApiResponse.error(error.message, 422, 'IMPORT_ERROR', error.context);
      }

      if (error instanceof ExternalApiError) {
        return ApiResponse.error(
          'External service unavailable',
          503,
          'EXTERNAL_API_ERROR',
          process.env.NODE_ENV === 'development' ? error.context : undefined
        );
      }

      // Handle API errors with status codes
      if (error instanceof Error && 'status' in error) {
        const apiError = error as ApiError;
        return ApiResponse.error(
          apiError.message,
          apiError.status || 500,
          apiError.code,
          process.env.NODE_ENV === 'development' ? error.stack : undefined
        );
      }

      // Generic error fallback
      return ApiResponse.error(
        process.env.NODE_ENV === 'development' 
          ? (error as Error).message 
          : 'Internal server error',
        500,
        'INTERNAL_ERROR',
        process.env.NODE_ENV === 'development' ? (error as Error).stack : undefined
      );
    }
  };
}

// Global error handlers for unhandled rejections and exceptions
export function setupGlobalErrorHandlers() {
  process.on('unhandledRejection', (reason, promise) => {
    logger.error({
      error: reason,
      promise: promise.toString()
    }, 'Unhandled Promise Rejection');
  });

  process.on('uncaughtException', (error) => {
    logger.fatal({ error }, 'Uncaught Exception');
    // In production, you might want to gracefully shutdown
    if (process.env.NODE_ENV === 'production') {
      process.exit(1);
    }
  });

  // Handle graceful shutdown
  process.on('SIGTERM', () => {
    logger.info('SIGTERM received, shutting down gracefully');
    process.exit(0);
  });

  process.on('SIGINT', () => {
    logger.info('SIGINT received, shutting down gracefully');
    process.exit(0);
  });
}