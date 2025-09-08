// Simple in-memory rate limiter for chat API
interface RateLimitEntry {
  count: number;
  resetTime: number;
}

const rateLimitStore = new Map<string, RateLimitEntry>();

export interface RateLimitConfig {
  windowMs: number; // Time window in milliseconds
  maxRequests: number; // Max requests per window
  maxDailyRequests?: number; // Optional daily limit
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetTime: number;
  error?: string;
}

export function checkRateLimit(
  identifier: string,
  config: RateLimitConfig
): RateLimitResult {
  const now = Date.now();
  const windowStart = now - config.windowMs;
  
  // Clean up old entries
  for (const [key, entry] of rateLimitStore) {
    if (entry.resetTime < now) {
      rateLimitStore.delete(key);
    }
  }
  
  // Get or create entry for this identifier
  let entry = rateLimitStore.get(identifier);
  
  if (!entry || entry.resetTime < now) {
    // Create new or reset expired entry
    entry = {
      count: 0,
      resetTime: now + config.windowMs
    };
  }
  
  // Check if limit exceeded
  if (entry.count >= config.maxRequests) {
    return {
      allowed: false,
      remaining: 0,
      resetTime: entry.resetTime,
      error: `Rate limit exceeded. Try again in ${Math.ceil((entry.resetTime - now) / 1000)} seconds.`
    };
  }
  
  // Increment counter and update
  entry.count++;
  rateLimitStore.set(identifier, entry);
  
  return {
    allowed: true,
    remaining: config.maxRequests - entry.count,
    resetTime: entry.resetTime
  };
}

// Helper to get client identifier from request
export function getClientIdentifier(req: Request): string {
  // Try to get IP from various headers (for different deployment environments)
  const forwarded = req.headers.get('x-forwarded-for');
  const realIp = req.headers.get('x-real-ip');
  const clientIp = forwarded?.split(',')[0] || realIp || 'unknown';
  
  return clientIp;
}

// Rate limit configurations
export const RATE_LIMITS = {
  // Conservative limits for production
  CHAT_PRODUCTION: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 2, // 2 requests per minute
    maxDailyRequests: 10 // 10 requests per day
  },
  
  // More permissive for development
  CHAT_DEVELOPMENT: {
    windowMs: 60 * 1000, // 1 minute  
    maxRequests: 20, // 20 requests per minute
  }
};