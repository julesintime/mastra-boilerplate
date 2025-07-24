# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

### Required Tools Usage
- **Use `context7`** for accessing up-to-date library documentation when needed
- **MANDATORY: Use `mastra-docs` tools BEFORE any coding tasks** - Check documentation, examples, and recent changes to ensure code follows latest patterns and best practices

## Project Overview

This is a Mastra AI project - a TypeScript agent framework for building AI applications. The project demonstrates a clean, production-ready Mastra architecture with multiple specialized agents, tools, workflows, and networks, all exposed via MCP servers for external integration.

## Available Commands

- `npm run dev` - Start Mastra development server with local playground
- `npm run build` - Build the project using Mastra CLI  
- `npm run start` - Start the built project
- `npm test` - No tests configured yet

## Architecture & Structure

### Core Components

- **Main Configuration**: `src/mastra/index.ts` - Central Mastra instance with agents, workflows, networks, storage, and MCP server configuration
- **Agents**:
  - `src/mastra/agents/weather-agent.ts` - Weather assistant using Google Gemini with memory and weather tool integration
  - `src/mastra/agents/eightball-agent.ts` - Mystical guidance agent using the magic eight ball tool
  - `src/mastra/agents/quotes-agent.ts` - Inspirational quote agent for motivation and wisdom
- **Tools**:
  - `src/mastra/tools/weather-tool.ts` - Tool for fetching real weather data from Open-Meteo API
  - `src/mastra/tools/eightball-tool.ts` - Tool for generating magic eight ball responses
  - `src/mastra/tools/quotes-tool.ts` - Tool for fetching inspirational quotes from famous authors
- **Workflows**: `src/mastra/workflows/weather-workflow.ts` - Two-step workflow: fetch weather data → generate activity suggestions
- **Networks**: `src/mastra/networks/autonomous-network.ts` - Autonomous intelligence network coordinating multiple agents
- **MCP Servers**: `src/mastra/mcps.ts` - MCP server factory functions for exposing agents and tools to external clients

### Agent Specializations

The project demonstrates three specialized agent types:

- **Weather Agent**: Provides real-time weather information and activity planning based on weather conditions
- **Eight Ball Agent**: Offers mystical guidance through magic eight ball readings with various sentiment types and languages
- **Quotes Agent**: Shares inspirational quotes from famous authors for motivation and wisdom

Each agent uses:
- Google Gemini (`gemini-2.5-pro`) as the language model
- Memory persistence with LibSQL storage
- Specialized tools that match their domain expertise

### Key Dependencies

- **@mastra/core** - Main Mastra framework
- **@mastra/mcp** - MCP server for exposing agents and tools to external clients
- **@mastra/memory** - Agent memory management 
- **@mastra/libsql** - SQLite storage backend (file-based for agent memory, in-memory for telemetry)
- **@ai-sdk/google** - Google Gemini model integration
- **zod** - Schema validation

### Storage Configuration

- Agent memory: Persistent file storage at `../mastra.db` (relative to `.mastra/output` directory)
- Telemetry/logs: In-memory storage (`:memory:`)

### Model Configuration

The template demonstrates multiple model providers:
- **Weather & Eight Ball Agents**: Google Gemini (`gemini-2.5-pro`) for general conversation
- **Quotes Agent**: Groq Llama (`llama-3.3-70b-versatile`) for fast inference with excellent tool calling support

To change models, update the `model` property in the agent configuration. Supported providers include:
- `google()` - Gemini models 
- `groq()` - Llama models with fast inference
- `openai()` - GPT models
- `anthropic()` - Claude models
- `cohere()` - Command models

### Logging and Observability Configuration

The project is configured with comprehensive logging and tracing:

#### Logging
- **Logger**: PinoLogger with debug level for detailed operation tracking
- **Levels**: debug, info, warn, error (all enabled)
- **Output**: Console output for development

#### Tracing (OpenTelemetry)
- **Service Name**: `mastra-agent-framework`
- **Sampling**: `always_on` (all traces collected for development)
- **Export**: Console output for development
- **Automatic Instrumentation**: Traces all core operations (agents, tools, workflows, networks)

To configure for production:
```typescript
telemetry: {
  serviceName: 'your-production-service',
  enabled: true,
  sampling: {
    type: 'ratio',
    probability: 0.1, // Sample 10% of traces
  },
  export: {
    type: 'otlp',
    endpoint: 'https://your-otel-collector.com/v1/traces',
    headers: {
      'Authorization': 'Bearer your-token',
    },
  },
}
```

## MCP Server Implementation

**MCPServer implementation follows Mastra's framework-integrated approach** - no external dependencies or custom scripts needed.

### Framework-Integrated MCP Servers

The project exposes agents, tools, and networks via MCPServer through Mastra's built-in configuration:

1. **MCPServer Registration**: Configured in `src/mastra/index.ts` via `mcpServers` property
2. **Automatic Exposure**: Mastra dev server automatically exposes MCP endpoints
3. **Available Endpoints**:
   - **Weather Agent**: `http://localhost:4112/api/mcp/weatherAgent/mcp`
   - **Autonomous Network**: `http://localhost:4112/api/mcp/autonomousNetwork/mcp`
   - **Messages**: `http://localhost:4112/api/mcp/{serverName}/messages?sessionId=<id>`
   - **Server List**: Available via Mastra playground

### Exposed Tools and Agents via MCPServer

#### Weather Agent Server
- `ask_weatherAgent` - Direct access to the weather agent for natural language queries
- `weatherTool` - Direct access to weather data fetching

#### Autonomous Network Server
- `ask_autonomousNetwork` - Access to the intelligent network coordinating all agents
- `weatherTool` - Direct access to weather data fetching
- `eightBallTool` - Direct access to magic eight ball readings
- `quotesTool` - Direct access to inspirational quotes

### External MCP Client Access

External MCP clients (like Claude Code) can connect using the framework's built-in endpoints. The Mastra framework handles session management and protocol compliance automatically.

Example external access:
```bash
# Connect to weather agent via MCP
curl http://localhost:4112/api/mcp/weatherAgent/mcp

# Connect to autonomous network via MCP  
curl http://localhost:4112/api/mcp/autonomousNetwork/mcp
```

## Development Workflow

1. Use `npm run dev` to start the development server with interactive playground
2. Access the Mastra playground at the provided local URL
3. Test agents, workflows, and networks interactively
4. Use MCP endpoints to integrate with external clients like Claude Code
5. Modify code - the dev server supports hot reloading
6. MCP servers are automatically exposed when the dev server starts

## Testing & Validation

- The weather tool integrates with Open-Meteo API for real weather data
- The eight ball tool provides randomized responses with different sentiment types
- The quotes tool fetches inspirational content from famous authors
- The workflow demonstrates chaining operations and streaming responses for activity planning
- The autonomous network coordinates between multiple specialized agents
- MCP servers expose all functionality to external clients

## Important Notes

- Database paths are relative to Mastra's output directory (`.mastra/output`)
- The project uses ES modules (`"type": "module"`)
- TypeScript configuration targets ES2022 with strict checking enabled
- Environment variables should be stored in `.env` file
- MCP servers are automatically exposed by the Mastra framework
- All agents use standard Mastra Agent class with framework-native memory and tool integration

## Additional Template Enhancements

Based on Mastra's comprehensive feature set, consider adding these important capabilities to your template:

### 🧪 **Evaluation System (Evals)**
Add automated testing and quality measurement for agent responses:

```typescript
// Add to agent configuration
import { SummarizationMetric, ContentSimilarityMetric, ToneConsistencyMetric } from '@mastra/evals';

evals: {
  summarization: new SummarizationMetric(model),
  contentSimilarity: new ContentSimilarityMetric(),
  tone: new ToneConsistencyMetric(),
}
```

**Benefits**: Quantifiable quality metrics, CI/CD integration, performance tracking over time

### 🔍 **RAG (Retrieval-Augmented Generation)**
Enable agents to work with your own data sources:

```typescript
// Vector database integration
import { PgVector } from '@mastra/pg';
import { createVectorQueryTool } from '@mastra/rag';

const vectorQueryTool = createVectorQueryTool({
  vectorStoreName: 'pgVector',
  indexName: 'knowledge_base',
  model: openai.embedding('text-embedding-3-small'),
});
```

**Benefits**: Context-aware responses, enterprise knowledge integration, document processing

### 🏗️ **Advanced Workflows**
Complex multi-step processes with conditional logic:

```typescript
// Multi-step workflow with branching
const advancedWorkflow = new Workflow({
  name: 'Advanced Processing Workflow',
  steps: {
    analyze: step(...),
    decide: step(...),
    processA: step(...),
    processB: step(...),
  }
});
```

**Benefits**: Complex business processes, conditional execution, error handling

### 🌐 **Multi-Model Networks**
Coordinate different specialized agents:

```typescript
// Agent network with specialized roles
const smartNetwork = new AgentNetwork({
  name: 'Smart Processing Network',
  agents: [analyzeAgent, processAgent, validateAgent],
  coordinator: coordinatorAgent,
});
```

**Benefits**: Task specialization, load distribution, complex problem solving

## Architecture Template

This project serves as a template for Mastra agent development following official Mastra patterns and folder structure conventions:

### Recommended Folder Structure
```
src/mastra/
├── agents/           # Agent definitions
├── tools/            # Tool implementations  
├── workflows/        # Workflow definitions
├── networks/         # Agent networks
├── mcps.ts          # MCP server configurations (optional)
└── index.ts         # Main Mastra configuration
```

**Key Points:**
- **No nested folders**: MCP configurations go directly in `src/mastra/` as per Mastra conventions
- **Single file approach**: MCP server factory functions in one file rather than a separate folder
- **Clean imports**: Direct file imports without unnecessary index.ts files
- **Standard structure**: Follows the official Mastra project structure patterns

### Development Patterns

### Agent Pattern
```typescript
import { Agent } from '@mastra/core/agent';
import { groq } from '@ai-sdk/groq'; // or google, openai, anthropic, etc.
import { Memory } from '@mastra/memory';
import { LibSQLStore } from '@mastra/libsql';
import { yourTool } from '../tools/your-tool';

export const yourAgent = new Agent({
  name: 'Your Agent Name',
  description: 'Clear description for MCP exposure',
  instructions: 'Detailed instructions...',
  model: groq('llama-3.3-70b-versatile'), // Fast inference with excellent tool calling
  tools: { yourTool },
  memory: new Memory({
    storage: new LibSQLStore({
      url: 'file:../mastra.db',
    }),
  }),
});
```

### Tool Pattern
```typescript
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

export const yourTool = createTool({
  id: 'your_tool_id',
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

### MCP Server Pattern
Create `src/mastra/mcps.ts` for MCP server factory functions:

```typescript
// src/mastra/mcps.ts
import { MCPServer } from '@mastra/mcp';
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { weatherTool } from './tools/weather-tool';
import { yourTool } from './tools/your-tool';

/**
 * Creates MCP server that exposes your agent for external clients
 */
export function createYourAgentServer(yourAgent: any) {
  return new MCPServer({
    name: 'Your Agent MCP Server',
    version: '1.0.0',
    description: 'Exposes your agent via MCP for external clients',
    tools: {
      yourTool, // Direct tool access
    },
    agents: {
      yourAgent, // Agent becomes "ask_yourAgent" tool
    },
  });
}
```

### Mastra Configuration Pattern
```typescript
// src/mastra/index.ts
import { Mastra } from '@mastra/core/mastra';
import { LibSQLStore } from '@mastra/libsql';
import { PinoLogger } from '@mastra/loggers';
import { yourAgent } from './agents/your-agent';
import { yourWorkflow } from './workflows/your-workflow';
import { yourNetwork } from './networks/your-network';
import { createYourAgentServer } from './mcps';

export const mastra = new Mastra({
  workflows: { yourWorkflow },
  agents: { yourAgent },
  networks: { yourNetwork },
  mcpServers: {
    yourAgent: createYourAgentServer(yourAgent),
  },
  storage: new LibSQLStore({ url: ":memory:" }),
  logger: new PinoLogger({ 
    name: 'Mastra', 
    level: 'debug' // Enable comprehensive logging
  }),
  telemetry: {
    serviceName: 'your-service-name',
    enabled: true,
    sampling: { type: 'always_on' },
    export: { type: 'console' }, // or 'otlp' for production
  },
});
```