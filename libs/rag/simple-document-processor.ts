/**
 * Simplified Document Processing for Testing
 * 
 * Basic document chunking and embedding without external dependencies
 */

import { embedMany, embed } from 'ai';
import { google } from '@ai-sdk/google';
import { 
  EMBEDDING_CONFIG, 
  DOCUMENT_CONFIG, 
  INDEX_CONFIG,
  AGENT_RAG_CONFIG 
} from './config';
import { VectorStoreFactory, VectorUpsertData } from './vector-store';

export interface DocumentChunk {
  id: string;
  text: string;
  metadata: Record<string, any>;
  embedding?: number[];
}

export interface ProcessedDocument {
  chunks: DocumentChunk[];
  totalChunks: number;
  totalTokens: number;
  processingTime: number;
}

export interface DocumentProcessingOptions {
  agentType?: keyof typeof AGENT_RAG_CONFIG;
  customMetadata?: Record<string, any>;
  batchSize?: number;
}

/**
 * Simple Document Processor - handles basic document processing without complex dependencies
 */
export class SimpleDocumentProcessor {
  private embeddingModel: any;
  private vectorStore: VectorStoreFactory;

  constructor() {
    // Initialize embedding model based on configuration
    this.embeddingModel = EMBEDDING_CONFIG.models[EMBEDDING_CONFIG.provider].model;
    this.vectorStore = VectorStoreFactory.getInstance();
  }

  /**
   * Process text with simple chunking
   */
  async processText(
    content: string,
    options: DocumentProcessingOptions = {}
  ): Promise<ProcessedDocument> {
    const startTime = Date.now();
    
    try {
      // Step 1: Simple text chunking
      const chunks = this.simpleChunk(content, options);
      
      // Step 2: Generate embeddings
      const processedChunks = await this.generateEmbeddings(chunks, options);
      
      // Step 3: Calculate processing metrics
      const processingTime = Date.now() - startTime;
      const totalTokens = this.estimateTokenCount(processedChunks);
      
      console.log(`Document processed: ${processedChunks.length} chunks, ~${totalTokens} tokens, ${processingTime}ms`);
      
      return {
        chunks: processedChunks,
        totalChunks: processedChunks.length,
        totalTokens,
        processingTime,
      };
      
    } catch (error) {
      console.error('Document processing failed:', error);
      throw new Error(`Document processing failed: ${error.message}`);
    }
  }

  /**
   * Simple text chunking implementation
   */
  private simpleChunk(
    content: string,
    options: DocumentProcessingOptions
  ): DocumentChunk[] {
    const chunkSize = DOCUMENT_CONFIG.strategies.recursive.size;
    const overlap = DOCUMENT_CONFIG.strategies.recursive.overlap;
    
    const chunks: DocumentChunk[] = [];
    const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 0);
    
    let currentChunk = '';
    let chunkIndex = 0;
    
    for (const sentence of sentences) {
      const trimmedSentence = sentence.trim();
      if (!trimmedSentence) continue;
      
      // If adding this sentence would exceed chunk size, start a new chunk
      if (currentChunk.length + trimmedSentence.length > chunkSize && currentChunk.length > 0) {
        chunks.push({
          id: `chunk_${Date.now()}_${chunkIndex}`,
          text: currentChunk.trim(),
          metadata: {
            ...options.customMetadata,
            chunkIndex: chunkIndex,
            chunkSize: currentChunk.length,
            timestamp: new Date().toISOString(),
            agentType: options.agentType,
            source: 'simple_processor',
          },
        });
        
        // Start new chunk with overlap
        const words = currentChunk.split(' ');
        const overlapWords = words.slice(-Math.floor(overlap / 10)); // Simple overlap calculation
        currentChunk = overlapWords.join(' ') + ' ' + trimmedSentence;
        chunkIndex++;
      } else {
        currentChunk += (currentChunk ? '. ' : '') + trimmedSentence;
      }
    }
    
    // Add the final chunk if it exists
    if (currentChunk.trim()) {
      chunks.push({
        id: `chunk_${Date.now()}_${chunkIndex}`,
        text: currentChunk.trim(),
        metadata: {
          ...options.customMetadata,
          chunkIndex: chunkIndex,
          chunkSize: currentChunk.length,
          timestamp: new Date().toISOString(),
          agentType: options.agentType,
          source: 'simple_processor',
        },
      });
    }
    
    return chunks;
  }

  /**
   * Generate embeddings for document chunks
   */
  private async generateEmbeddings(
    chunks: DocumentChunk[],
    options: DocumentProcessingOptions
  ): Promise<DocumentChunk[]> {
    const batchSize = options.batchSize || 5; // Smaller batch for testing
    const processedChunks: DocumentChunk[] = [];
    
    console.log(`Generating embeddings for ${chunks.length} chunks (batch size: ${batchSize})...`);
    
    // Process chunks in batches to avoid rate limits
    for (let i = 0; i < chunks.length; i += batchSize) {
      const batch = chunks.slice(i, i + batchSize);
      const batchTexts = batch.map(chunk => chunk.text);
      
      try {
        // Generate embeddings for the batch
        const { embeddings } = await embedMany({
          model: this.embeddingModel,
          values: batchTexts,
        });
        
        // Attach embeddings to chunks
        for (let j = 0; j < batch.length; j++) {
          processedChunks.push({
            ...batch[j],
            embedding: embeddings[j],
          });
        }
        
        console.log(`Processed batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(chunks.length / batchSize)}`);
        
        // Add a small delay to respect rate limits
        if (i + batchSize < chunks.length) {
          await new Promise(resolve => setTimeout(resolve, 500)); // Longer delay for free tier
        }
        
      } catch (error) {
        console.error(`Failed to generate embeddings for batch starting at index ${i}:`, error);
        throw error;
      }
    }
    
    return processedChunks;
  }

  /**
   * Store processed document chunks in the vector database
   */
  async storeDocument(
    processedDoc: ProcessedDocument,
    indexName: string
  ): Promise<void> {
    console.log(`Storing ${processedDoc.chunks.length} chunks in index: ${indexName}`);
    
    // Prepare data for vector store
    const vectors = processedDoc.chunks.map(chunk => chunk.embedding!);
    const metadata = processedDoc.chunks.map(chunk => ({
      text: chunk.text,
      ...chunk.metadata,
    }));
    const ids = processedDoc.chunks.map(chunk => chunk.id);
    
    const upsertData: VectorUpsertData = {
      vectors,
      metadata,
      ids,
    };
    
    try {
      await this.vectorStore.upsertVectors(indexName, upsertData);
      console.log(`✓ Successfully stored ${processedDoc.chunks.length} chunks in ${indexName}`);
    } catch (error) {
      console.error(`Failed to store chunks in ${indexName}:`, error);
      throw error;
    }
  }

  /**
   * Complete pipeline: process and store a document
   */
  async processAndStore(
    content: string,
    indexName: string,
    options: DocumentProcessingOptions = {}
  ): Promise<ProcessedDocument> {
    // Process the document
    const processedDoc = await this.processText(content, options);
    
    // Store in vector database
    await this.storeDocument(processedDoc, indexName);
    
    return processedDoc;
  }

  /**
   * Process multiple documents in batch
   */
  async processBatch(
    documents: Array<{
      content: string;
      metadata?: Record<string, any>;
    }>,
    indexName: string,
    options: DocumentProcessingOptions = {}
  ): Promise<ProcessedDocument[]> {
    console.log(`Processing batch of ${documents.length} documents...`);
    
    const results: ProcessedDocument[] = [];
    
    for (let i = 0; i < documents.length; i++) {
      const doc = documents[i];
      console.log(`Processing document ${i + 1}/${documents.length}`);
      
      try {
        const result = await this.processAndStore(
          doc.content,
          indexName,
          {
            ...options,
            customMetadata: {
              ...options.customMetadata,
              ...doc.metadata,
              batchIndex: i,
              batchSize: documents.length,
            },
          }
        );
        results.push(result);
      } catch (error) {
        console.error(`Failed to process document ${i + 1}:`, error);
        // Continue with other documents
      }
    }
    
    console.log(`Batch processing complete: ${results.length}/${documents.length} successful`);
    return results;
  }

  /**
   * Generate embedding for a single query (for retrieval)
   */
  async embedQuery(query: string): Promise<number[]> {
    const { embedding } = await embed({
      model: this.embeddingModel,
      value: query,
    });
    return embedding;
  }

  /**
   * Estimate token count for cost calculation
   */
  private estimateTokenCount(chunks: DocumentChunk[]): number {
    // Rough estimation: ~4 characters per token
    const totalChars = chunks.reduce((sum, chunk) => sum + chunk.text.length, 0);
    return Math.ceil(totalChars / 4);
  }
}

/**
 * Default document processor instance
 */
export const simpleDocumentProcessor = new SimpleDocumentProcessor();