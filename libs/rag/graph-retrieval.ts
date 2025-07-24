/**
 * Graph-based Retrieval for Complex Document Relationships
 * 
 * Implements sophisticated document relationship mapping and traversal
 * for enhanced contextual understanding and retrieval capabilities.
 */

import { simpleDocumentProcessor } from './simple-document-processor';
import { VectorStoreFactory } from './vector-store';
import { RETRIEVAL_CONFIG, AGENT_RAG_CONFIG } from './config';

export interface DocumentNode {
  id: string;
  text: string;
  metadata: Record<string, any>;
  embedding: number[];
  relationships: DocumentRelationship[];
}

export interface DocumentRelationship {
  type: 'semantic' | 'hierarchical' | 'temporal' | 'causal' | 'topical';
  targetId: string;
  weight: number;
  metadata?: Record<string, any>;
}

export interface GraphTraversalOptions {
  maxDepth: number;
  minWeight: number;
  relationshipTypes?: string[];
  includeMetadata?: string[];
  expandDirection?: 'forward' | 'backward' | 'bidirectional';
}

export interface GraphQueryResult {
  primaryResults: Array<{
    text: string;
    score: number;
    metadata: Record<string, any>;
    path: string[];
  }>;
  relatedResults: Array<{
    text: string;
    score: number;
    metadata: Record<string, any>;
    relationshipType: string;
    depth: number;
  }>;
  graph: {
    nodes: DocumentNode[];
    edges: DocumentRelationship[];
  };
  queryTime: number;
}

/**
 * Graph-based Retrieval Engine
 */
export class GraphRAGRetrieval {
  private documentGraph: Map<string, DocumentNode> = new Map();
  private relationshipIndex: Map<string, DocumentRelationship[]> = new Map();

  constructor() {}

  /**
   * Build document relationship graph using semantic similarity
   */
  async buildDocumentGraph(
    documents: Array<{
      id: string;
      text: string;
      metadata: Record<string, any>;
    }>,
    options: {
      semanticThreshold?: number;
      hierarchicalAnalysis?: boolean;
      temporalAnalysis?: boolean;
      topicalAnalysis?: boolean;
    } = {}
  ): Promise<void> {
    console.log(`Building document graph for ${documents.length} documents...`);
    
    const {
      semanticThreshold = 0.75,
      hierarchicalAnalysis = true,
      temporalAnalysis = true,
      topicalAnalysis = true
    } = options;

    // Step 1: Create document nodes with embeddings
    const nodes: DocumentNode[] = [];
    for (const doc of documents) {
      const embedding = await simpleDocumentProcessor.embedQuery(doc.text.slice(0, 500)); // Use first 500 chars
      
      const node: DocumentNode = {
        id: doc.id,
        text: doc.text,
        metadata: doc.metadata,
        embedding,
        relationships: []
      };
      
      nodes.push(node);
      this.documentGraph.set(doc.id, node);
    }

    // Step 2: Analyze relationships between documents
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const nodeA = nodes[i];
        const nodeB = nodes[j];
        
        const relationships = await this.analyzeDocumentRelationship(
          nodeA, 
          nodeB, 
          {
            semanticThreshold,
            hierarchicalAnalysis,
            temporalAnalysis,
            topicalAnalysis
          }
        );
        
        // Add bidirectional relationships
        nodeA.relationships.push(...relationships.map(rel => ({
          ...rel,
          targetId: nodeB.id
        })));
        
        nodeB.relationships.push(...relationships.map(rel => ({
          ...rel,
          targetId: nodeA.id
        })));
      }
    }

    // Step 3: Build relationship index for fast traversal
    this.buildRelationshipIndex();
    
    console.log(`Graph built: ${this.documentGraph.size} nodes, ${this.getTotalRelationships()} relationships`);
  }

  /**
   * Analyze relationship between two documents
   */
  private async analyzeDocumentRelationship(
    nodeA: DocumentNode,
    nodeB: DocumentNode,
    options: {
      semanticThreshold: number;
      hierarchicalAnalysis: boolean;
      temporalAnalysis: boolean;
      topicalAnalysis: boolean;
    }
  ): Promise<DocumentRelationship[]> {
    const relationships: DocumentRelationship[] = [];

    // 1. Semantic similarity analysis
    const semanticSimilarity = this.calculateCosineSimilarity(nodeA.embedding, nodeB.embedding);
    if (semanticSimilarity >= options.semanticThreshold) {
      relationships.push({
        type: 'semantic',
        targetId: nodeB.id,
        weight: semanticSimilarity,
        metadata: { similarity: semanticSimilarity }
      });
    }

    // 2. Hierarchical relationship analysis
    if (options.hierarchicalAnalysis) {
      const hierarchical = this.analyzeHierarchicalRelationship(nodeA, nodeB);
      if (hierarchical) {
        relationships.push(hierarchical);
      }
    }

    // 3. Temporal relationship analysis
    if (options.temporalAnalysis) {
      const temporal = this.analyzeTemporalRelationship(nodeA, nodeB);
      if (temporal) {
        relationships.push(temporal);
      }
    }

    // 4. Topical relationship analysis
    if (options.topicalAnalysis) {
      const topical = this.analyzeTopicalRelationship(nodeA, nodeB);
      if (topical) {
        relationships.push(topical);
      }
    }

    return relationships;
  }

  /**
   * Perform graph-based query with relationship traversal
   */
  async graphQuery(
    query: string,
    indexName: string,
    options: GraphTraversalOptions = {
      maxDepth: 3,
      minWeight: 0.5,
      expandDirection: 'bidirectional'
    }
  ): Promise<GraphQueryResult> {
    const startTime = Date.now();
    
    // Step 1: Get initial vector search results
    const queryEmbedding = await simpleDocumentProcessor.embedQuery(query);
    const vectorStore = await VectorStoreFactory.getInstance().getVectorStore();
    
    const initialResults = await VectorStoreFactory.getInstance().queryVectors({
      indexName,
      queryVector: queryEmbedding,
      topK: 10
    });

    const primaryResults = initialResults.map(result => ({
      text: result.text,
      score: result.score,
      metadata: result.metadata,
      path: [result.id || 'unknown']
    }));

    // Step 2: Expand results using graph traversal
    const relatedResults: Array<{
      text: string;
      score: number;
      metadata: Record<string, any>;
      relationshipType: string;
      depth: number;
    }> = [];

    const visited = new Set<string>();
    const graphNodes: DocumentNode[] = [];
    const graphEdges: DocumentRelationship[] = [];

    for (const result of initialResults) {
      const nodeId = result.id || result.metadata?.id;
      if (!nodeId || !this.documentGraph.has(nodeId)) continue;

      const traversalResults = await this.traverseGraph(
        nodeId,
        options,
        visited,
        0
      );

      relatedResults.push(...traversalResults);
      
      // Collect graph structure
      const node = this.documentGraph.get(nodeId);
      if (node) {
        graphNodes.push(node);
        graphEdges.push(...node.relationships);
      }
    }

    // Step 3: Remove duplicates and sort by relevance
    const uniqueRelated = this.deduplicateResults(relatedResults);
    uniqueRelated.sort((a, b) => b.score - a.score);

    return {
      primaryResults,
      relatedResults: uniqueRelated.slice(0, RETRIEVAL_CONFIG.maxTopK),
      graph: {
        nodes: this.deduplicateNodes(graphNodes),
        edges: this.deduplicateEdges(graphEdges)
      },
      queryTime: Date.now() - startTime
    };
  }

  /**
   * Traverse document graph to find related content
   */
  private async traverseGraph(
    startNodeId: string,
    options: GraphTraversalOptions,
    visited: Set<string>,
    currentDepth: number
  ): Promise<Array<{
    text: string;
    score: number;
    metadata: Record<string, any>;
    relationshipType: string;
    depth: number;
  }>> {
    if (currentDepth >= options.maxDepth || visited.has(startNodeId)) {
      return [];
    }

    visited.add(startNodeId);
    const results: Array<{
      text: string;
      score: number;
      metadata: Record<string, any>;
      relationshipType: string;
      depth: number;
    }> = [];

    const node = this.documentGraph.get(startNodeId);
    if (!node) return results;

    // Traverse relationships
    for (const relationship of node.relationships) {
      if (relationship.weight < options.minWeight) continue;
      
      if (options.relationshipTypes && 
          !options.relationshipTypes.includes(relationship.type)) {
        continue;
      }

      const targetNode = this.documentGraph.get(relationship.targetId);
      if (!targetNode) continue;

      // Add related document
      results.push({
        text: targetNode.text,
        score: relationship.weight,
        metadata: targetNode.metadata,
        relationshipType: relationship.type,
        depth: currentDepth + 1
      });

      // Recursive traversal
      if (options.expandDirection === 'bidirectional' || 
          options.expandDirection === 'forward') {
        const nestedResults = await this.traverseGraph(
          relationship.targetId,
          options,
          new Set(visited), // Copy to avoid affecting other branches
          currentDepth + 1
        );
        results.push(...nestedResults);
      }
    }

    return results;
  }

  /**
   * Calculate cosine similarity between embeddings
   */
  private calculateCosineSimilarity(embeddingA: number[], embeddingB: number[]): number {
    const dotProduct = embeddingA.reduce((sum, a, i) => sum + a * embeddingB[i], 0);
    const magnitudeA = Math.sqrt(embeddingA.reduce((sum, a) => sum + a * a, 0));
    const magnitudeB = Math.sqrt(embeddingB.reduce((sum, b) => sum + b * b, 0));
    
    return dotProduct / (magnitudeA * magnitudeB);
  }

  /**
   * Analyze hierarchical relationships (parent-child, part-whole)
   */
  private analyzeHierarchicalRelationship(
    nodeA: DocumentNode, 
    nodeB: DocumentNode
  ): DocumentRelationship | null {
    const metaA = nodeA.metadata;
    const metaB = nodeB.metadata;

    // Check for explicit hierarchical indicators
    if (metaA.level && metaB.level) {
      const levelDiff = Math.abs(metaA.level - metaB.level);
      if (levelDiff === 1) {
        return {
          type: 'hierarchical',
          targetId: nodeB.id,
          weight: 0.8,
          metadata: { 
            relationship: metaA.level < metaB.level ? 'parent-child' : 'child-parent',
            levelDiff
          }
        };
      }
    }

    // Check for category-subcategory relationships
    if (metaA.category && metaB.category) {
      if (metaA.category === metaB.category && metaA.subcategory !== metaB.subcategory) {
        return {
          type: 'hierarchical',
          targetId: nodeB.id,
          weight: 0.6,
          metadata: { relationship: 'sibling-categories' }
        };
      }
    }

    return null;
  }

  /**
   * Analyze temporal relationships (before-after, concurrent)
   */
  private analyzeTemporalRelationship(
    nodeA: DocumentNode, 
    nodeB: DocumentNode
  ): DocumentRelationship | null {
    const timestampA = this.extractTimestamp(nodeA.metadata);
    const timestampB = this.extractTimestamp(nodeB.metadata);

    if (!timestampA || !timestampB) return null;

    const timeDiff = Math.abs(timestampA.getTime() - timestampB.getTime());
    const daysDiff = timeDiff / (1000 * 60 * 60 * 24);

    // Documents within 7 days are considered temporally related
    if (daysDiff <= 7) {
      return {
        type: 'temporal',
        targetId: nodeB.id,
        weight: Math.max(0.3, 1 - (daysDiff / 7)),
        metadata: { 
          relationship: daysDiff < 1 ? 'concurrent' : 'sequential',
          daysDiff: Math.round(daysDiff)
        }
      };
    }

    return null;
  }

  /**
   * Analyze topical relationships (same topic, related topics)
   */
  private analyzeTopicalRelationship(
    nodeA: DocumentNode, 
    nodeB: DocumentNode
  ): DocumentRelationship | null {
    const topicsA = this.extractTopics(nodeA);
    const topicsB = this.extractTopics(nodeB);

    const commonTopics = topicsA.filter(topic => topicsB.includes(topic));
    const topicSimilarity = commonTopics.length / Math.max(topicsA.length, topicsB.length);

    if (topicSimilarity > 0.3) {
      return {
        type: 'topical',
        targetId: nodeB.id,
        weight: topicSimilarity,
        metadata: { 
          commonTopics,
          similarity: topicSimilarity
        }
      };
    }

    return null;
  }

  /**
   * Extract timestamp from metadata
   */
  private extractTimestamp(metadata: Record<string, any>): Date | null {
    const candidates = [
      metadata.timestamp,
      metadata.created_at,
      metadata.date,
      metadata.published_at
    ];

    for (const candidate of candidates) {
      if (candidate) {
        const date = new Date(candidate);
        if (!isNaN(date.getTime())) {
          return date;
        }
      }
    }

    return null;
  }

  /**
   * Extract topics from document node
   */
  private extractTopics(node: DocumentNode): string[] {
    const topics: string[] = [];
    
    // From metadata
    if (node.metadata.topics) {
      topics.push(...(Array.isArray(node.metadata.topics) ? node.metadata.topics : [node.metadata.topics]));
    }
    
    if (node.metadata.tags) {
      topics.push(...(Array.isArray(node.metadata.tags) ? node.metadata.tags : [node.metadata.tags]));
    }

    if (node.metadata.category) {
      topics.push(node.metadata.category);
    }

    // Simple keyword extraction from text (basic implementation)
    const keywords = this.extractKeywords(node.text);
    topics.push(...keywords);

    return [...new Set(topics)]; // Remove duplicates
  }

  /**
   * Basic keyword extraction
   */
  private extractKeywords(text: string): string[] {
    const words = text.toLowerCase()
      .replace(/[^\w\s]/g, '')
      .split(/\s+/)
      .filter(word => word.length > 3);
    
    // Simple frequency-based extraction
    const wordCount = words.reduce((acc, word) => {
      acc[word] = (acc[word] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return Object.entries(wordCount)
      .filter(([_, count]) => count > 1)
      .sort(([_, a], [__, b]) => b - a)
      .slice(0, 5)
      .map(([word]) => word);
  }

  /**
   * Build relationship index for fast lookup
   */
  private buildRelationshipIndex(): void {
    this.relationshipIndex.clear();
    
    for (const [nodeId, node] of this.documentGraph) {
      for (const relationship of node.relationships) {
        const key = `${nodeId}-${relationship.type}`;
        if (!this.relationshipIndex.has(key)) {
          this.relationshipIndex.set(key, []);
        }
        this.relationshipIndex.get(key)!.push(relationship);
      }
    }
  }

  /**
   * Utility methods for deduplication
   */
  private deduplicateResults(results: Array<{
    text: string;
    score: number;
    metadata: Record<string, any>;
    relationshipType: string;
    depth: number;
  }>): Array<{
    text: string;
    score: number;
    metadata: Record<string, any>;
    relationshipType: string;
    depth: number;
  }> {
    const seen = new Set<string>();
    return results.filter(result => {
      const key = result.text.slice(0, 100); // Use first 100 chars as identifier
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  private deduplicateNodes(nodes: DocumentNode[]): DocumentNode[] {
    const seen = new Set<string>();
    return nodes.filter(node => {
      if (seen.has(node.id)) return false;
      seen.add(node.id);
      return true;
    });
  }

  private deduplicateEdges(edges: DocumentRelationship[]): DocumentRelationship[] {
    const seen = new Set<string>();
    return edges.filter(edge => {
      const key = `${edge.targetId}-${edge.type}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  /**
   * Get total number of relationships in the graph
   */
  private getTotalRelationships(): number {
    return Array.from(this.documentGraph.values())
      .reduce((total, node) => total + node.relationships.length, 0);
  }

  /**
   * Export graph structure for visualization
   */
  exportGraph(): {
    nodes: Array<{ id: string; label: string; metadata: Record<string, any> }>;
    edges: Array<{ from: string; to: string; type: string; weight: number }>;
  } {
    const nodes = Array.from(this.documentGraph.values()).map(node => ({
      id: node.id,
      label: node.text.slice(0, 50) + '...',
      metadata: node.metadata
    }));

    const edges: Array<{ from: string; to: string; type: string; weight: number }> = [];
    for (const [nodeId, node] of this.documentGraph) {
      for (const relationship of node.relationships) {
        edges.push({
          from: nodeId,
          to: relationship.targetId,
          type: relationship.type,
          weight: relationship.weight
        });
      }
    }

    return { nodes, edges };
  }
}

/**
 * Default graph retrieval instance
 */
export const graphRAGRetrieval = new GraphRAGRetrieval();