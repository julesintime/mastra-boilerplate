/**
 * Workflow Monitoring and Observability System
 * 
 * Provides comprehensive monitoring, metrics collection, and observability
 * for workflow executions with real-time tracking and performance analysis.
 */

import { workflowEngine } from './architecture';

// Workflow execution metrics and events
export interface WorkflowExecution {
  id: string;
  templateId: string;
  templateVersion: string;
  status: 'running' | 'completed' | 'failed' | 'cancelled' | 'timeout';
  startTime: number;
  endTime?: number;
  duration?: number;
  input: any;
  output?: any;
  error?: string;
  steps: WorkflowStepExecution[];
  metadata: Record<string, any>;
}

export interface WorkflowStepExecution {
  stepId: string;
  stepName: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped' | 'retrying';
  startTime: number;
  endTime?: number;
  duration?: number;
  input: any;
  output?: any;
  error?: string;
  retryCount: number;
  metadata: Record<string, any>;
}

export interface WorkflowMetrics {
  templateId: string;
  totalExecutions: number;
  successfulExecutions: number;
  failedExecutions: number;
  averageDuration: number;
  p95Duration: number;
  p99Duration: number;
  errorRate: number;
  throughput: number; // executions per hour
  stepMetrics: Map<string, StepMetrics>;
  timeSeriesData: TimeSeriesPoint[];
}

export interface StepMetrics {
  stepId: string;
  stepName: string;
  totalExecutions: number;
  successfulExecutions: number;
  failedExecutions: number;
  averageDuration: number;
  errorRate: number;
  commonErrors: Array<{ error: string; count: number }>;
}

export interface TimeSeriesPoint {
  timestamp: number;
  executions: number;
  successRate: number;
  averageDuration: number;
  errorCount: number;
}

/**
 * Workflow Monitor - tracks execution and collects metrics
 */
export class WorkflowMonitor {
  private static instance: WorkflowMonitor;
  private executions: Map<string, WorkflowExecution> = new Map();
  private metrics: Map<string, WorkflowMetrics> = new Map();
  private observers: Array<(event: WorkflowEvent) => void> = [];

  static getInstance(): WorkflowMonitor {
    if (!WorkflowMonitor.instance) {
      WorkflowMonitor.instance = new WorkflowMonitor();
    }
    return WorkflowMonitor.instance;
  }

  /**
   * Start monitoring a workflow execution
   */
  startWorkflowExecution(
    templateId: string,
    templateVersion: string,
    input: any,
    metadata: Record<string, any> = {}
  ): string {
    const executionId = `exec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const execution: WorkflowExecution = {
      id: executionId,
      templateId,
      templateVersion,
      status: 'running',
      startTime: Date.now(),
      input,
      steps: [],
      metadata,
    };

    this.executions.set(executionId, execution);
    this.emitEvent({
      type: 'workflow_started',
      executionId,
      templateId,
      timestamp: Date.now(),
      data: { input, metadata },
    });

    return executionId;
  }

  /**
   * Complete workflow execution
   */
  completeWorkflowExecution(
    executionId: string,
    output: any,
    error?: string
  ): void {
    const execution = this.executions.get(executionId);
    if (!execution) return;

    const endTime = Date.now();
    execution.endTime = endTime;
    execution.duration = endTime - execution.startTime;
    execution.status = error ? 'failed' : 'completed';
    execution.output = output;
    execution.error = error;

    this.updateMetrics(execution);
    this.emitEvent({
      type: error ? 'workflow_failed' : 'workflow_completed',
      executionId,
      templateId: execution.templateId,
      timestamp: endTime,
      data: { output, error, duration: execution.duration },
    });
  }

  /**
   * Start monitoring a step execution
   */
  startStepExecution(
    executionId: string,
    stepId: string,
    stepName: string,
    input: any
  ): void {
    const execution = this.executions.get(executionId);
    if (!execution) return;

    const stepExecution: WorkflowStepExecution = {
      stepId,
      stepName,
      status: 'running',
      startTime: Date.now(),
      input,
      retryCount: 0,
      metadata: {},
    };

    execution.steps.push(stepExecution);
    this.emitEvent({
      type: 'step_started',
      executionId,
      templateId: execution.templateId,
      timestamp: Date.now(),
      data: { stepId, stepName, input },
    });
  }

  /**
   * Complete step execution
   */
  completeStepExecution(
    executionId: string,
    stepId: string,
    output: any,
    error?: string
  ): void {
    const execution = this.executions.get(executionId);
    if (!execution) return;

    const stepExecution = execution.steps.find(s => s.stepId === stepId);
    if (!stepExecution) return;

    const endTime = Date.now();
    stepExecution.endTime = endTime;
    stepExecution.duration = endTime - stepExecution.startTime;
    stepExecution.status = error ? 'failed' : 'completed';
    stepExecution.output = output;
    stepExecution.error = error;

    this.emitEvent({
      type: error ? 'step_failed' : 'step_completed',
      executionId,
      templateId: execution.templateId,
      timestamp: endTime,
      data: { stepId, output, error, duration: stepExecution.duration },
    });
  }

  /**
   * Record step retry
   */
  recordStepRetry(executionId: string, stepId: string, error: string): void {
    const execution = this.executions.get(executionId);
    if (!execution) return;

    const stepExecution = execution.steps.find(s => s.stepId === stepId);
    if (!stepExecution) return;

    stepExecution.retryCount++;
    stepExecution.status = 'retrying';

    this.emitEvent({
      type: 'step_retry',
      executionId,
      templateId: execution.templateId,
      timestamp: Date.now(),
      data: { stepId, error, retryCount: stepExecution.retryCount },
    });
  }

  /**
   * Get workflow execution details
   */
  getExecution(executionId: string): WorkflowExecution | undefined {
    return this.executions.get(executionId);
  }

  /**
   * Get recent executions for a template
   */
  getRecentExecutions(templateId: string, limit: number = 50): WorkflowExecution[] {
    return Array.from(this.executions.values())
      .filter(exec => exec.templateId === templateId)
      .sort((a, b) => b.startTime - a.startTime)
      .slice(0, limit);
  }

  /**
   * Get workflow metrics
   */
  getMetrics(templateId: string): WorkflowMetrics | undefined {
    return this.metrics.get(templateId);
  }

  /**
   * Get all metrics
   */
  getAllMetrics(): WorkflowMetrics[] {
    return Array.from(this.metrics.values());
  }

  /**
   * Subscribe to workflow events
   */
  subscribe(observer: (event: WorkflowEvent) => void): () => void {
    this.observers.push(observer);
    return () => {
      const index = this.observers.indexOf(observer);
      if (index !== -1) {
        this.observers.splice(index, 1);
      }
    };
  }

  /**
   * Update metrics based on execution
   */
  private updateMetrics(execution: WorkflowExecution): void {
    let metrics = this.metrics.get(execution.templateId);
    
    if (!metrics) {
      metrics = {
        templateId: execution.templateId,
        totalExecutions: 0,
        successfulExecutions: 0,
        failedExecutions: 0,
        averageDuration: 0,
        p95Duration: 0,
        p99Duration: 0,
        errorRate: 0,
        throughput: 0,
        stepMetrics: new Map(),
        timeSeriesData: [],
      };
      this.metrics.set(execution.templateId, metrics);
    }

    // Update execution counts
    metrics.totalExecutions++;
    if (execution.status === 'completed') {
      metrics.successfulExecutions++;
    } else if (execution.status === 'failed') {
      metrics.failedExecutions++;
    }

    // Update durations and rates
    const executions = this.getRecentExecutions(execution.templateId, 1000);
    const durations = executions
      .filter(e => e.duration !== undefined)
      .map(e => e.duration!)
      .sort((a, b) => a - b);

    if (durations.length > 0) {
      metrics.averageDuration = durations.reduce((sum, d) => sum + d, 0) / durations.length;
      metrics.p95Duration = durations[Math.floor(durations.length * 0.95)] || 0;
      metrics.p99Duration = durations[Math.floor(durations.length * 0.99)] || 0;
    }

    metrics.errorRate = metrics.totalExecutions > 0 
      ? metrics.failedExecutions / metrics.totalExecutions 
      : 0;

    // Calculate throughput (executions per hour in last 24 hours)
    const last24Hours = Date.now() - (24 * 60 * 60 * 1000);
    const recentExecutions = executions.filter(e => e.startTime >= last24Hours);
    metrics.throughput = recentExecutions.length / 24;

    // Update step metrics
    for (const stepExec of execution.steps) {
      this.updateStepMetrics(metrics, stepExec);
    }

    // Update time series data
    this.updateTimeSeriesData(metrics, execution);
  }

  /**
   * Update step-level metrics
   */
  private updateStepMetrics(workflowMetrics: WorkflowMetrics, stepExecution: WorkflowStepExecution): void {
    let stepMetrics = workflowMetrics.stepMetrics.get(stepExecution.stepId);
    
    if (!stepMetrics) {
      stepMetrics = {
        stepId: stepExecution.stepId,
        stepName: stepExecution.stepName,
        totalExecutions: 0,
        successfulExecutions: 0,
        failedExecutions: 0,
        averageDuration: 0,
        errorRate: 0,
        commonErrors: [],
      };
      workflowMetrics.stepMetrics.set(stepExecution.stepId, stepMetrics);
    }

    stepMetrics.totalExecutions++;
    if (stepExecution.status === 'completed') {
      stepMetrics.successfulExecutions++;
    } else if (stepExecution.status === 'failed') {
      stepMetrics.failedExecutions++;
      
      // Track common errors
      if (stepExecution.error) {
        const errorEntry = stepMetrics.commonErrors.find(e => e.error === stepExecution.error);
        if (errorEntry) {
          errorEntry.count++;
        } else {
          stepMetrics.commonErrors.push({ error: stepExecution.error, count: 1 });
        }
        
        // Keep only top 10 errors
        stepMetrics.commonErrors.sort((a, b) => b.count - a.count);
        stepMetrics.commonErrors = stepMetrics.commonErrors.slice(0, 10);
      }
    }

    stepMetrics.errorRate = stepMetrics.totalExecutions > 0 
      ? stepMetrics.failedExecutions / stepMetrics.totalExecutions 
      : 0;

    // Update average duration
    if (stepExecution.duration !== undefined) {
      const totalDuration = stepMetrics.averageDuration * (stepMetrics.totalExecutions - 1) + stepExecution.duration;
      stepMetrics.averageDuration = totalDuration / stepMetrics.totalExecutions;
    }
  }

  /**
   * Update time series data
   */
  private updateTimeSeriesData(metrics: WorkflowMetrics, execution: WorkflowExecution): void {
    const hour = Math.floor(execution.startTime / (60 * 60 * 1000)) * (60 * 60 * 1000);
    let timePoint = metrics.timeSeriesData.find(tp => tp.timestamp === hour);
    
    if (!timePoint) {
      timePoint = {
        timestamp: hour,
        executions: 0,
        successRate: 0,
        averageDuration: 0,
        errorCount: 0,
      };
      metrics.timeSeriesData.push(timePoint);
    }

    timePoint.executions++;
    if (execution.status === 'failed') {
      timePoint.errorCount++;
    }
    
    timePoint.successRate = timePoint.executions > 0 
      ? (timePoint.executions - timePoint.errorCount) / timePoint.executions 
      : 0;

    if (execution.duration !== undefined) {
      const totalDuration = timePoint.averageDuration * (timePoint.executions - 1) + execution.duration;
      timePoint.averageDuration = totalDuration / timePoint.executions;
    }

    // Keep only last 7 days of data
    const weekAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
    metrics.timeSeriesData = metrics.timeSeriesData.filter(tp => tp.timestamp >= weekAgo);
    metrics.timeSeriesData.sort((a, b) => a.timestamp - b.timestamp);
  }

  /**
   * Emit workflow event
   */
  private emitEvent(event: WorkflowEvent): void {
    for (const observer of this.observers) {
      try {
        observer(event);
      } catch (error) {
        console.error('Error in workflow event observer:', error);
      }
    }
  }

  /**
   * Clean up old executions to prevent memory leaks
   */
  cleanup(retentionHours: number = 24): void {
    const cutoff = Date.now() - (retentionHours * 60 * 60 * 1000);
    
    for (const [executionId, execution] of this.executions.entries()) {
      if (execution.startTime < cutoff) {
        this.executions.delete(executionId);
      }
    }
  }
}

// Workflow event types
export interface WorkflowEvent {
  type: 'workflow_started' | 'workflow_completed' | 'workflow_failed' | 
        'step_started' | 'step_completed' | 'step_failed' | 'step_retry';
  executionId: string;
  templateId: string;
  timestamp: number;
  data: any;
}

/**
 * Workflow Performance Analyzer
 */
export class WorkflowPerformanceAnalyzer {
  constructor(private monitor: WorkflowMonitor) {}

  /**
   * Analyze workflow performance and identify bottlenecks
   */
  analyzePerformance(templateId: string): WorkflowPerformanceReport {
    const metrics = this.monitor.getMetrics(templateId);
    if (!metrics) {
      throw new Error(`No metrics found for workflow template: ${templateId}`);
    }

    const bottlenecks = this.identifyBottlenecks(metrics);
    const recommendations = this.generateRecommendations(metrics, bottlenecks);
    const trends = this.analyzeTrends(metrics);

    return {
      templateId,
      analysisTimestamp: Date.now(),
      overallHealth: this.calculateHealthScore(metrics),
      bottlenecks,
      recommendations,
      trends,
      metrics,
    };
  }

  /**
   * Identify performance bottlenecks
   */
  private identifyBottlenecks(metrics: WorkflowMetrics): PerformanceBottleneck[] {
    const bottlenecks: PerformanceBottleneck[] = [];

    // Check overall error rate
    if (metrics.errorRate > 0.1) { // More than 10% error rate
      bottlenecks.push({
        type: 'high_error_rate',
        severity: 'high',
        description: `High error rate: ${(metrics.errorRate * 100).toFixed(1)}%`,
        affectedComponent: 'workflow',
        suggestedAction: 'Review error logs and implement better error handling',
      });
    }

    // Check for slow steps
    for (const [stepId, stepMetrics] of metrics.stepMetrics.entries()) {
      if (stepMetrics.averageDuration > 30000) { // More than 30 seconds
        bottlenecks.push({
          type: 'slow_step',
          severity: 'medium',
          description: `Step "${stepMetrics.stepName}" is slow (avg: ${(stepMetrics.averageDuration / 1000).toFixed(1)}s)`,
          affectedComponent: stepId,
          suggestedAction: 'Optimize step implementation or add timeout',
        });
      }

      if (stepMetrics.errorRate > 0.15) { // More than 15% error rate for step
        bottlenecks.push({
          type: 'unreliable_step',
          severity: 'high',
          description: `Step "${stepMetrics.stepName}" has high error rate: ${(stepMetrics.errorRate * 100).toFixed(1)}%`,
          affectedComponent: stepId,
          suggestedAction: 'Add retry logic and improve error handling',
        });
      }
    }

    // Check throughput
    if (metrics.throughput < 1) { // Less than 1 execution per hour
      bottlenecks.push({
        type: 'low_throughput',
        severity: 'low',
        description: `Low throughput: ${metrics.throughput.toFixed(1)} executions/hour`,
        affectedComponent: 'workflow',
        suggestedAction: 'Consider parallel execution or resource optimization',
      });
    }

    return bottlenecks.sort((a, b) => {
      const severityOrder = { high: 3, medium: 2, low: 1 };
      return severityOrder[b.severity] - severityOrder[a.severity];
    });
  }

  /**
   * Generate performance recommendations
   */
  private generateRecommendations(
    metrics: WorkflowMetrics,
    bottlenecks: PerformanceBottleneck[]
  ): PerformanceRecommendation[] {
    const recommendations: PerformanceRecommendation[] = [];

    // Based on bottlenecks
    for (const bottleneck of bottlenecks) {
      recommendations.push({
        category: 'performance',
        priority: bottleneck.severity,
        title: `Address ${bottleneck.type.replace('_', ' ')}`,
        description: bottleneck.suggestedAction,
        expectedImpact: 'medium',
        implementation: {
          effort: 'medium',
          steps: [bottleneck.suggestedAction],
        },
      });
    }

    // General recommendations
    if (metrics.totalExecutions > 100) {
      recommendations.push({
        category: 'monitoring',
        priority: 'low',
        title: 'Add custom metrics',
        description: 'Consider adding business-specific metrics for better insights',
        expectedImpact: 'low',
        implementation: {
          effort: 'low',
          steps: ['Define business KPIs', 'Add custom metric collection', 'Create dashboards'],
        },
      });
    }

    return recommendations;
  }

  /**
   * Analyze performance trends
   */
  private analyzeTrends(metrics: WorkflowMetrics): PerformanceTrend[] {
    const trends: PerformanceTrend[] = [];
    
    if (metrics.timeSeriesData.length < 2) {
      return trends;
    }

    const recent = metrics.timeSeriesData.slice(-24); // Last 24 hours
    const older = metrics.timeSeriesData.slice(-48, -24); // Previous 24 hours

    if (older.length === 0) return trends;

    // Success rate trend
    const recentSuccessRate = recent.reduce((sum, tp) => sum + tp.successRate, 0) / recent.length;
    const olderSuccessRate = older.reduce((sum, tp) => sum + tp.successRate, 0) / older.length;
    const successRateChange = recentSuccessRate - olderSuccessRate;

    if (Math.abs(successRateChange) > 0.05) { // 5% change
      trends.push({
        metric: 'success_rate',
        direction: successRateChange > 0 ? 'improving' : 'degrading',
        change: successRateChange,
        description: `Success rate ${successRateChange > 0 ? 'improved' : 'degraded'} by ${(Math.abs(successRateChange) * 100).toFixed(1)}%`,
      });
    }

    // Duration trend
    const recentDuration = recent.reduce((sum, tp) => sum + tp.averageDuration, 0) / recent.length;
    const olderDuration = older.reduce((sum, tp) => sum + tp.averageDuration, 0) / older.length;
    const durationChange = (recentDuration - olderDuration) / olderDuration;

    if (Math.abs(durationChange) > 0.1) { // 10% change
      trends.push({
        metric: 'duration',
        direction: durationChange > 0 ? 'degrading' : 'improving',
        change: durationChange,
        description: `Average duration ${durationChange > 0 ? 'increased' : 'decreased'} by ${(Math.abs(durationChange) * 100).toFixed(1)}%`,
      });
    }

    return trends;
  }

  /**
   * Calculate overall health score
   */
  private calculateHealthScore(metrics: WorkflowMetrics): number {
    let score = 100;

    // Penalize high error rate
    score -= metrics.errorRate * 50;

    // Penalize very slow workflows (over 5 minutes)
    if (metrics.averageDuration > 300000) {
      score -= 20;
    }

    // Penalize low throughput
    if (metrics.throughput < 0.1) {
      score -= 10;
    }

    // Bonus for consistent performance (low P99/P95 ratio)
    if (metrics.p95Duration > 0 && metrics.p99Duration / metrics.p95Duration < 2) {
      score += 5;
    }

    return Math.max(0, Math.min(100, score));
  }
}

// Supporting interfaces
export interface WorkflowPerformanceReport {
  templateId: string;
  analysisTimestamp: number;
  overallHealth: number;
  bottlenecks: PerformanceBottleneck[];
  recommendations: PerformanceRecommendation[];
  trends: PerformanceTrend[];
  metrics: WorkflowMetrics;
}

export interface PerformanceBottleneck {
  type: 'high_error_rate' | 'slow_step' | 'unreliable_step' | 'low_throughput';
  severity: 'high' | 'medium' | 'low';
  description: string;
  affectedComponent: string;
  suggestedAction: string;
}

export interface PerformanceRecommendation {
  category: 'performance' | 'reliability' | 'monitoring';
  priority: 'high' | 'medium' | 'low';
  title: string;
  description: string;
  expectedImpact: 'high' | 'medium' | 'low';
  implementation: {
    effort: 'high' | 'medium' | 'low';
    steps: string[];
  };
}

export interface PerformanceTrend {
  metric: 'success_rate' | 'duration' | 'throughput';
  direction: 'improving' | 'degrading' | 'stable';
  change: number;
  description: string;
}

// Global instances
export const workflowMonitor = WorkflowMonitor.getInstance();
export const workflowAnalyzer = new WorkflowPerformanceAnalyzer(workflowMonitor);

// Auto-cleanup every hour
setInterval(() => {
  workflowMonitor.cleanup(24); // Keep 24 hours of data
}, 60 * 60 * 1000);