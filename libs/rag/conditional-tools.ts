/**
 * Conditional RAG Tools
 * 
 * Provides RAG tools that gracefully handle the case when RAG is disabled.
 * These tools can be safely imported without triggering RAG validation.
 */

import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

// Check if RAG is enabled without importing heavy dependencies
const isRagEnabled = () => {
  return process.env.RAG_ENABLED !== 'false' && process.env.RAG_DISABLED !== 'true';
};

// Create a no-op tool for when RAG is disabled
const createDisabledRagTool = (toolId: string, description: string) => {
  return createTool({
    id: toolId,
    description: `${description} (RAG is currently disabled)`,
    inputSchema: z.object({
      query: z.string().describe('Search query (RAG disabled - will return informational message)'),
    }),
    outputSchema: z.object({
      results: z.array(z.object({
        text: z.string(),
        score: z.number(),
        metadata: z.record(z.any()),
      })),
      totalResults: z.number(),
      message: z.string(),
    }),
    execute: async ({ context }) => {
      return {
        results: [],
        totalResults: 0,
        message: 'RAG system is disabled. To enable RAG capabilities, set RAG_ENABLED=true in your .env file and ensure you have the required API keys configured.',
      };
    },
  });
};

// Create a proxy tool that loads the actual tool lazily
const createProxyTool = (toolLoader: () => Promise<any>, toolId: string, description: string) => {
  let actualTool: any = null;
  let loadingPromise: Promise<any> | null = null;

  return createTool({
    id: toolId,
    description: description,
    inputSchema: z.object({
      query: z.string().describe('Search query'),
      topK: z.number().optional().describe('Number of results to return (1-20)'),
      minSimilarity: z.number().optional().describe('Minimum similarity score (0-1)'),
      includeMetadata: z.array(z.string()).optional().describe('Metadata fields to include in results'),
      filters: z.record(z.any()).optional().describe('Additional filters to apply to the search'),
    }),
    outputSchema: z.object({
      results: z.array(z.object({
        text: z.string(),
        score: z.number(),
        metadata: z.record(z.any()),
      })),
      totalResults: z.number(),
      query: z.string(),
      searchTime: z.number(),
    }),
    execute: async ({ context }) => {
      // Load the actual tool if not already loaded
      if (!actualTool && !loadingPromise) {
        loadingPromise = toolLoader().then(tool => {
          actualTool = tool;
          loadingPromise = null;
          return tool;
        }).catch(error => {
          console.warn(`Failed to load RAG tool ${toolId}:`, error);
          // Return disabled tool behavior on load failure
          actualTool = createDisabledRagTool(`${toolId}_fallback`, description);
          loadingPromise = null;
          return actualTool;
        });
      }

      // Wait for loading if in progress
      if (loadingPromise) {
        actualTool = await loadingPromise;
      }

      // Execute the actual tool
      return await actualTool.execute({ context });
    },
  });
};

// Lazy loading functions for RAG tools
const loadWeatherVectorTool = async () => {
  if (!isRagEnabled()) {
    return createDisabledRagTool('weather_vector_query_disabled', 'Search weather knowledge base');
  }
  
  try {
    const { weatherVectorQueryTool } = await import('./query-tools');
    return weatherVectorQueryTool;
  } catch (error) {
    console.warn('Failed to load weather vector tool:', error);
    return createDisabledRagTool('weather_vector_query_fallback', 'Search weather knowledge base');
  }
};

const loadWeatherGraphTool = async () => {
  if (!isRagEnabled()) {
    return createDisabledRagTool('weather_graph_query_disabled', 'Search weather knowledge graph');
  }
  
  try {
    const { weatherGraphQueryTool } = await import('./graph-query-tool');
    return weatherGraphQueryTool;
  } catch (error) {
    console.warn('Failed to load weather graph tool:', error);
    return createDisabledRagTool('weather_graph_query_fallback', 'Search weather knowledge graph');
  }
};

const loadEightBallVectorTool = async () => {
  if (!isRagEnabled()) {
    return createDisabledRagTool('eightball_vector_query_disabled', 'Search mystical wisdom');
  }
  
  try {
    const { eightBallVectorQueryTool } = await import('./query-tools');
    return eightBallVectorQueryTool;
  } catch (error) {
    console.warn('Failed to load eight ball vector tool:', error);
    return createDisabledRagTool('eightball_vector_query_fallback', 'Search mystical wisdom');
  }
};

const loadEightBallGraphTool = async () => {
  if (!isRagEnabled()) {
    return createDisabledRagTool('eightball_graph_query_disabled', 'Search mystical knowledge graph');
  }
  
  try {
    const { eightBallGraphQueryTool } = await import('./graph-query-tool');
    return eightBallGraphQueryTool;
  } catch (error) {
    console.warn('Failed to load eight ball graph tool:', error);
    return createDisabledRagTool('eightball_graph_query_fallback', 'Search mystical knowledge graph');
  }
};

const loadQuotesVectorTool = async () => {
  if (!isRagEnabled()) {
    return createDisabledRagTool('quotes_vector_query_disabled', 'Search inspirational quotes');
  }
  
  try {
    const { quotesVectorQueryTool } = await import('./query-tools');
    return quotesVectorQueryTool;
  } catch (error) {
    console.warn('Failed to load quotes vector tool:', error);
    return createDisabledRagTool('quotes_vector_query_fallback', 'Search inspirational quotes');
  }
};

const loadQuotesGraphTool = async () => {
  if (!isRagEnabled()) {
    return createDisabledRagTool('quotes_graph_query_disabled', 'Search quotes knowledge graph');
  }
  
  try {
    const { quotesGraphQueryTool } = await import('./graph-query-tool');
    return quotesGraphQueryTool;
  } catch (error) {
    console.warn('Failed to load quotes graph tool:', error);
    return createDisabledRagTool('quotes_graph_query_fallback', 'Search quotes knowledge graph');
  }
};

// Export tools - provide immediate disabled tools when RAG is disabled
export const weatherVectorQueryTool = isRagEnabled() 
  ? createProxyTool(() => loadWeatherVectorTool(), 'weather_vector_query', 'Search weather knowledge base')
  : createDisabledRagTool('weather_vector_query_disabled', 'Search weather knowledge base');

export const weatherGraphQueryTool = isRagEnabled()
  ? createProxyTool(() => loadWeatherGraphTool(), 'weather_graph_query', 'Search weather knowledge graph')
  : createDisabledRagTool('weather_graph_query_disabled', 'Search weather knowledge graph');

export const eightBallVectorQueryTool = isRagEnabled()
  ? createProxyTool(() => loadEightBallVectorTool(), 'eightball_vector_query', 'Search mystical wisdom')
  : createDisabledRagTool('eightball_vector_query_disabled', 'Search mystical wisdom');

export const eightBallGraphQueryTool = isRagEnabled()
  ? createProxyTool(() => loadEightBallGraphTool(), 'eightball_graph_query', 'Search mystical knowledge graph')
  : createDisabledRagTool('eightball_graph_query_disabled', 'Search mystical knowledge graph');

export const quotesVectorQueryTool = isRagEnabled()
  ? createProxyTool(() => loadQuotesVectorTool(), 'quotes_vector_query', 'Search inspirational quotes')
  : createDisabledRagTool('quotes_vector_query_disabled', 'Search inspirational quotes');

export const quotesGraphQueryTool = isRagEnabled()
  ? createProxyTool(() => loadQuotesGraphTool(), 'quotes_graph_query', 'Search quotes knowledge graph')
  : createDisabledRagTool('quotes_graph_query_disabled', 'Search quotes knowledge graph');