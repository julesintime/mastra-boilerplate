/**
 * RAG Document Caching System
 * 
 * Implements intelligent caching for frequently accessed documents
 * to improve retrieval performance and reduce embedding API calls.
 */

import { RETRIEVAL_CONFIG } from './config';

export interface CachedDocument {
  id: string;
  text: string;
  metadata: Record<string, any>;
  embedding: number[];
  score?: number;
  timestamp: number;
  accessCount: number;
  lastAccessed: number;
}

export interface CacheStats {
  totalEntries: number;
  hitRate: number;
  totalRequests: number;
  totalHits: number;
  totalMisses: number;
  memoryUsage: number; // in MB
  oldestEntry: number;
  newestEntry: number;
}

export interface CacheConfig {
  maxSize: number;
  ttlSeconds: number;
  enabled: boolean;
  evictionPolicy: 'lru' | 'lfu' | 'ttl';
  preloadFrequent: boolean;
}

/**
 * Intelligent Document Cache with multiple eviction strategies
 */
export class DocumentCache {
  private cache: Map<string, CachedDocument> = new Map();
  private accessOrder: string[] = []; // For LRU tracking
  private config: CacheConfig;
  private stats = {
    totalRequests: 0,
    totalHits: 0,
    totalMisses: 0,
  };

  constructor(config: Partial<CacheConfig> = {}) {
    this.config = {
      maxSize: config.maxSize || parseInt(process.env.RAG_CACHE_MAX_SIZE || '1000'),
      ttlSeconds: config.ttlSeconds || parseInt(process.env.RAG_CACHE_TTL || '3600'),
      enabled: config.enabled ?? (process.env.RAG_CACHING_ENABLED === 'true'),
      evictionPolicy: (config.evictionPolicy as 'lru' | 'lfu' | 'ttl') || 'lru',
      preloadFrequent: config.preloadFrequent ?? true,
    };

    // Auto-cleanup every 5 minutes
    if (this.config.enabled) {
      setInterval(() => this.cleanup(), 5 * 60 * 1000);
    }
  }

  /**
   * Get document from cache
   */
  get(key: string): CachedDocument | null {
    this.stats.totalRequests++;

    if (!this.config.enabled) {
      this.stats.totalMisses++;
      return null;
    }

    const document = this.cache.get(key);
    
    if (!document) {
      this.stats.totalMisses++;
      return null;
    }

    // Check TTL
    const now = Date.now();
    if (now - document.timestamp > this.config.ttlSeconds * 1000) {
      this.cache.delete(key);
      this.removeFromAccessOrder(key);
      this.stats.totalMisses++;
      return null;
    }

    // Update access tracking
    document.accessCount++;
    document.lastAccessed = now;
    this.updateAccessOrder(key);
    
    this.stats.totalHits++;
    return { ...document }; // Return copy to prevent mutation
  }

  /**
   * Store document in cache
   */
  set(key: string, document: Omit<CachedDocument, 'timestamp' | 'accessCount' | 'lastAccessed'>): void {
    if (!this.config.enabled) {
      return;
    }

    const now = Date.now();
    const cachedDoc: CachedDocument = {
      ...document,
      timestamp: now,
      accessCount: 1,
      lastAccessed: now,
    };

    // Check if we need to evict
    if (this.cache.size >= this.config.maxSize && !this.cache.has(key)) {
      this.evict();
    }

    this.cache.set(key, cachedDoc);
    this.updateAccessOrder(key);
  }

  /**
   * Store multiple documents (batch operation)
   */
  setMany(documents: Array<{ key: string; document: Omit<CachedDocument, 'timestamp' | 'accessCount' | 'lastAccessed'> }>): void {
    if (!this.config.enabled) {
      return;
    }

    const now = Date.now();
    
    for (const { key, document } of documents) {
      const cachedDoc: CachedDocument = {
        ...document,
        timestamp: now,
        accessCount: 1,
        lastAccessed: now,
      };

      // Check if we need to evict
      if (this.cache.size >= this.config.maxSize && !this.cache.has(key)) {
        this.evict();
      }

      this.cache.set(key, cachedDoc);
      this.updateAccessOrder(key);
    }
  }

  /**
   * Check if key exists in cache (without updating access stats)
   */
  has(key: string): boolean {
    if (!this.config.enabled) {
      return false;
    }

    const document = this.cache.get(key);
    if (!document) {
      return false;
    }

    // Check TTL
    const now = Date.now();
    if (now - document.timestamp > this.config.ttlSeconds * 1000) {
      this.cache.delete(key);
      this.removeFromAccessOrder(key);
      return false;
    }

    return true;
  }

  /**
   * Get multiple documents from cache
   */
  getMany(keys: string[]): Map<string, CachedDocument> {
    const results = new Map<string, CachedDocument>();
    
    for (const key of keys) {
      const doc = this.get(key);
      if (doc) {
        results.set(key, doc);
      }
    }

    return results;
  }

  /**
   * Invalidate specific cache entry
   */
  invalidate(key: string): boolean {
    if (!this.config.enabled) {
      return false;
    }

    const existed = this.cache.delete(key);
    if (existed) {
      this.removeFromAccessOrder(key);
    }
    return existed;
  }

  /**
   * Clear entire cache
   */
  clear(): void {
    this.cache.clear();
    this.accessOrder = [];
    this.stats = {
      totalRequests: 0,
      totalHits: 0,
      totalMisses: 0,
    };
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    const memoryUsage = this.estimateMemoryUsage();
    const entries = Array.from(this.cache.values());
    
    return {
      totalEntries: this.cache.size,
      hitRate: this.stats.totalRequests > 0 ? this.stats.totalHits / this.stats.totalRequests : 0,
      totalRequests: this.stats.totalRequests,
      totalHits: this.stats.totalHits,
      totalMisses: this.stats.totalMisses,
      memoryUsage,
      oldestEntry: entries.length > 0 ? Math.min(...entries.map(e => e.timestamp)) : 0,
      newestEntry: entries.length > 0 ? Math.max(...entries.map(e => e.timestamp)) : 0,
    };
  }

  /**
   * Get frequently accessed documents
   */
  getFrequentlyAccessed(limit: number = 10): Array<{ key: string; accessCount: number; lastAccessed: number }> {
    const entries = Array.from(this.cache.entries())
      .map(([key, doc]) => ({
        key,
        accessCount: doc.accessCount,
        lastAccessed: doc.lastAccessed,
      }))
      .sort((a, b) => b.accessCount - a.accessCount);

    return entries.slice(0, limit);
  }

  /**
   * Preload frequently accessed documents
   */
  async preloadFrequent(
    loader: (keys: string[]) => Promise<Array<{ key: string; document: Omit<CachedDocument, 'timestamp' | 'accessCount' | 'lastAccessed'> }>>
  ): Promise<void> {
    if (!this.config.enabled || !this.config.preloadFrequent) {
      return;
    }

    // This would typically load from analytics or usage logs
    // For now, we'll implement a basic placeholder
    console.log('📦 Preloading frequently accessed documents...');
    
    try {
      // In a real implementation, you'd query for most accessed documents
      const frequentKeys = this.getFrequentlyAccessed(50).map(item => item.key);
      
      if (frequentKeys.length > 0) {
        const documents = await loader(frequentKeys);
        this.setMany(documents);
        console.log(`✅ Preloaded ${documents.length} frequently accessed documents`);
      }
    } catch (error) {
      console.error('❌ Failed to preload documents:', error);
    }
  }

  /**
   * Cleanup expired entries
   */
  private cleanup(): void {
    if (!this.config.enabled) {
      return;
    }

    const now = Date.now();
    const expired: string[] = [];

    for (const [key, document] of this.cache.entries()) {
      if (now - document.timestamp > this.config.ttlSeconds * 1000) {
        expired.push(key);
      }
    }

    for (const key of expired) {
      this.cache.delete(key);
      this.removeFromAccessOrder(key);
    }

    if (expired.length > 0) {
      console.log(`🧹 Cleaned up ${expired.length} expired cache entries`);
    }
  }

  /**
   * Evict least valuable entry based on configured policy
   */
  private evict(): void {
    if (this.cache.size === 0) {
      return;
    }

    let keyToEvict: string;

    switch (this.config.evictionPolicy) {
      case 'lru':
        keyToEvict = this.accessOrder[0]; // Least recently used
        break;
      
      case 'lfu':
        // Least frequently used
        let minAccessCount = Infinity;
        keyToEvict = '';
        for (const [key, doc] of this.cache.entries()) {
          if (doc.accessCount < minAccessCount) {
            minAccessCount = doc.accessCount;
            keyToEvict = key;
          }
        }
        break;
      
      case 'ttl':
        // Oldest entry
        let oldestTimestamp = Infinity;
        keyToEvict = '';
        for (const [key, doc] of this.cache.entries()) {
          if (doc.timestamp < oldestTimestamp) {
            oldestTimestamp = doc.timestamp;
            keyToEvict = key;
          }
        }
        break;
      
      default:
        keyToEvict = this.accessOrder[0];
    }

    if (keyToEvict) {
      this.cache.delete(keyToEvict);
      this.removeFromAccessOrder(keyToEvict);
    }
  }

  /**
   * Update access order for LRU tracking
   */
  private updateAccessOrder(key: string): void {
    // Remove from current position
    this.removeFromAccessOrder(key);
    // Add to end (most recently used)
    this.accessOrder.push(key);
  }

  /**
   * Remove key from access order tracking
   */
  private removeFromAccessOrder(key: string): void {
    const index = this.accessOrder.indexOf(key);
    if (index !== -1) {
      this.accessOrder.splice(index, 1);
    }
  }

  /**
   * Estimate memory usage in MB
   */
  private estimateMemoryUsage(): number {
    let totalSize = 0;
    
    for (const doc of this.cache.values()) {
      // Rough estimation: text length + embedding array + metadata
      totalSize += doc.text.length * 2; // UTF-16 encoding
      totalSize += doc.embedding.length * 8; // 64-bit floats
      totalSize += JSON.stringify(doc.metadata).length * 2;
      totalSize += 200; // Overhead for object structure
    }

    return totalSize / (1024 * 1024); // Convert to MB
  }
}

/**
 * Query Result Cache - specialized for RAG query results
 */
export class QueryResultCache {
  private cache: Map<string, {
    results: any[];
    timestamp: number;
    queryTime: number;
    accessCount: number;
  }> = new Map();
  
  private config: CacheConfig;

  constructor(config: Partial<CacheConfig> = {}) {
    this.config = {
      maxSize: config.maxSize || 500, // Smaller cache for query results
      ttlSeconds: config.ttlSeconds || 1800, // 30 minutes default
      enabled: config.enabled ?? (process.env.RAG_CACHING_ENABLED === 'true'),
      evictionPolicy: 'lru',
      preloadFrequent: false,
    };
  }

  /**
   * Generate cache key from query parameters
   */
  generateKey(query: string, options: Record<string, any> = {}): string {
    const normalized = {
      query: query.toLowerCase().trim(),
      ...options,
    };
    return Buffer.from(JSON.stringify(normalized)).toString('base64');
  }

  /**
   * Get cached query results
   */
  get(key: string): any[] | null {
    if (!this.config.enabled) {
      return null;
    }

    const cached = this.cache.get(key);
    if (!cached) {
      return null;
    }

    // Check TTL
    const now = Date.now();
    if (now - cached.timestamp > this.config.ttlSeconds * 1000) {
      this.cache.delete(key);
      return null;
    }

    cached.accessCount++;
    return cached.results;
  }

  /**
   * Cache query results
   */
  set(key: string, results: any[], queryTime: number): void {
    if (!this.config.enabled) {
      return;
    }

    // Evict if necessary
    if (this.cache.size >= this.config.maxSize && !this.cache.has(key)) {
      const oldestKey = Array.from(this.cache.entries())
        .sort(([, a], [, b]) => a.timestamp - b.timestamp)[0][0];
      this.cache.delete(oldestKey);
    }

    this.cache.set(key, {
      results,
      timestamp: Date.now(),
      queryTime,
      accessCount: 1,
    });
  }

  /**
   * Clear query cache
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Get cache statistics
   */
  getStats(): {
    size: number;
    averageQueryTime: number;
    totalAccessCount: number;
  } {
    const entries = Array.from(this.cache.values());
    
    return {
      size: this.cache.size,
      averageQueryTime: entries.length > 0 
        ? entries.reduce((sum, entry) => sum + entry.queryTime, 0) / entries.length 
        : 0,
      totalAccessCount: entries.reduce((sum, entry) => sum + entry.accessCount, 0),
    };
  }
}

// Global cache instances
export const documentCache = new DocumentCache({
  maxSize: parseInt(process.env.RAG_CACHE_MAX_SIZE || '1000'),
  ttlSeconds: parseInt(process.env.RAG_CACHE_TTL || '3600'),
  enabled: process.env.RAG_CACHING_ENABLED === 'true',
  evictionPolicy: 'lru',
});

export const queryResultCache = new QueryResultCache({
  maxSize: 500,
  ttlSeconds: 1800, // 30 minutes
  enabled: process.env.RAG_CACHING_ENABLED === 'true',
});

/**
 * Cache-aware document retrieval wrapper
 */
export function withCache<T extends (...args: any[]) => Promise<any>>(
  fn: T,
  keyGenerator: (...args: Parameters<T>) => string,
  cache: DocumentCache | QueryResultCache = documentCache
): T {
  return (async (...args: Parameters<T>) => {
    const key = keyGenerator(...args);
    
    // Try cache first
    const cached = cache.get(key);
    if (cached) {
      return cached;
    }

    // Execute original function
    const result = await fn(...args);
    
    // Cache the result
    if (cache instanceof QueryResultCache) {
      cache.set(key, result, Date.now());
    } else {
      // For document cache, we'd need to adapt the result format
      // This is a simplified version
      cache.set(key, result);
    }

    return result;
  }) as T;
}