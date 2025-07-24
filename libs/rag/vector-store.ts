/**
 * Vector Store Factory for Mastra RAG System
 * 
 * Provides a unified interface for different vector database providers
 * and handles initialization, configuration, and common operations.
 */

import { LibSQLVector } from '@mastra/libsql';
import { VECTOR_DB_CONFIG, INDEX_CONFIG, validateRagConfig, isRagEnabled } from './config';

export type VectorStore = LibSQLVector;

export interface VectorSearchResult {
  text: string;
  score: number;
  metadata: Record<string, any>;
  id?: string;
}

export interface VectorUpsertData {
  vectors: number[][];
  metadata: Record<string, any>[];
  ids?: string[];
}

export interface VectorQueryOptions {
  indexName: string;
  queryVector: number[];
  topK?: number;
  filter?: Record<string, any>;
  minScore?: number;
}

/**
 * Vector Store Factory - creates and configures vector database instances
 */
export class VectorStoreFactory {
  private static instance: VectorStoreFactory;
  private stores: Map<string, VectorStore> = new Map();

  private constructor() {
    // Only validate configuration if RAG is enabled
    if (isRagEnabled()) {
      validateRagConfig();
    }
  }

  static getInstance(): VectorStoreFactory {
    if (!VectorStoreFactory.instance) {
      VectorStoreFactory.instance = new VectorStoreFactory();
    }
    return VectorStoreFactory.instance;
  }

  /**
   * Get or create a vector store instance
   */
  async getVectorStore(provider?: string): Promise<VectorStore> {
    const providerName = provider || VECTOR_DB_CONFIG.provider;
    
    if (this.stores.has(providerName)) {
      return this.stores.get(providerName)!;
    }

    const store = await this.createVectorStore(providerName);
    this.stores.set(providerName, store);
    return store;
  }

  /**
   * Create a new vector store instance - only LibSQL supported for testing
   */
  private async createVectorStore(provider: string): Promise<VectorStore> {
    if (provider === 'libsql') {
      return new LibSQLVector({
        connectionUrl: VECTOR_DB_CONFIG.libsql.connectionUrl,
        authToken: VECTOR_DB_CONFIG.libsql.authToken,
      });
    }
    
    throw new Error(`Unsupported vector database provider: ${provider}. Only 'libsql' is supported for testing.`);
  }

  /**
   * Initialize all required indexes for the application
   */
  async initializeIndexes(store?: VectorStore): Promise<void> {
    const vectorStore = store || await this.getVectorStore();
    
    console.log('Initializing vector database indexes...');
    
    // Create indexes for each agent type
    for (const [agentType, indexName] of Object.entries(INDEX_CONFIG.indexes)) {
      try {
        await vectorStore.createIndex({
          indexName,
          dimension: INDEX_CONFIG.settings.dimension,
          metric: INDEX_CONFIG.settings.metric,
        });
        console.log(`✓ Created index: ${indexName} for ${agentType}`);
      } catch (error: any) {
        // Index might already exist, which is fine
        if (error.message.includes('already exists') || error.message.includes('duplicate')) {
          console.log(`✓ Index already exists: ${indexName} for ${agentType}`);
        } else {
          console.error(`✗ Failed to create index ${indexName}:`, error.message);
          throw error;
        }
      }
    }
    
    console.log('Vector database initialization complete');
  }

  /**
   * Unified upsert operation across all vector stores
   */
  async upsertVectors(
    indexName: string,
    data: VectorUpsertData,
    store?: VectorStore
  ): Promise<void> {
    const vectorStore = store || await this.getVectorStore();
    
    await vectorStore.upsert({
      indexName,
      vectors: data.vectors,
      metadata: data.metadata,
      ids: data.ids,
    });
  }

  /**
   * Unified query operation across all vector stores
   */
  async queryVectors(
    options: VectorQueryOptions,
    store?: VectorStore
  ): Promise<VectorSearchResult[]> {
    const vectorStore = store || await this.getVectorStore();
    
    const results = await vectorStore.query({
      indexName: options.indexName,
      queryVector: options.queryVector,
      topK: options.topK || 5,
      filter: options.filter,
    });

    // Filter by minimum score if specified
    let filteredResults = results;
    if (options.minScore) {
      filteredResults = results.filter(result => result.score >= options.minScore!);
    }

    return filteredResults.map(result => ({
      text: result.metadata?.text || '',
      score: result.score,
      metadata: result.metadata || {},
      id: result.id,
    }));
  }

  /**
   * Delete vectors from index
   */
  async deleteVectors(
    indexName: string, 
    ids: string[],
    store?: VectorStore
  ): Promise<void> {
    const vectorStore = store || await this.getVectorStore();
    
    if ('delete' in vectorStore) {
      await (vectorStore as any).delete({
        indexName,
        ids,
      });
    } else {
      console.warn(`Delete operation not supported for ${VECTOR_DB_CONFIG.provider}`);
    }
  }

  /**
   * Clear all vectors from an index
   */
  async clearIndex(
    indexName: string,
    store?: VectorStore
  ): Promise<void> {
    const vectorStore = store || await this.getVectorStore();
    
    if ('clear' in vectorStore) {
      await (vectorStore as any).clear({ indexName });
    } else {
      console.warn(`Clear operation not supported for ${VECTOR_DB_CONFIG.provider}`);
    }
  }

  /**
   * Get statistics about an index
   */
  async getIndexStats(
    indexName: string,
    store?: VectorStore
  ): Promise<{ count: number; dimension: number }> {
    const vectorStore = store || await this.getVectorStore();
    
    if ('getStats' in vectorStore) {
      return await (vectorStore as any).getStats({ indexName });
    } else {
      // Fallback: attempt a dummy query to check if index exists
      try {
        await vectorStore.query({
          indexName,
          queryVector: new Array(INDEX_CONFIG.settings.dimension).fill(0),
          topK: 1,
        });
        return { 
          count: -1, // Unknown count
          dimension: INDEX_CONFIG.settings.dimension 
        };
      } catch (error) {
        throw new Error(`Index ${indexName} does not exist or is inaccessible`);
      }
    }
  }
}

/**
 * Convenience function to get the default vector store
 */
export const getVectorStore = async (): Promise<VectorStore> => {
  return VectorStoreFactory.getInstance().getVectorStore();
};

/**
 * Convenience function to initialize all indexes
 */
export const initializeVectorDatabase = async (): Promise<void> => {
  return VectorStoreFactory.getInstance().initializeIndexes();
};

/**
 * Convenience function for vector operations
 */
export const vectorOperations = {
  upsert: async (indexName: string, data: VectorUpsertData) => {
    return VectorStoreFactory.getInstance().upsertVectors(indexName, data);
  },
  
  query: async (options: VectorQueryOptions) => {
    return VectorStoreFactory.getInstance().queryVectors(options);
  },
  
  delete: async (indexName: string, ids: string[]) => {
    return VectorStoreFactory.getInstance().deleteVectors(indexName, ids);
  },
  
  clear: async (indexName: string) => {
    return VectorStoreFactory.getInstance().clearIndex(indexName);
  },
  
  stats: async (indexName: string) => {
    return VectorStoreFactory.getInstance().getIndexStats(indexName);
  },
};