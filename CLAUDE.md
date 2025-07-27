# CLAUDE.md

This file provides guidance to Claude Code when working with this Mastra AI agent boilerplate.

## Required Tools Usage
- **MANDATORY: Use `mastraDocs` tools BEFORE any coding tasks** - Check documentation, examples, and recent changes
- **Use `context7` and `deepwiki`** for accessing up-to-date library documentation when needed

## Project Overview

This is a **production-ready Mastra AI boilerplate** with intelligent proxy system for API key rotation and rate limiting.

## Key Features

- **🔄 Intelligent Proxy System**: ProxyLanguageModel with automatic API key rotation
- **⏱️ Rate Limit Handling**: Exponential backoff and queue management for free tier optimization
- **🚀 vNext Networks**: NewAgentNetwork architecture with enhanced timeout handling
- **📊 Quota Management**: Daily usage tracking and automatic reset detection

## Quick Start

```bash
pnpm install
pnpm dev
```

## Architecture

- **Agents**: `src/mastra/agents/` - AI agents using ProxyLanguageModel
- **Tools**: `src/mastra/tools/` - Custom tool implementations  
- **Workflows**: `src/mastra/workflows/` - Long-running business processes
- **Networks**: `src/mastra/networks/` - vNext agent coordination (use `/api/networks/v-next/`)
- **Utils**: `src/mastra/utils/` - ProxyLanguageModel and ProxyManager
- **MCP Servers**: `src/mastra/mcps.ts` - External integration endpoints

## Proxy System

All LLM calls use `ProxyLanguageModel` for:
- Intelligent API key rotation
- Rate limit detection and exponential backoff
- Extended timeout handling for long operations
- Abort signal support for cancellation

Configure in `proxies.json` with your API keys.

## API Endpoints

**vNext Networks** (preferred):
- List: `GET /api/networks/v-next`
- Specific: `GET /api/networks/v-next/{networkId}`
- Generate: `POST /api/networks/v-next/{networkId}/generate`

**MCP Servers**:
- Weather Agent: `http://localhost:4114/api/mcp/weatherAgent/mcp`
- Content Network: `http://localhost:4114/api/mcp/contentProductionNetwork/mcp`