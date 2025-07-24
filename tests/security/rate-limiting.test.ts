/**
 * Request Rate Limiting and Throttling Test Suite
 * 
 * Comprehensive test cases for rate limiting implementation following TDD approach.
 * Tests cover rate limiting algorithms, user-based limits, IP-based limits, and recovery scenarios.
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { RateLimiter, TokenBucketLimiter, SlidingWindowLimiter, FixedWindowLimiter } from '../../libs/security/rate-limiter';

describe('Rate Limiting System', () => {
  beforeEach(() => {
    // Reset time mocks before each test
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('Token Bucket Rate Limiter', () => {
    let limiter: TokenBucketLimiter;

    beforeEach(() => {
      limiter = new TokenBucketLimiter({
        capacity: 10,
        refillRate: 1, // 1 token per second
        refillInterval: 1000, // 1 second
      });
    });

    it('should allow requests when tokens are available', async () => {
      const result = await limiter.checkLimit('user1', 1);
      
      expect(result.allowed).toBe(true);
      expect(result.remainingTokens).toBe(9);
      expect(result.resetTime).toBeGreaterThan(Date.now());
    });

    it('should block requests when no tokens available', async () => {
      // Consume all tokens
      for (let i = 0; i < 10; i++) {
        await limiter.checkLimit('user1', 1);
      }

      const result = await limiter.checkLimit('user1', 1);
      
      expect(result.allowed).toBe(false);
      expect(result.remainingTokens).toBe(0);
      expect(result.error).toContain('rate limit exceeded');
    });

    it('should refill tokens over time', async () => {
      // Consume all tokens
      for (let i = 0; i < 10; i++) {
        await limiter.checkLimit('user1', 1);
      }

      // Should be blocked
      let result = await limiter.checkLimit('user1', 1);
      expect(result.allowed).toBe(false);

      // Fast forward time by 2 seconds (should refill 2 tokens)
      vi.advanceTimersByTime(2000);

      // Should allow 2 requests now
      result = await limiter.checkLimit('user1', 1);
      expect(result.allowed).toBe(true);
      expect(result.remainingTokens).toBe(1);

      result = await limiter.checkLimit('user1', 1);
      expect(result.allowed).toBe(true);
      expect(result.remainingTokens).toBe(0);

      // Third request should be blocked
      result = await limiter.checkLimit('user1', 1);
      expect(result.allowed).toBe(false);
    });

    it('should handle burst requests correctly', async () => {
      // Should allow burst up to capacity
      const promises = Array.from({ length: 5 }, () => limiter.checkLimit('user1', 1));
      const results = await Promise.all(promises);

      expect(results.every(r => r.allowed)).toBe(true);
      expect(results[4].remainingTokens).toBe(5);
    });

    it('should handle different cost per request', async () => {
      // Request with cost of 5 tokens
      const result = await limiter.checkLimit('user1', 5);
      
      expect(result.allowed).toBe(true);
      expect(result.remainingTokens).toBe(5);

      // Next request with cost of 6 should fail
      const result2 = await limiter.checkLimit('user1', 6);
      expect(result2.allowed).toBe(false);
    });

    it('should maintain separate buckets for different users', async () => {
      // Consume tokens for user1
      for (let i = 0; i < 10; i++) {
        await limiter.checkLimit('user1', 1);
      }

      // user1 should be blocked
      let result = await limiter.checkLimit('user1', 1);
      expect(result.allowed).toBe(false);

      // user2 should still have tokens
      result = await limiter.checkLimit('user2', 1);
      expect(result.allowed).toBe(true);
      expect(result.remainingTokens).toBe(9);
    });

    it('should not exceed capacity when refilling', async () => {
      // Consume 5 tokens
      for (let i = 0; i < 5; i++) {
        await limiter.checkLimit('user1', 1);
      }

      // Fast forward by 20 seconds (would normally add 20 tokens)
      vi.advanceTimersByTime(20000);

      // Should be capped at capacity (10)
      const result = await limiter.checkLimit('user1', 1);
      expect(result.allowed).toBe(true);
      expect(result.remainingTokens).toBe(9); // 10 - 1 = 9
    });
  });

  describe('Sliding Window Rate Limiter', () => {
    let limiter: SlidingWindowLimiter;

    beforeEach(() => {
      limiter = new SlidingWindowLimiter({
        windowSize: 60000, // 1 minute
        maxRequests: 100,
        subWindowCount: 6, // 10-second sub-windows
      });
    });

    it('should allow requests within limit', async () => {
      const result = await limiter.checkLimit('user1');
      
      expect(result.allowed).toBe(true);
      expect(result.remainingRequests).toBe(99);
      expect(result.windowResetTime).toBeGreaterThan(Date.now());
    });

    it('should block requests when limit exceeded', async () => {
      // Make 100 requests
      for (let i = 0; i < 100; i++) {
        await limiter.checkLimit('user1');
      }

      const result = await limiter.checkLimit('user1');
      
      expect(result.allowed).toBe(false);
      expect(result.remainingRequests).toBe(0);
      expect(result.error).toContain('rate limit exceeded');
    });

    it('should slide the window correctly', async () => {
      // Make 50 requests
      for (let i = 0; i < 50; i++) {
        await limiter.checkLimit('user1');
      }

      // Fast forward by 30 seconds (half the window)
      vi.advanceTimersByTime(30000);

      // Make 50 more requests
      for (let i = 0; i < 50; i++) {
        await limiter.checkLimit('user1');
      }

      // Should be blocked now
      let result = await limiter.checkLimit('user1');
      expect(result.allowed).toBe(false);

      // Fast forward by another 30 seconds (oldest requests should fall out)
      vi.advanceTimersByTime(30000);

      // Should allow requests again
      result = await limiter.checkLimit('user1');
      expect(result.allowed).toBe(true);
    });

    it('should handle high frequency requests', async () => {
      const results = [];
      
      // Make 150 requests rapidly
      for (let i = 0; i < 150; i++) {
        results.push(await limiter.checkLimit('user1'));
      }

      const allowed = results.filter(r => r.allowed).length;
      const blocked = results.filter(r => !r.allowed).length;

      expect(allowed).toBe(100);
      expect(blocked).toBe(50);
    });

    it('should maintain accurate counts across sub-windows', async () => {
      // Make requests across different sub-windows
      for (let i = 0; i < 20; i++) {
        await limiter.checkLimit('user1');
        vi.advanceTimersByTime(500); // 0.5 seconds
      }

      // Should have made 20 requests over 10 seconds
      const result = await limiter.checkLimit('user1');
      expect(result.allowed).toBe(true);
      expect(result.remainingRequests).toBe(79); // 100 - 20 - 1 = 79
    });
  });

  describe('Fixed Window Rate Limiter', () => {
    let limiter: FixedWindowLimiter;

    beforeEach(() => {
      limiter = new FixedWindowLimiter({
        windowSize: 10000, // 10 seconds
        maxRequests: 50,
      });
    });

    it('should allow requests within window limit', async () => {
      const result = await limiter.checkLimit('user1');
      
      expect(result.allowed).toBe(true);
      expect(result.remainingRequests).toBe(49);
      expect(result.windowResetTime).toBeGreaterThan(Date.now());
    });

    it('should reset counts at window boundary', async () => {
      // Consume all requests in current window
      for (let i = 0; i < 50; i++) {
        await limiter.checkLimit('user1');
      }

      // Should be blocked
      let result = await limiter.checkLimit('user1');
      expect(result.allowed).toBe(false);

      // Fast forward to next window
      vi.advanceTimersByTime(10000);

      // Should allow requests again
      result = await limiter.checkLimit('user1');
      expect(result.allowed).toBe(true);
      expect(result.remainingRequests).toBe(49);
    });

    it('should handle boundary conditions correctly', async () => {
      const startTime = Date.now();
      
      // Make requests in first window  
      vi.setSystemTime(startTime + 5000); // Middle of first window
      
      for (let i = 0; i < 25; i++) {
        await limiter.checkLimit('user1');
      }

      // Verify we have requests left in current window
      let result = await limiter.checkLimit('user1');
      expect(result.allowed).toBe(true);
      expect(result.remainingRequests).toBe(24); // 50 - 25 - 1 = 24

      // Cross window boundary (advance by windowSize)
      vi.setSystemTime(startTime + 15000); // Move to next window

      // Should allow requests again in new window
      result = await limiter.checkLimit('user1');
      expect(result.allowed).toBe(true);
      expect(result.remainingRequests).toBe(49); // Full limit minus 1
    });
  });

  describe('Multi-Tier Rate Limiting', () => {
    let rateLimiter: RateLimiter;

    beforeEach(() => {
      rateLimiter = new RateLimiter({
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
            requestsPerMinute: 500,
            requestsPerHour: 25000,
            requestsPerDay: 250000,
          },
        },
        ipBasedLimits: {
          requestsPerMinute: 1000,
          requestsPerHour: 10000,
        },
      });
    });

    it('should apply different limits based on user tier', async () => {
      // Free tier user
      const freeResult = await rateLimiter.checkLimit({
        userId: 'user1',
        tier: 'free',
        ipAddress: '192.168.1.1',
      });

      expect(freeResult.allowed).toBe(true);
      expect(freeResult.limits.requestsPerMinute.remaining).toBe(9);

      // Premium tier user
      const premiumResult = await rateLimiter.checkLimit({
        userId: 'user2',
        tier: 'premium',
        ipAddress: '192.168.1.2',
      });

      expect(premiumResult.allowed).toBe(true);
      expect(premiumResult.limits.requestsPerMinute.remaining).toBe(99);
    });

    it('should enforce the most restrictive limit', async () => {
      // Make requests that would exceed minute limit but not hour limit
      for (let i = 0; i < 10; i++) {
        await rateLimiter.checkLimit({
          userId: 'user1',
          tier: 'free',
          ipAddress: '192.168.1.1',
        });
      }

      const result = await rateLimiter.checkLimit({
        userId: 'user1',
        tier: 'free',
        ipAddress: '192.168.1.1',
      });

      expect(result.allowed).toBe(false);
      expect(result.limitedBy).toBe('requestsPerMinute');
    });

    it('should apply IP-based limits independently', async () => {
      // Multiple users from same IP
      const requests = [];
      for (let i = 0; i < 1001; i++) {
        requests.push(rateLimiter.checkLimit({
          userId: `user${i % 10}`,
          tier: 'premium',
          ipAddress: '192.168.1.1',
        }));
      }

      const results = await Promise.all(requests);
      const blocked = results.filter(r => !r.allowed);
      
      expect(blocked.length).toBeGreaterThan(0);
      expect(blocked[0].limitedBy).toBe('ipBasedLimits');
    });

    it('should handle premium tier bypass correctly', async () => {
      // Premium users should bypass certain IP limits
      const result = await rateLimiter.checkLimit({
        userId: 'enterprise_user',
        tier: 'enterprise',
        ipAddress: '192.168.1.1',
        bypassIpLimits: true,
      });

      expect(result.allowed).toBe(true);
      expect(result.bypassedLimits).toContain('ipBasedLimits');
    });
  });

  describe('Rate Limiting with Context', () => {
    let rateLimiter: RateLimiter;

    beforeEach(() => {
      rateLimiter = new RateLimiter({
        contextualLimits: {
          'api:expensive': {
            requestsPerMinute: 5,
            requestsPerHour: 50,
          },
          'api:bulk': {
            requestsPerMinute: 2,
            requestsPerHour: 20,
          },
          'api:read': {
            requestsPerMinute: 100,
            requestsPerHour: 5000,
          },
        },
        defaultLimits: {
          requestsPerMinute: 60,
          requestsPerHour: 1000,
        },
      });
    });

    it('should apply contextual limits for specific operations', async () => {
      const result = await rateLimiter.checkLimit({
        userId: 'user1',
        context: 'api:expensive',
        ipAddress: '192.168.1.1',
      });

      expect(result.allowed).toBe(true);
      expect(result.limits.requestsPerMinute.limit).toBe(5);
      expect(result.limits.requestsPerMinute.remaining).toBe(4);
    });

    it('should fall back to default limits for unknown contexts', async () => {
      const result = await rateLimiter.checkLimit({
        userId: 'user1',
        context: 'api:unknown',
        ipAddress: '192.168.1.1',
      });

      expect(result.allowed).toBe(true);
      expect(result.limits.requestsPerMinute.limit).toBe(60);
      expect(result.limits.requestsPerMinute.remaining).toBe(59);
    });

    it('should combine user and context limits correctly', async () => {
      // User makes regular API calls
      for (let i = 0; i < 30; i++) {
        await rateLimiter.checkLimit({
          userId: 'user1',
          context: 'api:read',
          ipAddress: '192.168.1.1',
        });
      }

      // User tries expensive operation
      const result = await rateLimiter.checkLimit({
        userId: 'user1',
        context: 'api:expensive',
        ipAddress: '192.168.1.1',
      });

      expect(result.allowed).toBe(true); // Should have separate limit
      expect(result.limits.requestsPerMinute.remaining).toBe(4);
    });
  });

  describe('Rate Limiting Persistence and Recovery', () => {
    it('should persist rate limit data across restarts', async () => {
      const limiter1 = new TokenBucketLimiter({
        capacity: 10,
        refillRate: 1,
        refillInterval: 1000,
        persistent: true,
        storageKey: 'test-limiter',
      });

      // Consume some tokens
      for (let i = 0; i < 5; i++) {
        await limiter1.checkLimit('user1', 1);
      }

      // Check remaining tokens
      let result = await limiter1.checkLimit('user1', 0); // Cost 0 to just check
      expect(result.remainingTokens).toBe(5);

      // Create new instance (simulating restart)
      const limiter2 = new TokenBucketLimiter({
        capacity: 10,
        refillRate: 1,
        refillInterval: 1000,
        persistent: true,
        storageKey: 'test-limiter',
      });

      // Should remember previous state (within reasonable margin due to refill timing)
      const result2 = await limiter2.checkLimit('user1', 1);
      expect(result2.allowed).toBe(true);
      expect(result2.remainingTokens).toBeLessThanOrEqual(5);
      expect(result2.remainingTokens).toBeGreaterThanOrEqual(3); // Allow for refill
    });

    it('should handle storage failures gracefully', async () => {
      const limiter = new TokenBucketLimiter({
        capacity: 10,
        refillRate: 1,
        refillInterval: 1000,
        persistent: true,
        storageKey: 'invalid-storage',
        fallbackToMemory: true,
      });

      // Should work despite storage issues
      const result = await limiter.checkLimit('user1', 1);
      expect(result.allowed).toBe(true);
    });

    it('should recover from corrupted state gracefully', async () => {
      // Mock corrupted storage
      const limiter = new TokenBucketLimiter({
        capacity: 10,
        refillRate: 1,
        refillInterval: 1000,
        persistent: true,
        storageKey: 'corrupted-storage',
      });

      // Should reset to default state
      const result = await limiter.checkLimit('user1', 1);
      expect(result.allowed).toBe(true);
      expect(result.remainingTokens).toBe(9);
    });
  });

  describe('Rate Limiting Analytics and Monitoring', () => {
    let rateLimiter: RateLimiter;

    beforeEach(() => {
      rateLimiter = new RateLimiter({
        enableAnalytics: true,
        analyticsRetention: 3600000, // 1 hour
        tiers: {
          free: { requestsPerMinute: 10 },
        },
      });
    });

    it('should track rate limiting events', async () => {
      // Make some requests
      await rateLimiter.checkLimit({ userId: 'user1', tier: 'free' });
      await rateLimiter.checkLimit({ userId: 'user1', tier: 'free' });

      const analytics = rateLimiter.getAnalytics('user1');
      
      expect(analytics.totalRequests).toBe(2);
      expect(analytics.allowedRequests).toBe(2);
      expect(analytics.blockedRequests).toBe(0);
    });

    it('should track blocked requests', async () => {
      // Exceed limit
      for (let i = 0; i < 11; i++) {
        await rateLimiter.checkLimit({ userId: 'user1', tier: 'free' });
      }

      const analytics = rateLimiter.getAnalytics('user1');
      
      expect(analytics.totalRequests).toBe(11);
      expect(analytics.allowedRequests).toBe(10);
      expect(analytics.blockedRequests).toBe(1);
    });

    it('should provide rate limiting statistics', async () => {
      // Create activity for multiple users
      for (let i = 0; i < 5; i++) {
        await rateLimiter.checkLimit({ userId: `user${i}`, tier: 'free' });
      }

      const stats = rateLimiter.getGlobalStats();
      
      expect(stats.totalUsers).toBe(5);
      expect(stats.totalRequests).toBe(5);
      expect(stats.averageRequestsPerUser).toBe(1);
    });

    it('should provide top blocked users', async () => {
      // Create different blocking patterns
      for (let i = 0; i < 15; i++) {
        await rateLimiter.checkLimit({ userId: 'user1', tier: 'free' });
      }
      
      for (let i = 0; i < 12; i++) {
        await rateLimiter.checkLimit({ userId: 'user2', tier: 'free' });
      }

      const topBlocked = rateLimiter.getTopBlockedUsers(10);
      
      expect(topBlocked[0].userId).toBe('user1');
      expect(topBlocked[0].blockedRequests).toBe(5);
      expect(topBlocked[1].userId).toBe('user2');
      expect(topBlocked[1].blockedRequests).toBe(2);
    });

    it('should clean up old analytics data', async () => {
      // Make request
      await rateLimiter.checkLimit({ userId: 'user1', tier: 'free' });

      // Fast forward beyond retention period
      vi.advanceTimersByTime(3600001); // 1 hour + 1ms

      // Trigger cleanup
      await rateLimiter.cleanupAnalytics();

      // Analytics should be empty
      const analytics = rateLimiter.getAnalytics('user1');
      expect(analytics.totalRequests).toBe(0);
    });
  });

  describe('Rate Limiting Edge Cases', () => {
    it('should handle concurrent requests correctly', async () => {
      const limiter = new TokenBucketLimiter({
        capacity: 10,
        refillRate: 1,
        refillInterval: 1000,
      });

      // Make 20 concurrent requests
      const promises = Array.from({ length: 20 }, () => 
        limiter.checkLimit('user1', 1)
      );
      
      const results = await Promise.all(promises);
      const allowed = results.filter(r => r.allowed).length;
      const blocked = results.filter(r => !r.allowed).length;

      expect(allowed).toBe(10);
      expect(blocked).toBe(10);
    });

    it('should handle zero capacity gracefully', async () => {
      const limiter = new TokenBucketLimiter({
        capacity: 0,
        refillRate: 1,
        refillInterval: 1000,
      });

      const result = await limiter.checkLimit('user1', 1);
      expect(result.allowed).toBe(false);
    });

    it('should handle negative costs gracefully', async () => {
      const limiter = new TokenBucketLimiter({
        capacity: 10,
        refillRate: 1,
        refillInterval: 1000,
      });

      const result = await limiter.checkLimit('user1', -5);
      expect(result.allowed).toBe(false);
      expect(result.error).toContain('Invalid cost');
    });

    it('should handle extremely high refill rates', async () => {
      const limiter = new TokenBucketLimiter({
        capacity: 10,
        refillRate: 1000000, // Very high refill rate
        refillInterval: 1,
      });

      // Consume all tokens
      for (let i = 0; i < 10; i++) {
        await limiter.checkLimit('user1', 1);
      }

      // Fast forward minimal time
      vi.advanceTimersByTime(1);

      // Should be back to full capacity
      const result = await limiter.checkLimit('user1', 1);
      expect(result.remainingTokens).toBe(9);
    });

    it('should handle memory pressure gracefully', async () => {
      const limiter = new SlidingWindowLimiter({
        windowSize: 60000,
        maxRequests: 100,
        maxMemoryUsers: 1000,
      });

      // Create many users to trigger memory pressure
      for (let i = 0; i < 1100; i++) {
        await limiter.checkLimit(`user${i}`);
      }

      // Should still function for new requests
      const result = await limiter.checkLimit('newuser');
      expect(result.allowed).toBe(true);
    });
  });
});