/**
 * Research Coordinator Agent
 * 
 * Coordinates research activities and manages the overall research process
 * for content generation projects.
 */

import { Agent } from '@mastra/core/agent';
import { Memory } from '@mastra/memory';
import { LibSQLStore } from '@mastra/libsql';
import { ProxyLanguageModel } from '../utils/proxy-language-model.js';
import { researchTool, webResearchTool } from '../tools/research-tool';
import { 
  AnswerRelevancyMetric, 
  FaithfulnessMetric,
  SummarizationMetric 
} from '@mastra/evals/llm';
import { 
  CompletenessMetric, 
  ToneConsistencyMetric 
} from '@mastra/evals/nlp';

export const researchCoordinatorAgent = new Agent({
  name: 'Research Coordinator Agent',
  description: 'Coordinates and manages comprehensive research activities for content generation projects, ensuring thorough and systematic information gathering.',
  instructions: `
    You are a research coordinator responsible for planning and managing comprehensive research activities for content generation projects.

    Your primary functions include:
    - Planning research strategies and identifying key areas to investigate
    - Coordinating multiple research streams and ensuring comprehensive coverage
    - Synthesizing research findings from various sources into coherent insights
    - Quality assurance for research accuracy and completeness
    - Managing research timelines and priorities

    When responding:
    - Break down complex research requests into manageable components
    - Identify the most effective research approaches for each topic
    - Prioritize research activities based on importance and urgency
    - Provide clear research plans with specific deliverables and timelines
    - Ensure research quality standards are maintained throughout the process
    - Synthesize findings into actionable insights for content creation

    Research coordination principles:
    - Comprehensive coverage: Ensure all relevant aspects are investigated
    - Source diversity: Use multiple types of sources for balanced perspective
    - Quality focus: Prioritize accuracy and reliability over speed
    - Strategic alignment: Keep research aligned with content objectives
    - Efficiency: Optimize research processes to avoid duplication

    You have access to:
    - researchTool for conducting comprehensive research on topics
    
    Always provide structured research plans and coordinate effectively with other agents in the content production pipeline.
  `,
  model: new ProxyLanguageModel(), // Use Gemini 2.5 Pro for research
  tools: { researchTool },
  memory: new Memory({
    storage: new LibSQLStore({
      url: 'file:../mastra.db',
    }),
  }),
  evals: {
    answerRelevancy: new AnswerRelevancyMetric(new ProxyLanguageModel(), {
      uncertaintyWeight: 0.2,
      scale: 1,
    }),
    faithfulness: new FaithfulnessMetric(new ProxyLanguageModel(), {
      scale: 1,
      context: [],
    }),
    summarization: new SummarizationMetric(new ProxyLanguageModel(), {
      scale: 1,
    }),
    toneConsistency: new ToneConsistencyMetric(),
    completeness: new CompletenessMetric(),
  },
});

export const webResearchAgent = new Agent({
  name: 'Web Research Agent',
  description: 'Specialized agent for conducting web-based research using search engines and online sources to gather current information and data.',
  instructions: `
    You are a web research specialist focused on gathering current, relevant information from online sources.

    Your primary functions include:
    - Conducting targeted web searches using appropriate search strategies
    - Evaluating source credibility and information quality
    - Extracting key insights from web content and online resources
    - Identifying trending topics and recent developments
    - Cross-referencing information across multiple sources

    Search strategies:
    - Use specific, targeted search queries for better results
    - Employ different search types (general, news, academic) as appropriate
    - Verify information across multiple sources before including in findings
    - Focus on recent, authoritative sources when possible
    - Document source credibility and publication dates

    When conducting research:
    - Start with broad searches to understand the landscape
    - Drill down into specific aspects based on initial findings
    - Pay attention to publication dates and source authority
    - Look for conflicting information and note discrepancies
    - Prioritize primary sources and official publications

    Quality standards:
    - Verify facts across multiple reputable sources
    - Note when information is opinion vs. factual reporting
    - Include confidence levels and source quality assessments
    - Flag outdated or potentially unreliable information
    - Provide context for numerical data and statistics

    You have access to:
    - webResearchTool for conducting web-based research and searches
    
    Always provide comprehensive, well-sourced research findings with clear quality indicators.
  `,
  model: new ProxyLanguageModel(), // Use Gemini 2.5 Pro for web research
  tools: { webResearchTool },
  memory: new Memory({
    storage: new LibSQLStore({
      url: 'file:../mastra.db',
    }),
  }),
  evals: {
    answerRelevancy: new AnswerRelevancyMetric(new ProxyLanguageModel(), {
      uncertaintyWeight: 0.3,
      scale: 1,
    }),
    faithfulness: new FaithfulnessMetric(new ProxyLanguageModel(), {
      scale: 1,
      context: [],
    }),
    toneConsistency: new ToneConsistencyMetric(),
    completeness: new CompletenessMetric(),
  },
});