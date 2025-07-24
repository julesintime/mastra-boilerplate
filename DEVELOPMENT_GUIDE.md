# Mastra Agent Framework - Development Guide

This comprehensive guide provides everything you need to work with and extend the Mastra AI agent framework. It serves as your primary reference for development, configuration, and deployment.

## 📋 Table of Contents

- [Project Overview](#project-overview)
- [Quick Start](#quick-start)
- [Architecture](#architecture)
- [Development Commands](#development-commands)
- [Agent Development](#agent-development)
- [RAG System](#rag-system)
- [Security Features](#security-features)
- [Workflow Extensions](#workflow-extensions)
- [Testing & Evaluation](#testing--evaluation)
- [MCP Server Integration](#mcp-server-integration)
- [Deployment](#deployment)
- [Configuration Reference](#configuration-reference)
- [Troubleshooting](#troubleshooting)

## Project Overview

This is a **production-ready Mastra AI project** demonstrating a clean, scalable architecture with multiple specialized agents, tools, workflows, and networks. The framework is organized to separate core business logic from extensible plugins and utilities.

### Key Features

- **🤖 Multi-Agent Architecture**: Weather, Eight Ball, and Quotes agents with autonomous coordination
- **🔄 Intelligent Workflows**: Complex multi-step processes with conditional logic and error handling  
- **🔍 RAG System**: Retrieval-Augmented Generation with multiple vector database support
- **🔒 Security Layer**: Authentication, authorization, input validation, and rate limiting
- **🔌 MCP Server Integration**: Expose agents as Model Context Protocol servers for external tools
- **📊 Comprehensive Monitoring**: OpenTelemetry tracing, evaluation metrics, and performance analytics
- **⚡ Multiple Model Providers**: Google Gemini, Groq Llama, OpenAI GPT, Anthropic Claude

### Organizational Structure

```
├── src/mastra/           # Core Mastra framework components
│   ├── agents/           # Business logic agents
│   ├── tools/            # Business-specific tools
│   ├── workflows/        # Business workflows
│   ├── networks/         # Agent coordination
│   ├── mcps.ts          # MCP server configurations
│   └── index.ts         # Main Mastra configuration
├── libs/                 # Extensible plugins and utilities
│   ├── rag/             # RAG system implementation
│   ├── security/        # Security components
│   └── workflows/       # Advanced workflow architecture
├── tests/               # Comprehensive test suite
│   ├── agents/          # Agent evaluation tests
│   ├── evaluation/      # Evaluation system tests
│   └── security/        # Security validation tests
└── docs/                # Documentation
```

## Quick Start

### Prerequisites

- Node.js v20.0+
- API keys for your chosen model providers

### Installation

```bash
# Install dependencies
npm install

# Configure environment variables
cp .env.example .env
# Edit .env with your API keys and configuration

# Initialize RAG system (optional)
npm run rag:init

# Start development server
npm run dev
```

### Essential Commands

```bash
# Development
npm run dev                    # Start with interactive playground
npm run build                  # Build for production
npm run start                  # Start production server

# Testing
npm test                       # Run comprehensive test suite
npm run test:ui                # Interactive test UI
npm run test:coverage          # Coverage reporting
npm run eval:ci                # Run evaluation pipeline

# Utilities
npm run lint                   # Code linting
npm run typecheck              # TypeScript validation
```

## Architecture

### Core Components

#### **Agents** (Business Logic)
Specialized AI agents with persistent memory and tool access:

```typescript
export const weatherAgent = new Agent({
  name: 'Weather Agent',
  description: 'Weather assistant with real-time data access',
  model: groq('llama-3.3-70b-versatile'), // Fast inference with excellent tool calling
  tools: { weatherTool, weatherVectorQueryTool, weatherGraphQueryTool },
  memory: new Memory({
    storage: new LibSQLStore({
      url: 'file:../mastra.db',
    }),
  }),
  evals: {
    answerRelevancy: new AnswerRelevancyMetric(model, { uncertaintyWeight: 0.3 }),
    faithfulness: new FaithfulnessMetric(model, { context: [] }),
    hallucination: new HallucinationMetric(model, { context: [] }),
    // ... additional evaluation metrics
  },
});
```

#### **Tools** (Business Capabilities)  
External API integrations and custom functionality:

```typescript
export const weatherTool = createTool({
  id: 'get_weather',
  description: 'Fetch current weather data from Open-Meteo API',
  inputSchema: z.object({
    location: z.string().describe('Location to get weather for'),
  }),
  outputSchema: z.object({
    temperature: z.number(),
    description: z.string(),
    humidity: z.number(),
    // ... additional weather data
  }),
  execute: async ({ context }) => {
    // Real API integration with Open-Meteo
    const response = await fetch(`${API_URL}?location=${context.location}`);
    return await response.json();
  },
});
```

#### **Networks** (Agent Coordination)
Coordinate multiple agents for complex tasks:

```typescript
export const autonomousNetwork = new AgentNetwork({
  name: 'Autonomous Intelligence Network',
  description: 'Coordinates specialized agents for complex multi-domain tasks',
  model: google('gemini-2.5-flash'), // Fast coordination model
  agents: [weatherAgent, eightBallAgent, quotesAgent],
});
```

#### **Workflows** (Business Processes)
Multi-step processes with conditional logic and error handling:

```typescript
export const tripMotivationWorkflow = new Workflow({
  name: 'Trip Motivation Workflow',
  steps: {
    getWeather: step(weatherInputSchema, weatherOutputSchema, {
      run: async (input, context) => {
        return await weatherAgent.generate(`Get weather for ${input.destination}`);
      },
    }),
    getMotivation: step(motivationInputSchema, motivationOutputSchema, {
      run: async (input, context) => {
        const weatherInfo = context.fromStep('getWeather');
        return await quotesAgent.generate(`Provide travel motivation for ${input.destination} with ${weatherInfo.description} weather`);
      },
    }),
  },
});
```

### Plugin Architecture (libs/)

#### **RAG System** (`libs/rag/`)
Retrieval-Augmented Generation capabilities:

- **Multi-database Support**: LibSQL, Chroma, PostgreSQL+pgvector, Pinecone
- **Flexible Document Processing**: Multiple chunking strategies and content types
- **Advanced Retrieval**: Semantic search, reranking, hybrid search
- **Agent Integration**: Specialized tools for each agent type

#### **Security Layer** (`libs/security/`)
Production-ready security components:

- **Authentication**: JWT-based auth with role management
- **Authorization**: RBAC (Role-Based Access Control)
- **Input Validation**: Comprehensive input sanitization
- **Rate Limiting**: Configurable rate limiting with multiple strategies
- **API Key Management**: Secure key rotation and validation

#### **Workflow Extensions** (`libs/workflows/`)
Advanced workflow capabilities:

- **Workflow Builder**: Declarative workflow construction
- **Performance Monitoring**: Real-time execution tracking
- **Template System**: Pre-built business process templates
- **Error Handling**: Sophisticated retry and compensation logic

## Development Commands

### Core Development

```bash
# Start development server with hot-reload
npm run dev

# Build the project using Mastra CLI
npm run build

# Start the built project
npm run start
```

### Testing & Quality

```bash
# Run all tests
npm test

# Run tests with interactive UI
npm run test:ui

# Run tests once (non-watch mode)
npm run test:run

# Run tests with coverage reporting
npm run test:coverage

# Run evaluation pipeline
npm run eval:ci

# Code quality checks
npm run lint
npm run typecheck
```

### RAG System Commands

```bash
# Initialize vector database and populate with sample data
npm run rag:init

# Test vector database connection
npm run rag:test

# Rebuild vector indexes
npm run rag:rebuild
```

## Agent Development

### Creating New Agents

1. **Create Agent File** in `src/mastra/agents/`:

```typescript
// src/mastra/agents/my-agent.ts
import { Agent } from '@mastra/core/agent';
import { groq } from '@ai-sdk/groq';
import { Memory } from '@mastra/memory';
import { LibSQLStore } from '@mastra/libsql';
import { myTool } from '../tools/my-tool';

export const myAgent = new Agent({
  name: 'My Specialized Agent',
  description: 'Description for MCP exposure',
  instructions: `You are a specialized agent that...`,
  model: groq('llama-3.3-70b-versatile'),
  tools: { myTool },
  memory: new Memory({
    storage: new LibSQLStore({
      url: 'file:../mastra.db',
    }),
  }),
  evals: {
    // Add relevant evaluation metrics
    answerRelevancy: new AnswerRelevancyMetric(model),
  },
});
```

2. **Create Supporting Tool** in `src/mastra/tools/`:

```typescript
// src/mastra/tools/my-tool.ts
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

export const myTool = createTool({
  id: 'my_tool_id',
  description: 'Clear description of what the tool does',
  inputSchema: z.object({
    param: z.string().describe('Parameter description'),
  }),
  outputSchema: z.object({
    result: z.string().describe('Result description'),
  }),
  execute: async ({ context }) => {
    // Tool implementation
    return { result: 'processed data' };
  },
});
```

3. **Register Agent** in `src/mastra/index.ts`:

```typescript
import { myAgent } from './agents/my-agent';

export const mastra = new Mastra({
  agents: {
    weatherAgent,
    eightBallAgent,
    quotesAgent,
    myAgent, // Add your agent
  },
  // ... rest of configuration
});
```

4. **Add MCP Server** (optional) in `src/mastra/mcps.ts`:

```typescript
export function createMyAgentServer(myAgent: any) {
  return new MCPServer({
    name: 'My Agent MCP Server',
    version: '1.0.0',
    description: 'Exposes my agent via MCP for external clients',
    tools: { myTool },
    agents: { myAgent },
  });
}
```

### Agent Specializations

The framework includes three example specialized agent types:

- **Weather Agent**: Real-time weather information and activity planning
- **Eight Ball Agent**: Mystical guidance with multi-language support  
- **Quotes Agent**: Inspirational wisdom from famous authors

Each agent demonstrates:
- **Model Selection**: Optimal model choice for the agent's purpose
- **Tool Integration**: Specialized tools that match domain expertise
- **Memory Persistence**: Conversation history and context retention
- **Evaluation Metrics**: Quality assessment specific to the agent's output type

### Model Configuration

Models are configured with **general names** (not agent-specific) in `.env`:

```env
# Primary models for general use
GEMINI_MODEL=gemini-2.5-pro
GROQ_MODEL=llama-3.3-70b-versatile
OPENAI_MODEL=gpt-4o-mini
ANTHROPIC_MODEL=claude-3-5-sonnet-20241022

# Fast models for quick responses
GEMINI_FAST_MODEL=gemini-2.5-flash
GROQ_FAST_MODEL=llama-3.1-8b-instant

# Tool-optimized models for complex tool calling
GROQ_TOOL_MODEL=llama-3.3-70b-versatile
OPENAI_TOOL_MODEL=gpt-4o
```

Agents select optimal models programmatically based on their needs:

```typescript
// Fast model for simple responses
model: google('gemini-2.5-flash')

// Tool-optimized model for API calls
model: groq('llama-3.3-70b-versatile')

// Reasoning model for complex tasks
model: openai('gpt-4o')
```

## RAG System

The RAG (Retrieval-Augmented Generation) system enhances agent responses by incorporating relevant context from a knowledge base.

### Quick Setup

```bash
# Configure RAG in .env
VECTOR_DB_PROVIDER=libsql
RAG_DATABASE_URL=file:../rag-vectors.db
EMBEDDING_PROVIDER=openai
EMBEDDING_MODEL=text-embedding-3-small

# Initialize RAG system
npm run rag:init

# Test agent interactions with RAG capabilities
npm run dev
```

### Supported Vector Databases

| **Database** | **Best For** | **Setup** |
|--------------|--------------|-----------|
| **LibSQL** | Development, embedded apps | `VECTOR_DB_PROVIDER=libsql` |
| **Chroma** | Local experimentation | `docker run -p 8000:8000 chromadb/chroma` |
| **PostgreSQL+pgvector** | Production, existing PostgreSQL | Install pgvector extension |
| **Pinecone** | Managed service, scale | Create index with 1536 dimensions |

### Agent Integration

Each agent has specialized vector query capabilities:

- **Weather Agent**: `weatherVectorQueryTool` - Weather patterns and activity suggestions
- **Eight Ball Agent**: `eightBallVectorQueryTool` - Mystical wisdom and interpretations
- **Quotes Agent**: `quotesVectorQueryTool` - Inspirational quotes and life wisdom

### Advanced Features

#### Reranking
```env
RAG_RERANKING_ENABLED=true
RERANK_PROVIDER=mastra
RERANK_MODEL=gpt-4o-mini
```

#### Hybrid Search
```typescript
const results = await hybridSearchTool.execute({
  context: {
    query: 'sunny weather activities',
    keywords: ['outdoor', 'sports', 'beach'],
    vectorWeight: 0.7,
    keywordWeight: 0.3,
  },
});
```

#### Metadata Filtering
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

## Security Features

The security layer (`libs/security/`) provides production-ready security components:

### Authentication & Authorization

```typescript
// libs/security/auth-manager.ts
import { AuthManager } from '../../libs/security/auth-manager';
import { RBACManager } from '../../libs/security/rbac-manager';

const authManager = new AuthManager({
  jwtSecret: process.env.JWT_SECRET!,
  tokenExpiry: '24h',
});

const rbac = new RBACManager();
rbac.createRole('admin', ['read', 'write', 'delete']);
rbac.createRole('user', ['read']);
```

### Input Validation

```typescript
// libs/security/input-validator.ts
import { InputValidator } from '../../libs/security/input-validator';

const validator = new InputValidator({
  maxLength: 1000,
  allowedPatterns: [/^[a-zA-Z0-9\s.,!?-]+$/],
  blockedPatterns: [/<script/i, /javascript:/i],
});

const sanitized = validator.sanitize(userInput);
```

### Rate Limiting

```typescript
// libs/security/rate-limiter.ts
import { RateLimiter } from '../../libs/security/rate-limiter';

const rateLimiter = new RateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  maxRequests: 100,
  strategy: 'sliding-window',
});
```

## Workflow Extensions

The workflow system (`libs/workflows/`) provides advanced workflow capabilities beyond basic Mastra workflows.

### Workflow Builder

```typescript
import { WorkflowBuilder, WorkflowSteps } from '../../libs/workflows/architecture';

const complexWorkflow = new WorkflowBuilder('data-processing', 'Data Processing Pipeline')
  .description('Complete data processing with validation and transformation')
  .addSteps([
    WorkflowSteps.validation(inputSchema, 'validate-input'),
    WorkflowSteps.transform(inputSchema, outputSchema, transformer, 'transform-data'),
    WorkflowSteps.apiCall({
      stepId: 'store-data',
      url: 'https://api.example.com/store',
      method: 'POST',
      headers: { 'Authorization': `Bearer ${process.env.API_TOKEN}` },
    }),
  ])
  .errorHandling({
    strategy: 'retry-all',
    errorNotification: {
      channels: ['webhook'],
      config: { url: process.env.ERROR_WEBHOOK_URL },
    },
  })
  .build();
```

### Performance Monitoring

```typescript
import { workflowMonitor, workflowAnalyzer } from '../../libs/workflows/monitoring';

// Monitor workflow execution
const executionId = workflowMonitor.startWorkflowExecution('data-processing', '1.0.0', input);

// Analyze performance
const report = workflowAnalyzer.analyzePerformance('data-processing');
console.log(`Health Score: ${report.overallHealth}`);
console.log(`Bottlenecks: ${report.bottlenecks.length}`);
```

### Pre-built Templates

The system includes templates for common business processes:

- **Data Processing Pipeline**: Validation, transformation, storage
- **Approval Workflow**: Multi-stage approval with escalation
- **Content Generation**: AI-powered content with quality checks
- **Customer Service**: Automated service with human escalation

## Testing & Evaluation

### Comprehensive Test Suite

The project includes robust testing built with **Vitest**:

```bash
# Run all tests
npm test

# Run specific test files
npm test -- tests/agents/weather-agent.test.ts

# Run with coverage
npm run test:coverage

# Interactive test UI
npm run test:ui
```

### Evaluation Metrics

Each agent includes comprehensive evaluation metrics:

#### LLM-based Metrics
- **Answer Relevancy**: How well responses match queries
- **Faithfulness**: Accuracy relative to retrieved context  
- **Hallucination Detection**: Identifies information not in context
- **Bias Detection**: Identifies potential bias in responses
- **Toxicity Detection**: Ensures safe and appropriate responses

#### NLP-based Metrics  
- **Completeness**: Measures response completeness
- **Content Similarity**: Semantic similarity analysis
- **Tone Consistency**: Maintains appropriate tone
- **Keyword Coverage**: Ensures key topics are addressed

#### Agent-Specific Quality Assurance
- **Weather Agent**: Factual accuracy validation, safety recommendations
- **Eight Ball Agent**: Bias prevention, tone appropriateness
- **Quotes Agent**: Attribution accuracy, inspirational quality

### Continuous Evaluation

```bash
# Run evaluation pipeline
npm run eval:ci

# View evaluation results
cat eval-results/latest-summary.txt
```

## MCP Server Integration

The **Model Context Protocol (MCP) Server** integration is a primary feature, enabling external tools to access agents.

### HTTP/SSE Endpoints

When running the development server, agents are automatically exposed:

| **Agent/Network** | **MCP Endpoint** | **Exposed Tools** |
|-------------------|-------------------|-------------------|
| **Weather Agent** | `http://localhost:4112/api/mcp/weatherAgent/mcp` | `ask_weatherAgent`, `weatherTool` |
| **Autonomous Network** | `http://localhost:4112/api/mcp/autonomousNetwork/mcp` | `ask_autonomousNetwork`, all agent tools |
| **Trip Motivation Workflow** | `http://localhost:4112/api/mcp/tripMotivationWorkflow/mcp` | `run_tripMotivationWorkflow` |

### External Tool Access

Available tools exposed via MCP protocol:
- `ask_weatherAgent` - Direct weather agent conversation
- `ask_autonomousNetwork` - Multi-agent coordination  
- `run_tripMotivationWorkflow` - Weather info + inspirational quotes for travel
- `weatherTool` - Real-time weather data fetching
- `eightBallTool` - Mystical guidance responses
- `quotesTool` - Inspirational quotes retrieval

### Integration Examples

#### Claude Code Integration
```json
{
  "mcpServers": {
    "mastra-weather": {
      "command": "npx",
      "args": ["--yes", "@modelcontextprotocol/server-fetch"],
      "env": {
        "MASTRA_ENDPOINT": "http://localhost:4112/api/mcp/weatherAgent/mcp"
      }
    }
  }
}
```

#### Direct HTTP Access
```bash
# Test MCP endpoint availability
curl -X GET "http://localhost:4112/api/mcp/weatherAgent/mcp"

# List available tools
curl -X POST "http://localhost:4112/api/mcp/weatherAgent/messages" \
  -H "Content-Type: application/json" \
  -d '{"method": "tools/list"}'
```

## Deployment

### Development

```bash
npm run dev
```

Provides:
- Interactive playground at the provided local URL
- Hot-reload for code changes
- Automatic MCP server exposure
- Debug logging and tracing

### Production

```bash
# Build the application
npm run build

# Start production server  
npm run start
```

### Docker (Optional)

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

### Environment Configuration

```env
# API Keys
GOOGLE_GENERATIVE_AI_API_KEY=your_google_api_key
GROQ_API_key=your_groq_api_key
OPENAI_API_KEY=your_openai_api_key
ANTHROPIC_API_KEY=your_anthropic_api_key

# Model Configuration
GEMINI_MODEL=gemini-2.5-pro
GROQ_MODEL=llama-3.3-70b-versatile
OPENAI_MODEL=gpt-4o-mini
ANTHROPIC_MODEL=claude-3-5-sonnet-20241022

# Fast Models
GEMINI_FAST_MODEL=gemini-2.5-flash
GROQ_FAST_MODEL=llama-3.1-8b-instant

# Tool-optimized Models
GROQ_TOOL_MODEL=llama-3.3-70b-versatile
OPENAI_TOOL_MODEL=gpt-4o

# MCP Server Configuration
SITE_URL=http://localhost:4112
WEATHER_MCP_SERVER_NAME=weatherAgent
NETWORK_MCP_SERVER_NAME=autonomousNetwork

# RAG Configuration
VECTOR_DB_PROVIDER=libsql
RAG_DATABASE_URL=file:../rag-vectors.db
EMBEDDING_PROVIDER=openai
EMBEDDING_MODEL=text-embedding-3-small
RAG_TOP_K=5
RAG_MIN_SIMILARITY=0.7

# Security Configuration
JWT_SECRET=your_jwt_secret_key
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

# Observability
OTEL_ENABLED=true
LOG_LEVEL=debug
OTEL_SERVICE_NAME=mastra-agent-framework
OTEL_SAMPLING_RATE=1.0
```

## Configuration Reference

### Storage Configuration

- **Agent Memory**: Persistent file storage at `../mastra.db` (relative to `.mastra/output` directory)
- **Telemetry/Logs**: In-memory storage (`:memory:`)
- **Vector Database**: Configurable (LibSQL, Chroma, PostgreSQL, Pinecone)

### Logging and Observability

```typescript
telemetry: {
  serviceName: 'mastra-agent-framework',
  enabled: true,
  sampling: { type: 'always_on' },
  export: { type: 'console' }, // or 'otlp' for production
}
```

### Model Providers

| **Provider** | **Primary Models** | **Fast Models** | **Tool Models** | **Strengths** |
|--------------|-------------------|------------------|-----------------|---------------|
| **Google** | gemini-2.5-pro | gemini-2.5-flash | gemini-2.5-pro | Multimodal, reasoning |
| **Groq** | llama-3.3-70b-versatile | llama-3.1-8b-instant | llama-3.3-70b-versatile | Ultra-fast inference |
| **OpenAI** | gpt-4o-mini | gpt-4o-mini | gpt-4o | Industry standard |
| **Anthropic** | claude-3-5-sonnet | claude-3-5-haiku | claude-3-5-sonnet | Advanced reasoning |

## Troubleshooting

### Common Issues

#### 1. Vector Database Connection Errors
```bash
# Check database connectivity
npm run rag:init
```

#### 2. Embedding API Rate Limits
```env
# Reduce batch size
EMBEDDING_BATCH_SIZE=5
```

#### 3. Low Retrieval Quality
```env
# Adjust similarity threshold
RAG_MIN_SIMILARITY=0.6

# Enable reranking
RAG_RERANKING_ENABLED=true
```

#### 4. Memory Issues with Large Documents
```env
# Reduce chunk size
CHUNK_SIZE=256
CHUNK_OVERLAP=25
```

#### 5. Model Selection Issues
```env
# Verify API keys are set
GOOGLE_GENERATIVE_AI_API_KEY=your_key
GROQ_API_KEY=your_key

# Check model names match provider specifications
GEMINI_MODEL=gemini-2.5-pro
GROQ_MODEL=llama-3.3-70b-versatile
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

# Test MCP endpoints
curl -X GET "http://localhost:4112/api/mcp/weatherAgent/mcp"
```

### Performance Optimization

#### Model Selection Strategy
- **Fast Models**: Use for simple responses (gemini-2.5-flash, llama-3.1-8b-instant)
- **Tool Models**: Use for complex tool calling (llama-3.3-70b-versatile, gpt-4o)
- **Reasoning Models**: Use for complex analysis (gemini-2.5-pro, claude-3-5-sonnet)

#### RAG Optimization
```env
# Embedding configuration
EMBEDDING_MODEL=text-embedding-3-small  # Fast and cost-effective
EMBEDDING_DIMENSIONS=1536

# Vector index tuning
VECTOR_EF_CONSTRUCTION=200
VECTOR_M=16
VECTOR_MAX_CONNECTIONS=16

# Caching
RAG_CACHING_ENABLED=true
RAG_CACHE_TTL=3600
```

## Extending the Framework

### Adding New Capabilities

1. **New Agents**: Create in `src/mastra/agents/`
2. **New Tools**: Create in `src/mastra/tools/`  
3. **New Workflows**: Create in `src/mastra/workflows/`
4. **New Plugins**: Create in `libs/` for reusable extensions

### Plugin Development

Create new plugins in the `libs/` directory:

```
libs/
├── my-plugin/
│   ├── index.ts          # Main plugin export
│   ├── config.ts         # Plugin configuration
│   ├── tools.ts          # Plugin-specific tools
│   └── README.md         # Plugin documentation
```

### Contributing Guidelines

1. Follow the existing architectural patterns
2. Separate business logic (src/mastra/) from plugins (libs/)
3. Add comprehensive tests in `tests/`
4. Update documentation and types
5. Test with multiple model providers
6. Follow the evaluation framework for quality assurance

## Resources

- [Mastra Documentation](https://docs.mastra.ai)
- [Model Provider Documentation](https://ai-sdk.dev/providers)
- [OpenTelemetry Integration](https://docs.mastra.ai/observability)
- [MCP Specification](https://modelcontextprotocol.io)
- [Vitest Testing Framework](https://vitest.dev)

---

**Built with [Mastra](https://mastra.ai) - The TypeScript AI Agent Framework**