/**
 * Document Processing Pipeline for Mastra RAG System
 * 
 * Handles document chunking, embedding generation, and metadata extraction
 * with support for multiple document types and processing strategies.
 */

import { MDocument } from '@mastra/rag';
import { embedMany, embed } from 'ai';
import { openai } from '@ai-sdk/openai';
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
  strategy?: keyof typeof DOCUMENT_CONFIG.strategies;
  extractMetadata?: boolean;
  agentType?: keyof typeof AGENT_RAG_CONFIG;
  customMetadata?: Record<string, any>;
  batchSize?: number;
}

/**
 * Document Processor - handles the complete pipeline from raw documents to stored vectors
 */
export class DocumentProcessor {
  private embeddingModel: any;
  private vectorStore: VectorStoreFactory;

  constructor() {
    // Initialize embedding model based on configuration
    this.embeddingModel = EMBEDDING_CONFIG.models[EMBEDDING_CONFIG.provider].model;
    this.vectorStore = VectorStoreFactory.getInstance();
  }

  /**
   * Process a document from text content
   */
  async processText(
    content: string,
    options: DocumentProcessingOptions = {}
  ): Promise<ProcessedDocument> {
    const doc = MDocument.fromText(content);
    return this.processDocument(doc, options);
  }

  /**
   * Process a document from HTML content
   */
  async processHTML(
    content: string,
    options: DocumentProcessingOptions = {}
  ): Promise<ProcessedDocument> {
    const doc = MDocument.fromHTML(content);
    return this.processDocument(doc, options);
  }

  /**
   * Process a document from Markdown content
   */
  async processMarkdown(
    content: string,
    options: DocumentProcessingOptions = {}
  ): Promise<ProcessedDocument> {
    const doc = MDocument.fromMarkdown(content);
    return this.processDocument(doc, options);
  }

  /**
   * Process a document from JSON content
   */
  async processJSON(
    content: string,
    options: DocumentProcessingOptions = {}
  ): Promise<ProcessedDocument> {
    const doc = MDocument.fromJSON(content);
    return this.processDocument(doc, options);
  }

  /**
   * Core document processing logic
   */
  private async processDocument(
    doc: MDocument,
    options: DocumentProcessingOptions
  ): Promise<ProcessedDocument> {
    const startTime = Date.now();
    
    try {
      // Step 1: Chunk the document
      const chunks = await this.chunkDocument(doc, options);
      
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
   * Chunk a document using the specified strategy
   */
  private async chunkDocument(
    doc: MDocument,
    options: DocumentProcessingOptions
  ): Promise<DocumentChunk[]> {
    const strategy = options.strategy || DOCUMENT_CONFIG.defaultStrategy;
    const strategyConfig = DOCUMENT_CONFIG.strategies[strategy];
    
    console.log(`Chunking document using ${strategy} strategy...`);
    
    // Apply agent-specific configurations if provided
    let chunkConfig = { ...strategyConfig };
    if (options.agentType && AGENT_RAG_CONFIG[options.agentType]) {
      const agentConfig = AGENT_RAG_CONFIG[options.agentType];
      const agentStrategy = DOCUMENT_CONFIG.strategies[agentConfig.chunkingStrategy as keyof typeof DOCUMENT_CONFIG.strategies];
      chunkConfig = { ...chunkConfig, ...agentStrategy };
    }

    // Perform chunking
    const chunks = await doc.chunk({
      strategy,
      ...chunkConfig,
      extract: {
        metadata: options.extractMetadata ?? DOCUMENT_CONFIG.metadata.enabled,
      },
    });

    // Convert to our DocumentChunk format
    return chunks.map((chunk, index) => ({
      id: `chunk_${Date.now()}_${index}`,
      text: chunk.text,
      metadata: {
        ...chunk.metadata,
        ...options.customMetadata,
        chunkIndex: index,
        chunkStrategy: strategy,
        chunkSize: chunk.text.length,
        timestamp: new Date().toISOString(),
        agentType: options.agentType,
      },
    }));
  }

  /**
   * Generate embeddings for document chunks
   */
  private async generateEmbeddings(
    chunks: DocumentChunk[],
    options: DocumentProcessingOptions
  ): Promise<DocumentChunk[]> {
    const batchSize = options.batchSize || 10;
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
          await new Promise(resolve => setTimeout(resolve, 100));
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
    contentType: 'text' | 'html' | 'markdown' | 'json' = 'text',
    options: DocumentProcessingOptions = {}
  ): Promise<ProcessedDocument> {
    // Process the document
    let processedDoc: ProcessedDocument;
    
    switch (contentType) {
      case 'html':
        processedDoc = await this.processHTML(content, options);
        break;
      case 'markdown':
        processedDoc = await this.processMarkdown(content, options);
        break;
      case 'json':
        processedDoc = await this.processJSON(content, options);
        break;
      case 'text':
      default:
        processedDoc = await this.processText(content, options);
        break;
    }
    
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
      type: 'text' | 'html' | 'markdown' | 'json';
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
          doc.type,
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
export const documentProcessor = new DocumentProcessor();