# RAG (Retrieval-Augmented Generation) System

This document provides comprehensive information about the RAG system implementation in the Mastra Agent Framework.

## Overview

The RAG system enhances agent responses by incorporating relevant context from a knowledge base. It provides:

- **Multi-database Support**: LibSQL, Chroma, PostgreSQL+pgvector, Pinecone
- **Flexible Document Processing**: Multiple chunking strategies and content types
- **Advanced Retrieval**: Semantic search, reranking, hybrid search
- **Agent Integration**: Specialized tools for each agent type
- **Performance Monitoring**: Comprehensive evaluation and observability

## Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Documents     │    │   Processing    │    │  Vector Store   │
│                 │────│                 │────│                 │
│ • Text          │    │ • Chunking      │    │ • LibSQL        │
│ • HTML          │    │ • Embedding     │    │ • Chroma        │
│ • Markdown      │    │ • Metadata      │    │ • PostgreSQL    │
│ • JSON          │    │                 │    │ • Pinecone      │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                                        │
┌─────────────────┐    ┌─────────────────┐             │
│     Agents      │    │   Query Tools   │             │
│                 │────│                 │─────────────┘
│ • Weather       │    │ • Vector Search │
│ • Eight Ball    │    │ • Reranking     │
│ • Quotes        │    │ • Hybrid Search │
│ • Autonomous    │    │ • Filtering     │
└─────────────────┘    └─────────────────┘
```

## Quick Start

### 1. Configuration

The RAG system is configured via environment variables in `.env`:

```bash
# Vector Database
VECTOR_DB_PROVIDER=libsql
RAG_DATABASE_URL=file:../rag-vectors.db

# Embedding Model
EMBEDDING_PROVIDER=openai
EMBEDDING_MODEL=text-embedding-3-small
EMBEDDING_DIMENSIONS=1536

# Document Processing
CHUNK_SIZE=512
CHUNK_OVERLAP=50

# Retrieval Settings
RAG_TOP_K=5
RAG_MIN_SIMILARITY=0.7
```

### 2. Initialize RAG System

```bash
# Install dependencies
npm install

# Initialize vector database and populate with sample data
npm run rag:init
```

### 3. Test the System

```bash
# Start the development server
npm run dev

# Test agent interactions with RAG capabilities
# The agents now have access to vector query tools
```

## Supported Vector Databases

### LibSQL (Default)
- **Best for**: Development, embedded applications
- **Configuration**: File-based or Turso cloud
- **Setup**: Automatic with `file:../rag-vectors.db`

```env
VECTOR_DB_PROVIDER=libsql
RAG_DATABASE_URL=file:../rag-vectors.db
```

### Chroma
- **Best for**: Development, local experimentation
- **Configuration**: Docker or local installation
- **Setup**: `docker run -p 8000:8000 chromadb/chroma`

```env
VECTOR_DB_PROVIDER=chroma
CHROMA_URL=http://localhost:8000
```

### PostgreSQL + pgvector
- **Best for**: Production, existing PostgreSQL infrastructure
- **Configuration**: Requires pgvector extension
- **Setup**: Install pgvector extension in PostgreSQL

```env
VECTOR_DB_PROVIDER=pgvector
POSTGRES_CONNECTION_STRING=postgresql://user:password@localhost:5432/rag_db
```

### Pinecone
- **Best for**: Production, managed service
- **Configuration**: Requires Pinecone account
- **Setup**: Create index with 1536 dimensions

```env
VECTOR_DB_PROVIDER=pinecone
PINECONE_API_KEY=your_api_key
PINECONE_ENVIRONMENT=us-east-1-aws
```

## Document Processing

### Supported Formats

- **Text**: Plain text documents
- **HTML**: Web pages and HTML content
- **Markdown**: Documentation and structured text
- **JSON**: Structured data documents

### Chunking Strategies

1. **Recursive** (Default)
   - Smart splitting based on content structure
   - Preserves semantic boundaries
   - Best for: General text, articles

2. **Character**
   - Simple character-based splits
   - Consistent chunk sizes
   - Best for: Uniform content

3. **Token**
   - Token-aware splitting
   - Respects token boundaries
   - Best for: LLM-optimized content

4. **Markdown**
   - Markdown structure-aware
   - Preserves headers and sections
   - Best for: Documentation

5. **HTML**
   - HTML structure-aware
   - Preserves semantic elements
   - Best for: Web content

6. **JSON**
   - JSON structure-aware
   - Preserves object boundaries
   - Best for: Structured data

### Example Usage

```typescript
import { documentProcessor } from './src/mastra/rag/document-processor';

// Process a markdown document
const result = await documentProcessor.processMarkdown(
  '# Title\n\nContent here...',
  {
    strategy: 'markdown',
    agentType: 'weather',
    extractMetadata: true,
  }
);

// Store in weather agent's index
await documentProcessor.storeDocument(result, 'weather-knowledge');
```

## Agent Integration

Each agent has a specialized vector query tool:

### Weather Agent
- **Tool**: `weatherVectorQueryTool`
- **Index**: `weather-knowledge`
- **Content**: Weather patterns, activity suggestions, safety guidelines
- **Filters**: Weather type, temperature range, activity type

### Eight Ball Agent
- **Tool**: `eightBallVectorQueryTool`
- **Index**: `mystical-wisdom`
- **Content**: Mystical wisdom, interpretation guides, spiritual practices
- **Filters**: Mystical level, practice type, tradition

### Quotes Agent
- **Tool**: `quotesVectorQueryTool`
- **Index**: `inspirational-quotes`
- **Content**: Inspirational quotes, life wisdom, success principles
- **Filters**: Theme, author, cultural origin

### Generic RAG Tool
- **Tool**: `genericRagQueryTool`
- **Capability**: Search across all indexes
- **Features**: Cross-index reranking, result aggregation

## Advanced Features

### Reranking

Improves result relevance using semantic understanding:

```env
RAG_RERANKING_ENABLED=true
RERANK_PROVIDER=mastra
RERANK_MODEL=gpt-4o-mini
RERANK_TOP_K=10
```

### Hybrid Search

Combines semantic similarity with keyword matching:

```typescript
import { hybridSearchTool } from './src/mastra/rag/query-tools';

const results = await hybridSearchTool.execute({
  context: {
    query: 'sunny weather activities',
    keywords: ['outdoor', 'sports', 'beach'],
    vectorWeight: 0.7,
    keywordWeight: 0.3,
  },
});
```

### Metadata Filtering

Filter results based on metadata:

```typescript
const results = await weatherVectorQueryTool.execute({
  context: {
    query: 'outdoor activities',
    filters: {
      weather_type: 'sunny',
      temperature_range: '20-30',
    },
  },
});
```

## Performance Optimization

### Embedding Configuration

Choose the right embedding model for your use case:

```env
# Fast and cost-effective
EMBEDDING_MODEL=text-embedding-3-small
EMBEDDING_DIMENSIONS=1536

# Higher quality (more expensive)
EMBEDDING_MODEL=text-embedding-3-large
EMBEDDING_DIMENSIONS=3072

# Reduced dimensions for storage efficiency
EMBEDDING_DIMENSIONS=512
```

### Vector Index Tuning

Optimize vector index performance:

```env
# HNSW parameters for pgvector/libsql
VECTOR_EF_CONSTRUCTION=200  # Higher = better recall, slower build
VECTOR_M=16                 # Higher = better recall, more memory
VECTOR_MAX_CONNECTIONS=16   # Max connections per node
```

### Caching

Enable caching for frequently accessed documents:

```env
RAG_CACHING_ENABLED=true
RAG_CACHE_TTL=3600          # 1 hour
RAG_CACHE_MAX_SIZE=1000     # Max cached entries
```

## Monitoring and Evaluation

### Built-in Metrics

The RAG system includes comprehensive evaluation:

- **Answer Relevancy**: How well responses match queries
- **Faithfulness**: Accuracy relative to retrieved context
- **Hallucination Detection**: Identifies information not in context
- **Retrieval Quality**: Measures search effectiveness

### Performance Monitoring

Track RAG system performance:

```bash
# Run evaluation pipeline
npm run eval:ci

# View evaluation results
cat eval-results/latest-summary.txt
```

### Custom Metrics

Add domain-specific evaluation metrics:

```typescript
import { createCustomMetric } from '@mastra/evals';

const domainMetric = createCustomMetric({
  name: 'domain-accuracy',
  description: 'Measures domain-specific accuracy',
  evaluator: async (input, output, context) => {
    // Custom evaluation logic
    return { score: 0.85, info: { reason: 'Evaluation details' } };
  },
});
```

## Troubleshooting

### Common Issues

1. **Vector Database Connection Errors**
   ```bash
   # Check database connectivity
   npm run rag:init
   ```

2. **Embedding API Rate Limits**
   ```env
   # Reduce batch size
   EMBEDDING_BATCH_SIZE=5
   ```

3. **Low Retrieval Quality**
   ```env
   # Adjust similarity threshold
   RAG_MIN_SIMILARITY=0.6
   
   # Enable reranking
   RAG_RERANKING_ENABLED=true
   ```

4. **Memory Issues with Large Documents**
   ```env
   # Reduce chunk size
   CHUNK_SIZE=256
   CHUNK_OVERLAP=25
   ```

### Debug Commands

```bash
# Test vector database connection
npm run rag:init

# Verify agent configurations
npm test tests/agents/

# Check evaluation pipeline
npm run eval

# View system logs
npm run dev --verbose
```

## Security Considerations

### API Key Management

Store sensitive keys securely:

```env
# Use environment-specific keys
OPENAI_API_KEY=${OPENAI_API_KEY}
PINECONE_API_KEY=${PINECONE_API_KEY}
```

### Data Privacy

- Vector embeddings don't contain original text
- Metadata should not include sensitive information
- Use appropriate access controls for vector databases

### Input Validation

All user queries are validated before processing:

- Length limits (max 1000 characters)
- Content filtering for malicious input
- SQL injection protection for metadata queries

## API Reference

### Core Classes

- **`DocumentProcessor`**: Handles document chunking and embedding
- **`VectorStoreFactory`**: Creates and manages vector database connections
- **`VectorQueryTool`**: Provides retrieval capabilities to agents

### Configuration Objects

- **`VECTOR_DB_CONFIG`**: Vector database settings
- **`EMBEDDING_CONFIG`**: Embedding model configuration
- **`RETRIEVAL_CONFIG`**: Search and ranking parameters
- **`AGENT_RAG_CONFIG`**: Agent-specific RAG settings

### Utility Functions

- **`initializeVectorDatabase()`**: Sets up vector indexes
- **`validateRagConfig()`**: Validates configuration
- **`getVectorStore()`**: Gets default vector store instance

## Contributing

When adding new RAG features:

1. Update configuration in `src/mastra/rag/config.ts`
2. Add tests in `tests/rag/`
3. Update documentation
4. Add evaluation metrics for new capabilities
5. Test with multiple vector database providers

## Migration Guide

### From Basic Agents to RAG-Enhanced

1. Install RAG dependencies: `npm install`
2. Configure vector database in `.env`
3. Initialize RAG system: `npm run rag:init`
4. Update agent tools to include vector query capabilities
5. Test enhanced agent responses

### Switching Vector Databases

1. Update `VECTOR_DB_PROVIDER` in `.env`
2. Configure new database connection settings
3. Run `npm run rag:init` to recreate indexes
4. Migrate existing data if needed

## Performance Benchmarks

| Vector DB | Query Latency | Storage Efficiency | Scalability |
|-----------|---------------|-------------------|-------------|
| LibSQL    | ~50ms        | High              | Medium      |
| Chroma    | ~30ms        | Medium            | Medium      |
| pgvector  | ~25ms        | High              | High        |
| Pinecone  | ~100ms       | Medium            | Very High   |

*Benchmarks based on 10k documents, 1536-dimensional embeddings*