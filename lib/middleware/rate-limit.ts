import { NextRequest, NextResponse } from 'next/server';
import { logger } from '../logger';

// Import config with fallback
let config: any = null;
try {
  config = require('../config').config;
} catch (error) {
  logger.warn('Config module not available, using defaults');
  config = {
    rateLimit: {
      windowMs: 60000,
      maxRequests: 100
    }
  };
}

// Simple in-memory rate limiter for Next.js API routes
class RateLimiter {
  private requests: Map<string, { count: number; resetTime: number }> = new Map();
  private windowMs: number;
  private maxRequests: number;

  constructor(windowMs: number, maxRequests: number) {
    this.windowMs = windowMs;
    this.maxRequests = maxRequests;
    
    // Clean up expired entries every minute
    setInterval(() => this.cleanup(), 60000);
  }

  private cleanup() {
    const now = Date.now();
    for (const [key, data] of this.requests.entries()) {
      if (now > data.resetTime) {
        this.requests.delete(key);
      }
    }
  }

  private getClientId(request: NextRequest): string {
    // Try to get real IP from headers (for proxies/load balancers)
    const forwarded = request.headers.get('x-forwarded-for');
    const realIp = request.headers.get('x-real-ip');
    const ip = forwarded?.split(',')[0] || realIp || request.ip || 'unknown';
    
    return ip;
  }

  check(request: NextRequest): { allowed: boolean; remaining: number; resetTime: number } {
    const clientId = this.getClientId(request);
    const now = Date.now();
    const resetTime = now + this.windowMs;

    const existing = this.requests.get(clientId);

    if (!existing || now > existing.resetTime) {
      // New window or expired
      this.requests.set(clientId, { count: 1, resetTime });
      return { allowed: true, remaining: this.maxRequests - 1, resetTime };
    }

    if (existing.count >= this.maxRequests) {
      // Rate limit exceeded
      logger.warn({
        clientId,
        count: existing.count,
        maxRequests: this.maxRequests,
        resetTime: existing.resetTime
      }, 'Rate limit exceeded');
      
      return { allowed: false, remaining: 0, resetTime: existing.resetTime };
    }

    // Increment counter
    existing.count++;
    this.requests.set(clientId, existing);

    return { 
      allowed: true, 
      remaining: this.maxRequests - existing.count, 
      resetTime: existing.resetTime 
    };
  }

  getStats() {
    return {
      activeClients: this.requests.size,
      windowMs: this.windowMs,
      maxRequests: this.maxRequests
    };
  }
}

// Create rate limiter instance with fallback values
let rateLimiter: RateLimiter;

try {
  rateLimiter = new RateLimiter(
    config.rateLimit?.windowMs || 60000, // 1 minute default
    config.rateLimit?.maxRequests || 100 // 100 requests default
  );
} catch (error) {
  logger.warn('Config not available, using default rate limits');
  rateLimiter = new RateLimiter(60000, 100);
}

// Middleware function for API routes
export function withRateLimit<T extends any[]>(
  handler: (...args: T) => Promise<NextResponse>,
  customLimits?: { windowMs?: number; maxRequests?: number }
) {
  // Create custom limiter if different limits are needed
  const limiter = customLimits 
    ? new RateLimiter(
        customLimits.windowMs || config.rateLimit?.windowMs || 60000,
        customLimits.maxRequests || config.rateLimit?.maxRequests || 100
      )
    : rateLimiter;

  return async (request: NextRequest, ...otherArgs: any[]): Promise<NextResponse> => {
    const result = limiter.check(request);

    // Add rate limit headers
    const headers = new Headers();
    const stats = limiter.getStats();
    headers.set('X-RateLimit-Limit', stats.maxRequests.toString());
    headers.set('X-RateLimit-Remaining', result.remaining.toString());
    headers.set('X-RateLimit-Reset', new Date(result.resetTime).toISOString());

    if (!result.allowed) {
      return NextResponse.json(
        {
          success: false,
          error: {
            message: 'Rate limit exceeded',
            code: 'RATE_LIMIT_EXCEEDED',
            retryAfter: Math.ceil((result.resetTime - Date.now()) / 1000)
          }
        },
        { 
          status: 429,
          headers
        }
      );
    }

    // Call the original handler
    const response = await handler(request, ...otherArgs);
    
    // Add rate limit headers to successful responses
    for (const [key, value] of headers.entries()) {
      response.headers.set(key, value);
    }

    return response;
  };
}

// Export rate limiter for monitoring
export { rateLimiter };