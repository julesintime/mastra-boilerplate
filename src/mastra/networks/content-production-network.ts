/**
 * Content Production Network with Proxy Integration
 * 
 * A network for content production with research, analysis, and writing agents.
 * Utilizes intelligent API key rotation and rate limiting for maximizing free tier usage.
 */

import { NewAgentNetwork } from '@mastra/core/network/vNext';
import { ProxyLanguageModel } from '../utils/proxy-language-model.js';
import { researchCoordinatorAgent, webResearchAgent } from '../agents/research-coordinator-agent';
import { dataAnalysisAgent } from '../agents/data-analysis-agent';
import { contentWriterAgent } from '../agents/content-writer-agent';

export const contentProductionNetwork = new NewAgentNetwork({
  id: 'content_production_network',
  name: 'Content Production Network',
  instructions: 'Coordinate specialized agents for comprehensive content production including research, analysis, and writing. All LLM calls use ProxyLanguageModel for intelligent API key rotation.',
  model: new ProxyLanguageModel({
    maxAttempts: 5,
    baseRetryDelay: 3000, // 3 seconds initial delay
    maxRetryDelay: 60000, // Up to 60 seconds for long queues
    queueTimeout: 300000, // 5 minutes total timeout for network operations
    exponentialBackoff: true
  }),
  agents: {
    researchCoordinatorAgent,
    webResearchAgent, 
    dataAnalysisAgent,
    contentWriterAgent
  },
});

export default contentProductionNetwork;