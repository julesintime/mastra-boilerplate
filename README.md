# Mastra Agent Framework Template

> A production-ready TypeScript template for exposing AI agents, workflows, and networks as **Model Context Protocol (MCP) servers** for seamless integration with external tools and applications.

## Overview

This template demonstrates how to build and **expose AI agents as MCP servers** using the Mastra framework. The primary purpose is to create a scalable architecture where specialized agents, autonomous networks, and workflows can be accessed externally via standardized MCP endpoints, enabling integration with tools like Claude Code, IDEs, and other AI applications.

## Features

### 🤖 **Multi-Agent Architecture**
- **Weather Agent**: Real-time weather data and activity planning
- **Eight Ball Agent**: Mystical guidance with multi-language support
- **Quotes Agent**: Inspirational wisdom from famous authors
- **Autonomous Network**: Intelligent coordination between specialized agents

### 🔄 **Intelligent Workflows**
- **Trip Motivation Workflow**: Chains weather and quotes agents to provide destination weather info plus inspirational quotes for your journey

### 🔌 **MCP Server Integration** (Primary Feature)
- **HTTP/SSE Endpoints**: Real-time streaming agent communication
- **Tool Exposure**: Direct access to agent tools via MCP protocol
- **Network Coordination**: Multi-agent orchestration through MCP
- **External Integration**: Claude Code, IDEs, and AI tool compatibility

### ⚡ **Configurable Model Providers**
- **Google Gemini**: Primary models (gemini-2.5-pro, gemini-2.5-flash)
- **Groq Llama**: Ultra-fast inference (llama-3.3-70b-versatile, llama-3.1-8b-instant)
- **OpenAI GPT**: Industry-standard models (gpt-4o, gpt-4o-mini)
- **Anthropic Claude**: Advanced reasoning (claude-3-5-sonnet, claude-3-5-haiku)

### 🔧 **Production-Ready Features**
- Environment-based model configuration
- Comprehensive logging and OpenTelemetry tracing
- Persistent agent memory with LibSQL
- MCP server integration for external tools
- Tool integration with real APIs
- Hot-reload development server

### 🏗️ **Clean Architecture**
- TypeScript with strict type checking
- ES modules and modern build tooling
- Official Mastra folder structure conventions
- Separation of concerns (agents, tools, workflows, networks)
- Configurable and maintainable codebase

## Quick Start

### Prerequisites

- Node.js v20.0+
- API keys for your chosen model providers

### Installation

```bash
# Clone the template
git clone <repository-url>
cd mastra-agent-framework

# Install dependencies
npm install

# Configure environment variables
cp .env.example .env
# Edit .env with your API keys
```

### Configuration

Edit `.env` to configure your model providers and MCP settings:

```env
# API Keys
GOOGLE_GENERATIVE_AI_API_KEY=your_google_api_key
GROQ_API_KEY=your_groq_api_key
OPENAI_API_KEY=your_openai_api_key
ANTHROPIC_API_KEY=your_anthropic_api_key

# General Model Configuration (no agent-specific names)
GEMINI_MODEL=gemini-2.5-pro
GROQ_MODEL=llama-3.3-70b-versatile
OPENAI_MODEL=gpt-4o-mini
ANTHROPIC_MODEL=claude-3-5-sonnet-20241022

# Fast Models for quick responses
GEMINI_FAST_MODEL=gemini-2.5-flash
GROQ_FAST_MODEL=llama-3.1-8b-instant

# Tool-optimized models
GROQ_TOOL_MODEL=llama-3.3-70b-versatile
OPENAI_TOOL_MODEL=gpt-4o

# MCP Server Configuration
SITE_URL=http://localhost:4111
WEATHER_MCP_SERVER_NAME=weatherAgent
NETWORK_MCP_SERVER_NAME=autonomousNetwork

# Observability
OTEL_ENABLED=true
LOG_LEVEL=debug
```

### Development

```bash
# Start development server with playground
npm run dev

# Build for production
npm run build

# Start production server
npm run start
```

The development server provides:
- Interactive playground at the provided local URL
- Hot-reload for code changes
- Automatic MCP server exposure
- Debug logging and tracing

## Architecture

### Project Structure

```
src/mastra/
├── agents/              # Agent definitions
│   ├── weather-agent.ts
│   ├── eightball-agent.ts
│   └── quotes-agent.ts
├── tools/               # Tool implementations
│   ├── weather-tool.ts
│   ├── eightball-tool.ts
│   └── quotes-tool.ts
├── workflows/           # Workflow definitions
│   └── weather-workflow.ts (now trip-motivation-workflow)
├── networks/            # Agent networks
│   └── autonomous-network.ts
├── mcps.ts             # MCP server configurations
└── index.ts            # Main Mastra configuration
```

### Key Components

#### **Agents**
Specialized AI agents with persistent memory and tool access:

```typescript
export const weatherAgent = new Agent({
  name: 'Weather Agent',
  description: 'Weather assistant with real-time data access',
  model: getModel(GEMINI_FAST_MODEL), // Configurable model
  tools: { weatherTool },
  memory: new Memory({ storage: new LibSQLStore(...) })
});
```

#### **Tools** 
External API integrations and custom functionality:

```typescript
export const weatherTool = createTool({
  id: 'get-weather',
  description: 'Fetch current weather data',
  inputSchema: z.object({ location: z.string() }),
  execute: async ({ context }) => {
    // Real API integration
  }
});
```

#### **Networks**
Coordinate multiple agents for complex tasks:

```typescript
export const autonomousNetwork = new AgentNetwork({
  name: 'Autonomous Intelligence Network',
  model: GEMINI_FAST_MODEL,
  agents: [weatherAgent, eightBallAgent, quotesAgent]
});
```

#### **MCP Servers**
Expose agents and tools to external clients:

```typescript
export function createWeatherAgentServer(weatherAgent) {
  return new MCPServer({
    name: 'Weather Agent MCP Server',
    tools: { weatherTool },
    agents: { weatherAgent }
  });
}
```

## MCP Server Integration (Primary Feature)

### HTTP/SSE Endpoints

When running the development server, agents are automatically exposed as MCP servers:

| **Endpoint Type** | **URL Pattern** | **Description** |
|-------------------|-----------------|-----------------|
| **HTTP/SSE** | `${SITE_URL}/api/mcp/{serverName}/mcp` | Main MCP endpoint for real-time communication |
| **Messages** | `${SITE_URL}/api/mcp/{serverName}/messages?sessionId={id}` | Message-based interaction |

### Example MCP Servers

Based on your `SITE_URL` configuration (default: `http://localhost:4111`):

| **Agent/Network** | **MCP Endpoint** | **Exposed Tools** |
|-------------------|-------------------|------------------|
| **Weather Agent** | `http://localhost:4111/api/mcp/weatherAgent/mcp` | `ask_weatherAgent`, `weatherTool` |
| **Autonomous Network** | `http://localhost:4111/api/mcp/autonomousNetwork/mcp` | `ask_autonomousNetwork`, all agent tools |
| **Trip Motivation Workflow** | `http://localhost:4111/api/mcp/tripMotivationWorkflow/mcp` | `run_tripMotivationWorkflow` |

### External Tool Access

Available tools exposed via MCP protocol:
- `ask_weatherAgent` - Direct weather agent conversation
- `ask_autonomousNetwork` - Multi-agent coordination
- `run_tripMotivationWorkflow` - Get weather info and inspirational quotes for travel destinations
- `weatherTool` - Real-time weather data fetching
- `eightBallTool` - Mystical guidance responses  
- `quotesTool` - Inspirational quotes retrieval

### Integration Examples

#### Claude Code Integration
```bash
# Add to your Claude Code MCP configuration
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

### Cursor/Claude Code Integration

This template is optimized for AI-assisted development:
- Comprehensive documentation in `CLAUDE.md`
- Clear architectural patterns
- Type-safe configurations
- Detailed code comments

## Model Configuration

### Supported Providers & Latest Models

| **Provider** | **Primary Models** | **Fast Models** | **Tool Models** | **Strengths** |
|--------------|-------------------|------------------|-----------------|---------------|
| **Google** | gemini-2.5-pro | gemini-2.5-flash | gemini-2.5-pro | Multimodal, reasoning |
| **Groq** | llama-3.3-70b-versatile | llama-3.1-8b-instant | llama-3.3-70b-versatile | Ultra-fast inference |
| **OpenAI** | gpt-4o-mini | gpt-4o-mini | gpt-4o | Industry standard |
| **Anthropic** | claude-3-5-sonnet | claude-3-5-haiku | claude-3-5-sonnet | Advanced reasoning |

### Flexible Model Selection

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

### Agent Model Assignment

Agents select optimal models programmatically:

```typescript
// Weather agent uses tool-optimized model for API calls
export function getWeatherModel() {
  return getModel('google', 'tool');
}

// Quotes agent uses fast Groq model for quick responses
export function getQuotesModel() {
  return getModel('groq', 'tool');
}

// Eight ball uses fast model for simple mystical responses
export function getEightBallModel() {
  return getModel('google', 'fast');
}
```

## Observability

### Comprehensive Logging & Tracing

Configured via environment variables for production-ready observability:

```env
# Logging Configuration
LOG_LEVEL=debug              # debug, info, warn, error
LOG_FORMAT=json              # json, pretty
LOG_DESTINATION=console      # console, file

# OpenTelemetry Tracing
OTEL_ENABLED=true
OTEL_SERVICE_NAME=mastra-agent-framework
OTEL_EXPORTER_TYPE=console   # console, otlp
OTEL_SAMPLING_RATE=1.0       # 0.0 to 1.0

# Production OTLP Configuration
# OTEL_EXPORTER_TYPE=otlp
# OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318
# OTEL_EXPORTER_OTLP_HEADERS=
```

### Monitoring Features

- **Request Tracing**: Track MCP requests and responses
- **Agent Performance**: Monitor model inference times
- **Tool Execution**: Track tool call success rates and latency
- **Memory Usage**: Monitor agent memory operations
- **Error Tracking**: Comprehensive error logging with context

## Deployment

### Development

```bash
npm run dev
```

### Production

```bash
# Build the application
npm run build

# Start production server
node --import=./.mastra/output/instrumentation.mjs .mastra/output/index.mjs
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

## Extending the Template

### Adding New Agents

1. Create agent file in `src/mastra/agents/`
2. Add model configuration to `.env`
3. Register in `src/mastra/index.ts`
4. Optional: Add to MCP servers for external access

### Adding New Tools

1. Create tool file in `src/mastra/tools/`
2. Import and add to relevant agents
3. Update MCP server configurations if needed

### Adding New Models

1. Install provider SDK: `npm install @ai-sdk/provider`
2. Add to `src/mastra/config/models.ts`
3. Configure in `.env`

## Contributing

This template follows Mastra's official patterns and conventions. For enhancements:

1. Check `TODO.md` for planned features
2. Follow the existing architectural patterns
3. Update documentation and types
4. Test with multiple model providers

## Resources

- [Mastra Documentation](https://docs.mastra.ai)
- [Model Provider Docs](https://ai-sdk.dev/providers)
- [OpenTelemetry Integration](https://docs.mastra.ai/observability)
- [MCP Specification](https://modelcontextprotocol.io)

## License

MIT License - see LICENSE file for details.

---

**Built with [Mastra](https://mastra.ai) - The TypeScript AI Agent Framework**