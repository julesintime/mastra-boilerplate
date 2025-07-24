/**
 * Vector Query Tools for Mastra RAG System
 * 
 * Provides specialized vector query tools for each agent type with
 * agent-specific configurations, filtering, and reranking capabilities.
 */

import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { 
  AGENT_RAG_CONFIG, 
  RETRIEVAL_CONFIG, 
  VECTOR_DB_CONFIG,
  EMBEDDING_CONFIG 
} from './config';
import { documentCache, queryResultCache } from './cache';
import { VectorStoreFactory } from './vector-store';
import { simpleDocumentProcessor } from './simple-document-processor';

/**
 * Base vector query tool factory
 */
export function createVectorQueryTool(agentType: keyof typeof AGENT_RAG_CONFIG) {
  const config = AGENT_RAG_CONFIG[agentType];
  
  return createTool({
    id: `vector_query_${agentType}`,
    description: `Search through ${agentType} knowledge base to find relevant information. Use this when you need to retrieve specific information from the knowledge base to answer user questions accurately.`,
    inputSchema: z.object({
      query: z.string().describe('The search query to find relevant information'),
      topK: z.number().optional().default(config.topK).describe('Number of results to return (1-20)'),
      minSimilarity: z.number().optional().default(RETRIEVAL_CONFIG.thresholds.minSimilarity).describe('Minimum similarity score (0-1)'),
      includeMetadata: z.array(z.string()).optional().default(config.includeMetadata).describe('Metadata fields to include in results'),
      filters: z.record(z.any()).optional().describe('Additional filters to apply to the search'),
    }),
    outputSchema: z.object({
      results: z.array(z.object({
        text: z.string().describe('The relevant text content'),
        score: z.number().describe('Similarity score (0-1)'),
        metadata: z.record(z.any()).describe('Associated metadata'),
      })),
      totalResults: z.number().describe('Total number of results found'),
      query: z.string().describe('The original query'),
      searchTime: z.number().describe('Search time in milliseconds'),
    }),
    execute: async ({ context }) => {
      const startTime = Date.now();
      
      // Generate cache key
      const cacheKey = queryResultCache.generateKey(context.query, {
        agentType,
        topK: context.topK,
        minSimilarity: context.minSimilarity,
        filters: context.filters,
        rerank: context.rerank,
      });
      
      // Check cache first
      const cachedResult = queryResultCache.get(cacheKey);
      if (cachedResult) {
        return {
          ...cachedResult,
          queryTime: Date.now() - startTime,
          cached: true,
        };
      }
      
      try {
        // Generate query embedding
        const queryEmbedding = await simpleDocumentProcessor.embedQuery(context.query);
        
        // Get vector store
        const vectorStore = await VectorStoreFactory.getInstance().getVectorStore();
        
        // Prepare search options
        const searchOptions = {
          indexName: config.indexName,
          queryVector: queryEmbedding,
          topK: Math.min(context.topK || config.topK, RETRIEVAL_CONFIG.maxTopK),
          minScore: context.minSimilarity,
          filter: {
            ...config.filters,
            ...context.filters,
          },
        };
        
        // Execute vector search
        const vectorResults = await VectorStoreFactory.getInstance().queryVectors(searchOptions);
        
        // Use vector search results directly (reranking disabled for testing)
        let finalResults = vectorResults;
        
        // Filter metadata based on includeMetadata configuration
        const filteredResults = finalResults.map(result => ({
          text: result.text,
          score: result.score,
          metadata: context.includeMetadata.reduce((filtered, key) => {
            if (result.metadata[key] !== undefined) {
              filtered[key] = result.metadata[key];
            }
            return filtered;
          }, {} as Record<string, any>),
        }));
        
        const searchTime = Date.now() - startTime;
        
        const result = {
          results: filteredResults,
          totalResults: filteredResults.length,
          query: context.query,
          searchTime,
          cached: false,
        };
        
        // Cache the result
        queryResultCache.set(cacheKey, result, searchTime);
        
        return result;
        
      } catch (error) {
        console.error(`Vector query failed for ${agentType}:`, error);
        return {
          results: [],
          totalResults: 0,
          query: context.query,
          searchTime: Date.now() - startTime,
          error: error.message,
        };
      }
    },
  });
}

/**
 * Weather-specific vector query tool
 */
export const weatherVectorQueryTool = createVectorQueryTool('weather');

/**
 * Eight Ball-specific vector query tool
 */
export const eightBallVectorQueryTool = createVectorQueryTool('eightball');

/**
 * Quotes-specific vector query tool
 */
export const quotesVectorQueryTool = createVectorQueryTool('quotes');

/**
 * Generic RAG query tool for multi-purpose use
 */
export const genericRagQueryTool = createTool({
  id: 'rag_query',
  description: 'Search through all knowledge bases to find relevant information. Use this when you need comprehensive information that might span multiple domains.',
  inputSchema: z.object({
    query: z.string().describe('The search query to find relevant information'),
    indexes: z.array(z.string()).optional().describe('Specific indexes to search (default: search all)'),
    topK: z.number().optional().default(RETRIEVAL_CONFIG.defaultTopK).describe('Number of results to return per index'),
    minSimilarity: z.number().optional().default(RETRIEVAL_CONFIG.thresholds.minSimilarity).describe('Minimum similarity score'),
    aggregateResults: z.boolean().optional().default(true).describe('Whether to aggregate and rerank results across indexes'),
  }),
  outputSchema: z.object({
    results: z.array(z.object({
      text: z.string(),
      score: z.number(),
      metadata: z.record(z.any()),
      source: z.string().describe('Which index/agent the result came from'),
    })),
    totalResults: z.number(),
    query: z.string(),
    searchTime: z.number(),
    indexesSearched: z.array(z.string()),
  }),
  execute: async ({ context }) => {
    const startTime = Date.now();
    
    try {
      // Determine which indexes to search
      const indexesToSearch = context.indexes || Object.values(AGENT_RAG_CONFIG).map(config => config.indexName);
      
      // Generate query embedding
      const queryEmbedding = await simpleDocumentProcessor.embedQuery(context.query);
      
      // Search all specified indexes
      const allResults: Array<{
        text: string;
        score: number;
        metadata: Record<string, any>;
        source: string;
      }> = [];
      
      for (const indexName of indexesToSearch) {
        try {
          const results = await VectorStoreFactory.getInstance().queryVectors({
            indexName,
            queryVector: queryEmbedding,
            topK: context.topK,
            minScore: context.minSimilarity,
          });
          
          // Add source information
          for (const result of results) {
            allResults.push({
              ...result,
              source: indexName,
            });
          }
        } catch (error) {
          console.warn(`Failed to search index ${indexName}:`, error.message);
        }
      }
      
      // Sort by relevance score
      allResults.sort((a, b) => b.score - a.score);
      
      // Apply aggregation and reranking if requested
      let finalResults = allResults;
      if (context.aggregateResults && RETRIEVAL_CONFIG.reranking.enabled && allResults.length > 3) {
        try {
          const rerankModel = groq(RETRIEVAL_CONFIG.reranking.model);
          const relevanceScorer = new MastraAgentRelevanceScorer('relevance-scorer', rerankModel);
          
          const rerankedResults = await rerankWithScorer({
            results: allResults.map(r => ({
              ...r,
              metadata: { ...r.metadata, text: r.text },
            })),
            query: context.query,
            provider: relevanceScorer,
            options: {
              topK: Math.min(context.topK * indexesToSearch.length, RETRIEVAL_CONFIG.maxTopK),
            },
          });
          
          finalResults = rerankedResults.map(r => ({
            text: r.text,
            score: r.score,
            metadata: r.metadata,
            source: allResults.find(orig => orig.text === r.text)?.source || 'unknown',
          }));
        } catch (rerankError) {
          console.warn('Cross-index reranking failed:', rerankError.message);
        }
      }
      
      // Limit final results
      const limitedResults = finalResults.slice(0, context.topK * indexesToSearch.length);
      
      return {
        results: limitedResults,
        totalResults: limitedResults.length,
        query: context.query,
        searchTime: Date.now() - startTime,
        indexesSearched: indexesToSearch,
      };
      
    } catch (error) {
      console.error('Generic RAG query failed:', error);
      return {
        results: [],
        totalResults: 0,
        query: context.query,
        searchTime: Date.now() - startTime,
        indexesSearched: [],
        error: error.message,
      };
    }
  },
});

/**
 * Hybrid search tool that combines vector search with keyword matching
 */
export const hybridSearchTool = createTool({
  id: 'hybrid_search',
  description: 'Perform hybrid search combining semantic similarity and keyword matching for comprehensive results.',
  inputSchema: z.object({
    query: z.string().describe('The search query'),
    keywords: z.array(z.string()).optional().describe('Specific keywords to match'),
    indexName: z.string().describe('Index to search'),
    vectorWeight: z.number().optional().default(0.7).describe('Weight for vector similarity (0-1)'),
    keywordWeight: z.number().optional().default(0.3).describe('Weight for keyword matching (0-1)'),
    topK: z.number().optional().default(RETRIEVAL_CONFIG.defaultTopK),
  }),
  outputSchema: z.object({
    results: z.array(z.object({
      text: z.string(),
      vectorScore: z.number().describe('Semantic similarity score'),
      keywordScore: z.number().describe('Keyword matching score'),
      hybridScore: z.number().describe('Combined hybrid score'),
      metadata: z.record(z.any()),
    })),
    totalResults: z.number(),
    query: z.string(),
    searchTime: z.number(),
  }),
  execute: async ({ context }) => {
    const startTime = Date.now();
    
    try {
      // Get vector search results
      const queryEmbedding = await simpleDocumentProcessor.embedQuery(context.query);
      const vectorResults = await VectorStoreFactory.getInstance().queryVectors({
        indexName: context.indexName,
        queryVector: queryEmbedding,
        topK: context.topK * 2, // Get more results for hybrid scoring
      });
      
      // Extract keywords from query if not provided
      const keywords = context.keywords || context.query.toLowerCase().split(/\s+/).filter(word => word.length > 2);
      
      // Calculate hybrid scores
      const hybridResults = vectorResults.map(result => {
        const text = result.text.toLowerCase();
        
        // Calculate keyword score
        const keywordMatches = keywords.filter(keyword => text.includes(keyword.toLowerCase())).length;
        const keywordScore = keywords.length > 0 ? keywordMatches / keywords.length : 0;
        
        // Calculate hybrid score
        const hybridScore = (result.score * context.vectorWeight) + (keywordScore * context.keywordWeight);
        
        return {
          text: result.text,
          vectorScore: result.score,
          keywordScore,
          hybridScore,
          metadata: result.metadata,
        };
      });
      
      // Sort by hybrid score and limit results
      hybridResults.sort((a, b) => b.hybridScore - a.hybridScore);
      const finalResults = hybridResults.slice(0, context.topK);
      
      return {
        results: finalResults,
        totalResults: finalResults.length,
        query: context.query,
        searchTime: Date.now() - startTime,
      };
      
    } catch (error) {
      console.error('Hybrid search failed:', error);
      return {
        results: [],
        totalResults: 0,
        query: context.query,
        searchTime: Date.now() - startTime,
        error: error.message,
      };
    }
  },
});