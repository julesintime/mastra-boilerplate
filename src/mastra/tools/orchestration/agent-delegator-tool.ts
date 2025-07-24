import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

/**
 * Agent Delegator Tool
 * 
 * Handles task delegation to specialized agents within the orchestration network.
 * Manages agent communication, task assignment, and ensures proper handoffs between agents.
 */
export const agentDelegatorTool = createTool({
  id: 'agent_delegator',
  description: 'Delegate tasks to specialized agents with detailed instructions, monitor assignment status, and manage inter-agent communication for complex multi-agent workflows.',
  inputSchema: z.object({
    taskId: z.string().describe('Unique identifier for the task being delegated'),
    targetAgent: z.enum([
      'Web Research Agent',
      'Academic Research Agent', 
      'Data Analysis Agent',
      'Writer Agent',
      'Editor Agent',
      'Fact Checker Agent',
      'Review Agent',
      'Citation Agent'
    ]).describe('The specialized agent to receive the task'),
    taskDetails: z.object({
      title: z.string().describe('Clear, concise task title'),
      description: z.string().describe('Detailed task description with context'),
      objectives: z.array(z.string()).describe('Specific objectives to accomplish'),
      inputs: z.array(z.object({
        type: z.enum(['text', 'document', 'url', 'data', 'reference']),
        content: z.string(),
        metadata: z.record(z.any()).optional(),
      })).describe('Input materials and resources for the task'),
      constraints: z.object({
        timeLimit: z.string().optional().describe('Maximum time allowed for completion'),
        qualityStandards: z.array(z.string()).describe('Quality requirements and success criteria'),
        formatRequirements: z.string().optional().describe('Required output format specifications'),
        styleGuidelines: z.string().optional().describe('Style, tone, or format guidelines'),
      }).describe('Task constraints and requirements'),
    }),
    priority: z.enum(['low', 'medium', 'high', 'urgent']).describe('Task priority level'),
    dependencies: z.array(z.string()).optional().describe('Task IDs that must complete before this task'),
    handoffInstructions: z.object({
      nextAgent: z.string().optional().describe('Agent to receive output after completion'),
      handoffCriteria: z.array(z.string()).optional().describe('Criteria for successful handoff'),
      reviewRequired: z.boolean().default(false).describe('Whether coordinator review is required before handoff'),
    }).optional().describe('Instructions for task handoff to next agent'),
  }),
  outputSchema: z.object({
    delegationResult: z.object({
      taskId: z.string(),
      assignedAgent: z.string(),
      assignmentStatus: z.enum(['assigned', 'accepted', 'rejected', 'queued']),
      estimatedCompletion: z.string(),
      delegationTimestamp: z.string(),
      agentResponse: z.string().describe('Agent acknowledgment or questions about the assignment'),
    }),
    communicationLog: z.array(z.object({
      timestamp: z.string(),
      from: z.string(),
      to: z.string(),
      messageType: z.enum(['assignment', 'acknowledgment', 'question', 'update', 'completion']),
      content: z.string(),
    })),
    monitoringSetup: z.object({
      checkpointSchedule: z.array(z.string()).describe('Scheduled progress check times'),
      progressMetrics: z.array(z.string()).describe('Metrics to track during execution'),
      escalationTriggers: z.array(z.string()).describe('Conditions that require coordinator intervention'),
    }),
  }),
  execute: async ({ context }) => {
    const { taskId, targetAgent, taskDetails, priority, dependencies, handoffInstructions } = context;
    
    // Agent capability matrix for validation
    const agentCapabilities = {
      'Web Research Agent': {
        specialties: ['web_scraping', 'search_optimization', 'content_extraction', 'trend_monitoring'],
        strengths: ['Large-scale web data collection', 'Real-time information gathering', 'Multi-source synthesis'],
        limitations: ['Academic database access', 'Deep analytical reasoning', 'Content creation'],
        avgResponseTime: '1-3 hours',
        reliability: 'high',
      },
      'Academic Research Agent': {
        specialties: ['scholarly_search', 'citation_analysis', 'literature_review', 'peer_review_assessment'],
        strengths: ['Academic database access', 'Research methodology', 'Citation management'],
        limitations: ['Web scraping', 'Data visualization', 'Content writing'],
        avgResponseTime: '2-4 hours',
        reliability: 'very_high',
      },
      'Data Analysis Agent': {
        specialties: ['statistical_analysis', 'data_visualization', 'pattern_recognition', 'quantitative_research'],
        strengths: ['Complex data processing', 'Statistical modeling', 'Trend analysis'],
        limitations: ['Content creation', 'Qualitative analysis', 'Web scraping'],
        avgResponseTime: '1-2 hours',
        reliability: 'high',
      },
      'Writer Agent': {
        specialties: ['content_creation', 'narrative_structure', 'style_adaptation', 'audience_targeting'],
        strengths: ['Creative writing', 'Content structure', 'Audience engagement'],
        limitations: ['Fact checking', 'Data analysis', 'Technical editing'],
        avgResponseTime: '3-6 hours',
        reliability: 'high',
      },
      'Editor Agent': {
        specialties: ['content_refinement', 'style_consistency', 'flow_optimization', 'grammar_checking'],
        strengths: ['Language precision', 'Style optimization', 'Quality enhancement'],
        limitations: ['Content creation', 'Fact verification', 'Research'],
        avgResponseTime: '1-2 hours',
        reliability: 'very_high',
      },
      'Fact Checker Agent': {
        specialties: ['claim_verification', 'source_validation', 'accuracy_assessment', 'credibility_scoring'],
        strengths: ['Accuracy verification', 'Source evaluation', 'Bias detection'],
        limitations: ['Content creation', 'Style editing', 'Data analysis'],
        avgResponseTime: '2-4 hours',
        reliability: 'very_high',
      },
      'Review Agent': {
        specialties: ['quality_assessment', 'completeness_validation', 'final_approval', 'stakeholder_alignment'],
        strengths: ['Comprehensive evaluation', 'Quality standards', 'Final approval'],
        limitations: ['Content creation', 'Technical analysis', 'Specialized research'],
        avgResponseTime: '1-2 hours',
        reliability: 'very_high',
      },
      'Citation Agent': {
        specialties: ['reference_formatting', 'bibliography_management', 'citation_compliance', 'academic_standards'],
        strengths: ['Citation accuracy', 'Format compliance', 'Academic standards'],
        limitations: ['Content creation', 'Research', 'Analysis'],
        avgResponseTime: '30min-1 hour',
        reliability: 'very_high',
      },
    };

    // Validate agent capability match
    const agentInfo = agentCapabilities[targetAgent];
    if (!agentInfo) {
      throw new Error(`Unknown agent: ${targetAgent}`);
    }

    // Create delegation timestamp
    const delegationTimestamp = new Date().toISOString();
    
    // Generate agent assignment instructions
    const assignmentInstructions = `
## Task Assignment: ${taskDetails.title}

**Task ID:** ${taskId}
**Priority:** ${priority.toUpperCase()}
**Assigned to:** ${targetAgent}
**Assigned at:** ${delegationTimestamp}

### Task Description
${taskDetails.description}

### Objectives
${taskDetails.objectives.map((obj, i) => `${i + 1}. ${obj}`).join('\n')}

### Input Materials
${taskDetails.inputs.map((input, i) => `
**Input ${i + 1}:** ${input.type.toUpperCase()}
Content: ${input.content}
${input.metadata ? `Metadata: ${JSON.stringify(input.metadata, null, 2)}` : ''}
`).join('\n')}

### Constraints & Requirements
- **Time Limit:** ${taskDetails.constraints.timeLimit || 'Standard SLA for task complexity'}
- **Quality Standards:** ${taskDetails.constraints.qualityStandards.join(', ')}
- **Format Requirements:** ${taskDetails.constraints.formatRequirements || 'Standard deliverable format'}
- **Style Guidelines:** ${taskDetails.constraints.styleGuidelines || 'Follow project style guide'}

### Dependencies
${dependencies && dependencies.length > 0 ? 
  `This task depends on completion of: ${dependencies.join(', ')}` : 
  'No dependencies - can begin immediately'}

### Handoff Instructions
${handoffInstructions ? `
**Next Agent:** ${handoffInstructions.nextAgent || 'To be determined'}
**Handoff Criteria:** ${handoffInstructions.handoffCriteria?.join(', ') || 'Standard completion criteria'}
**Review Required:** ${handoffInstructions.reviewRequired ? 'Yes - coordinator review before handoff' : 'No - direct handoff allowed'}
` : 'Final deliverable - no handoff required'}

### Success Criteria
Your deliverable will be considered successful when:
1. All stated objectives are fully accomplished
2. Output meets specified quality standards
3. Format and style requirements are satisfied
4. All input materials are properly utilized
5. Delivery is within specified time constraints

Please acknowledge this assignment and provide your estimated completion time.
    `;

    // Simulate agent response (in real implementation, this would be actual agent communication)
    const agentResponse = `Task ${taskId} acknowledged by ${targetAgent}. 

Based on the requirements and my current workload, I estimate completion in ${agentInfo.avgResponseTime}. 

I have the necessary capabilities for this task including: ${agentInfo.specialties.slice(0, 3).join(', ')}.

I'll begin work immediately${dependencies && dependencies.length > 0 ? ' once dependencies are completed' : ''}.

Will provide progress updates at 25%, 50%, and 75% completion milestones.`;

    // Determine assignment status
    const assignmentStatus = 'accepted'; // In real implementation, this would be dynamic

    // Create communication log entry
    const communicationLog = [
      {
        timestamp: delegationTimestamp,
        from: 'Research Coordinator Agent',
        to: targetAgent,
        messageType: 'assignment' as const,
        content: assignmentInstructions,
      },
      {
        timestamp: new Date(Date.now() + 300000).toISOString(), // 5 minutes later
        from: targetAgent,
        to: 'Research Coordinator Agent', 
        messageType: 'acknowledgment' as const,
        content: agentResponse,
      },
    ];

    // Set up monitoring schedule based on estimated completion time
    const getCheckpointSchedule = (estimatedTime: string): string[] => {
      const now = new Date();
      const checkpoints = [];
      
      // Parse estimated time and create checkpoints
      if (estimatedTime.includes('hour')) {
        const hours = parseInt(estimatedTime.match(/(\d+)/)?.[1] || '2');
        checkpoints.push(new Date(now.getTime() + (hours * 0.25 * 60 * 60 * 1000)).toISOString());
        checkpoints.push(new Date(now.getTime() + (hours * 0.5 * 60 * 60 * 1000)).toISOString());
        checkpoints.push(new Date(now.getTime() + (hours * 0.75 * 60 * 60 * 1000)).toISOString());
        checkpoints.push(new Date(now.getTime() + (hours * 60 * 60 * 1000)).toISOString());
      } else {
        // Default hourly checkpoints
        checkpoints.push(new Date(now.getTime() + (60 * 60 * 1000)).toISOString());
        checkpoints.push(new Date(now.getTime() + (2 * 60 * 60 * 1000)).toISOString());
      }
      
      return checkpoints;
    };

    const monitoringSetup = {
      checkpointSchedule: getCheckpointSchedule(agentInfo.avgResponseTime),
      progressMetrics: [
        'Completion percentage',
        'Quality score (preliminary)',
        'Resource utilization',
        'Blocker identification',
        'Timeline adherence',
      ],
      escalationTriggers: [
        'No progress update after 25% of estimated time',
        'Quality score below threshold in preliminary review',
        'Agent reports critical blockers',
        'Timeline slippage beyond 20%',
        'Resource constraints preventing completion',
      ],
    };

    return {
      delegationResult: {
        taskId,
        assignedAgent: targetAgent,
        assignmentStatus,
        estimatedCompletion: new Date(Date.now() + parseFloat(agentInfo.avgResponseTime.split('-')[1]) * 60 * 60 * 1000).toISOString(),
        delegationTimestamp,
        agentResponse,
      },
      communicationLog,
      monitoringSetup,
    };
  },
});