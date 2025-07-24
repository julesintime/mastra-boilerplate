/**
 * RAG Configuration for Mastra Agent Framework
 * 
 * This file provides centralized configuration for RAG capabilities including
 * vector databases, embedding models, chunking strategies, and retrieval settings.
 */

import { openai } from '@ai-sdk/openai';
import { google } from '@ai-sdk/google';
import { groq } from '@ai-sdk/groq';

// Vector Database Configuration
export const VECTOR_DB_CONFIG = {
  // Default provider - using only LibSQL for simplicity
  provider: 'libsql' as const,
  
  // LibSQL Vector Configuration (embedded, good for development and testing)
  libsql: {
    connectionUrl: process.env.RAG_DATABASE_URL || 'file:../rag-vectors.db',
    authToken: process.env.RAG_DATABASE_AUTH_TOKEN, // Optional for Turso cloud
  },
};

// Embedding Model Configuration  
export const EMBEDDING_CONFIG = {
  // Default embedding provider - using openai for development
  provider: (process.env.EMBEDDING_PROVIDER || 'openai') as 'openai' | 'google',
  
  // Model configurations
  models: {
    openai: {
      model: openai.embedding(process.env.EMBEDDING_MODEL || 'text-embedding-3-small'),
      dimensions: parseInt(process.env.EMBEDDING_DIMENSIONS || '1536'),
      costPerToken: 0.00002, // Per 1K tokens
    },
    google: {
      model: 'text-embedding-004', // Google embedding model name
      dimensions: parseInt(process.env.EMBEDDING_DIMENSIONS || '768'),
      costPerToken: 0.000025, // Per 1K tokens (free tier available)
    },
  },
};

// Document Processing Configuration
export const DOCUMENT_CONFIG = {
  // Default chunking strategy
  defaultStrategy: 'recursive' as const,
  
  // Chunking configurations by document type
  strategies: {
    recursive: {
      size: parseInt(process.env.CHUNK_SIZE || '512'),
      overlap: parseInt(process.env.CHUNK_OVERLAP || '50'),
      separator: process.env.CHUNK_SEPARATOR || '\n',
    },
    character: {
      size: parseInt(process.env.CHUNK_SIZE || '500'),
      overlap: parseInt(process.env.CHUNK_OVERLAP || '50'),
    },
    token: {
      size: parseInt(process.env.CHUNK_SIZE || '400'),
      overlap: parseInt(process.env.CHUNK_OVERLAP || '40'),
    },
    markdown: {
      size: parseInt(process.env.CHUNK_SIZE || '600'),
      overlap: parseInt(process.env.CHUNK_OVERLAP || '60'),
      preserveHeaders: true,
    },
    html: {
      size: parseInt(process.env.CHUNK_SIZE || '600'),
      overlap: parseInt(process.env.CHUNK_OVERLAP || '60'),
      preserveStructure: true,
    },
    json: {
      size: parseInt(process.env.CHUNK_SIZE || '400'),
      overlap: parseInt(process.env.CHUNK_OVERLAP || '40'),
      preserveStructure: true,
    },
  },
  
  // Metadata extraction settings
  metadata: {
    enabled: process.env.EXTRACT_METADATA === 'true',
    useAI: process.env.AI_METADATA_EXTRACTION === 'true',
    maxRetries: 3,
  },
};

// Retrieval Configuration
export const RETRIEVAL_CONFIG = {
  // Default retrieval settings
  defaultTopK: parseInt(process.env.RAG_TOP_K || '5'),
  maxTopK: parseInt(process.env.RAG_MAX_TOP_K || '20'),
  
  // Similarity thresholds
  thresholds: {
    minSimilarity: parseFloat(process.env.RAG_MIN_SIMILARITY || '0.7'),
    rerankThreshold: parseFloat(process.env.RAG_RERANK_THRESHOLD || '0.6'),
  },
  
  // Reranking configuration
  reranking: {
    enabled: process.env.RAG_RERANKING_ENABLED === 'true',
    provider: (process.env.RERANK_PROVIDER || 'mastra') as 'mastra' | 'cohere' | 'zero-entropy',
    topK: parseInt(process.env.RERANK_TOP_K || '10'),
    model: process.env.RERANK_MODEL || 'gpt-4o-mini',
  },
  
  // Graph RAG configuration
  graphRag: {
    enabled: process.env.GRAPH_RAG_ENABLED === 'true',
    threshold: parseFloat(process.env.GRAPH_RAG_THRESHOLD || '0.75'),
    maxDepth: parseInt(process.env.GRAPH_RAG_MAX_DEPTH || '3'),
  },
  
  // Caching configuration
  caching: {
    enabled: process.env.RAG_CACHING_ENABLED === 'true',
    ttl: parseInt(process.env.RAG_CACHE_TTL || '3600'), // 1 hour in seconds
    maxSize: parseInt(process.env.RAG_CACHE_MAX_SIZE || '1000'), // Max cache entries
  },
};

// Index Configuration
export const INDEX_CONFIG = {
  // Default index names by agent type (valid SQL identifiers)
  indexes: {
    weather: 'weather_knowledge',
    eightball: 'mystical_wisdom',
    quotes: 'inspirational_quotes',
    general: 'general_knowledge',
  },
  
  // Index-specific settings
  settings: {
    dimension: EMBEDDING_CONFIG.models[EMBEDDING_CONFIG.provider].dimensions,
    metric: 'cosine' as const,
    
    // Performance tuning
    performance: {
      efConstruction: parseInt(process.env.VECTOR_EF_CONSTRUCTION || '200'),
      m: parseInt(process.env.VECTOR_M || '16'),
      maxConnections: parseInt(process.env.VECTOR_MAX_CONNECTIONS || '16'),
    },
  },
};

// Agent-specific RAG configurations
export const AGENT_RAG_CONFIG = {
  weather: {
    indexName: INDEX_CONFIG.indexes.weather,
    chunkingStrategy: 'recursive',
    topK: 3,
    includeMetadata: ['source', 'timestamp', 'location', 'category'],
    filters: {
      category: ['weather', 'forecast', 'climate'],
    },
  },
  
  eightball: {
    indexName: INDEX_CONFIG.indexes.eightball,
    chunkingStrategy: 'character',
    topK: 2,
    includeMetadata: ['source', 'sentiment', 'language', 'category'],
    filters: {
      category: ['wisdom', 'guidance', 'fortune'],
    },
  },
  
  quotes: {
    indexName: INDEX_CONFIG.indexes.quotes,
    chunkingStrategy: 'recursive',
    topK: 4,
    includeMetadata: ['author', 'source', 'theme', 'category', 'era'],
    filters: {
      category: ['inspiration', 'motivation', 'wisdom'],
    },
  },
} as const;

// Environment-specific overrides
export const getEnvironmentConfig = () => {
  const env = process.env.NODE_ENV || 'development';
  
  switch (env) {
    case 'production':
      return {
        vectorDb: 'pgvector', // Use PostgreSQL in production
        embeddingProvider: 'openai', // More reliable for production
        caching: true,
        reranking: true,
        graphRag: true,
      };
      
    case 'staging':
      return {
        vectorDb: 'pgvector',
        embeddingProvider: 'openai',
        caching: true,
        reranking: false, // Reduce costs in staging
        graphRag: false,
      };
      
    case 'development':
    default:
      return {
        vectorDb: 'libsql', // Embedded for local development
        embeddingProvider: 'openai',
        caching: false, // Disable for development
        reranking: false,
        graphRag: false,
      };
  }
};

// Check if RAG is enabled (skip validation if disabled)
export const isRagEnabled = (): boolean => {
  return process.env.RAG_ENABLED !== 'false' && process.env.RAG_DISABLED !== 'true';
};

// Validate configuration (only when RAG is enabled)
export const validateRagConfig = () => {
  // Skip validation if RAG is explicitly disabled
  if (!isRagEnabled()) {
    console.log('📝 RAG system is disabled - skipping validation');
    return true;
  }

  const errors: string[] = [];
  
  // Check embedding configuration
  if (!EMBEDDING_CONFIG.models[EMBEDDING_CONFIG.provider]) {
    errors.push(`Invalid embedding provider: ${EMBEDDING_CONFIG.provider}`);
  }
  
  // Check vector database configuration
  const dbConfig = VECTOR_DB_CONFIG[VECTOR_DB_CONFIG.provider];
  if (!dbConfig) {
    errors.push(`Invalid vector database provider: ${VECTOR_DB_CONFIG.provider}`);
  }
  
  // Check required environment variables (only for supported providers)
  // Note: Currently only libsql is configured - add other providers as needed
  
  // Check embedding API keys (skip in test mode or when RAG is disabled)
  const isTestMode = process.env.NODE_ENV === 'test' || process.env.RAG_TEST_MODE === 'true';
  
  if (!isTestMode) {
    if (EMBEDDING_CONFIG.provider === 'openai' && !process.env.OPENAI_API_KEY) {
      errors.push('OPENAI_API_KEY is required for OpenAI embeddings');
    }
    
    if (EMBEDDING_CONFIG.provider === 'google' && !process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
      errors.push('GOOGLE_GENERATIVE_AI_API_KEY is required for Google embeddings');
    }
  }
  
  if (errors.length > 0) {
    throw new Error(`RAG Configuration Errors:\n${errors.join('\n')}`);
  }
  
  return true;
};