/**
 * API Key Management and Rotation System
 * 
 * Provides secure API key management with automatic rotation,
 * access control, and audit logging for external service integrations.
 */

import crypto from 'crypto';
import { z } from 'zod';

export interface ApiKey {
  id: string;
  name: string;
  key: string;
  hashedKey: string;
  service: string;
  scope: string[];
  status: 'active' | 'expired' | 'revoked' | 'pending_rotation';
  createdAt: number;
  expiresAt?: number;
  lastUsed?: number;
  usageCount: number;
  rotationSchedule?: RotationSchedule;
  metadata: Record<string, any>;
}

export interface RotationSchedule {
  enabled: boolean;
  intervalDays: number;
  warningDays: number;
  lastRotation?: number;
  nextRotation?: number;
  autoRotate: boolean;
}

export interface KeyUsageLog {
  keyId: string;
  timestamp: number;
  service: string;
  operation: string;
  success: boolean;
  error?: string;
  metadata?: Record<string, any>;
}

export interface RotationEvent {
  keyId: string;
  oldKeyHash: string;
  newKeyHash: string;
  timestamp: number;
  trigger: 'manual' | 'scheduled' | 'security_breach' | 'expiration';
  success: boolean;
  error?: string;
}

/**
 * API Key Manager
 */
export class ApiKeyManager {
  private static instance: ApiKeyManager;
  private keys: Map<string, ApiKey> = new Map();
  private usageLogs: KeyUsageLog[] = [];
  private rotationEvents: RotationEvent[] = [];
  private rotationCallbacks: Map<string, (oldKey: string, newKey: string) => Promise<void>> = new Map();

  static getInstance(): ApiKeyManager {
    if (!ApiKeyManager.instance) {
      ApiKeyManager.instance = new ApiKeyManager();
      ApiKeyManager.instance.startRotationScheduler();
    }
    return ApiKeyManager.instance;
  }

  /**
   * Generate a new API key
   */
  async generateKey(config: {
    name: string;
    service: string;
    scope: string[];
    expirationDays?: number;
    rotationSchedule?: Partial<RotationSchedule>;
    metadata?: Record<string, any>;
  }): Promise<ApiKey> {
    const keyId = `key_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`;
    const rawKey = this.generateSecureKey();
    const hashedKey = this.hashKey(rawKey);

    const apiKey: ApiKey = {
      id: keyId,
      name: config.name,
      key: rawKey,
      hashedKey,
      service: config.service,
      scope: config.scope,
      status: 'active',
      createdAt: Date.now(),
      expiresAt: config.expirationDays 
        ? Date.now() + (config.expirationDays * 24 * 60 * 60 * 1000)
        : undefined,
      usageCount: 0,
      rotationSchedule: config.rotationSchedule ? {
        enabled: config.rotationSchedule.enabled ?? false,
        intervalDays: config.rotationSchedule.intervalDays ?? 90,
        warningDays: config.rotationSchedule.warningDays ?? 7,
        autoRotate: config.rotationSchedule.autoRotate ?? false,
        nextRotation: config.rotationSchedule.enabled 
          ? Date.now() + ((config.rotationSchedule.intervalDays ?? 90) * 24 * 60 * 60 * 1000)
          : undefined,
      } : undefined,
      metadata: config.metadata || {},
    };

    this.keys.set(keyId, apiKey);
    
    console.log(`Generated new API key: ${keyId} for service: ${config.service}`);
    return { ...apiKey, key: rawKey }; // Return with plain key only once
  }

  /**
   * Validate an API key
   */
  async validateKey(keyId: string, providedKey: string): Promise<{
    valid: boolean;
    key?: ApiKey;
    error?: string;
  }> {
    const key = this.keys.get(keyId);
    
    if (!key) {
      await this.logUsage(keyId, 'unknown', 'validation', false, 'Key not found');
      return { valid: false, error: 'Invalid key ID' };
    }

    // Check key status
    if (key.status !== 'active') {
      await this.logUsage(keyId, key.service, 'validation', false, `Key status: ${key.status}`);
      return { valid: false, error: `Key is ${key.status}` };
    }

    // Check expiration
    if (key.expiresAt && Date.now() > key.expiresAt) {
      key.status = 'expired';
      await this.logUsage(keyId, key.service, 'validation', false, 'Key expired');
      return { valid: false, error: 'Key expired' };
    }

    // Validate key hash
    const providedHash = this.hashKey(providedKey);
    if (providedHash !== key.hashedKey) {
      await this.logUsage(keyId, key.service, 'validation', false, 'Invalid key');
      return { valid: false, error: 'Invalid key' };
    }

    // Update usage
    key.lastUsed = Date.now();
    key.usageCount++;
    
    await this.logUsage(keyId, key.service, 'validation', true);
    return { valid: true, key };
  }

  /**
   * Rotate an API key
   */
  async rotateKey(keyId: string, trigger: RotationEvent['trigger'] = 'manual'): Promise<{
    success: boolean;
    newKey?: string;
    error?: string;
  }> {
    const existingKey = this.keys.get(keyId);
    if (!existingKey) {
      return { success: false, error: 'Key not found' };
    }

    const oldKeyHash = existingKey.hashedKey;
    
    try {
      // Generate new key
      const newRawKey = this.generateSecureKey();
      const newHashedKey = this.hashKey(newRawKey);

      // Update key
      existingKey.key = newRawKey;
      existingKey.hashedKey = newHashedKey;
      existingKey.status = 'active';
      
      if (existingKey.rotationSchedule) {
        existingKey.rotationSchedule.lastRotation = Date.now();
        existingKey.rotationSchedule.nextRotation = existingKey.rotationSchedule.enabled
          ? Date.now() + (existingKey.rotationSchedule.intervalDays * 24 * 60 * 60 * 1000)
          : undefined;
      }

      // Execute callback if registered
      const callback = this.rotationCallbacks.get(keyId);
      if (callback) {
        await callback(oldKeyHash, newRawKey);
      }

      // Log rotation event
      this.rotationEvents.push({
        keyId,
        oldKeyHash,
        newKeyHash: newHashedKey,
        timestamp: Date.now(),
        trigger,
        success: true,
      });

      console.log(`Rotated API key: ${keyId} (trigger: ${trigger})`);
      return { success: true, newKey: newRawKey };

    } catch (error) {
      this.rotationEvents.push({
        keyId,
        oldKeyHash,
        newKeyHash: '',
        timestamp: Date.now(),
        trigger,
        success: false,
        error: error.message,
      });

      console.error(`Failed to rotate API key ${keyId}:`, error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Revoke an API key
   */
  async revokeKey(keyId: string, reason?: string): Promise<boolean> {
    const key = this.keys.get(keyId);
    if (!key) {
      return false;
    }

    key.status = 'revoked';
    key.metadata.revokedAt = Date.now();
    key.metadata.revocationReason = reason;

    await this.logUsage(keyId, key.service, 'revocation', true, reason);
    console.log(`Revoked API key: ${keyId}${reason ? ` (${reason})` : ''}`);
    return true;
  }

  /**
   * List API keys
   */
  listKeys(filters?: {
    service?: string;
    status?: ApiKey['status'];
    scope?: string;
  }): ApiKey[] {
    let keys = Array.from(this.keys.values());

    if (filters) {
      if (filters.service) {
        keys = keys.filter(k => k.service === filters.service);
      }
      if (filters.status) {
        keys = keys.filter(k => k.status === filters.status);
      }
      if (filters.scope) {
        keys = keys.filter(k => k.scope.includes(filters.scope));
      }
    }

    // Remove sensitive key data
    return keys.map(k => ({ ...k, key: '[REDACTED]' }));
  }

  /**
   * Get key usage statistics
   */
  getKeyStats(keyId: string): {
    key: ApiKey;
    recentUsage: KeyUsageLog[];
    successRate: number;
    averageUsagePerDay: number;
  } | null {
    const key = this.keys.get(keyId);
    if (!key) return null;

    const recentUsage = this.usageLogs
      .filter(log => log.keyId === keyId)
      .slice(-100); // Last 100 uses

    const successful = recentUsage.filter(log => log.success).length;
    const successRate = recentUsage.length > 0 ? successful / recentUsage.length : 0;

    const daysSinceCreation = (Date.now() - key.createdAt) / (1000 * 60 * 60 * 24);
    const averageUsagePerDay = daysSinceCreation > 0 ? key.usageCount / daysSinceCreation : 0;

    return {
      key: { ...key, key: '[REDACTED]' },
      recentUsage,
      successRate,
      averageUsagePerDay,
    };
  }

  /**
   * Register rotation callback
   */
  onRotation(keyId: string, callback: (oldKey: string, newKey: string) => Promise<void>): void {
    this.rotationCallbacks.set(keyId, callback);
  }

  /**
   * Check keys that need rotation
   */
  getKeysNeedingRotation(): ApiKey[] {
    const now = Date.now();
    return Array.from(this.keys.values()).filter(key => {
      if (!key.rotationSchedule?.enabled || !key.rotationSchedule.nextRotation) {
        return false;
      }
      return now >= key.rotationSchedule.nextRotation;
    });
  }

  /**
   * Get keys nearing expiration
   */
  getKeysNearingExpiration(warningDays: number = 7): ApiKey[] {
    const warningTime = Date.now() + (warningDays * 24 * 60 * 60 * 1000);
    return Array.from(this.keys.values()).filter(key => {
      if (!key.expiresAt) return false;
      return key.expiresAt <= warningTime && key.status === 'active';
    });
  }

  /**
   * Generate secure random key
   */
  private generateSecureKey(): string {
    return crypto.randomBytes(32).toString('base64url');
  }

  /**
   * Hash key for storage
   */
  private hashKey(key: string): string {
    return crypto.createHash('sha256').update(key).digest('hex');
  }

  /**
   * Log key usage
   */
  private async logUsage(
    keyId: string,
    service: string,
    operation: string,
    success: boolean,
    error?: string,
    metadata?: Record<string, any>
  ): Promise<void> {
    const log: KeyUsageLog = {
      keyId,
      timestamp: Date.now(),
      service,
      operation,
      success,
      error,
      metadata,
    };

    this.usageLogs.push(log);

    // Keep only recent logs (last 10000)
    if (this.usageLogs.length > 10000) {
      this.usageLogs = this.usageLogs.slice(-5000);
    }
  }

  /**
   * Start automatic rotation scheduler
   */
  private startRotationScheduler(): void {
    // Check for rotations every hour
    setInterval(async () => {
      const keysNeedingRotation = this.getKeysNeedingRotation()
        .filter(key => key.rotationSchedule?.autoRotate);

      for (const key of keysNeedingRotation) {
        console.log(`Auto-rotating key: ${key.id}`);
        await this.rotateKey(key.id, 'scheduled');
      }

      // Log warning for keys nearing expiration
      const nearingExpiration = this.getKeysNearingExpiration();
      if (nearingExpiration.length > 0) {
        console.warn(`${nearingExpiration.length} API keys are nearing expiration`);
      }

    }, 60 * 60 * 1000); // 1 hour
  }
}

/**
 * Service-specific API key managers
 */
export class ServiceApiKeyManager {
  constructor(
    private keyManager: ApiKeyManager,
    private serviceName: string
  ) {}

  /**
   * Get API key for service
   */
  async getServiceKey(scope: string = 'default'): Promise<string | null> {
    const keys = this.keyManager.listKeys({
      service: this.serviceName,
      status: 'active',
      scope,
    });

    if (keys.length === 0) {
      console.warn(`No active API keys found for service: ${this.serviceName}`);
      return null;
    }

    // Get the most recently used key
    const key = keys.sort((a, b) => (b.lastUsed || 0) - (a.lastUsed || 0))[0];
    const fullKey = this.keyManager['keys'].get(key.id);
    
    return fullKey?.key || null;
  }

  /**
   * Rotate service keys
   */
  async rotateServiceKeys(): Promise<{ rotated: number; failed: number }> {
    const keys = this.keyManager.listKeys({
      service: this.serviceName,
      status: 'active',
    });

    let rotated = 0;
    let failed = 0;

    for (const key of keys) {
      const result = await this.keyManager.rotateKey(key.id, 'manual');
      if (result.success) {
        rotated++;
      } else {
        failed++;
      }
    }

    return { rotated, failed };
  }
}

/**
 * Environment-based API key provider
 */
export class EnvironmentKeyProvider {
  private keyManager: ApiKeyManager;

  constructor() {
    this.keyManager = ApiKeyManager.getInstance();
  }

  /**
   * Initialize API keys from environment variables
   */
  async initializeFromEnvironment(): Promise<void> {
    const keyConfigs = [
      {
        name: 'Google Generative AI',
        service: 'google',
        envVar: 'GOOGLE_GENERATIVE_AI_API_KEY',
        scope: ['embeddings', 'generation'],
      },
      {
        name: 'Groq API',
        service: 'groq',
        envVar: 'GROQ_API_KEY',
        scope: ['generation', 'fast-inference'],
      },
      {
        name: 'OpenAI API',
        service: 'openai',
        envVar: 'OPENAI_API_KEY',
        scope: ['generation', 'embeddings'],
      },
      {
        name: 'Anthropic API',
        service: 'anthropic',
        envVar: 'ANTHROPIC_API_KEY',
        scope: ['generation'],
      },
    ];

    for (const config of keyConfigs) {
      const envKey = process.env[config.envVar];
      if (envKey) {
        // Check if key already exists
        const existing = this.keyManager.listKeys({
          service: config.service,
          status: 'active',
        });

        if (existing.length === 0) {
          await this.keyManager.generateKey({
            name: config.name,
            service: config.service,
            scope: config.scope,
            rotationSchedule: {
              enabled: true,
              intervalDays: 90,
              warningDays: 7,
              autoRotate: false, // Manual rotation for external keys
            },
            metadata: {
              source: 'environment',
              envVar: config.envVar,
            },
          });

          console.log(`Initialized API key for ${config.service} from environment`);
        }
      }
    }
  }

  /**
   * Get service managers for each configured service
   */
  getServiceManagers(): Record<string, ServiceApiKeyManager> {
    return {
      google: new ServiceApiKeyManager(this.keyManager, 'google'),
      groq: new ServiceApiKeyManager(this.keyManager, 'groq'),
      openai: new ServiceApiKeyManager(this.keyManager, 'openai'),
      anthropic: new ServiceApiKeyManager(this.keyManager, 'anthropic'),
    };
  }
}

// Global instances
export const apiKeyManager = ApiKeyManager.getInstance();
export const environmentKeyProvider = new EnvironmentKeyProvider();

// Service-specific managers
export const serviceManagers = environmentKeyProvider.getServiceManagers();

// Auto-initialize from environment
environmentKeyProvider.initializeFromEnvironment().catch(console.error);