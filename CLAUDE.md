# CLAUDE.md

This file provides guidance to Claude Code when working with this Mastra AI agent boilerplate.

## Required Tools Usage
- **MANDATORY: Use `mastraDocs` tools BEFORE any coding tasks** - Check documentation, examples, and recent changes
- **Use `context7` and `deepwiki`** for accessing up-to-date library documentation when needed

## Project Overview

This is a **minimal, production-ready Mastra AI boilerplate** for agent orchestration with MCP server integration.

## Quick Start

```bash
pnpm install
pnpm dev
```

## Architecture

- **Agents**: `src/mastra/agents/` - AI agents with tools and memory
- **Tools**: `src/mastra/tools/` - Custom tool implementations  
- **Workflows**: `src/mastra/workflows/` - Business process orchestration
- **Networks**: `src/mastra/networks/` - Agent coordination systems
- **MCP Servers**: `src/mastra/mcps.ts` - External integration endpoints

## MCP Server Integration

Development server exposes agents at:
- **Weather Agent**: `http://localhost:4111/api/mcp/weatherAgent/mcp`
- **Autonomous Network**: `http://localhost:4111/api/mcp/autonomousNetwork/mcp`
- **Content Workflow**: `http://localhost:4111/api/mcp/contentProductionWorkflowShort/mcp`