/**
 * Rate Limiting Middleware and Integration
 * 
 * Express middleware and utility functions for integrating rate limiting
 * with web applications and the Mastra AI agent framework.
 */

import { Request, Response, NextFunction } from 'express';
import { RateLimiter, RateLimitRequest } from './rate-limiter';

export interface RateLimitMiddlewareOptions {
  rateLimiter: RateLimiter;
  keyGenerator?: (req: Request) => RateLimitRequest;
  onLimitReached?: (req: Request, res: Response) => void;
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
  headers?: boolean;
  message?: string | object;
}

/**
 * Express middleware for rate limiting
 */
export function createRateLimitMiddleware(options: RateLimitMiddlewareOptions) {
  const {
    rateLimiter,
    keyGenerator = defaultKeyGenerator,
    onLimitReached,
    skipSuccessfulRequests = false,
    skipFailedRequests = false,
    headers = true,
    message = { error: 'Too many requests', retryAfter: '1m' }
  } = options;

  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const rateLimitRequest = keyGenerator(req);
      const result = await rateLimiter.checkLimit(rateLimitRequest);

      // Add rate limit headers
      if (headers && result.limits) {
        const primaryLimit = Object.values(result.limits)[0];
        if (primaryLimit) {
          res.set({
            'X-RateLimit-Limit': primaryLimit.limit.toString(),
            'X-RateLimit-Remaining': primaryLimit.remaining.toString(),
            'X-RateLimit-Reset': new Date(primaryLimit.resetTime).toISOString(),
          });
        }
      }

      if (!result.allowed) {
        // Add additional headers for blocked requests
        if (headers) {
          res.set({
            'Retry-After': '60',
            'X-RateLimit-Blocked-By': result.limitedBy || 'unknown',
          });
        }

        if (onLimitReached) {
          onLimitReached(req, res);
          return;
        }

        return res.status(429).json(message);
      }

      // Skip counting if configured
      const shouldSkip = 
        (skipSuccessfulRequests && res.statusCode < 400) ||
        (skipFailedRequests && res.statusCode >= 400);

      if (shouldSkip) {
        // Would need to implement skip logic in rate limiter
        console.log('Skipping rate limit count for status:', res.statusCode);
      }

      next();
    } catch (error) {
      console.error('Rate limiting middleware error:', error);
      next(); // Continue on error
    }
  };
}

/**
 * Default key generator for rate limiting
 */
function defaultKeyGenerator(req: Request): RateLimitRequest {
  const userId = req.user?.id || req.headers['x-user-id'] as string;
  const tier = req.user?.tier || req.headers['x-user-tier'] as string;
  const ipAddress = req.ip || req.connection.remoteAddress || 'unknown';
  const context = req.route?.path || req.path;

  return {
    userId,
    ipAddress,
    tier,
    context: context.startsWith('/api/') ? context : undefined,
  };
}

/**
 * Rate limiting decorator for Mastra agent functions
 */
export function rateLimited(rateLimiter: RateLimiter, context?: string) {
  return function(target: any, propertyName: string, descriptor: PropertyDescriptor) {
    const method = descriptor.value;

    descriptor.value = async function(...args: any[]) {
      // Extract user context from arguments or agent context
      const userContext = this?.context || args[0]?.context || {};
      
      const rateLimitRequest: RateLimitRequest = {
        userId: userContext.userId,
        tier: userContext.tier || 'free',
        ipAddress: userContext.ipAddress,
        context: context || `agent:${target.constructor.name}:${propertyName}`,
      };

      const result = await rateLimiter.checkLimit(rateLimitRequest);
      
      if (!result.allowed) {
        throw new Error(`Rate limit exceeded for ${propertyName}. ${result.error || ''}`);
      }

      return method.apply(this, args);
    };

    return descriptor;
  };
}

/**
 * Mastra Agent Rate Limiting Integration
 */
export class MastraRateLimitIntegration {
  private rateLimiter: RateLimiter;

  constructor(rateLimiter: RateLimiter) {
    this.rateLimiter = rateLimiter;
  }

  /**
   * Wrap an agent to add rate limiting
   */
  wrapAgent(agent: any, options: {
    tier?: string;
    context?: string;
    methods?: string[];
  } = {}) {
    const { tier = 'free', context, methods } = options;
    
    const originalMethods = methods || Object.getOwnPropertyNames(agent)
      .filter(name => typeof agent[name] === 'function' && !name.startsWith('_'));

    for (const methodName of originalMethods) {
      const originalMethod = agent[methodName];
      
      agent[methodName] = async (...args: any[]) => {
        const userContext = args[0]?.context || {};
        
        const rateLimitRequest: RateLimitRequest = {
          userId: userContext.userId || 'anonymous',
          tier: userContext.tier || tier,
          ipAddress: userContext.ipAddress,
          context: context || `agent:${agent.constructor.name}:${methodName}`,
        };

        const result = await this.rateLimiter.checkLimit(rateLimitRequest);
        
        if (!result.allowed) {
          throw new Error(`Rate limit exceeded for ${methodName}. Limited by: ${result.limitedBy}. ${result.error || ''}`);
        }

        return originalMethod.apply(agent, args);
      };
    }

    return agent;
  }

  /**
   * Create rate limiting configuration for different agent tiers
   */
  static createAgentRateLimits() {
    return {
      tiers: {
        free: {
          requestsPerMinute: 10,
          requestsPerHour: 100,
          requestsPerDay: 1000,
        },
        premium: {
          requestsPerMinute: 100,
          requestsPerHour: 5000,
          requestsPerDay: 50000,
        },
        enterprise: {
          requestsPerMinute: 1000,
          requestsPerHour: 50000,
          requestsPerDay: 500000,
        },
      },
      contextualLimits: {
        'agent:WeatherAgent:getWeather': {
          requestsPerMinute: 5,
          requestsPerHour: 100,
        },
        'agent:EightBallAgent:ask': {
          requestsPerMinute: 10,
          requestsPerHour: 200,
        },
        'agent:QuotesAgent:getQuote': {
          requestsPerMinute: 15,
          requestsPerHour: 300,
        },
        'api:expensive': {
          requestsPerMinute: 2,
          requestsPerHour: 20,
        },
        'api:bulk': {
          requestsPerMinute: 1,
          requestsPerHour: 10,
        },
      },
      ipBasedLimits: {
        requestsPerMinute: 200,
        requestsPerHour: 5000,
      },
      enableAnalytics: true,
      analyticsRetention: 86400000, // 24 hours
    };
  }
}

/**
 * Rate limiting utilities
 */
export class RateLimitUtils {
  /**
   * Parse rate limit from string (e.g., "100/hour", "10/min")
   */
  static parseRateLimit(rateLimitString: string): { requests: number; windowMs: number } {
    const match = rateLimitString.match(/^(\d+)\/(min|minute|hour|day)$/i);
    if (!match) {
      throw new Error(`Invalid rate limit format: ${rateLimitString}`);
    }

    const requests = parseInt(match[1], 10);
    const unit = match[2].toLowerCase();

    let windowMs: number;
    switch (unit) {
      case 'min':
      case 'minute':
        windowMs = 60 * 1000;
        break;
      case 'hour':
        windowMs = 60 * 60 * 1000;
        break;
      case 'day':
        windowMs = 24 * 60 * 60 * 1000;
        break;
      default:
        throw new Error(`Unknown time unit: ${unit}`);
    }

    return { requests, windowMs };
  }

  /**
   * Format remaining time until reset
   */
  static formatResetTime(resetTime: number): string {
    const now = Date.now();
    const diff = resetTime - now;

    if (diff <= 0) return 'now';

    const seconds = Math.ceil(diff / 1000);
    if (seconds < 60) return `${seconds}s`;

    const minutes = Math.ceil(seconds / 60);
    if (minutes < 60) return `${minutes}m`;

    const hours = Math.ceil(minutes / 60);
    return `${hours}h`;
  }

  /**
   * Create user-friendly rate limit message
   */
  static createLimitMessage(result: any): string {
    const resetTime = result.limits ? 
      Object.values(result.limits)[0]?.resetTime : 
      Date.now() + 60000;

    const timeUntilReset = RateLimitUtils.formatResetTime(resetTime);
    
    return `Rate limit exceeded. Try again in ${timeUntilReset}. Limited by: ${result.limitedBy || 'system'}.`;
  }
}

/**
 * Health check for rate limiting system
 */
export class RateLimitHealthCheck {
  private rateLimiter: RateLimiter;

  constructor(rateLimiter: RateLimiter) {
    this.rateLimiter = rateLimiter;
  }

  async checkHealth(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    details: {
      totalUsers: number;
      avgRequestsPerUser: number;
      topBlockedUsers: number;
      systemLoad: 'low' | 'medium' | 'high';
    };
  }> {
    try {
      const stats = this.rateLimiter.getGlobalStats();
      const topBlocked = this.rateLimiter.getTopBlockedUsers(5);

      const systemLoad = stats.totalUsers > 1000 ? 'high' : 
                        stats.totalUsers > 100 ? 'medium' : 'low';

      const blockedPercentage = stats.totalRequests > 0 ? 
        (stats.totalBlocked / stats.totalRequests) * 100 : 0;

      const status = blockedPercentage > 50 ? 'unhealthy' :
                    blockedPercentage > 20 ? 'degraded' : 'healthy';

      return {
        status,
        details: {
          totalUsers: stats.totalUsers,
          avgRequestsPerUser: Math.round(stats.averageRequestsPerUser * 100) / 100,
          topBlockedUsers: topBlocked.length,
          systemLoad,
        },
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        details: {
          totalUsers: 0,
          avgRequestsPerUser: 0,
          topBlockedUsers: 0,
          systemLoad: 'high',
        },
      };
    }
  }
}