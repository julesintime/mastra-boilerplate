/**
 * Request Rate Limiting and Throttling System
 * 
 * Comprehensive rate limiting implementation with multiple algorithms,
 * multi-tier support, contextual limits, analytics, and persistence.
 */

import crypto from 'crypto';

export interface RateLimitResult {
  allowed: boolean;
  remainingTokens?: number;
  remainingRequests?: number;
  resetTime?: number;
  windowResetTime?: number;
  error?: string;
  limitedBy?: string;
  bypassedLimits?: string[];
  limits?: {
    [key: string]: {
      limit: number;
      remaining: number;
      resetTime: number;
    };
  };
}

export interface RateLimitRequest {
  userId?: string;
  ipAddress?: string;
  tier?: string;
  context?: string;
  bypassIpLimits?: boolean;
}

export interface TokenBucketConfig {
  capacity: number;
  refillRate: number;
  refillInterval: number;
  persistent?: boolean;
  storageKey?: string;
  fallbackToMemory?: boolean;
}

export interface SlidingWindowConfig {
  windowSize: number;
  maxRequests: number;
  subWindowCount?: number;
  maxMemoryUsers?: number;
}

export interface FixedWindowConfig {
  windowSize: number;
  maxRequests: number;
}

export interface RateLimiterConfig {
  tiers?: {
    [tierName: string]: {
      requestsPerMinute?: number;
      requestsPerHour?: number;
      requestsPerDay?: number;
    };
  };
  ipBasedLimits?: {
    requestsPerMinute?: number;
    requestsPerHour?: number;
    requestsPerDay?: number;
  };
  contextualLimits?: {
    [context: string]: {
      requestsPerMinute?: number;
      requestsPerHour?: number;
      requestsPerDay?: number;
    };
  };
  defaultLimits?: {
    requestsPerMinute?: number;
    requestsPerHour?: number;
    requestsPerDay?: number;
  };
  enableAnalytics?: boolean;
  analyticsRetention?: number;
}

export interface AnalyticsData {
  totalRequests: number;
  allowedRequests: number;
  blockedRequests: number;
  firstRequest: number;
  lastRequest: number;
  blockedByLimit: Record<string, number>;
}

export interface GlobalStats {
  totalUsers: number;
  totalRequests: number;
  totalBlocked: number;
  averageRequestsPerUser: number;
  topContexts: Array<{ context: string; requests: number; }>;
}

/**
 * Token Bucket Rate Limiter
 */
export class TokenBucketLimiter {
  private buckets: Map<string, { tokens: number; lastRefill: number; }> = new Map();
  private config: TokenBucketConfig;
  private storage?: Map<string, any>;

  constructor(config: TokenBucketConfig) {
    this.config = config;
    
    if (config.persistent) {
      this.initializeStorage();
    }

    // Start refill process
    this.startRefillProcess();
  }

  async checkLimit(userId: string, cost: number = 1): Promise<RateLimitResult> {
    if (cost < 0) {
      return {
        allowed: false,
        error: 'Invalid cost: must be non-negative',
      };
    }

    if (this.config.capacity === 0) {
      return {
        allowed: false,
        remainingTokens: 0,
        resetTime: Date.now() + this.config.refillInterval,
        error: 'Zero capacity bucket',
      };
    }

    const bucket = this.getBucket(userId);
    this.refillBucket(bucket);

    if (bucket.tokens >= cost) {
      bucket.tokens -= cost;
      
      if (this.config.persistent) {
        await this.persistBucket(userId, bucket);
      }

      return {
        allowed: true,
        remainingTokens: bucket.tokens,
        resetTime: this.calculateResetTime(bucket),
      };
    }

    return {
      allowed: false,
      remainingTokens: bucket.tokens,
      resetTime: this.calculateResetTime(bucket),
      error: `Token bucket rate limit exceeded. Need ${cost} tokens, have ${bucket.tokens}`,
    };
  }

  private getBucket(userId: string): { tokens: number; lastRefill: number; } {
    let bucket = this.buckets.get(userId);
    
    if (!bucket) {
      if (this.config.persistent && this.storage) {
        bucket = this.loadBucket(userId);
      }
      
      if (!bucket) {
        bucket = {
          tokens: this.config.capacity,
          lastRefill: Date.now(),
        };
      }
      
      this.buckets.set(userId, bucket);
    }

    return bucket;
  }

  private refillBucket(bucket: { tokens: number; lastRefill: number; }): void {
    const now = Date.now();
    const timePassed = now - bucket.lastRefill;
    const intervalsElapsed = Math.floor(timePassed / this.config.refillInterval);

    if (intervalsElapsed > 0) {
      const tokensToAdd = intervalsElapsed * this.config.refillRate;
      bucket.tokens = Math.min(this.config.capacity, bucket.tokens + tokensToAdd);
      bucket.lastRefill = now;
    }
  }

  private calculateResetTime(bucket: { tokens: number; lastRefill: number; }): number {
    if (bucket.tokens >= this.config.capacity) {
      return bucket.lastRefill + this.config.refillInterval;
    }
    
    const tokensNeeded = this.config.capacity - bucket.tokens;
    const intervalsNeeded = Math.ceil(tokensNeeded / this.config.refillRate);
    return bucket.lastRefill + (intervalsNeeded * this.config.refillInterval);
  }

  private startRefillProcess(): void {
    // Periodic cleanup of unused buckets
    setInterval(() => {
      const cutoff = Date.now() - (this.config.refillInterval * 100); // Clean up old buckets
      
      for (const [userId, bucket] of this.buckets.entries()) {
        if (bucket.lastRefill < cutoff) {
          this.buckets.delete(userId);
        }
      }
    }, this.config.refillInterval * 10);
  }

  private initializeStorage(): void {
    try {
      // Use a shared storage for all instances with the same storageKey
      if (!TokenBucketLimiter.sharedStorage) {
        TokenBucketLimiter.sharedStorage = new Map();
      }
      this.storage = TokenBucketLimiter.sharedStorage;
    } catch (error) {
      if (this.config.fallbackToMemory) {
        console.warn('Rate limiter storage initialization failed, falling back to memory');
        this.storage = new Map();
      } else {
        throw error;
      }
    }
  }

  private static sharedStorage?: Map<string, any>;

  private loadBucket(userId: string): { tokens: number; lastRefill: number; } | null {
    try {
      if (!this.storage) return null;
      
      const data = this.storage.get(`${this.config.storageKey}:${userId}`);
      if (data && typeof data.tokens === 'number' && typeof data.lastRefill === 'number') {
        return data;
      }
    } catch (error) {
      console.warn(`Failed to load bucket for ${userId}:`, error);
    }
    
    return null;
  }

  private async persistBucket(userId: string, bucket: { tokens: number; lastRefill: number; }): Promise<void> {
    try {
      if (this.storage) {
        this.storage.set(`${this.config.storageKey}:${userId}`, {
          tokens: bucket.tokens,
          lastRefill: bucket.lastRefill,
        });
      }
    } catch (error) {
      console.warn(`Failed to persist bucket for ${userId}:`, error);
    }
  }
}

/**
 * Sliding Window Rate Limiter
 */
export class SlidingWindowLimiter {
  private windows: Map<string, number[]> = new Map();
  private config: SlidingWindowConfig;

  constructor(config: SlidingWindowConfig) {
    this.config = {
      subWindowCount: 10,
      maxMemoryUsers: 10000,
      ...config,
    };

    this.startCleanupProcess();
  }

  async checkLimit(userId: string): Promise<RateLimitResult> {
    const now = Date.now();
    const window = this.getWindow(userId);
    
    // Clean old requests outside the window
    this.cleanWindow(window, now);

    if (window.length >= this.config.maxRequests) {
      return {
        allowed: false,
        remainingRequests: 0,
        windowResetTime: this.calculateWindowResetTime(window, now),
        error: `Sliding window rate limit exceeded. Maximum ${this.config.maxRequests} requests per ${this.config.windowSize}ms`,
      };
    }

    // Add current request
    window.push(now);
    
    return {
      allowed: true,
      remainingRequests: this.config.maxRequests - window.length,
      windowResetTime: this.calculateWindowResetTime(window, now),
    };
  }

  private getWindow(userId: string): number[] {
    let window = this.windows.get(userId);
    
    if (!window) {
      // Check memory pressure
      if (this.windows.size >= this.config.maxMemoryUsers!) {
        this.evictOldestUser();
      }
      
      window = [];
      this.windows.set(userId, window);
    }

    return window;
  }

  private cleanWindow(window: number[], now: number): void {
    const cutoff = now - this.config.windowSize;
    
    // Remove old requests
    while (window.length > 0 && window[0] <= cutoff) {
      window.shift();
    }
  }

  private calculateWindowResetTime(window: number[], now: number): number {
    if (window.length === 0) {
      return now + this.config.windowSize;
    }
    
    return window[0] + this.config.windowSize;
  }

  private evictOldestUser(): void {
    let oldestUser = '';
    let oldestTime = Date.now();

    for (const [userId, window] of this.windows.entries()) {
      if (window.length > 0 && window[0] < oldestTime) {
        oldestTime = window[0];
        oldestUser = userId;
      }
    }

    if (oldestUser) {
      this.windows.delete(oldestUser);
    }
  }

  private startCleanupProcess(): void {
    setInterval(() => {
      const now = Date.now();
      const cutoff = now - this.config.windowSize * 2; // Clean up windows not used for 2x window size

      for (const [userId, window] of this.windows.entries()) {
        if (window.length === 0 || window[window.length - 1] < cutoff) {
          this.windows.delete(userId);
        }
      }
    }, this.config.windowSize);
  }
}

/**
 * Fixed Window Rate Limiter
 */
export class FixedWindowLimiter {
  private windows: Map<string, { count: number; windowStart: number; }> = new Map();
  private config: FixedWindowConfig;

  constructor(config: FixedWindowConfig) {
    this.config = config;
    this.startCleanupProcess();
  }

  async checkLimit(userId: string): Promise<RateLimitResult> {
    const now = Date.now();
    const window = this.getWindow(userId, now);

    if (window.count >= this.config.maxRequests) {
      return {
        allowed: false,
        remainingRequests: 0,
        windowResetTime: window.windowStart + this.config.windowSize,
        error: `Fixed window rate limit exceeded. Maximum ${this.config.maxRequests} requests per ${this.config.windowSize}ms`,
      };
    }

    window.count++;
    
    return {
      allowed: true,
      remainingRequests: this.config.maxRequests - window.count,
      windowResetTime: window.windowStart + this.config.windowSize,
    };
  }

  private getWindow(userId: string, now: number): { count: number; windowStart: number; } {
    const windowStart = Math.floor(now / this.config.windowSize) * this.config.windowSize;
    let window = this.windows.get(userId);

    if (!window || window.windowStart !== windowStart) {
      window = {
        count: 0,
        windowStart,
      };
      this.windows.set(userId, window);
    }

    return window;
  }

  private startCleanupProcess(): void {
    setInterval(() => {
      const now = Date.now();
      const currentWindowStart = Math.floor(now / this.config.windowSize) * this.config.windowSize;

      for (const [userId, window] of this.windows.entries()) {
        if (window.windowStart < currentWindowStart) {
          this.windows.delete(userId);
        }
      }
    }, this.config.windowSize);
  }
}

/**
 * Multi-Tier Rate Limiter
 */
export class RateLimiter {
  private limiters: Map<string, any> = new Map();
  private config: RateLimiterConfig;
  private analytics: Map<string, AnalyticsData> = new Map();

  constructor(config: RateLimiterConfig) {
    this.config = {
      enableAnalytics: false,
      analyticsRetention: 3600000, // 1 hour
      ...config,
    };

    if (this.config.enableAnalytics) {
      this.startAnalyticsCleanup();
    }
  }

  async checkLimit(request: RateLimitRequest): Promise<RateLimitResult> {
    const { userId, ipAddress, tier, context, bypassIpLimits } = request;
    const limits: RateLimitResult['limits'] = {};
    let mostRestrictive: { allowed: boolean; limitedBy?: string; } | null = null;
    const bypassedLimits: string[] = [];

    // Get applicable limits
    const applicableLimits = this.getApplicableLimits(tier, context);

    // Check user-based limits
    if (userId) {
      for (const [limitName, limitConfig] of Object.entries(applicableLimits)) {
        const limiterKey = `user:${userId}:${context || 'default'}:${limitName}`;
        const limiter = this.getLimiter(limiterKey, limitConfig);
        const result = await limiter.checkLimit(`${userId}:${context || 'default'}:${limitName}`);

        limits[limitName] = {
          limit: limitConfig.maxRequests,
          remaining: result.remainingRequests || result.remainingTokens || 0,
          resetTime: result.resetTime || result.windowResetTime || 0,
        };

        if (!result.allowed && (!mostRestrictive || !mostRestrictive.allowed)) {
          mostRestrictive = { allowed: false, limitedBy: limitName };
        }
      }
    }

    // Check IP-based limits
    if (ipAddress && this.config.ipBasedLimits && !bypassIpLimits) {
      for (const [limitName, limitValue] of Object.entries(this.config.ipBasedLimits)) {
        const limiterKey = `ip:${ipAddress}:${limitName}`;
        const limitConfig = { maxRequests: limitValue, windowSize: this.getWindowSize(limitName) };
        const limiter = this.getLimiter(limiterKey, limitConfig);
        const result = await limiter.checkLimit(`${ipAddress}:${limitName}`);

        limits[`ip_${limitName}`] = {
          limit: limitValue,
          remaining: result.remainingRequests || result.remainingTokens || 0,
          resetTime: result.resetTime || result.windowResetTime || 0,
        };

        if (!result.allowed && (!mostRestrictive || !mostRestrictive.allowed)) {
          mostRestrictive = { allowed: false, limitedBy: 'ipBasedLimits' };
        }
      }
    } else if (bypassIpLimits) {
      bypassedLimits.push('ipBasedLimits');
    }

    // Record analytics
    if (this.config.enableAnalytics && userId) {
      this.recordAnalytics(userId, mostRestrictive?.allowed !== false, mostRestrictive?.limitedBy);
    }

    return {
      allowed: mostRestrictive?.allowed !== false,
      limits,
      limitedBy: mostRestrictive?.limitedBy,
      bypassedLimits: bypassedLimits.length > 0 ? bypassedLimits : undefined,
    };
  }

  private getApplicableLimits(tier?: string, context?: string): Record<string, { maxRequests: number; windowSize: number; }> {
    let limits: Record<string, { maxRequests: number; windowSize: number; }> = {};

    // Start with default limits if no context is specified
    if (!context && this.config.defaultLimits) {
      for (const [limitName, limitValue] of Object.entries(this.config.defaultLimits)) {
        limits[limitName] = {
          maxRequests: limitValue,
          windowSize: this.getWindowSize(limitName),
        };
      }
    }

    // Apply tier-specific limits (overrides defaults)
    if (tier && this.config.tiers?.[tier]) {
      for (const [limitName, limitValue] of Object.entries(this.config.tiers[tier])) {
        if (limitValue !== undefined) {
          limits[limitName] = {
            maxRequests: limitValue,
            windowSize: this.getWindowSize(limitName),
          };
        }
      }
    }

    // Apply contextual limits (separate from defaults/tier limits)
    if (context && this.config.contextualLimits?.[context]) {
      // Clear existing limits when context is specified - contextual limits are separate
      limits = {};
      
      for (const [limitName, limitValue] of Object.entries(this.config.contextualLimits[context])) {
        if (limitValue !== undefined) {
          limits[limitName] = {
            maxRequests: limitValue,
            windowSize: this.getWindowSize(limitName),
          };
        }
      }
    }

    // If no limits found, use defaults
    if (Object.keys(limits).length === 0 && this.config.defaultLimits) {
      for (const [limitName, limitValue] of Object.entries(this.config.defaultLimits)) {
        limits[limitName] = {
          maxRequests: limitValue,
          windowSize: this.getWindowSize(limitName),
        };
      }
    }

    return limits;
  }

  private getWindowSize(limitName: string): number {
    if (limitName.includes('Minute')) return 60000;
    if (limitName.includes('Hour')) return 3600000;
    if (limitName.includes('Day')) return 86400000;
    return 60000; // Default to 1 minute
  }

  private getLimiter(key: string, config: { maxRequests: number; windowSize: number; }): any {
    let limiter = this.limiters.get(key);
    
    if (!limiter) {
      // Use sliding window by default
      limiter = new SlidingWindowLimiter({
        windowSize: config.windowSize,
        maxRequests: config.maxRequests,
      });
      this.limiters.set(key, limiter);
    }

    return limiter;
  }

  private recordAnalytics(userId: string, allowed: boolean, limitedBy?: string): void {
    let analytics = this.analytics.get(userId);
    
    if (!analytics) {
      analytics = {
        totalRequests: 0,
        allowedRequests: 0,
        blockedRequests: 0,
        firstRequest: Date.now(),
        lastRequest: Date.now(),
        blockedByLimit: {},
      };
      this.analytics.set(userId, analytics);
    }

    analytics.totalRequests++;
    analytics.lastRequest = Date.now();

    if (allowed) {
      analytics.allowedRequests++;
    } else {
      analytics.blockedRequests++;
      if (limitedBy) {
        analytics.blockedByLimit[limitedBy] = (analytics.blockedByLimit[limitedBy] || 0) + 1;
      }
    }
  }

  getAnalytics(userId: string): AnalyticsData {
    return this.analytics.get(userId) || {
      totalRequests: 0,
      allowedRequests: 0,
      blockedRequests: 0,
      firstRequest: 0,
      lastRequest: 0,
      blockedByLimit: {},
    };
  }

  getGlobalStats(): GlobalStats {
    const stats: GlobalStats = {
      totalUsers: this.analytics.size,
      totalRequests: 0,
      totalBlocked: 0,
      averageRequestsPerUser: 0,
      topContexts: [],
    };

    for (const analytics of this.analytics.values()) {
      stats.totalRequests += analytics.totalRequests;
      stats.totalBlocked += analytics.blockedRequests;
    }

    stats.averageRequestsPerUser = stats.totalUsers > 0 ? stats.totalRequests / stats.totalUsers : 0;

    return stats;
  }

  getTopBlockedUsers(limit: number = 10): Array<{ userId: string; blockedRequests: number; totalRequests: number; }> {
    const users: Array<{ userId: string; blockedRequests: number; totalRequests: number; }> = [];

    for (const [userId, analytics] of this.analytics.entries()) {
      if (analytics.blockedRequests > 0) {
        users.push({
          userId,
          blockedRequests: analytics.blockedRequests,
          totalRequests: analytics.totalRequests,
        });
      }
    }

    return users
      .sort((a, b) => b.blockedRequests - a.blockedRequests)
      .slice(0, limit);
  }

  async cleanupAnalytics(): Promise<void> {
    const cutoff = Date.now() - this.config.analyticsRetention!;

    for (const [userId, analytics] of this.analytics.entries()) {
      if (analytics.lastRequest < cutoff) {
        this.analytics.delete(userId);
      }
    }
  }

  private startAnalyticsCleanup(): void {
    setInterval(() => {
      this.cleanupAnalytics();
    }, this.config.analyticsRetention! / 4); // Clean up every quarter of retention period
  }
}