/**
 * Content Production Network
 * 
 * Multi-agent network for coordinated content production with intelligent
 * agent orchestration and workflow management.
 */

import { NewAgentNetwork } from '@mastra/core/network/vNext';
import { researchCoordinatorAgent, webResearchAgent } from '../agents/research-coordinator-agent';
import { dataAnalysisAgent } from '../agents/data-analysis-agent';
import { contentWriterAgent } from '../agents/content-writer-agent';
import { executeContentProductionWorkflow } from '../workflows/content-production-workflow';
import { google } from '@ai-sdk/google';
import { Memory } from '@mastra/memory';
import { LibSQLStore } from '@mastra/libsql';

const memory = new Memory({
  storage: new LibSQLStore({
    url: 'file:../mastra.db', // path is relative to the .mastra/output directory
  }),
});

export const contentProductionNetwork = new NewAgentNetwork({
  id: 'contentProductionNetwork',
  name: 'Content Production Network',
  instructions: `
    You are the coordinator for a content production network that combines specialized agents to create high-quality, comprehensive content.

    Your network includes:
    - Research Coordinator Agent: Plans and manages research strategies
    - Web Research Agent: Conducts targeted web-based research
    - Data Analysis Agent: Analyzes research data and generates insights
    - Content Writer Agent: Creates high-quality written content

    Your role is to orchestrate these agents to produce comprehensive, well-researched content through coordinated multi-agent collaboration.
  `,
  model: google(process.env.GEMINI_MODEL || 'gemini-2.5-pro'),
  agents: {
    researchCoordinatorAgent,
    webResearchAgent,
    dataAnalysisAgent,
    contentWriterAgent,
  },
  workflows: {},
  memory: memory,
});

/**
 * Workflow Integration Helper
 * 
 * Provides seamless integration between network and workflow execution
 */
export async function executeContentProductionPipeline(
  topic: string,
  options: {
    execution_mode?: 'network' | 'workflow' | 'auto';
    content_type?: string;
    target_audience?: string;
    research_depth?: string;
    quality_level?: string;
    priority?: string;
  } = {}
) {
  const {
    execution_mode = 'auto',
    content_type = 'article',
    target_audience = 'business professionals',
    research_depth = 'moderate',
    quality_level = 'standard',
    priority = 'standard',
  } = options;
  
  console.log(`🔀 Content Production Pipeline - Mode: ${execution_mode}`);
  
  try {
    // Auto mode: choose based on complexity and requirements
    if (execution_mode === 'auto') {
      const useNetwork = (
        quality_level === 'premium' || 
        quality_level === 'executive' ||
        priority === 'high' ||
        priority === 'urgent' ||
        research_depth === 'deep' ||
        content_type === 'white_paper' ||
        content_type === 'case_study'
      );
      
      if (useNetwork) {
        console.log('🏢 Auto-selected: Network execution for complex/high-priority content');
        return await contentProductionNetwork.generate(`Create ${content_type} content on: ${topic} for ${target_audience}`);
      } else {
        console.log('⚡ Auto-selected: Workflow execution for standard content');
        return await executeContentProductionWorkflow(topic, options);
      }
    }
    
    // Explicit mode selection
    if (execution_mode === 'network') {
      return await contentProductionNetwork.generate(`Create ${content_type} content on: ${topic} for ${target_audience}`);
    } else {
      return await executeContentProductionWorkflow(topic, options);
    }
    
  } catch (error) {
    console.error('❌ Content Production Pipeline failed:', error);
    throw error;
  }
}

export default contentProductionNetwork;