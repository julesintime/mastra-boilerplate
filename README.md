# Mastra Agent Framework

> Production-ready TypeScript template for building AI agent systems with MCP server integration

## Overview

A comprehensive boilerplate for creating intelligent AI agent systems using the [Mastra framework](https://mastra.ai). This template demonstrates best practices for agent orchestration, tool integration, and external API exposure through Model Context Protocol (MCP) servers.

## Features

- **🤖 Multi-Agent System**: Weather, Eight Ball, and Quotes agents with autonomous coordination
- **🔍 RAG Integration**: Retrieval-Augmented Generation with multiple vector database support  
- **🔒 Security Layer**: Authentication, authorization, and rate limiting
- **🔄 Advanced Workflows**: Complex business processes with monitoring and templates
- **🔌 MCP Server**: Expose agents to external tools like Claude Code and IDEs
- **📊 Comprehensive Testing**: Evaluation metrics and automated quality assurance
- **⚡ Multi-Model Support**: Google Gemini, Groq Llama, OpenAI GPT, Anthropic Claude

## Quick Start

### Prerequisites

- Node.js v20.0+
- API keys for your chosen model providers

### Installation

```bash
# Clone and install
git clone <repository-url>
cd mastra-agent-framework
npm install

# Configure environment
cp .env.example .env
# Edit .env with your API keys

# Start development server
npm run dev
```

### Basic Usage

```bash
# Development with hot-reload
npm run dev

# Build for production  
npm run build

# Run tests
npm test

# Initialize RAG system (optional)
npm run rag:init
```

## Architecture

```
├── src/mastra/           # Core business logic
│   ├── agents/           # Specialized AI agents
│   ├── tools/            # Business-specific tools
│   ├── workflows/        # Business processes
│   ├── networks/         # Agent coordination
│   └── index.ts          # Main configuration
├── libs/                 # Extensible plugins
│   ├── rag/             # RAG system
│   ├── security/        # Security components
│   └── workflows/       # Advanced workflow architecture
└── tests/               # Comprehensive test suite
```

## Key Components

### Agents
- **Weather Agent**: Real-time weather data and activity planning
- **Eight Ball Agent**: Mystical guidance with multi-language support
- **Quotes Agent**: Inspirational wisdom from famous authors
- **Autonomous Network**: Intelligent coordination between agents

### MCP Server Integration
Access agents externally via HTTP endpoints:

```bash
# Weather Agent
http://localhost:4112/api/mcp/weatherAgent/mcp

# Autonomous Network  
http://localhost:4112/api/mcp/autonomousNetwork/mcp

# Available tools: ask_weatherAgent, weatherTool, eightBallTool, quotesTool
```

### RAG System
Enhance agents with retrieval-augmented generation:

- **Vector Databases**: LibSQL, Chroma, PostgreSQL+pgvector, Pinecone
- **Document Processing**: Multiple chunking strategies
- **Advanced Search**: Semantic search, reranking, hybrid search

## Configuration

Key environment variables:

```env
# Model Providers
GOOGLE_GENERATIVE_AI_API_KEY=your_key
GROQ_API_KEY=your_key
OPENAI_API_KEY=your_key
ANTHROPIC_API_KEY=your_key

# Models
GEMINI_MODEL=gemini-2.5-pro
GROQ_MODEL=llama-3.3-70b-versatile
OPENAI_MODEL=gpt-4o-mini

# RAG (optional)
VECTOR_DB_PROVIDER=libsql
RAG_DATABASE_URL=file:../rag-vectors.db
EMBEDDING_MODEL=text-embedding-3-small

# MCP Server
SITE_URL=http://localhost:4112
```

## Testing

```bash
# Run all tests
npm test

# Test with UI
npm run test:ui

# Coverage report
npm run test:coverage

# Evaluation pipeline
npm run eval:ci
```

## Deployment

### Development
```bash
npm run dev
```

### Production
```bash
npm run build
npm run start
```

### Docker
```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
RUN npm run build
EXPOSE 4112
CMD ["npm", "start"]
```

## Documentation

- **[Development Guide](./DEVELOPMENT_GUIDE.md)** - Comprehensive development documentation
- **[Architecture Overview](./docs/)** - Detailed architectural patterns
- **[API Reference](./docs/)** - Complete API documentation

## Examples

### Creating a New Agent

```typescript
// src/mastra/agents/my-agent.ts
import { Agent } from '@mastra/core/agent';
import { groq } from '@ai-sdk/groq';

export const myAgent = new Agent({
  name: 'My Agent',
  model: groq('llama-3.3-70b-versatile'),
  tools: { myTool },
  instructions: 'You are a specialized agent that...',
});
```

### Adding RAG Capabilities

```typescript
// Enhanced with vector search
import { myVectorQueryTool } from '../../libs/rag/query-tools';

export const myAgent = new Agent({
  // ... basic config
  tools: { myTool, myVectorQueryTool },
});
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Follow the existing architectural patterns
4. Add tests for new features
5. Update documentation
6. Submit a pull request

## License

MIT License - see [LICENSE](LICENSE) file for details.

## Resources

- [Mastra Documentation](https://docs.mastra.ai)
- [Model Context Protocol](https://modelcontextprotocol.io)
- [AI SDK Documentation](https://ai-sdk.dev)

---

**Built with [Mastra](https://mastra.ai) 🚀**