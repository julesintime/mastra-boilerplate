/**
 * Rate Limiting Integration Example
 * 
 * Demonstrates how to integrate the rate limiting system with Mastra agents,
 * Express applications, and custom workflows.
 */

import { RateLimiter } from './rate-limiter';
import { createRateLimitMiddleware, MastraRateLimitIntegration, RateLimitUtils } from './rate-limit-middleware';
import express from 'express';

// Example: Create a comprehensive rate limiter for a Mastra application
export function createMastraRateLimiter() {
  return new RateLimiter({
    // Tier-based limits for different user types
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

    // Context-specific limits for different operations
    contextualLimits: {
      // Weather agent limits
      'agent:WeatherAgent:getWeather': {
        requestsPerMinute: 20,
        requestsPerHour: 500,
      },
      'agent:WeatherAgent:getActivitySuggestions': {
        requestsPerMinute: 10,
        requestsPerHour: 200,
      },

      // Eight ball agent limits
      'agent:EightBallAgent:ask': {
        requestsPerMinute: 30,
        requestsPerHour: 1000,
      },

      // Quotes agent limits
      'agent:QuotesAgent:getQuote': {
        requestsPerMinute: 50,
        requestsPerHour: 2000,
      },

      // Expensive operations
      'api:evaluate': {
        requestsPerMinute: 5,
        requestsPerHour: 50,
      },
      'api:bulk-process': {
        requestsPerMinute: 2,
        requestsPerHour: 20,
      },
      'api:generate-report': {
        requestsPerMinute: 1,
        requestsPerHour: 10,
      },
    },

    // IP-based limits to prevent abuse
    ipBasedLimits: {
      requestsPerMinute: 500,
      requestsPerHour: 10000,
    },

    // Default limits for unknown contexts
    defaultLimits: {
      requestsPerMinute: 60,
      requestsPerHour: 1000,
    },

    // Enable analytics for monitoring
    enableAnalytics: true,
    analyticsRetention: 86400000, // 24 hours
  });
}

// Example: Express middleware integration
export function setupExpressRateLimiting(app: express.Application) {
  const rateLimiter = createMastraRateLimiter();

  // Global rate limiting middleware
  const globalRateLimit = createRateLimitMiddleware({
    rateLimiter,
    keyGenerator: (req) => ({
      userId: req.user?.id,
      tier: req.user?.tier || 'free',
      ipAddress: req.ip,
      context: req.path.startsWith('/api/') ? req.path : undefined,
    }),
    message: {
      error: 'Rate limit exceeded',
      message: 'Too many requests. Please try again later.',
      retryAfter: '60s',
    },
  });

  // Apply to all API routes
  app.use('/api/', globalRateLimit);

  // Specific endpoints with custom limits
  const expensiveOperationLimit = createRateLimitMiddleware({
    rateLimiter,
    keyGenerator: (req) => ({
      userId: req.user?.id,
      tier: req.user?.tier || 'free',
      ipAddress: req.ip,
      context: 'api:expensive',
    }),
  });

  app.use('/api/evaluate', expensiveOperationLimit);
  app.use('/api/generate-report', expensiveOperationLimit);

  // Rate limit status endpoint
  app.get('/api/rate-limit/status', async (req, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const analytics = rateLimiter.getAnalytics(userId);
      const globalStats = rateLimiter.getGlobalStats();

      res.json({
        user: {
          totalRequests: analytics.totalRequests,
          allowedRequests: analytics.allowedRequests,
          blockedRequests: analytics.blockedRequests,
          successRate: analytics.allowedRequests / analytics.totalRequests || 0,
        },
        global: {
          totalUsers: globalStats.totalUsers,
          averageRequestsPerUser: globalStats.averageRequestsPerUser,
        },
      });
    } catch (error) {
      res.status(500).json({ error: 'Failed to get rate limit status' });
    }
  });

  return rateLimiter;
}

// Example: Mastra agent integration
export function setupMastraAgentRateLimiting() {
  const rateLimiter = createMastraRateLimiter();
  const integration = new MastraRateLimitIntegration(rateLimiter);

  // Example weather agent with rate limiting
  class WeatherAgent {
    constructor() {}

    async getWeather(location: string, context?: any) {
      // Simulate weather API call
      console.log(`Getting weather for ${location}`);
      return {
        location,
        temperature: Math.round(Math.random() * 30),
        condition: 'sunny',
        timestamp: Date.now(),
      };
    }

    async getActivitySuggestions(weather: any, context?: any) {
      // Simulate activity suggestion logic
      console.log(`Generating activity suggestions for ${weather.condition} weather`);
      return {
        activities: ['hiking', 'picnic', 'outdoor sports'],
        weather,
        timestamp: Date.now(),
      };
    }
  }

  // Wrap the agent with rate limiting
  const weatherAgent = integration.wrapAgent(new WeatherAgent(), {
    tier: 'free', // Default tier
    context: 'agent:WeatherAgent',
  });

  return { rateLimiter, weatherAgent };
}

// Example: Workflow with rate limiting
export async function createRateLimitedWorkflow() {
  const { rateLimiter, weatherAgent } = setupMastraAgentRateLimiting();

  // Workflow function with built-in rate limiting
  async function weatherWorkflow(location: string, userId: string, tier: string = 'free') {
    const context = {
      userId,
      tier,
      ipAddress: '192.168.1.1', // Would come from request
    };

    try {
      // Step 1: Get weather (rate limited)
      const weather = await weatherAgent.getWeather(location, { context });
      
      // Step 2: Get activity suggestions (rate limited)
      const suggestions = await weatherAgent.getActivitySuggestions(weather, { context });

      return {
        success: true,
        data: {
          weather,
          suggestions,
        },
      };
    } catch (error) {
      if (error.message.includes('Rate limit exceeded')) {
        return {
          success: false,
          error: 'Rate limit exceeded',
          message: RateLimitUtils.createLimitMessage(error),
          retryAfter: 60,
        };
      }
      
      throw error;
    }
  }

  return { weatherWorkflow, rateLimiter };
}

// Example: Analytics data access (headless - no UI dashboard)
export class RateLimitAnalytics {
  private rateLimiter: RateLimiter;

  constructor(rateLimiter: RateLimiter) {
    this.rateLimiter = rateLimiter;
  }

  getOverviewData() {
    const globalStats = this.rateLimiter.getGlobalStats();
    const topBlockedUsers = this.rateLimiter.getTopBlockedUsers(10);

    return {
      overview: {
        totalUsers: globalStats.totalUsers,
        totalRequests: globalStats.totalRequests,
        totalBlocked: globalStats.totalBlocked,
        blockRate: globalStats.totalRequests > 0 ? 
          (globalStats.totalBlocked / globalStats.totalRequests * 100).toFixed(2) + '%' : '0%',
        averageRequestsPerUser: globalStats.averageRequestsPerUser.toFixed(2),
      },
      topBlockedUsers: topBlockedUsers.map(user => ({
        userId: user.userId,
        blockedRequests: user.blockedRequests,
        totalRequests: user.totalRequests,
        blockRate: ((user.blockedRequests / user.totalRequests) * 100).toFixed(2) + '%',
      })),
      recentActivity: this.getRecentActivity(),
    };
  }

  private getRecentActivity() {
    // In a real implementation, this would query recent analytics data
    return [
      { timestamp: Date.now() - 300000, event: 'high_traffic', description: 'Traffic spike detected' },
      { timestamp: Date.now() - 600000, event: 'user_blocked', description: 'User exceeded limits' },
      { timestamp: Date.now() - 900000, event: 'normal', description: 'Normal operation' },
    ];
  }

  getUserAnalytics(userId: string) {
    const analytics = this.rateLimiter.getAnalytics(userId);
    
    return {
      userId,
      analytics: {
        totalRequests: analytics.totalRequests,
        allowedRequests: analytics.allowedRequests,
        blockedRequests: analytics.blockedRequests,
        firstRequest: new Date(analytics.firstRequest).toISOString(),
        lastRequest: new Date(analytics.lastRequest).toISOString(),
        blockedByLimit: analytics.blockedByLimit,
      },
    };
  }

  async cleanup() {
    await this.rateLimiter.cleanupAnalytics();
    return { message: 'Analytics cleaned up successfully' };
  }
}

// Example usage in main application
export async function exampleUsage() {
  console.log('=== Rate Limiting Integration Example ===\n');

  // 1. Create workflow with rate limiting
  const { weatherWorkflow, rateLimiter } = await createRateLimitedWorkflow();

  // 2. Test normal usage
  console.log('Testing normal usage...');
  const result1 = await weatherWorkflow('New York', 'user123', 'premium');
  console.log('Result 1:', result1.success ? 'Success' : 'Failed');

  // 3. Test rate limiting by making many requests quickly
  console.log('\nTesting rate limiting...');
  const promises = [];
  for (let i = 0; i < 15; i++) {
    promises.push(weatherWorkflow('Boston', 'user456', 'free'));
  }

  const results = await Promise.all(promises);
  const successful = results.filter(r => r.success).length;
  const rateLimited = results.filter(r => !r.success && r.error === 'Rate limit exceeded').length;

  console.log(`Out of 15 requests: ${successful} successful, ${rateLimited} rate limited`);

  // 4. Show analytics
  console.log('\n=== Analytics ===');
  const stats = rateLimiter.getGlobalStats();
  console.log('Global stats:', {
    totalUsers: stats.totalUsers,
    totalRequests: stats.totalRequests,
    averageRequestsPerUser: stats.averageRequestsPerUser.toFixed(2),
  });

  const topBlocked = rateLimiter.getTopBlockedUsers(3);
  console.log('Top blocked users:', topBlocked);

  // 5. Get analytics data
  const analytics = new RateLimitAnalytics(rateLimiter);
  const overviewData = analytics.getOverviewData();
  console.log('\n=== Analytics Overview ===');
  console.log(JSON.stringify(overviewData, null, 2));
}

// Run example if this file is executed directly
if (require.main === module) {
  exampleUsage().catch(console.error);
}