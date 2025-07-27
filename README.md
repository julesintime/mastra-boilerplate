# Mastra Agent Framework Boilerplate

> Clean, production-ready TypeScript boilerplate for building AI agent systems with the Mastra framework

## Overview

A streamlined boilerplate for creating intelligent AI agent systems using the [Mastra framework](https://mastra.ai). This template provides best practices for agent orchestration, tool integration, and MCP server exposure.

## Features

- **🤖 Multi-Agent System**: Pre-configured Weather, Eight Ball, and Quotes agents
- **🔌 AI SDK Integration**: Direct integration with Vercel AI SDK for all major providers
- **🔄 Workflow Support**: Built-in workflow orchestration capabilities  
- **🔌 MCP Server**: Ready-to-use MCP server for external tool integration
- **📊 Evaluation Framework**: Comprehensive testing and quality assurance
- **⚡ Multi-Provider Support**: Google Gemini, Groq, OpenAI, Anthropic

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

# Configure environment
cp .env.local .env.local
# Edit .env.local with your API keys

# Start development server
pnpm dev
```

## Project Structure

```
src/mastra/
├── agents/           # AI agents (weather, eightball, quotes, etc.)
├── tools/            # Custom tools for agents
├── workflows/        # Business process workflows
├── networks/         # Agent coordination networks
└── index.ts          # Main Mastra configuration
```

## Configuration

Edit `.env.local` with your settings:

```env
# API Keys - Add for providers you want to use
GOOGLE_GENERATIVE_AI_API_KEY=your_google_api_key
GROQ_API_KEY=your_groq_api_key  
OPENAI_API_KEY=your_openai_api_key
ANTHROPIC_API_KEY=your_anthropic_api_key

# Model Selection (pre-configured with best defaults)
GEMINI_MODEL=gemini-2.5-pro
GROQ_MODEL=llama-3.3-70b-versatile
OPENAI_MODEL=gpt-4o-mini
ANTHROPIC_MODEL=claude-3-5-sonnet-20241022
```

## Available Scripts

```bash
# Development
pnpm dev          # Start with hot-reload
pnpm build        # Build for production
pnpm start        # Run production build
```

## MCP Server Endpoints

When running, agents are exposed via MCP endpoints:

- **Weather Agent**: `http://localhost:4111/api/mcp/weatherAgent/mcp`
- **Autonomous Network**: `http://localhost:4111/api/mcp/autonomousNetwork/mcp`

Use these endpoints to integrate with Claude Code, IDEs, or other MCP-compatible tools.

## Creating New Agents

```typescript
// src/mastra/agents/my-agent.ts
import { Agent } from '@mastra/core/agent';
import { google } from '@ai-sdk/google';

export const myAgent = new Agent({
  name: 'My Agent',
  model: google(process.env.GEMINI_MODEL || 'gemini-2.5-pro'),
  tools: { myTool },
  instructions: 'You are a specialized agent that...',
});
```

## Key Implementation Notes

- **Provider Flexibility**: Easily switch between AI providers via environment variables
- **Type Safety**: Full TypeScript support throughout the framework
- **Evaluation Ready**: Built-in evaluation metrics for quality assurance
- **Production Ready**: Includes logging, telemetry, and error handling
- **Extensible**: Modular architecture for easy customization

## Resources

- [Mastra Documentation](https://docs.mastra.ai)
- [AI SDK Documentation](https://ai-sdk.dev)
- [Model Context Protocol](https://modelcontextprotocol.io)

---

**Built with [Mastra](https://mastra.ai) 🚀**