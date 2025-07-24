import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

/**
 * Task Planner Tool
 * 
 * Creates comprehensive project plans and task breakdowns for complex research
 * and content generation projects. Analyzes requirements, identifies dependencies,
 * and generates structured execution plans.
 */
export const taskPlannerTool = createTool({
  id: 'task_planner',
  description: 'Create detailed project plans and task breakdowns for complex research and content generation projects. Analyzes requirements, identifies dependencies, and generates structured execution plans with timelines.',
  inputSchema: z.object({
    projectTitle: z.string().describe('Title of the research/content project'),
    objectives: z.array(z.string()).describe('Primary objectives and goals for the project'),
    scope: z.object({
      topics: z.array(z.string()).describe('Main topics to research'),
      deliverables: z.array(z.string()).describe('Expected deliverables (articles, reports, etc.)'),
      constraints: z.array(z.string()).optional().describe('Time, budget, or resource constraints'),
      targetAudience: z.string().optional().describe('Intended audience for the content'),
    }).describe('Project scope and requirements'),
    complexity: z.enum(['simple', 'moderate', 'complex', 'advanced']).describe('Project complexity level'),
    priority: z.enum(['low', 'medium', 'high', 'urgent']).describe('Project priority level'),
  }),
  outputSchema: z.object({
    projectPlan: z.object({
      projectId: z.string().describe('Unique identifier for the project'),
      phases: z.array(z.object({
        phaseId: z.string(),
        name: z.string(),
        description: z.string(),
        estimatedDuration: z.string(),
        dependencies: z.array(z.string()),
        tasks: z.array(z.object({
          taskId: z.string(),
          name: z.string(),
          description: z.string(),
          assignedAgent: z.string(),
          estimatedTime: z.string(),
          priority: z.enum(['low', 'medium', 'high', 'urgent']),
          dependencies: z.array(z.string()),
          deliverables: z.array(z.string()),
        })),
      })),
      timeline: z.object({
        estimatedTotalTime: z.string(),
        criticalPath: z.array(z.string()),
        milestones: z.array(z.object({
          name: z.string(),
          deadline: z.string(),
          deliverables: z.array(z.string()),
        })),
      }),
      resourceRequirements: z.object({
        agents: z.array(z.string()),
        tools: z.array(z.string()),
        externalAPIs: z.array(z.string()).optional(),
      }),
    }),
    riskAssessment: z.array(z.object({
      risk: z.string(),
      probability: z.enum(['low', 'medium', 'high']),
      impact: z.enum(['low', 'medium', 'high']),
      mitigation: z.string(),
    })),
    successCriteria: z.array(z.string()),
  }),
  execute: async ({ context }) => {
    const { projectTitle, objectives, scope, complexity, priority } = context;
    
    // Generate unique project ID
    const projectId = `proj_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Define agent capabilities for task assignment
    const agentCapabilities = {
      'Web Research Agent': ['web_scraping', 'search_queries', 'content_extraction', 'trend_analysis'],
      'Academic Research Agent': ['scholarly_search', 'citation_management', 'literature_review', 'peer_review_analysis'],
      'Data Analysis Agent': ['statistical_analysis', 'data_visualization', 'trend_identification', 'quantitative_research'],
      'Writer Agent': ['content_creation', 'narrative_structure', 'draft_generation', 'style_adaptation'],
      'Editor Agent': ['content_refinement', 'style_optimization', 'flow_improvement', 'grammar_checking'],
      'Fact Checker Agent': ['claim_verification', 'source_validation', 'accuracy_checking', 'credibility_assessment'],
      'Review Agent': ['quality_review', 'completeness_validation', 'final_approval'],
      'Citation Agent': ['reference_formatting', 'bibliography_management', 'citation_style_compliance'],
    };

    // Create project phases based on complexity
    const phases = [];
    let phaseCounter = 1;
    
    // Phase 1: Research Planning & Initial Data Gathering
    phases.push({
      phaseId: `phase_${phaseCounter++}`,
      name: 'Research Planning & Initial Data Gathering',
      description: 'Define research strategy, identify sources, and begin initial data collection',
      estimatedDuration: complexity === 'simple' ? '2-4 hours' : complexity === 'moderate' ? '4-8 hours' : '8-16 hours',
      dependencies: [],
      tasks: [
        {
          taskId: `task_${projectId}_001`,
          name: 'Research Strategy Development',
          description: 'Define research methodology, identify key sources, and create search strategies',
          assignedAgent: 'Web Research Agent',
          estimatedTime: '1-2 hours',
          priority: 'high' as const,
          dependencies: [],
          deliverables: ['Research strategy document', 'Source identification list'],
        },
        {
          taskId: `task_${projectId}_002`,
          name: 'Academic Literature Search',
          description: 'Search academic databases for relevant scholarly articles and research papers',
          assignedAgent: 'Academic Research Agent',
          estimatedTime: '2-4 hours',
          priority: 'high' as const,
          dependencies: [`task_${projectId}_001`],
          deliverables: ['Academic source list', 'Literature review outline'],
        },
      ],
    });

    // Phase 2: Deep Research & Data Collection
    phases.push({
      phaseId: `phase_${phaseCounter++}`,
      name: 'Deep Research & Data Collection',
      description: 'Comprehensive data gathering, source analysis, and initial fact verification',
      estimatedDuration: complexity === 'simple' ? '4-6 hours' : complexity === 'moderate' ? '8-12 hours' : '12-24 hours',
      dependencies: [`phase_1`],
      tasks: [
        {
          taskId: `task_${projectId}_003`,
          name: 'Web Content Extraction',
          description: 'Extract relevant information from web sources, blogs, news articles, and industry reports',
          assignedAgent: 'Web Research Agent',
          estimatedTime: '3-5 hours',
          priority: 'high' as const,
          dependencies: [`task_${projectId}_001`],
          deliverables: ['Web research compilation', 'Source credibility assessment'],
        },
        {
          taskId: `task_${projectId}_004`,
          name: 'Data Analysis & Pattern Recognition',
          description: 'Analyze collected data for trends, patterns, and statistical insights',
          assignedAgent: 'Data Analysis Agent',
          estimatedTime: '2-4 hours',
          priority: 'medium' as const,
          dependencies: [`task_${projectId}_003`],
          deliverables: ['Data analysis report', 'Trend identification summary'],
        },
        {
          taskId: `task_${projectId}_005`,
          name: 'Initial Fact Verification',
          description: 'Verify key claims and facts from collected research data',
          assignedAgent: 'Fact Checker Agent',
          estimatedTime: '2-3 hours',
          priority: 'high' as const,
          dependencies: [`task_${projectId}_003`],
          deliverables: ['Fact verification report', 'Source reliability assessment'],
        },
      ],
    });

    // Phase 3: Content Creation & Synthesis
    phases.push({
      phaseId: `phase_${phaseCounter++}`,
      name: 'Content Creation & Synthesis',
      description: 'Transform research into structured content, create drafts, and begin editing process',
      estimatedDuration: complexity === 'simple' ? '3-5 hours' : complexity === 'moderate' ? '6-10 hours' : '10-20 hours',
      dependencies: [`phase_2`],
      tasks: [
        {
          taskId: `task_${projectId}_006`,
          name: 'Content Structure & Outline Creation',
          description: 'Create detailed content structure and comprehensive outline based on research findings',
          assignedAgent: 'Writer Agent',
          estimatedTime: '1-2 hours',
          priority: 'high' as const,
          dependencies: [`task_${projectId}_004`, `task_${projectId}_005`],
          deliverables: ['Content outline', 'Section structure plan'],
        },
        {
          taskId: `task_${projectId}_007`,
          name: 'Draft Content Generation',
          description: 'Write comprehensive first draft incorporating all research findings',
          assignedAgent: 'Writer Agent',
          estimatedTime: '4-8 hours',
          priority: 'high' as const,
          dependencies: [`task_${projectId}_006`],
          deliverables: ['First draft', 'Content flow assessment'],
        },
        {
          taskId: `task_${projectId}_008`,
          name: 'Citation & Reference Integration',
          description: 'Add proper citations, format references, and ensure academic compliance',
          assignedAgent: 'Citation Agent',
          estimatedTime: '1-2 hours',
          priority: 'medium' as const,
          dependencies: [`task_${projectId}_007`],
          deliverables: ['Cited draft', 'Bibliography'],
        },
      ],
    });

    // Phase 4: Quality Assurance & Finalization
    phases.push({
      phaseId: `phase_${phaseCounter++}`,
      name: 'Quality Assurance & Finalization',
      description: 'Comprehensive editing, final fact-checking, and quality review before delivery',
      estimatedDuration: complexity === 'simple' ? '2-3 hours' : complexity === 'moderate' ? '3-6 hours' : '6-12 hours',
      dependencies: [`phase_3`],
      tasks: [
        {
          taskId: `task_${projectId}_009`,
          name: 'Content Editing & Refinement',
          description: 'Comprehensive editing for style, flow, clarity, and engagement',
          assignedAgent: 'Editor Agent',
          estimatedTime: '2-4 hours',
          priority: 'high' as const,
          dependencies: [`task_${projectId}_008`],
          deliverables: ['Edited content', 'Style consistency report'],
        },
        {
          taskId: `task_${projectId}_010`,
          name: 'Final Fact Verification',
          description: 'Final verification of all claims, statistics, and references',
          assignedAgent: 'Fact Checker Agent',
          estimatedTime: '1-2 hours',
          priority: 'high' as const,
          dependencies: [`task_${projectId}_009`],
          deliverables: ['Fact-check report', 'Accuracy certification'],
        },
        {
          taskId: `task_${projectId}_011`,
          name: 'Quality Review & Final Approval',
          description: 'Comprehensive quality review and final approval for delivery',
          assignedAgent: 'Review Agent',
          estimatedTime: '1-2 hours',
          priority: 'high' as const,
          dependencies: [`task_${projectId}_010`],
          deliverables: ['Quality assessment', 'Final approved content'],
        },
      ],
    });

    // Calculate timeline and critical path
    const estimatedTotalTime = complexity === 'simple' ? '11-18 hours' : 
                              complexity === 'moderate' ? '21-36 hours' : 
                              complexity === 'complex' ? '36-72 hours' : '48-96 hours';
    
    const criticalPath = [
      `task_${projectId}_001`,
      `task_${projectId}_002`,
      `task_${projectId}_003`,
      `task_${projectId}_006`,
      `task_${projectId}_007`,
      `task_${projectId}_009`,
      `task_${projectId}_011`,
    ];

    // Define milestones
    const milestones = [
      {
        name: 'Research Strategy Complete',
        deadline: '25% of total timeline',
        deliverables: ['Research strategy document', 'Academic source list'],
      },
      {
        name: 'Data Collection Complete',
        deadline: '50% of total timeline',
        deliverables: ['Web research compilation', 'Data analysis report', 'Fact verification report'],
      },
      {
        name: 'First Draft Complete',
        deadline: '75% of total timeline',
        deliverables: ['First draft', 'Cited draft', 'Bibliography'],
      },
      {
        name: 'Final Delivery',
        deadline: '100% of total timeline',
        deliverables: ['Final approved content', 'Quality assessment'],
      },
    ];

    // Identify required resources
    const resourceRequirements = {
      agents: Array.from(new Set(phases.flatMap(phase => phase.tasks.map(task => task.assignedAgent)))),
      tools: ['WebFetch', 'Data Analysis Libraries', 'Citation Management', 'Content Formatting'],
      externalAPIs: ['Search APIs', 'Academic Databases', 'Fact-checking Services'],
    };

    // Risk assessment
    const riskAssessment = [
      {
        risk: 'Limited source availability for niche topics',
        probability: 'medium' as const,
        impact: 'medium' as const,
        mitigation: 'Expand search strategies, consider alternative sources, consult domain experts',
      },
      {
        risk: 'Agent availability or performance issues',
        probability: 'low' as const,
        impact: 'high' as const,
        mitigation: 'Implement redundancy, have backup agents, monitor performance continuously',
      },
      {
        risk: 'Quality standards not met in first attempt',
        probability: 'medium' as const,
        impact: 'medium' as const,
        mitigation: 'Build in iteration cycles, implement quality gates, allow buffer time',
      },
      {
        risk: 'Scope creep during research phase',
        probability: 'high' as const,
        impact: 'medium' as const,
        mitigation: 'Clear scope definition, regular check-ins, change management process',
      },
    ];

    // Success criteria
    const successCriteria = [
      'All research objectives fully addressed with comprehensive coverage',
      'Content quality meets or exceeds industry standards for accuracy and readability',
      'Proper citation and referencing throughout all deliverables',
      'Delivery within estimated timeline and resource constraints',
      'Stakeholder approval and satisfaction with final outputs',
      'Reusable research assets and knowledge base enhancement',
    ];

    return {
      projectPlan: {
        projectId,
        phases,
        timeline: {
          estimatedTotalTime,
          criticalPath,
          milestones,
        },
        resourceRequirements,
      },
      riskAssessment,
      successCriteria,
    };
  },
});