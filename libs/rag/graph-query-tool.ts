/**
 * Graph-based Query Tool for Enhanced RAG Retrieval
 * 
 * Provides advanced query capabilities using document relationship graphs
 * for more contextual and comprehensive information retrieval.
 */

import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { graphRAGRetrieval } from './graph-retrieval';
import { AGENT_RAG_CONFIG, RETRIEVAL_CONFIG } from './config';

/**
 * Create graph-enhanced query tool for specific agent
 */
export function createGraphQueryTool(agentType: keyof typeof AGENT_RAG_CONFIG) {
  const config = AGENT_RAG_CONFIG[agentType];
  
  return createTool({
    id: `graph_query_${agentType}`,
    description: `Perform advanced graph-based search through ${agentType} knowledge base with relationship traversal. This tool finds not only directly relevant information but also related content through document relationships.`,
    inputSchema: z.object({
      query: z.string().describe('The search query to find relevant information'),
      maxDepth: z.number().optional().default(3).describe('Maximum relationship traversal depth (1-5)'),
      minWeight: z.number().optional().default(0.5).describe('Minimum relationship weight threshold (0-1)'),
      relationshipTypes: z.array(z.enum(['semantic', 'hierarchical', 'temporal', 'causal', 'topical'])).optional().describe('Types of relationships to traverse'),
      expandDirection: z.enum(['forward', 'backward', 'bidirectional']).optional().default('bidirectional').describe('Direction of graph traversal'),
      includeGraphViz: z.boolean().optional().default(false).describe('Include graph visualization data'),
    }),
    outputSchema: z.object({
      primaryResults: z.array(z.object({
        text: z.string().describe('The relevant text content'),
        score: z.number().describe('Relevance score (0-1)'),
        metadata: z.record(z.any()).describe('Associated metadata'),
        path: z.array(z.string()).describe('Document relationship path'),
      })),
      relatedResults: z.array(z.object({
        text: z.string().describe('Related content through graph traversal'),
        score: z.number().describe('Relationship strength score'),
        metadata: z.record(z.any()).describe('Associated metadata'),
        relationshipType: z.string().describe('Type of relationship'),
        depth: z.number().describe('Traversal depth from original results'),
      })),
      graphVisualization: z.object({
        nodes: z.array(z.object({
          id: z.string(),
          label: z.string(),
          metadata: z.record(z.any()),
        })),
        edges: z.array(z.object({
          from: z.string(),
          to: z.string(),
          type: z.string(),
          weight: z.number(),
        })),
      }).optional().describe('Graph structure for visualization'),
      totalResults: z.number().describe('Total number of results'),
      queryTime: z.number().describe('Query execution time in milliseconds'),
      searchStrategy: z.string().describe('Search strategy used'),
    }),
    execute: async ({ context }) => {
      const startTime = Date.now();
      
      try {
        // Execute graph-based query
        const results = await graphRAGRetrieval.graphQuery(
          context.query,
          config.indexName,
          {
            maxDepth: Math.min(Math.max(context.maxDepth || 3, 1), 5),
            minWeight: Math.min(Math.max(context.minWeight || 0.5, 0), 1),
            relationshipTypes: context.relationshipTypes,
            expandDirection: context.expandDirection || 'bidirectional',
          }
        );

        // Include graph visualization if requested
        let graphVisualization;
        if (context.includeGraphViz) {
          graphVisualization = graphRAGRetrieval.exportGraph();
        }

        return {
          primaryResults: results.primaryResults.slice(0, RETRIEVAL_CONFIG.defaultTopK),
          relatedResults: results.relatedResults.slice(0, RETRIEVAL_CONFIG.maxTopK),
          graphVisualization,
          totalResults: results.primaryResults.length + results.relatedResults.length,
          queryTime: Date.now() - startTime,
          searchStrategy: 'graph-enhanced-retrieval',
        };

      } catch (error) {
        console.error(`Graph query failed for ${agentType}:`, error);
        return {
          primaryResults: [],
          relatedResults: [],
          totalResults: 0,
          queryTime: Date.now() - startTime,
          searchStrategy: 'fallback-vector-search',
          error: error.message,
        };
      }
    },
  });
}

/**
 * Agent-specific graph query tools
 */
export const weatherGraphQueryTool = createGraphQueryTool('weather');
export const eightBallGraphQueryTool = createGraphQueryTool('eightball');
export const quotesGraphQueryTool = createGraphQueryTool('quotes');

/**
 * Multi-agent graph query tool for cross-domain searches
 */
export const multiAgentGraphQueryTool = createTool({
  id: 'multi_agent_graph_query',
  description: 'Perform comprehensive graph-based search across all agent knowledge bases with relationship traversal and cross-domain analysis.',
  inputSchema: z.object({
    query: z.string().describe('The search query'),
    agentTypes: z.array(z.enum(['weather', 'eightball', 'quotes'])).optional().describe('Specific agents to search (default: all)'),
    maxDepth: z.number().optional().default(2).describe('Maximum relationship traversal depth'),
    minWeight: z.number().optional().default(0.6).describe('Minimum relationship weight threshold'),
    relationshipTypes: z.array(z.enum(['semantic', 'hierarchical', 'temporal', 'causal', 'topical'])).optional(),
    crossDomainAnalysis: z.boolean().optional().default(true).describe('Enable cross-domain relationship analysis'),
    aggregateResults: z.boolean().optional().default(true).describe('Aggregate and rank results across domains'),
  }),
  outputSchema: z.object({
    results: z.array(z.object({
      text: z.string(),
      score: z.number(),
      metadata: z.record(z.any()),
      source: z.string().describe('Which agent/domain the result came from'),
      relationshipType: z.string().optional(),
      depth: z.number().optional(),
    })),
    domainAnalysis: z.object({
      weather: z.object({
        resultCount: z.number(),
        avgScore: z.number(),
        topRelationships: z.array(z.string()),
      }).optional(),
      eightball: z.object({
        resultCount: z.number(),
        avgScore: z.number(),
        topRelationships: z.array(z.string()),
      }).optional(),
      quotes: z.object({
        resultCount: z.number(),
        avgScore: z.number(),
        topRelationships: z.array(z.string()),
      }).optional(),
    }),
    crossDomainInsights: z.array(z.object({
      insight: z.string(),
      domains: z.array(z.string()),
      confidence: z.number(),
    })),
    totalResults: z.number(),
    queryTime: z.number(),
  }),
  execute: async ({ context }) => {
    const startTime = Date.now();
    
    try {
      const agentTypes = context.agentTypes || ['weather', 'eightball', 'quotes'];
      const allResults: Array<{
        text: string;
        score: number;
        metadata: Record<string, any>;
        source: string;
        relationshipType?: string;
        depth?: number;
      }> = [];

      const domainAnalysis: Record<string, any> = {};

      // Query each agent's knowledge base
      for (const agentType of agentTypes) {
        const config = AGENT_RAG_CONFIG[agentType];
        if (!config) continue;

        try {
          const results = await graphRAGRetrieval.graphQuery(
            context.query,
            config.indexName,
            {
              maxDepth: context.maxDepth || 2,
              minWeight: context.minWeight || 0.6,
              relationshipTypes: context.relationshipTypes,
              expandDirection: 'bidirectional',
            }
          );

          // Process primary results
          const primaryResults = results.primaryResults.map(result => ({
            ...result,
            source: agentType,
          }));

          // Process related results
          const relatedResults = results.relatedResults.map(result => ({
            text: result.text,
            score: result.score,
            metadata: result.metadata,
            source: agentType,
            relationshipType: result.relationshipType,
            depth: result.depth,
          }));

          const domainResults = [...primaryResults, ...relatedResults];
          allResults.push(...domainResults);

          // Analyze domain performance
          const relationships = relatedResults.map(r => r.relationshipType).filter(Boolean);
          domainAnalysis[agentType] = {
            resultCount: domainResults.length,
            avgScore: domainResults.reduce((sum, r) => sum + r.score, 0) / domainResults.length || 0,
            topRelationships: [...new Set(relationships)].slice(0, 3),
          };

        } catch (error) {
          console.warn(`Failed to query ${agentType} domain:`, error.message);
          domainAnalysis[agentType] = {
            resultCount: 0,
            avgScore: 0,
            topRelationships: [],
          };
        }
      }

      // Aggregate and rank results
      if (context.aggregateResults) {
        allResults.sort((a, b) => {
          // Primary scoring by relevance
          const scoreDiff = b.score - a.score;
          if (Math.abs(scoreDiff) > 0.1) return scoreDiff;
          
          // Secondary scoring by relationship strength
          const depthPenaltyA = (a.depth || 0) * 0.1;
          const depthPenaltyB = (b.depth || 0) * 0.1;
          return (b.score - depthPenaltyB) - (a.score - depthPenaltyA);
        });
      }

      // Cross-domain insights
      const crossDomainInsights = context.crossDomainAnalysis ? 
        generateCrossDomainInsights(allResults, domainAnalysis) : [];

      return {
        results: allResults.slice(0, RETRIEVAL_CONFIG.maxTopK),
        domainAnalysis,
        crossDomainInsights,
        totalResults: allResults.length,
        queryTime: Date.now() - startTime,
      };

    } catch (error) {
      console.error('Multi-agent graph query failed:', error);
      return {
        results: [],
        domainAnalysis: {},
        crossDomainInsights: [],
        totalResults: 0,
        queryTime: Date.now() - startTime,
        error: error.message,
      };
    }
  },
});

/**
 * Generate cross-domain insights from multi-agent results
 */
function generateCrossDomainInsights(
  results: Array<{
    text: string;
    score: number;
    metadata: Record<string, any>;
    source: string;
    relationshipType?: string;
    depth?: number;
  }>,
  domainAnalysis: Record<string, any>
): Array<{
  insight: string;
  domains: string[];
  confidence: number;
}> {
  const insights: Array<{
    insight: string;
    domains: string[];
    confidence: number;
  }> = [];

  // Analyze result distribution across domains
  const domainCounts = results.reduce((acc, result) => {
    acc[result.source] = (acc[result.source] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const activeDomains = Object.keys(domainCounts);
  const totalResults = results.length;

  // Insight 1: Domain expertise relevance
  const primaryDomain = Object.entries(domainCounts)
    .sort(([, a], [, b]) => b - a)[0];
  
  if (primaryDomain && primaryDomain[1] > totalResults * 0.5) {
    insights.push({
      insight: `This query is most relevant to ${primaryDomain[0]} domain expertise (${Math.round(primaryDomain[1] / totalResults * 100)}% of results)`,
      domains: [primaryDomain[0]],
      confidence: primaryDomain[1] / totalResults,
    });
  }

  // Insight 2: Cross-domain relationships
  const crossDomainRelationships = results.filter(r => r.relationshipType && r.depth && r.depth > 0);
  if (crossDomainRelationships.length > 0) {
    const relationshipTypes = [...new Set(crossDomainRelationships.map(r => r.relationshipType))];
    insights.push({
      insight: `Found ${crossDomainRelationships.length} cross-domain relationships, primarily ${relationshipTypes.join(', ')}`,
      domains: activeDomains,
      confidence: Math.min(crossDomainRelationships.length / totalResults, 1),
    });
  }

  // Insight 3: Knowledge gaps
  const lowScoreDomains = Object.entries(domainAnalysis)
    .filter(([, analysis]: [string, any]) => analysis.avgScore < 0.3)
    .map(([domain]) => domain);
  
  if (lowScoreDomains.length > 0) {
    insights.push({
      insight: `Limited relevant information found in ${lowScoreDomains.join(', ')} domains - consider expanding knowledge base`,
      domains: lowScoreDomains,
      confidence: 0.7,
    });
  }

  return insights.slice(0, 5); // Limit to top 5 insights
}

/**
 * Initialize graph with sample data for enhanced retrieval
 */
export async function initializeGraphRAG(): Promise<void> {
  console.log('🔗 Initializing Graph RAG system...');
  
  // This would typically load existing documents from the vector database
  // and build the relationship graph. For now, we'll set up the foundation.
  
  console.log('✅ Graph RAG system initialized and ready for document ingestion');
}