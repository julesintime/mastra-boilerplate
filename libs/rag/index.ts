/**
 * RAG System Entry Point
 * 
 * Provides conditional exports for RAG functionality based on configuration.
 * This allows the framework to work with or without RAG enabled.
 */

import { isRagEnabled } from './config';

// Conditional exports - only provide real tools when RAG is enabled
export const getRagTools = async (agentType: 'weather' | 'eightball' | 'quotes') => {
  if (!isRagEnabled()) {
    // Return dummy tools when RAG is disabled
    return {
      vectorQueryTool: null,
      graphQueryTool: null,
    };
  }

  try {
    // Dynamic import to avoid loading RAG dependencies when disabled
    const { weatherVectorQueryTool, eightBallVectorQueryTool, quotesVectorQueryTool } = await import('./query-tools');
    const { weatherGraphQueryTool, eightBallGraphQueryTool, quotesGraphQueryTool } = await import('./graph-query-tool');

    switch (agentType) {
      case 'weather':
        return {
          vectorQueryTool: weatherVectorQueryTool,
          graphQueryTool: weatherGraphQueryTool,
        };
      case 'eightball':
        return {
          vectorQueryTool: eightBallVectorQueryTool,
          graphQueryTool: eightBallGraphQueryTool,
        };
      case 'quotes':
        return {
          vectorQueryTool: quotesVectorQueryTool,
          graphQueryTool: quotesGraphQueryTool,
        };
      default:
        return {
          vectorQueryTool: null,
          graphQueryTool: null,
        };
    }
  } catch (error) {
    console.warn('⚠️  RAG tools could not be loaded:', error);
    return {
      vectorQueryTool: null,
      graphQueryTool: null,
    };
  }
};

// Export utility functions
export { isRagEnabled } from './config';
export { initializeVectorDatabase } from './vector-store';