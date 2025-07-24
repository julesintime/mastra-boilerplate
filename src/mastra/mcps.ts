import { MCPServer } from '@mastra/mcp';
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { weatherTool } from './tools/weather-tool';
import { eightBallTool } from './tools/eightball-tool';
import { quotesTool } from './tools/quotes-tool';

/**
 * Creates MCP server that exposes the weather agent for external clients
 * The server exposes both the agent and its tools directly
 */
export function createWeatherAgentServer(weatherAgent: any) {
  return new MCPServer({
    name: 'Weather Agent MCP Server',
    version: '1.0.0',
    description: 'Exposes weather agent capabilities via MCP for external clients like Claude Code',
    tools: {
      weatherTool, // Direct access to weather tool
    },
    agents: {
      weatherAgent, // This will become tool "ask_weatherAgent"
    },
  });
}

/**
 * Creates MCP server that exposes the autonomous network for external clients
 * The network coordinates between multiple agents and exposes all available tools
 */
export function createAutonomousNetworkServer(autonomousNetwork: any) {
  // Create a custom tool that wraps the network since AgentNetwork doesn't have getDescription method
  const autonomousNetworkTool = createTool({
    id: 'ask_autonomousNetwork',
    description: 'Ask the Autonomous Intelligence Network a question. This network coordinates between weather, mystical guidance (eight ball), and inspirational quote agents to provide comprehensive assistance.',
    inputSchema: z.object({
      message: z.string().describe('Your question or request for the autonomous network'),
    }),
    execute: async ({ context }) => {
      try {
        const result = await autonomousNetwork.generate(context.message);
        return result.text || result;
      } catch (error) {
        return `Error processing request: ${error instanceof Error ? error.message : 'Unknown error'}`;
      }
    },
  });

  return new MCPServer({
    name: 'Autonomous Intelligence Network MCP Server',
    version: '1.0.0',
    description: 'Exposes autonomous intelligence network with coordinated weather, mystical guidance, and inspirational quote agents',
    tools: {
      weatherTool, // Direct access to weather tool
      eightBallTool, // Direct access to eight ball tool
      quotesTool, // Direct access to quotes tool
      autonomousNetworkTool, // Network wrapped as a tool
    },
  });
}

/**
 * Creates MCP server that exposes the trip motivation workflow for external clients
 * The workflow coordinates weather and quotes agents to provide destination information and inspiration
 */
export function createTripMotivationWorkflowServer(tripMotivationWorkflow: any) {
  return new MCPServer({
    name: 'Trip Motivation Workflow MCP Server',
    version: '1.0.0',
    description: 'Exposes trip motivation workflow that combines weather information and inspirational quotes for travel destinations',
    tools: {}, // Empty tools object to prevent undefined error
    workflows: {
      tripMotivationWorkflow, // This will become tool "run_tripMotivationWorkflow"
    },
  });
}