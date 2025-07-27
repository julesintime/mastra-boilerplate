/**
 * Autonomous Network with Proxy Integration
 * 
 * A basic autonomous agent network for coordination and orchestration with intelligent
 * API key rotation and rate limiting for maximizing free tier usage.
 */

import { NewAgentNetwork } from '@mastra/core/network/vNext';
import { ProxyLanguageModel } from '../utils/proxy-language-model.js';
import { weatherAgent } from '../agents/weather-agent';
import { eightBallAgent } from '../agents/eightball-agent';

export const autonomousNetwork = new NewAgentNetwork({
  id: 'autonomous_network',
  name: 'Autonomous Network',
  instructions: 'Coordinate specialized agents for various tasks including weather and decision making. All LLM calls use ProxyLanguageModel for intelligent API key rotation.',
  model: new ProxyLanguageModel({
    maxAttempts: 5,
    baseRetryDelay: 3000, // 3 seconds initial delay
    maxRetryDelay: 60000, // Up to 60 seconds for long queues
    queueTimeout: 300000, // 5 minutes total timeout for network operations
    exponentialBackoff: true
  }),
  agents: {
    weatherAgent,
    eightBallAgent,
  },
});

export default autonomousNetwork;