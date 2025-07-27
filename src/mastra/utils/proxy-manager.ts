/**
 * Patient Content Factory - Proxy Manager
 * 
 * Intelligent API key rotation and quota management for maximizing 
 * free tier usage over extended periods (hours/days).
 */

import fs from 'fs/promises';
import path from 'path';

export interface APIKey {
  id: string;
  key: string;
  limits: {
    requests_per_minute: number;
    requests_per_day: number;
    tokens_per_minute: number;
    tokens_per_day: number;
  };
  usage_today: {
    requests: number;
    tokens: number;
    last_reset: string;
    last_request_time: string | null;
  };
  last_used: string | null;
  status: 'active' | 'exhausted' | 'suspended';
}

export interface ProxyConfig {
  providers: {
    [provider: string]: {
      keys: APIKey[];
      rotation_strategy: 'round_robin' | 'least_used' | 'random';
      patient_mode: boolean;
      retry_policy: {
        base_delay_ms: number;
        max_delay_ms: number;
        exponential_factor: number;
        jitter_factor: number;
        max_retries: number;
      };
    };
  };
  global_settings: {
    patient_mode: boolean;
    max_workflow_duration_hours: number;
    suspend_on_all_keys_exhausted: boolean;
    resume_check_interval_minutes: number;
    daily_quota_reset_hour: number;
    rate_limit_buffer_percentage: number;
  };
  metadata: {
    version: string;
    created: string;
    description: string;
    last_updated: string;
  };
}

export interface QuotaStatus {
  available_keys: number;
  exhausted_keys: number;
  next_reset_time: Date;
  estimated_quota_remaining: number;
  recommended_action: 'continue' | 'slow_down' | 'suspend_until_reset';
}

export interface RateLimitError extends Error {
  code: 'RATE_LIMIT_EXCEEDED';
  provider: string;
  key_id: string;
  retry_after_ms: number;
  quota_reset_time: Date;
}

/**
 * Patient Content Factory Proxy Manager
 * 
 * Core class for managing API keys with a focus on maximizing free tier usage
 * through intelligent rotation, quota tracking, and patient execution patterns.
 */
export class ProxyManager {
  private config: ProxyConfig;
  private configPath: string;
  private currentKeyIndex: Map<string, number> = new Map();

  constructor(configPath: string = './proxies.json') {
    // Try multiple possible locations for the config file
    this.configPath = this.findConfigPath(configPath);
  }

  /**
   * Find the config file in multiple possible locations
   */
  private findConfigPath(initialPath: string): string {
    const possiblePaths = [
      // Original provided path
      path.resolve(initialPath),
      // Project root (two levels up from bundled output)
      path.resolve(process.cwd(), 'proxies.json'),
      path.resolve(process.cwd(), '../../proxies.json'),
      // Relative to current working directory
      path.resolve('./proxies.json'),
      path.resolve('../proxies.json'),
      path.resolve('../../proxies.json'),
      // Absolute project paths (fallback)
      '/home/jit/tensorzero-content-company/proxies.json'
    ];

    // Return the first path that might exist (we'll verify in initialize)
    return possiblePaths[0];
  }

  /**
   * Initialize the proxy manager by loading configuration
   */
  async initialize(): Promise<void> {
    // Try multiple possible locations for proxies.json
    const possiblePaths = [
      // Project root (two levels up from bundled output)
      path.resolve(process.cwd(), 'proxies.json'),
      path.resolve(process.cwd(), '../../proxies.json'),
      // Relative to current working directory  
      path.resolve('./proxies.json'),
      path.resolve('../proxies.json'),
      path.resolve('../../proxies.json'),
      // Original configured path
      this.configPath,
      // Absolute project paths (fallback)
      '/home/jit/tensorzero-content-company/proxies.json'
    ];

    let configContent: string;
    let foundPath: string | null = null;

    for (const tryPath of possiblePaths) {
      try {
        configContent = await fs.readFile(tryPath, 'utf-8');
        foundPath = tryPath;
        this.configPath = tryPath; // Update to successful path
        break;
      } catch (error) {
        // Continue to next path
        continue;
      }
    }

    if (!foundPath) {
      throw new Error(`Could not find proxies.json in any of these locations:\n${possiblePaths.join('\n')}\nWorking directory: ${process.cwd()}`);
    }

    try {
      this.config = JSON.parse(configContent!);
      
      // Reset daily quotas if needed
      await this.checkAndResetDailyQuotas();
      
      console.log('🔧 Proxy Manager initialized with patient mode settings');
      console.log(`📂 Config loaded from: ${foundPath}`);
      console.log(`📊 Loaded ${this.getTotalActiveKeys()} active API keys`);
    } catch (error) {
      throw new Error(`Failed to parse proxies.json from ${foundPath}: ${error}`);
    }
  }

  /**
   * Get the next available API key for a provider using intelligent rotation
   */
  async getNextKey(provider: string): Promise<{ key: APIKey; estimated_wait_time_ms: number }> {
    const providerConfig = this.config.providers[provider];
    if (!providerConfig) {
      throw new Error(`Provider ${provider} not found in configuration`);
    }

    // Get all available keys (let the API decide if they work)
    const availableKeys = providerConfig.keys;

    if (availableKeys.length === 0) {
      throw new Error(`No API keys configured for provider ${provider}`);
    }

    // Select key based on rotation strategy
    const selectedKey = this.selectKeyByStrategy(provider, availableKeys);
    
    // Let the actual API call determine if there are quota issues
    return { key: selectedKey, estimated_wait_time_ms: 0 };
  }

  /**
   * Record API usage for a key and update quotas
   */
  async recordUsage(
    provider: string, 
    keyId: string, 
    tokens: number = 0,
    success: boolean = true
  ): Promise<void> {
    const providerConfig = this.config.providers[provider];
    const key = providerConfig.keys.find(k => k.id === keyId);
    
    if (!key) {
      throw new Error(`Key ${keyId} not found for provider ${provider}`);
    }

    // Update usage statistics only
    key.usage_today.requests += 1;
    key.usage_today.tokens += tokens;
    key.usage_today.last_request_time = new Date().toISOString();
    key.last_used = new Date().toISOString();

    // Only mark as successful - let API errors determine exhaustion
    if (success) {
      key.status = 'active';
    }

    // Persist changes
    await this.saveConfig();
  }

  /**
   * Handle rate limit errors with intelligent retry logic
   */
  async handleRateLimit(
    error: RateLimitError,
    attempt: number,
    maxAttempts: number
  ): Promise<{ should_retry: boolean; delay_ms: number; switch_key: boolean }> {
    const provider = error.provider;
    const providerConfig = this.config.providers[provider];
    
    // Mark current key as temporarily exhausted
    const currentKey = providerConfig.keys.find(k => k.id === error.key_id);
    if (currentKey) {
      currentKey.status = 'exhausted';
      await this.saveConfig();
    }

    // Check if we have other available keys
    const availableKeys = providerConfig.keys.filter(k => 
      k.status === 'active' && k.id !== error.key_id
    );

    if (availableKeys.length > 0) {
      // Switch to next key immediately
      return {
        should_retry: true,
        delay_ms: 1000, // Small delay for key switching
        switch_key: true
      };
    }

    // All keys exhausted - calculate patient delay
    if (attempt < maxAttempts && providerConfig.patient_mode) {
      const delay = this.calculatePatientDelay(attempt, error.retry_after_ms);
      
      return {
        should_retry: true,
        delay_ms: delay,
        switch_key: false
      };
    }

    return {
      should_retry: false,
      delay_ms: 0,
      switch_key: false
    };
  }

  /**
   * Get current quota status across all providers
   */
  async getQuotaStatus(): Promise<Map<string, QuotaStatus>> {
    const status = new Map<string, QuotaStatus>();

    for (const [provider, config] of Object.entries(this.config.providers)) {
      const availableKeys = config.keys.filter(k => 
        k.status === 'active' && this.isKeyWithinLimits(k)
      );
      
      const exhaustedKeys = config.keys.filter(k => k.status === 'exhausted');
      
      const totalRemainingRequests = availableKeys.reduce((sum, key) => 
        sum + (key.limits.requests_per_day - key.usage_today.requests), 0
      );

      status.set(provider, {
        available_keys: availableKeys.length,
        exhausted_keys: exhaustedKeys.length,
        next_reset_time: this.getNextQuotaResetTime(),
        estimated_quota_remaining: totalRemainingRequests,
        recommended_action: this.getRecommendedAction(availableKeys.length, totalRemainingRequests)
      });
    }

    return status;
  }

  /**
   * Check if all keys are exhausted (triggers workflow suspension)
   */
  async areAllKeysExhausted(provider: string): Promise<boolean> {
    const providerConfig = this.config.providers[provider];
    const availableKeys = providerConfig.keys.filter(k => 
      k.status === 'active' && this.isKeyWithinLimits(k)
    );
    
    return availableKeys.length === 0;
  }

  /**
   * Calculate time until next quota reset
   */
  getTimeUntilQuotaReset(): number {
    const now = new Date();
    const nextReset = this.getNextQuotaResetTime();
    return nextReset.getTime() - now.getTime();
  }

  // Private helper methods

  private async checkAndResetDailyQuotas(): Promise<void> {
    const today = new Date().toISOString().split('T')[0];
    let configChanged = false;

    for (const providerConfig of Object.values(this.config.providers)) {
      for (const key of providerConfig.keys) {
        if (key.usage_today.last_reset !== today) {
          // Reset daily usage
          key.usage_today.requests = 0;
          key.usage_today.tokens = 0;
          key.usage_today.last_reset = today;
          key.status = 'active';
          configChanged = true;
          
          console.log(`🔄 Reset daily quota for key ${key.id}`);
        }
      }
    }

    if (configChanged) {
      await this.saveConfig();
    }
  }

  private isKeyWithinLimits(key: APIKey): boolean {
    const bufferPercentage = this.config.global_settings.rate_limit_buffer_percentage;
    
    // Check daily limits with buffer
    const dailyRequestLimit = key.limits.requests_per_day * (1 - bufferPercentage);
    const dailyTokenLimit = key.limits.tokens_per_day * (1 - bufferPercentage);
    
    if (key.usage_today.requests >= dailyRequestLimit) return false;
    if (key.usage_today.tokens >= dailyTokenLimit) return false;

    // Check minute-based rate limiting
    if (key.usage_today.last_request_time) {
      const lastRequest = new Date(key.usage_today.last_request_time);
      const timeSinceLastRequest = Date.now() - lastRequest.getTime();
      const minInterval = (60 * 1000) / key.limits.requests_per_minute;
      
      if (timeSinceLastRequest < minInterval) {
        return false;
      }
    }

    return true;
  }

  private selectKeyByStrategy(provider: string, availableKeys: APIKey[]): APIKey {
    const strategy = this.config.providers[provider].rotation_strategy;
    
    switch (strategy) {
      case 'round_robin':
        const currentIndex = this.currentKeyIndex.get(provider) || 0;
        const selectedKey = availableKeys[currentIndex % availableKeys.length];
        this.currentKeyIndex.set(provider, (currentIndex + 1) % availableKeys.length);
        return selectedKey;

      case 'least_used':
        return availableKeys.reduce((least, current) => 
          current.usage_today.requests < least.usage_today.requests ? current : least
        );

      case 'random':
        return availableKeys[Math.floor(Math.random() * availableKeys.length)];

      default:
        return availableKeys[0];
    }
  }

  private calculateKeyWaitTime(key: APIKey): number {
    if (!key.usage_today.last_request_time) return 0;

    const lastRequest = new Date(key.usage_today.last_request_time);
    const timeSinceLastRequest = Date.now() - lastRequest.getTime();
    const minInterval = (60 * 1000) / key.limits.requests_per_minute;
    
    return Math.max(0, minInterval - timeSinceLastRequest);
  }

  private calculatePatientDelay(attempt: number, retryAfterMs: number): number {
    const baseDelay = Math.max(retryAfterMs, 60000); // At least 1 minute
    const exponentialDelay = baseDelay * Math.pow(2, attempt);
    const jitter = 1 + (Math.random() - 0.5) * 0.2; // ±10% jitter
    
    return Math.min(exponentialDelay * jitter, 86400000); // Max 24 hours
  }

  private getNextQuotaResetTime(): Date {
    const now = new Date();
    const resetHour = this.config.global_settings.daily_quota_reset_hour;
    
    const nextReset = new Date(now);
    nextReset.setHours(resetHour, 0, 0, 0);
    
    // If reset time has passed today, move to next day
    if (nextReset <= now) {
      nextReset.setDate(nextReset.getDate() + 1);
    }
    
    return nextReset;
  }

  private getRecommendedAction(
    availableKeys: number, 
    remainingRequests: number
  ): 'continue' | 'slow_down' | 'suspend_until_reset' {
    if (availableKeys === 0) return 'suspend_until_reset';
    if (remainingRequests < 10) return 'slow_down';
    return 'continue';
  }

  private getTotalActiveKeys(): number {
    return Object.values(this.config.providers)
      .reduce((total, provider) => 
        total + provider.keys.filter(k => k.status === 'active').length, 0
      );
  }

  private createRateLimitError(
    provider: string,
    keyId: string,
    retryAfterMs: number,
    quotaResetTime: Date
  ): RateLimitError {
    const error = new Error(`Rate limit exceeded for ${provider} key ${keyId}`) as RateLimitError;
    error.code = 'RATE_LIMIT_EXCEEDED';
    error.provider = provider;
    error.key_id = keyId;
    error.retry_after_ms = retryAfterMs;
    error.quota_reset_time = quotaResetTime;
    return error;
  }

  private async saveConfig(): Promise<void> {
    this.config.metadata.last_updated = new Date().toISOString().split('T')[0];
    
    await fs.writeFile(
      this.configPath, 
      JSON.stringify(this.config, null, 2),
      'utf-8'
    );
  }
}

/**
 * Utility function to create a patient delay with jitter
 */
export function createPatientDelay(baseDelayMs: number, jitterFactor: number = 0.1): number {
  const jitter = 1 + (Math.random() - 0.5) * jitterFactor;
  return Math.floor(baseDelayMs * jitter);
}

/**
 * Check if an error is a rate limit error
 */
export function isRateLimitError(error: any): boolean {
  // Check for Google GenAI API specific errors
  if (error?.status === 429) return true; // Rate limit exceeded
  if (error?.status === 403) return true; // Quota exceeded 
  
  // Check error message patterns from actual API responses
  const message = error?.message?.toLowerCase() || '';
  if (message.includes('quota exceeded')) return true;
  if (message.includes('rate limit exceeded')) return true;
  if (message.includes('resource_exhausted')) return true;
  
  return false;
}

/**
 * Parse rate limit information from API error responses
 */
export function parseRateLimitInfo(error: any): { retryAfterMs: number; isRateLimit: boolean } {
  if (error?.headers?.['retry-after']) {
    return {
      isRateLimit: true,
      retryAfterMs: parseInt(error.headers['retry-after']) * 1000
    };
  }

  if (error?.message?.includes('rate limit')) {
    return {
      isRateLimit: true,
      retryAfterMs: 60000 // Default 1 minute
    };
  }

  return {
    isRateLimit: false,
    retryAfterMs: 0
  };
}