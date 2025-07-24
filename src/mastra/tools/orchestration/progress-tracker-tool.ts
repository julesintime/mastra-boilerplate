import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

/**
 * Progress Tracker Tool
 * 
 * Monitors real-time progress across all active tasks and agents in the orchestration network.
 * Provides comprehensive status updates, identifies bottlenecks, and triggers escalations when needed.
 */
export const progressTrackerTool = createTool({
  id: 'progress_tracker',
  description: 'Monitor real-time progress across all active tasks and agents. Track completion status, identify bottlenecks, measure performance metrics, and trigger escalations when needed.',
  inputSchema: z.object({
    trackingScope: z.enum(['all_tasks', 'project', 'agent', 'specific_task']).describe('Scope of progress tracking'),
    targetId: z.string().optional().describe('Project ID, agent name, or task ID for focused tracking'),
    includeMetrics: z.array(z.enum([
      'completion_percentage',
      'time_utilization', 
      'quality_scores',
      'resource_usage',
      'bottleneck_analysis',
      'performance_trends',
      'agent_availability',
      'task_dependencies'
    ])).default(['completion_percentage', 'time_utilization']).describe('Metrics to include in progress report'),
    timeframe: z.object({
      start: z.string().optional().describe('Start time for progress analysis (ISO format)'),
      end: z.string().optional().describe('End time for progress analysis (ISO format)'),
    }).optional().describe('Time range for historical progress analysis'),
  }),
  outputSchema: z.object({
    progressSummary: z.object({
      overallStatus: z.enum(['on_track', 'at_risk', 'delayed', 'critical']),
      completionPercentage: z.number().min(0).max(100),
      activeTasksCount: z.number(),
      completedTasksCount: z.number(),
      blockedTasksCount: z.number(),
      averageTaskProgress: z.number(),
    }),
    taskBreakdown: z.array(z.object({
      taskId: z.string(),
      taskTitle: z.string(),
      assignedAgent: z.string(),
      status: z.enum(['not_started', 'in_progress', 'review', 'completed', 'blocked', 'failed']),
      completionPercentage: z.number(),
      timeElapsed: z.string(),
      estimatedTimeRemaining: z.string(),
      qualityScore: z.number().optional(),
      blockers: z.array(z.string()).optional(),
      lastUpdate: z.string(),
    })),
    agentPerformance: z.array(z.object({
      agentName: z.string(),
      currentTasks: z.number(),
      completedTasks: z.number(),
      averageCompletionTime: z.string(),
      performanceScore: z.number(),
      availability: z.enum(['available', 'busy', 'overloaded', 'offline']),
      efficiency: z.number().describe('Tasks completed per hour'),
    })),
    bottleneckAnalysis: z.object({
      identifiedBottlenecks: z.array(z.object({
        type: z.enum(['agent_overload', 'resource_constraint', 'dependency_delay', 'quality_issue']),
        description: z.string(),
        impact: z.enum(['low', 'medium', 'high', 'critical']),
        affectedTasks: z.array(z.string()),
        recommendedActions: z.array(z.string()),
      })),
      criticalPath: z.array(z.string()).describe('Task IDs on critical path'),
      riskFactors: z.array(z.object({
        factor: z.string(),
        probability: z.number(),
        impact: z.string(),
      })),
    }),
    alerts: z.array(z.object({
      severity: z.enum(['info', 'warning', 'error', 'critical']),
      message: z.string(),
      taskId: z.string().optional(),
      agentName: z.string().optional(),
      timestamp: z.string(),
      actionRequired: z.boolean(),
      suggestedActions: z.array(z.string()).optional(),
    })),
    recommendations: z.array(z.object({
      type: z.enum(['reallocation', 'priority_adjustment', 'resource_addition', 'timeline_revision']),
      description: z.string(),
      rationale: z.string(),
      expectedImpact: z.string(),
      urgency: z.enum(['low', 'medium', 'high', 'immediate']),
    })),
  }),
  execute: async ({ context }) => {
    const { trackingScope, targetId, includeMetrics, timeframe } = context;
    
    // Simulate current system state (in real implementation, this would query actual task database)
    const currentTime = new Date();
    const simulatedTasks = [
      {
        taskId: 'task_proj_123_001',
        taskTitle: 'Research Strategy Development',
        assignedAgent: 'Web Research Agent',
        status: 'completed' as const,
        completionPercentage: 100,
        timeElapsed: '1.5 hours',
        estimatedTimeRemaining: '0 hours',
        qualityScore: 92,
        blockers: [],
        lastUpdate: new Date(currentTime.getTime() - 2 * 60 * 60 * 1000).toISOString(),
      },
      {
        taskId: 'task_proj_123_002',
        taskTitle: 'Academic Literature Search',
        assignedAgent: 'Academic Research Agent',
        status: 'in_progress' as const,
        completionPercentage: 75,
        timeElapsed: '2.5 hours',
        estimatedTimeRemaining: '0.5 hours',
        qualityScore: 88,
        blockers: [],
        lastUpdate: new Date(currentTime.getTime() - 30 * 60 * 1000).toISOString(),
      },
      {
        taskId: 'task_proj_123_003',
        taskTitle: 'Web Content Extraction',
        assignedAgent: 'Web Research Agent',
        status: 'in_progress' as const,
        completionPercentage: 40,
        timeElapsed: '1.2 hours',
        estimatedTimeRemaining: '1.8 hours',
        qualityScore: 85,
        blockers: ['Rate limiting on target website'],
        lastUpdate: new Date(currentTime.getTime() - 15 * 60 * 1000).toISOString(),
      },
      {
        taskId: 'task_proj_123_004',
        taskTitle: 'Data Analysis & Pattern Recognition',
        assignedAgent: 'Data Analysis Agent',
        status: 'not_started' as const,
        completionPercentage: 0,
        timeElapsed: '0 hours',
        estimatedTimeRemaining: '3 hours',
        qualityScore: undefined,
        blockers: ['Waiting for task_proj_123_003 completion'],
        lastUpdate: new Date(currentTime.getTime() - 60 * 60 * 1000).toISOString(),
      },
      {
        taskId: 'task_proj_123_005',
        taskTitle: 'Initial Fact Verification',
        assignedAgent: 'Fact Checker Agent',
        status: 'blocked' as const,
        completionPercentage: 20,
        timeElapsed: '0.5 hours',
        estimatedTimeRemaining: '2 hours',
        qualityScore: undefined,
        blockers: ['Insufficient source material', 'External API timeout issues'],
        lastUpdate: new Date(currentTime.getTime() - 45 * 60 * 1000).toISOString(),
      },
    ];

    // Calculate overall progress metrics
    const totalTasks = simulatedTasks.length;
    const completedTasks = simulatedTasks.filter(t => t.status === 'completed').length;
    const activeTasks = simulatedTasks.filter(t => ['in_progress', 'review'].includes(t.status)).length;
    const blockedTasks = simulatedTasks.filter(t => t.status === 'blocked').length;
    const averageProgress = simulatedTasks.reduce((sum, task) => sum + task.completionPercentage, 0) / totalTasks;

    // Determine overall status
    const getOverallStatus = () => {
      if (blockedTasks > 0) return 'critical';
      if (averageProgress < 50) return 'at_risk';
      if (averageProgress < 75) return 'delayed';
      return 'on_track';
    };

    // Agent performance analysis
    const agentPerformance = [
      {
        agentName: 'Web Research Agent',
        currentTasks: 1,
        completedTasks: 1,
        averageCompletionTime: '1.5 hours',
        performanceScore: 88,
        availability: 'busy' as const,
        efficiency: 0.67,
      },
      {
        agentName: 'Academic Research Agent',
        currentTasks: 1,
        completedTasks: 0,
        averageCompletionTime: '3 hours',
        performanceScore: 91,
        availability: 'busy' as const,
        efficiency: 0.33,
      },
      {
        agentName: 'Data Analysis Agent',
        currentTasks: 0,
        completedTasks: 0,
        averageCompletionTime: '2.5 hours',
        performanceScore: 95,
        availability: 'available' as const,
        efficiency: 0.0,
      },
      {
        agentName: 'Fact Checker Agent',
        currentTasks: 1,
        completedTasks: 0,
        averageCompletionTime: '2.2 hours',
        performanceScore: 85,
        availability: 'busy' as const,
        efficiency: 0.1,
      },
    ];

    // Bottleneck analysis
    const bottleneckAnalysis = {
      identifiedBottlenecks: [
        {
          type: 'resource_constraint' as const,
          description: 'Web scraping rate limits preventing timely data collection',
          impact: 'medium' as const,
          affectedTasks: ['task_proj_123_003'],
          recommendedActions: [
            'Implement proxy rotation for web scraping',
            'Add delay mechanisms to respect rate limits',
            'Consider alternative data sources',
          ],
        },
        {
          type: 'dependency_delay' as const,
          description: 'Fact checking blocked due to insufficient source material',
          impact: 'high' as const,
          affectedTasks: ['task_proj_123_005'],
          recommendedActions: [
            'Proceed with available sources for initial verification',
            'Escalate API timeout issues to technical team',
            'Consider manual verification for critical claims',
          ],
        },
      ],
      criticalPath: ['task_proj_123_003', 'task_proj_123_004', 'task_proj_123_006'],
      riskFactors: [
        {
          factor: 'External API reliability',
          probability: 0.3,
          impact: 'Potential delays in fact verification and data collection',
        },
        {
          factor: 'Web scraping challenges',
          probability: 0.4,
          impact: 'Slower data collection from web sources',
        },
      ],
    };

    // Generate alerts
    const alerts = [
      {
        severity: 'warning' as const,
        message: 'Fact verification task has been blocked for 45 minutes',
        taskId: 'task_proj_123_005',
        agentName: 'Fact Checker Agent',
        timestamp: currentTime.toISOString(),
        actionRequired: true,
        suggestedActions: [
          'Review blocker status and potential workarounds',
          'Consider reassigning resources or adjusting scope',
        ],
      },
      {
        severity: 'info' as const,
        message: 'Academic literature search is 75% complete and on track',
        taskId: 'task_proj_123_002',
        agentName: 'Academic Research Agent',
        timestamp: currentTime.toISOString(),
        actionRequired: false,
        suggestedActions: [],
      },
    ];

    // Generate recommendations
    const recommendations = [
      {
        type: 'resource_addition' as const,
        description: 'Add backup web scraping tools to handle rate limiting issues',
        rationale: 'Current web scraping is experiencing delays due to rate limits, affecting downstream tasks',
        expectedImpact: 'Reduce web content extraction time by 30-40%',
        urgency: 'medium' as const,
      },
      {
        type: 'reallocation' as const,
        description: 'Reassign fact checking to review available sources while resolving API issues',
        rationale: 'Unblock fact verification process to prevent further delays in content generation phase',
        expectedImpact: 'Resume progress on critical path tasks',
        urgency: 'high' as const,
      },
    ];

    return {
      progressSummary: {
        overallStatus: getOverallStatus(),
        completionPercentage: Math.round(averageProgress),
        activeTasksCount: activeTasks,
        completedTasksCount: completedTasks,
        blockedTasksCount: blockedTasks,
        averageTaskProgress: Math.round(averageProgress),
      },
      taskBreakdown: simulatedTasks,
      agentPerformance,
      bottleneckAnalysis,
      alerts,
      recommendations,
    };
  },
});