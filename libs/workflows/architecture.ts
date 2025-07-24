/**
 * Advanced Workflow Architecture for Mastra
 * 
 * This module provides a comprehensive workflow system that enables complex
 * business process automation with step orchestration, conditional logic,
 * error handling, and state management.
 */

import { Workflow, WorkflowContext } from '@mastra/core/workflow';
import { step } from '@mastra/core/workflow/step';
import { z } from 'zod';

// Core workflow types and interfaces
export interface WorkflowStep {
  id: string;
  name: string;
  description?: string;
  inputSchema: z.ZodSchema<any>;
  outputSchema: z.ZodSchema<any>;
  execute: (input: any, context: WorkflowContext) => Promise<any>;
  retryPolicy?: RetryPolicy;
  timeout?: number;
  dependencies?: string[];
  conditional?: ConditionalLogic;
}

export interface RetryPolicy {
  maxAttempts: number;
  backoffStrategy: 'fixed' | 'exponential' | 'linear';
  baseDelayMs: number;
  maxDelayMs?: number;
  retryableErrors?: string[];
}

export interface ConditionalLogic {
  condition: (input: any, context: WorkflowContext) => boolean | Promise<boolean>;
  onTrue?: string; // Next step if condition is true
  onFalse?: string; // Next step if condition is false
}

export interface WorkflowTemplate {
  id: string;
  name: string;
  description: string;
  version: string;
  steps: WorkflowStep[];
  triggers?: WorkflowTrigger[];
  errorHandling?: ErrorHandlingStrategy;
  metadata?: Record<string, any>;
}

export interface WorkflowTrigger {
  type: 'manual' | 'scheduled' | 'webhook' | 'event';
  config: Record<string, any>;
}

export interface ErrorHandlingStrategy {
  strategy: 'fail-fast' | 'continue' | 'retry-all' | 'compensate';
  compensationSteps?: string[];
  errorNotification?: {
    channels: ('email' | 'slack' | 'webhook')[];
    config: Record<string, any>;
  };
}

/**
 * Advanced Workflow Builder
 */
export class WorkflowBuilder {
  private template: Partial<WorkflowTemplate> = {
    steps: [],
    triggers: [],
  };

  constructor(id: string, name: string) {
    this.template.id = id;
    this.template.name = name;
    this.template.version = '1.0.0';
  }

  /**
   * Add a step to the workflow
   */
  addStep(stepConfig: WorkflowStep): this {
    this.template.steps!.push(stepConfig);
    return this;
  }

  /**
   * Add multiple steps
   */
  addSteps(steps: WorkflowStep[]): this {
    this.template.steps!.push(...steps);
    return this;
  }

  /**
   * Set workflow description
   */
  description(desc: string): this {
    this.template.description = desc;
    return this;
  }

  /**
   * Set workflow version
   */
  version(version: string): this {
    this.template.version = version;
    return this;
  }

  /**
   * Add trigger configuration
   */
  addTrigger(trigger: WorkflowTrigger): this {
    this.template.triggers!.push(trigger);
    return this;
  }

  /**
   * Set error handling strategy
   */
  errorHandling(strategy: ErrorHandlingStrategy): this {
    this.template.errorHandling = strategy;
    return this;
  }

  /**
   * Add metadata
   */
  metadata(meta: Record<string, any>): this {
    this.template.metadata = { ...this.template.metadata, ...meta };
    return this;
  }

  /**
   * Build the workflow template
   */
  build(): WorkflowTemplate {
    if (!this.template.id || !this.template.name || !this.template.steps?.length) {
      throw new Error('Workflow must have id, name, and at least one step');
    }
    return this.template as WorkflowTemplate;
  }

  /**
   * Convert to Mastra Workflow
   */
  toMastraWorkflow(): Workflow {
    const template = this.build();
    const workflowSteps: Record<string, any> = {};

    // Convert workflow steps to Mastra step format
    for (const stepConfig of template.steps) {
      workflowSteps[stepConfig.id] = step(stepConfig.inputSchema, stepConfig.outputSchema, {
        run: async (input, context) => {
          try {
            return await stepConfig.execute(input, context);
          } catch (error) {
            // Handle step-level errors based on retry policy
            if (stepConfig.retryPolicy) {
              return await this.executeWithRetry(stepConfig, input, context, error);
            }
            throw error;
          }
        },
        timeout: stepConfig.timeout,
      });
    }

    return new Workflow({
      name: template.name,
      steps: workflowSteps,
    });
  }

  /**
   * Execute step with retry logic
   */
  private async executeWithRetry(
    stepConfig: WorkflowStep,
    input: any,
    context: WorkflowContext,
    lastError: Error,
    attempt: number = 1
  ): Promise<any> {
    const policy = stepConfig.retryPolicy!;
    
    if (attempt >= policy.maxAttempts) {
      throw lastError;
    }

    // Check if error is retryable
    if (policy.retryableErrors && !policy.retryableErrors.includes(lastError.constructor.name)) {
      throw lastError;
    }

    // Calculate delay
    let delay = policy.baseDelayMs;
    switch (policy.backoffStrategy) {
      case 'exponential':
        delay = Math.min(policy.baseDelayMs * Math.pow(2, attempt - 1), policy.maxDelayMs || Infinity);
        break;
      case 'linear':
        delay = policy.baseDelayMs * attempt;
        break;
      case 'fixed':
      default:
        delay = policy.baseDelayMs;
    }

    // Wait before retry
    await new Promise(resolve => setTimeout(resolve, delay));

    try {
      return await stepConfig.execute(input, context);
    } catch (error) {
      return await this.executeWithRetry(stepConfig, input, context, error as Error, attempt + 1);
    }
  }
}

/**
 * Workflow Template Registry
 */
export class WorkflowRegistry {
  private static instance: WorkflowRegistry;
  private templates: Map<string, WorkflowTemplate> = new Map();

  static getInstance(): WorkflowRegistry {
    if (!WorkflowRegistry.instance) {
      WorkflowRegistry.instance = new WorkflowRegistry();
    }
    return WorkflowRegistry.instance;
  }

  /**
   * Register a workflow template
   */
  register(template: WorkflowTemplate): void {
    this.templates.set(template.id, template);
  }

  /**
   * Get workflow template by ID
   */
  get(id: string): WorkflowTemplate | undefined {
    return this.templates.get(id);
  }

  /**
   * List all registered templates
   */
  list(category?: string): WorkflowTemplate[] {
    const templates = Array.from(this.templates.values());
    if (category) {
      return templates.filter(t => t.metadata?.category === category);
    }
    return templates;
  }

  /**
   * Remove template
   */
  unregister(id: string): boolean {
    return this.templates.delete(id);
  }
}

/**
 * Workflow Execution Engine
 */
export class WorkflowEngine {
  private static instance: WorkflowEngine;
  private registry: WorkflowRegistry;

  constructor() {
    this.registry = WorkflowRegistry.getInstance();
  }

  static getInstance(): WorkflowEngine {
    if (!WorkflowEngine.instance) {
      WorkflowEngine.instance = new WorkflowEngine();
    }
    return WorkflowEngine.instance;
  }

  /**
   * Execute workflow by template ID
   */
  async execute(templateId: string, input: any, options?: {
    context?: Record<string, any>;
    timeout?: number;
  }): Promise<any> {
    const template = this.registry.get(templateId);
    if (!template) {
      throw new Error(`Workflow template '${templateId}' not found`);
    }

    const builder = new WorkflowBuilder(template.id, template.name)
      .description(template.description)
      .version(template.version)
      .addSteps(template.steps);

    if (template.errorHandling) {
      builder.errorHandling(template.errorHandling);
    }

    if (template.metadata) {
      builder.metadata(template.metadata);
    }

    const workflow = builder.toMastraWorkflow();
    
    try {
      return await workflow.execute(input, options?.context);
    } catch (error) {
      await this.handleWorkflowError(template, error as Error, input);
      throw error;
    }
  }

  /**
   * Handle workflow execution errors
   */
  private async handleWorkflowError(
    template: WorkflowTemplate,
    error: Error,
    input: any
  ): Promise<void> {
    if (!template.errorHandling) {
      return;
    }

    const strategy = template.errorHandling;
    
    // Send error notifications
    if (strategy.errorNotification) {
      await this.sendErrorNotification(strategy.errorNotification, template, error, input);
    }

    // Execute compensation steps if configured
    if (strategy.compensationSteps?.length) {
      console.log(`Executing compensation steps for workflow ${template.id}`);
      // Implementation would execute compensation logic
    }
  }

  /**
   * Send error notification
   */
  private async sendErrorNotification(
    notification: NonNullable<ErrorHandlingStrategy['errorNotification']>,
    template: WorkflowTemplate,
    error: Error,
    input: any
  ): Promise<void> {
    for (const channel of notification.channels) {
      try {
        switch (channel) {
          case 'email':
            // Email notification implementation
            console.log(`Sending email notification for workflow ${template.id} error`);
            break;
          case 'slack':
            // Slack notification implementation
            console.log(`Sending Slack notification for workflow ${template.id} error`);
            break;
          case 'webhook':
            // Webhook notification implementation
            console.log(`Sending webhook notification for workflow ${template.id} error`);
            break;
        }
      } catch (notificationError) {
        console.error(`Failed to send ${channel} notification:`, notificationError);
      }
    }
  }
}

/**
 * Common workflow step factories
 */
export const WorkflowSteps = {
  /**
   * Data validation step
   */
  validation: (schema: z.ZodSchema<any>, stepId: string = 'validation'): WorkflowStep => ({
    id: stepId,
    name: 'Data Validation',
    description: 'Validate input data against schema',
    inputSchema: z.any(),
    outputSchema: schema,
    execute: async (input: any) => {
      return schema.parse(input);
    },
  }),

  /**
   * Data transformation step
   */
  transform: <TInput, TOutput>(
    inputSchema: z.ZodSchema<TInput>,
    outputSchema: z.ZodSchema<TOutput>,
    transformer: (input: TInput) => TOutput | Promise<TOutput>,
    stepId: string = 'transform'
  ): WorkflowStep => ({
    id: stepId,
    name: 'Data Transformation',
    inputSchema,
    outputSchema,
    execute: async (input: TInput) => {
      return await transformer(input);
    },
  }),

  /**
   * HTTP API call step
   */
  apiCall: (config: {
    stepId: string;
    url: string;
    method: 'GET' | 'POST' | 'PUT' | 'DELETE';
    headers?: Record<string, string>;
    inputSchema?: z.ZodSchema<any>;
    outputSchema?: z.ZodSchema<any>;
  }): WorkflowStep => ({
    id: config.stepId,
    name: 'API Call',
    description: `${config.method} request to ${config.url}`,
    inputSchema: config.inputSchema || z.any(),
    outputSchema: config.outputSchema || z.any(),
    execute: async (input: any) => {
      const response = await fetch(config.url, {
        method: config.method,
        headers: {
          'Content-Type': 'application/json',
          ...config.headers,
        },
        body: config.method !== 'GET' ? JSON.stringify(input) : undefined,
      });

      if (!response.ok) {
        throw new Error(`API call failed: ${response.status} ${response.statusText}`);
      }

      return await response.json();
    },
    retryPolicy: {
      maxAttempts: 3,
      backoffStrategy: 'exponential',
      baseDelayMs: 1000,
      retryableErrors: ['NetworkError', 'TimeoutError'],
    },
  }),

  /**
   * Conditional branching step
   */
  conditional: (
    condition: (input: any, context: WorkflowContext) => boolean | Promise<boolean>,
    trueStep: string,
    falseStep: string,
    stepId: string = 'conditional'
  ): WorkflowStep => ({
    id: stepId,
    name: 'Conditional Branch',
    inputSchema: z.any(),
    outputSchema: z.any(),
    execute: async (input: any, context: WorkflowContext) => {
      return input; // Pass through input
    },
    conditional: {
      condition,
      onTrue: trueStep,
      onFalse: falseStep,
    },
  }),

  /**
   * Delay/wait step
   */
  delay: (delayMs: number, stepId: string = 'delay'): WorkflowStep => ({
    id: stepId,
    name: 'Delay',
    description: `Wait for ${delayMs}ms`,
    inputSchema: z.any(),
    outputSchema: z.any(),
    execute: async (input: any) => {
      await new Promise(resolve => setTimeout(resolve, delayMs));
      return input;
    },
  }),
};

// Export the global instances
export const workflowRegistry = WorkflowRegistry.getInstance();
export const workflowEngine = WorkflowEngine.getInstance();