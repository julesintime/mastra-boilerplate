/**
 * Content Production Workflow
 * 
 * Orchestrates a comprehensive content production pipeline combining research,
 * analysis, and writing to create high-quality, well-researched content.
 */

import { createWorkflow, createStep } from '@mastra/core/workflows';
import { z } from 'zod';
import { researchCoordinatorAgent, webResearchAgent } from '../agents/research-coordinator-agent';
import { dataAnalysisAgent } from '../agents/data-analysis-agent';
import { contentWriterAgent } from '../agents/content-writer-agent';

// Step 1: Research Step using Research Coordinator Agent
const researchStep = createStep({
  id: 'research-step',
  inputSchema: z.object({
    topic: z.string().describe('The main topic for content creation'),
    depth: z.enum(['surface', 'moderate', 'deep']).default('moderate').describe('Research depth'),
  }),
  outputSchema: z.object({
    research_data: z.string().describe('Research findings from agent'),
    success: z.boolean().describe('Whether research completed successfully'),
    topic: z.string().describe('The main topic for content creation'),
  }),
  execute: async ({ inputData }) => {
    const { topic, depth } = inputData;
    
    console.log('📚 Step 1: Conducting research...');
    
    const prompt = `Conduct comprehensive research on: "${topic}"
    
    Research requirements:
    - Depth: ${depth}
    - Focus on current market trends and insights
    - Include key findings and strategic implications
    - Provide structured data for content creation
    
    Please use your research tools to gather comprehensive information on this topic.`;
    
    const { text } = await researchCoordinatorAgent.generate([
      { role: 'user', content: prompt }
    ]);
    
    return {
      research_data: text,
      success: true,
      topic,
    };
  },
});

// Step 2: Analysis Step using Data Analysis Agent
const analysisStep = createStep({
  id: 'analysis-step',
  inputSchema: z.object({
    research_data: z.string().describe('Research data to analyze'),
    topic: z.string().describe('The main topic'),
    success: z.boolean().describe('Previous step success status'),
  }),
  outputSchema: z.object({
    analysis_results: z.string().describe('Analysis findings from agent'),
    success: z.boolean().describe('Whether analysis completed successfully'),
    research_data: z.string().describe('Research findings from previous step'),
    topic: z.string().describe('The main topic for content creation'),
  }),
  execute: async ({ inputData }) => {
    const { research_data, topic } = inputData;
    
    console.log('🔍 Step 2: Analyzing research data...');
    
    const prompt = `Analyze the research data and generate strategic insights for: "${topic}"
    
    Research Data:
    ${research_data}
    
    Analysis requirements:
    - Perform trend analysis on the provided data
    - Identify key insights and patterns
    - Generate actionable recommendations
    - Provide structured analysis suitable for content creation
    
    Please use your data analysis tools to process this information.`;
    
    const { text } = await dataAnalysisAgent.generate([
      { role: 'user', content: prompt }
    ]);
    
    return {
      analysis_results: text,
      success: true,
      research_data,
      topic,
    };
  },
});

// Step 3: Content Creation Step using Content Writer Agent
const contentCreationStep = createStep({
  id: 'content-creation-step',
  inputSchema: z.object({
    analysis_results: z.string().describe('Analysis results'),
    research_data: z.string().describe('Research findings'),
    topic: z.string().describe('The main topic for content creation'),
    success: z.boolean().describe('Previous step success status'),
  }),
  outputSchema: z.object({
    content: z.string().describe('Generated content from agent'),
    success: z.boolean().describe('Whether content creation completed successfully'),
    research_summary: z.string().describe('Research findings summary'),
  }),
  execute: async ({ inputData }) => {
    const { topic, research_data, analysis_results } = inputData;
    
    console.log('✍️ Step 3: Creating content...');
    
    const prompt = `Create high-quality article content on: "${topic}"
    
    Target Audience: business professionals
    
    Research Data:
    ${research_data}
    
    Analysis Results:
    ${analysis_results}
    
    Content Requirements:
    - Create engaging, professional content
    - Incorporate research findings and analysis insights
    - Maintain professional tone appropriate for business professionals
    - Structure content for optimal readability
    - Include compelling introduction and strong conclusion
    
    Please use your content writing tools to create comprehensive content.`;
    
    const { text } = await contentWriterAgent.generate([
      { role: 'user', content: prompt }
    ]);
    
    return {
      content: text,
      success: true,
      research_summary: research_data,
    };
  },
});

// Short Version: Streamlined workflow for quick content generation
export const contentProductionWorkflowShort = createWorkflow({
  id: 'content_production_workflow_short',
  description: 'Streamlined content production workflow that combines research, analysis, and writing to create high-quality content efficiently',
  inputSchema: z.object({
    topic: z.string().describe('The main topic for content creation'),
    content_type: z.string().default('article').describe('Type of content to create'),
    target_audience: z.string().default('business professionals').describe('Target audience'),
    depth: z.enum(['surface', 'moderate', 'deep']).default('moderate').describe('Research depth'),
  }),
  outputSchema: z.object({
    content: z.string().describe('Generated content'),
    research_summary: z.string().describe('Research findings summary'),
    success: z.boolean().describe('Whether the workflow completed successfully'),
  }),
})
  .map(({ inputData }) => ({
    topic: inputData.topic,
    depth: inputData.depth,
  }))
  .then(researchStep)
  .then(analysisStep)
  .then(contentCreationStep)
  .commit();

// Step 4: Web Research Step using Web Research Agent
const webResearchStep = createStep({
  id: 'web-research-step',
  inputSchema: z.object({
    analysis_results: z.string().describe('Analysis results from previous step'),
    research_data: z.string().describe('Research findings'),
    topic: z.string().describe('The main topic for web research'),
    success: z.boolean().describe('Previous step success status'),
  }),
  outputSchema: z.object({
    web_research_data: z.string().describe('Web research results from agent'),
    success: z.boolean().describe('Whether web research completed successfully'),
    analysis_results: z.string().describe('Analysis results from previous step'),
    research_data: z.string().describe('Research findings'),
    topic: z.string().describe('The main topic'),
  }),
  execute: async ({ inputData }) => {
    const { topic, analysis_results, research_data } = inputData;
    
    console.log('🌐 Step 4: Conducting web research...');
    
    const prompt = `Conduct comprehensive web research for: "${topic}"
    
    Web Research Requirements:
    - Search for recent developments and current trends
    - Find authoritative sources and expert opinions
    - Gather supporting statistics and data points
    - Focus on detailed market information
    - Cross-reference information across multiple sources
    
    Please use your web research tools to gather current, relevant information.`;
    
    const { text } = await webResearchAgent.generate([
      { role: 'user', content: prompt }
    ]);
    
    return {
      web_research_data: text,
      success: true,
      analysis_results,
      research_data,
      topic,
    };
  },
});

// Step 5: Enhanced Content Creation Step (for comprehensive workflow)
const enhancedContentCreationStep = createStep({
  id: 'enhanced-content-creation-step',
  inputSchema: z.object({
    web_research_data: z.string().describe('Web research data'),
    analysis_results: z.string().describe('Analysis results'),
    research_data: z.string().describe('Research findings'),
    topic: z.string().describe('The main topic for content creation'),
    success: z.boolean().describe('Previous step success status'),
  }),
  outputSchema: z.object({
    content: z.string().describe('Generated enhanced content from agent'),
    success: z.boolean().describe('Whether content creation completed successfully'),
    topic: z.string().describe('The main topic'),
  }),
  execute: async ({ inputData }) => {
    const { topic, research_data, analysis_results, web_research_data } = inputData;
    
    console.log('✍️ Enhanced Content Creation...');
    
    const prompt = `Create premium article content on: "${topic}"
    
    Target Audience: business professionals
    Quality Level: premium
    
    Research Data:
    ${research_data}
    
    Analysis Results:
    ${analysis_results}
    
    Web Research Data:
    ${web_research_data}
    
    Enhanced Content Requirements:
    - Create premium-quality content
    - Integrate all research findings and analysis insights
    - Include web research findings for current relevance
    - Maintain informative professional tone
    - Structure for long-form format
    - Include compelling narrative and actionable insights
    
    Please use your content writing tools to create exceptional content.`;
    
    const { text } = await contentWriterAgent.generate([
      { role: 'user', content: prompt }
    ]);
    
    return {
      content: text,
      success: true,
      topic,
    };
  },
});

// Step 6: Content Review Step using Content Writer Agent
const contentReviewStep = createStep({
  id: 'content-review-step',
  inputSchema: z.object({
    content: z.string().describe('Content to review'),
    topic: z.string().describe('The main topic'),
    success: z.boolean().describe('Previous step success status'),
  }),
  outputSchema: z.object({
    final_content: z.string().describe('Final reviewed content'),
    research_summary: z.string().describe('Research findings summary'),
    analysis_insights: z.string().describe('Analysis insights'),
    content_review: z.string().describe('Content review results from agent'),
    success: z.boolean().describe('Whether review completed successfully'),
  }),
  execute: async ({ inputData }) => {
    const { content, topic } = inputData;
    
    console.log('📝 Step 6: Reviewing content...');
    
    const reviewCriteria = 'clarity, accuracy, and engagement';
    
    const prompt = `Review and analyze the following content for quality and improvement:
    
    Content to Review:
    ${content}
    
    Review Criteria: ${reviewCriteria}
    Quality Level: standard
    
    Review Requirements:
    - Assess content quality against ${reviewCriteria}
    - Provide specific improvement recommendations
    - Rate overall quality and effectiveness
    - Suggest optimizations for target audience engagement
    - Ensure content meets professional standards
    
    Please use your content review tools to provide comprehensive feedback.`;
    
    const { text } = await contentWriterAgent.generate([
      { role: 'user', content: prompt }
    ]);
    
    return {
      final_content: content,
      research_summary: `Research conducted on: ${topic}`,
      analysis_insights: `Analysis completed for: ${topic}`,
      content_review: text,
      success: true,
    };
  },
});

// Comprehensive Version: Full-featured workflow with review and optimization
export const contentProductionWorkflow = createWorkflow({
  id: 'content_production_workflow',
  description: 'Comprehensive content production workflow with advanced research, web research, analysis, content creation, and review phases for premium content generation',
  inputSchema: z.object({
    topic: z.string().describe('The main topic for content creation'),
    content_type: z.string().default('article').describe('Type of content to create'),
    target_audience: z.string().default('business professionals').describe('Target audience'),
    quality_level: z.enum(['standard', 'premium', 'executive']).default('standard').describe('Quality level for content'),
    research_depth: z.enum(['surface', 'moderate', 'deep']).default('moderate').describe('Research depth'),
    include_review: z.boolean().default(true).describe('Whether to include content review step'),
  }),
  outputSchema: z.object({
    final_content: z.string().describe('Final reviewed content'),
    research_summary: z.string().describe('Research findings summary'),
    analysis_insights: z.string().describe('Analysis insights'),
    content_review: z.string().describe('Content review results'),
    success: z.boolean().describe('Whether the workflow completed successfully'),
  }),
})
  .map(async ({ inputData }) => ({
    topic: inputData.topic,
    depth: inputData.research_depth,
  }))
  .then(researchStep)
  .then(analysisStep)
  .then(webResearchStep)
  .then(enhancedContentCreationStep)
  .then(contentReviewStep)
  .commit();

/**
 * Execute content production workflow
 */
export async function executeContentProductionWorkflow(
  topic: string,
  options: {
    content_type?: string;
    target_audience?: string;
    research_depth?: string;
    quality_level?: string;
    include_review?: boolean;
  } = {}
): Promise<any> {
  try {
    console.log(`🚀 Starting content production workflow for: "${topic}"`);
    
    const workflowInput = {
      topic,
      content_type: options.content_type || 'article',
      target_audience: options.target_audience || 'business professionals',
      depth: (options.research_depth as 'surface' | 'moderate' | 'deep') || 'moderate',
      quality_level: (options.quality_level as 'standard' | 'premium' | 'executive') || 'standard',
      research_depth: (options.research_depth as 'surface' | 'moderate' | 'deep') || 'moderate',
      include_review: options.include_review !== false,
    };
    
    // Use comprehensive workflow for complex projects
    if (options.research_depth === 'deep' || options.quality_level === 'executive') {
      const runInstance = await contentProductionWorkflow.createRunAsync();
      const result = await runInstance.start({ inputData: workflowInput });
      console.log(`✅ Comprehensive content production workflow completed for: "${topic}"`);
      return result;
    }
    
    // Use short workflow for standard content
    const runInstance = await contentProductionWorkflowShort.createRunAsync();
    const result = await runInstance.start({ inputData: workflowInput });
    
    console.log(`✅ Content production workflow completed for: "${topic}"`);
    return result;
    
  } catch (error) {
    console.error(`❌ Content production workflow failed for: "${topic}"`, error);
    throw error;
  }
}

export { contentProductionWorkflowShort as default };