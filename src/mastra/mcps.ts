import { MCPServer } from '@mastra/mcp';
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { weatherTool } from './tools/weather-tool';
import { eightBallTool } from './tools/eightball-tool';
import { quotesTool } from './tools/quotes-tool';
import { researchTool, webResearchTool } from './tools/research-tool';
import { dataAnalysisTool, trendAnalysisTool } from './tools/data-analysis-tool';
import { contentWritingTool, contentReviewTool } from './tools/content-writing-tool';

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
        const result = await autonomousNetwork.generate([{
          role: 'user',
          content: context.message
        }]);
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

/**
 * Creates MCP server that exposes content generation agents and tools for external clients
 * Provides research, analysis, and content writing capabilities
 */
export function createContentGenerationServer(
  researchCoordinatorAgent: any,
  webResearchAgent: any,
  dataAnalysisAgent: any,
  contentWriterAgent: any
) {
  return new MCPServer({
    name: 'Content Generation MCP Server',
    version: '1.0.0',
    description: 'Exposes content generation agents and tools for research coordination, web research, data analysis, and content writing',
    tools: {
      researchTool,
      webResearchTool,
      dataAnalysisTool,
      trendAnalysisTool,
      contentWritingTool,
      contentReviewTool,
    },
    agents: {
      researchCoordinatorAgent, // This will become tool "ask_researchCoordinatorAgent"
      webResearchAgent, // This will become tool "ask_webResearchAgent"
      dataAnalysisAgent, // This will become tool "ask_dataAnalysisAgent"
      contentWriterAgent, // This will become tool "ask_contentWriterAgent"
    },
  });
}

/**
 * Creates MCP server that exposes the content production workflow for external clients
 */
export function createContentProductionWorkflowServer(contentProductionWorkflowShort: any) {
  return new MCPServer({
    name: 'Content Production Workflow MCP Server',
    version: '1.0.0',
    description: 'Exposes content production workflow that orchestrates research, analysis, and writing phases',
    tools: {}, // Empty tools object to prevent undefined error
    workflows: {
      contentProductionWorkflowShort, // This will become tool "run_contentProductionWorkflowShort"
    },
  });
}

/**
 * Creates MCP server that exposes the content production network for external clients
 */
export function createContentProductionNetworkServer(contentProductionNetwork: any) {
  // Create a custom tool that wraps the network
  const contentProductionNetworkTool = createTool({
    id: 'ask_contentProductionNetwork',
    description: 'Ask the Content Production Network to create comprehensive content. This network coordinates research, analysis, and writing agents for high-quality content generation.',
    inputSchema: z.object({
      topic: z.string().describe('The main topic for content generation'),
      content_type: z.string().optional().describe('Type of content (article, report, blog_post, etc.)'),
      target_audience: z.string().optional().describe('Target audience for the content'),
      research_depth: z.string().optional().describe('Depth of research (surface, moderate, deep)'),
      quality_level: z.string().optional().describe('Quality level (standard, premium, executive)'),
    }),
    execute: async ({ context }) => {
      try {
        const message = `Create content about: ${context.topic}. Content type: ${context.content_type || 'article'}. Target audience: ${context.target_audience || 'business professionals'}. Research depth: ${context.research_depth || 'moderate'}. Quality level: ${context.quality_level || 'standard'}.`;
        
        const result = await contentProductionNetwork.generate([{
          role: 'user',
          content: message
        }]);
        
        return result.text || result;
      } catch (error) {
        return `Error processing request: ${error instanceof Error ? error.message : 'Unknown error'}`;
      }
    },
  });

  return new MCPServer({
    name: 'Content Production Network MCP Server',
    version: '1.0.0',
    description: 'Exposes content production network with coordinated research, analysis, and writing agents',
    tools: {
      researchTool,
      webResearchTool,
      dataAnalysisTool,
      trendAnalysisTool,
      contentWritingTool,
      contentReviewTool,
      contentProductionNetworkTool, // Network wrapped as a tool
    },
  });
}