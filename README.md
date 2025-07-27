# Mastra Agent Framework Boilerplate

> Production-ready TypeScript boilerplate with intelligent proxy system for AI agent orchestration

## Overview

A streamlined boilerplate for creating intelligent AI agent systems using the [Mastra framework](https://mastra.ai). Features intelligent API key rotation and rate limiting optimized for free tier usage.

## Features

- **🔄 Intelligent Proxy System**: Automatic API key rotation with rate limit handling
- **🤖 Multi-Agent System**: Weather, Research, Analysis, and Content Writing agents
- **⏱️ Rate Limit Optimization**: Exponential backoff and queue management for free tiers
- **🚀 vNext Networks**: Enhanced agent coordination with extended timeout handling
- **🔌 MCP Server**: Ready-to-use MCP server for external tool integration
- **📊 Quota Management**: Daily usage tracking and automatic reset detection

## Quick Start

### Prerequisites

- Node.js v20.0+
- pnpm (recommended)
- API keys for your chosen model providers

### Installation

```bash
# Clone and install
git clone <repository-url>
cd mastra-agent-framework
pnpm install

# Configure proxy system
cp proxies.json.example proxies.json
# Edit proxies.json with your API keys

# Start development server
pnpm dev
```

## Project Structure

```
src/mastra/
├── agents/           # AI agents using ProxyLanguageModel
├── tools/            # Custom tools for agents
├── workflows/        # Long-running business processes
├── networks/         # vNext agent coordination systems
├── utils/            # ProxyLanguageModel and ProxyManager
└── index.ts          # Main Mastra configuration
```

## Proxy Configuration

Edit `proxies.json` with your API keys:

```json
{
  "providers": {
    "gemini": {
      "keys": [
        {
          "id": "key1", 
          "key": "your_google_api_key_1"
        },
        {
          "id": "key2",
          "key": "your_google_api_key_2" 
        }
      ],
      "limits": {
        "requests_per_minute": 15,
        "requests_per_day": 50
      }
    }
  }
}
```

## Available Scripts

```bash
# Development
pnpm dev          # Start with hot-reload
pnpm build        # Build for production
pnpm start        # Run production build
```

## API Endpoints

**vNext Networks** (recommended):
- List networks: `GET /api/networks/v-next`
- Get network: `GET /api/networks/v-next/{networkId}`
- Generate: `POST /api/networks/v-next/{networkId}/generate`

**MCP Server Endpoints**:
- **Weather Agent**: `http://localhost:4114/api/mcp/weatherAgent/mcp`
- **Content Network**: `http://localhost:4114/api/mcp/contentProductionNetwork/mcp`

Use MCP endpoints to integrate with Claude Code or other MCP-compatible tools.

## Creating New Agents

```typescript
// src/mastra/agents/my-agent.ts
import { Agent } from '@mastra/core/agent';
import { ProxyLanguageModel } from '../utils/proxy-language-model.js';

export const myAgent = new Agent({
  name: 'My Agent',
  model: new ProxyLanguageModel(),
  tools: { myTool },
  instructions: 'You are a specialized agent that...',
});
```

## Key Implementation Notes

- **Intelligent Proxy System**: Automatic API key rotation with rate limit handling
- **Free Tier Optimization**: Exponential backoff and queue management
- **vNext Networks**: Enhanced agent coordination with extended timeouts
- **Type Safety**: Full TypeScript support throughout the framework
- **Production Ready**: Includes logging, telemetry, and error handling
- **Extensible**: Modular architecture for easy customization

## Resources

- [Mastra Documentation](https://docs.mastra.ai)
- [AI SDK Documentation](https://ai-sdk.dev)
- [Model Context Protocol](https://modelcontextprotocol.io)

---

**Built with [Mastra](https://mastra.ai) 🚀**