/**
 * Workflow Templates for Common Business Processes
 * 
 * This module provides pre-built workflow templates for common business
 * scenarios including data processing, approval workflows, content generation,
 * and customer service automation.
 */

import { z } from 'zod';
import { WorkflowBuilder, WorkflowSteps, workflowRegistry, WorkflowStep } from './architecture';
import { weatherAgent } from '../src/mastra/agents/weather-agent';
import { eightBallAgent } from '../src/mastra/agents/eightball-agent';
import { quotesAgent } from '../src/mastra/agents/quotes-agent';

/**
 * Data Processing Workflow Template
 * 
 * Handles data ingestion, validation, transformation, and storage
 */
const DataProcessingWorkflow = new WorkflowBuilder('data-processing', 'Data Processing Pipeline')
  .description('Complete data processing pipeline with validation, transformation, and storage')
  .addSteps([
    // Step 1: Input validation
    WorkflowSteps.validation(
      z.object({
        data: z.array(z.record(z.any())),
        source: z.string(),
        timestamp: z.string().datetime(),
        metadata: z.record(z.any()).optional(),
      }),
      'validate-input'
    ),

    // Step 2: Data cleaning and normalization
    WorkflowSteps.transform(
      z.object({
        data: z.array(z.record(z.any())),
        source: z.string(),
        timestamp: z.string(),
        metadata: z.record(z.any()).optional(),
      }),
      z.object({
        cleanedData: z.array(z.record(z.any())),
        processingStats: z.object({
          totalRecords: z.number(),
          validRecords: z.number(),
          invalidRecords: z.number(),
          duplicatesRemoved: z.number(),
        }),
        source: z.string(),
        timestamp: z.string(),
      }),
      async (input) => {
        const cleanedData = [];
        let validRecords = 0;
        let invalidRecords = 0;
        let duplicatesRemoved = 0;
        const seenRecords = new Set();

        for (const record of input.data) {
          // Basic validation
          if (!record || typeof record !== 'object') {
            invalidRecords++;
            continue;
          }

          // Duplicate detection (simplified)
          const recordKey = JSON.stringify(record);
          if (seenRecords.has(recordKey)) {
            duplicatesRemoved++;
            continue;
          }
          seenRecords.add(recordKey);

          // Data normalization
          const cleanRecord = Object.entries(record).reduce((acc, [key, value]) => {
            // Normalize string values
            if (typeof value === 'string') {
              acc[key.toLowerCase()] = value.trim();
            } else {
              acc[key.toLowerCase()] = value;
            }
            return acc;
          }, {} as Record<string, any>);

          cleanedData.push({
            ...cleanRecord,
            _processed_at: new Date().toISOString(),
            _source: input.source,
          });
          validRecords++;
        }

        return {
          cleanedData,
          processingStats: {
            totalRecords: input.data.length,
            validRecords,
            invalidRecords,
            duplicatesRemoved,
          },
          source: input.source,
          timestamp: input.timestamp,
        };
      },
      'clean-normalize'
    ),

    // Step 3: Data enrichment
    {
      id: 'enrich-data',
      name: 'Data Enrichment',
      description: 'Enrich data with additional context and metadata',
      inputSchema: z.object({
        cleanedData: z.array(z.record(z.any())),
        processingStats: z.record(z.any()),
        source: z.string(),
        timestamp: z.string(),
      }),
      outputSchema: z.object({
        enrichedData: z.array(z.record(z.any())),
        enrichmentStats: z.record(z.any()),
        processingStats: z.record(z.any()),
        source: z.string(),
      }),
      execute: async (input) => {
        const enrichedData = input.cleanedData.map((record, index) => ({
          ...record,
          _id: `${input.source}_${Date.now()}_${index}`,
          _enriched_at: new Date().toISOString(),
          _batch_id: `batch_${Date.now()}`,
        }));

        return {
          enrichedData,
          enrichmentStats: {
            recordsEnriched: enrichedData.length,
            fieldsAdded: ['_id', '_enriched_at', '_batch_id'],
          },
          processingStats: input.processingStats,
          source: input.source,
        };
      },
    },

    // Step 4: Data storage
    {
      id: 'store-data',
      name: 'Data Storage',
      description: 'Store processed data in the database',
      inputSchema: z.object({
        enrichedData: z.array(z.record(z.any())),
        enrichmentStats: z.record(z.any()),
        processingStats: z.record(z.any()),
        source: z.string(),
      }),
      outputSchema: z.object({
        success: z.boolean(),
        recordsStored: z.number(),
        storageLocation: z.string(),
        processingReport: z.record(z.any()),
      }),
      execute: async (input) => {
        // Simulate database storage
        console.log(`Storing ${input.enrichedData.length} records from ${input.source}`);
        
        return {
          success: true,
          recordsStored: input.enrichedData.length,
          storageLocation: `database://processed_data/${input.source}`,
          processingReport: {
            ...input.processingStats,
            ...input.enrichmentStats,
            completedAt: new Date().toISOString(),
          },
        };
      },
      retryPolicy: {
        maxAttempts: 3,
        backoffStrategy: 'exponential',
        baseDelayMs: 1000,
      },
    },
  ])
  .errorHandling({
    strategy: 'retry-all',
    errorNotification: {
      channels: ['webhook'],
      config: { url: process.env.ERROR_WEBHOOK_URL },
    },
  })
  .metadata({ category: 'data-processing', tags: ['etl', 'data', 'automation'] });

/**
 * Approval Workflow Template
 * 
 * Multi-stage approval process with notifications and escalation
 */
const ApprovalWorkflow = new WorkflowBuilder('approval-process', 'Multi-Stage Approval Process')
  .description('Configurable approval workflow with escalation and notifications')
  .addSteps([
    // Step 1: Initial validation
    WorkflowSteps.validation(
      z.object({
        requestId: z.string(),
        requestType: z.enum(['expense', 'document', 'access', 'purchase']),
        amount: z.number().optional(),
        requestor: z.object({
          id: z.string(),
          name: z.string(),
          email: z.string().email(),
          department: z.string(),
        }),
        details: z.record(z.any()),
        attachments: z.array(z.string()).optional(),
      }),
      'validate-request'
    ),

    // Step 2: Determine approval level
    {
      id: 'determine-approval-level',
      name: 'Determine Approval Level',
      description: 'Determine required approval level based on request type and amount',
      inputSchema: z.object({
        requestId: z.string(),
        requestType: z.enum(['expense', 'document', 'access', 'purchase']),
        amount: z.number().optional(),
        requestor: z.record(z.any()),
        details: z.record(z.any()),
        attachments: z.array(z.string()).optional(),
      }),
      outputSchema: z.object({
        approvalLevel: z.enum(['manager', 'director', 'cfo', 'ceo']),
        approvers: z.array(z.object({
          id: z.string(),
          name: z.string(),
          email: z.string(),
          role: z.string(),
        })),
        originalRequest: z.record(z.any()),
      }),
      execute: async (input) => {
        let approvalLevel: 'manager' | 'director' | 'cfo' | 'ceo' = 'manager';
        
        // Determine approval level based on type and amount
        if (input.requestType === 'expense' && input.amount) {
          if (input.amount > 10000) approvalLevel = 'ceo';
          else if (input.amount > 5000) approvalLevel = 'cfo';
          else if (input.amount > 1000) approvalLevel = 'director';
        } else if (input.requestType === 'access') {
          approvalLevel = 'director';
        }

        // Mock approver data
        const approverMap = {
          manager: [{ id: 'mgr1', name: 'John Manager', email: 'manager@company.com', role: 'Manager' }],
          director: [{ id: 'dir1', name: 'Jane Director', email: 'director@company.com', role: 'Director' }],
          cfo: [{ id: 'cfo1', name: 'Bob CFO', email: 'cfo@company.com', role: 'CFO' }],
          ceo: [{ id: 'ceo1', name: 'Alice CEO', email: 'ceo@company.com', role: 'CEO' }],
        };

        return {
          approvalLevel,
          approvers: approverMap[approvalLevel],
          originalRequest: input,
        };
      },
    },

    // Step 3: Send approval notification
    {
      id: 'notify-approvers',
      name: 'Notify Approvers',
      description: 'Send notification to required approvers',
      inputSchema: z.object({
        approvalLevel: z.string(),
        approvers: z.array(z.record(z.any())),
        originalRequest: z.record(z.any()),
      }),
      outputSchema: z.object({
        notificationsSent: z.number(),
        approvalDeadline: z.string(),
        approvalToken: z.string(),
        originalRequest: z.record(z.any()),
      }),
      execute: async (input) => {
        const approvalDeadline = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(); // 7 days
        const approvalToken = `approval_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

        // Send notifications (mock implementation)
        for (const approver of input.approvers) {
          console.log(`Sending approval notification to ${approver.email}`);
          // In real implementation, send email/Slack notification
        }

        return {
          notificationsSent: input.approvers.length,
          approvalDeadline,
          approvalToken,
          originalRequest: input.originalRequest,
        };
      },
    },

    // Step 4: Wait for approval (simplified)
    WorkflowSteps.delay(5000, 'wait-for-approval'), // 5 second delay for demo

    // Step 5: Process approval decision
    {
      id: 'process-decision',
      name: 'Process Approval Decision',
      description: 'Process the approval decision and take appropriate action',
      inputSchema: z.any(),
      outputSchema: z.object({
        decision: z.enum(['approved', 'rejected', 'pending']),
        processedAt: z.string(),
        nextActions: z.array(z.string()),
      }),
      execute: async (input) => {
        // Mock approval decision (in real implementation, this would check actual approvals)
        const decision = Math.random() > 0.3 ? 'approved' : 'rejected';
        
        const nextActions = decision === 'approved' 
          ? ['execute-request', 'notify-requestor', 'update-records']
          : ['notify-rejection', 'log-decision'];

        return {
          decision,
          processedAt: new Date().toISOString(),
          nextActions,
        };
      },
    },
  ])
  .errorHandling({
    strategy: 'continue',
    errorNotification: {
      channels: ['email', 'slack'],
      config: { adminEmail: 'admin@company.com' },
    },
  })
  .metadata({ category: 'approval', tags: ['workflow', 'approval', 'business-process'] });

/**
 * Content Generation Workflow Template
 * 
 * AI-powered content generation with review and publishing
 */
const ContentGenerationWorkflow = new WorkflowBuilder('content-generation', 'AI Content Generation Pipeline')
  .description('Generate, review, and publish content using AI agents')
  .addSteps([
    // Step 1: Content brief validation
    WorkflowSteps.validation(
      z.object({
        contentType: z.enum(['blog', 'social', 'email', 'documentation']),
        topic: z.string(),
        targetAudience: z.string(),
        tone: z.enum(['professional', 'casual', 'technical', 'friendly']),
        length: z.enum(['short', 'medium', 'long']),
        keywords: z.array(z.string()).optional(),
        guidelines: z.string().optional(),
      }),
      'validate-brief'
    ),

    // Step 2: Generate content using AI agents
    {
      id: 'generate-content',
      name: 'AI Content Generation',
      description: 'Generate content using appropriate AI agent',
      inputSchema: z.object({
        contentType: z.string(),
        topic: z.string(),
        targetAudience: z.string(),
        tone: z.string(),
        length: z.string(),
        keywords: z.array(z.string()).optional(),
        guidelines: z.string().optional(),
      }),
      outputSchema: z.object({
        generatedContent: z.string(),
        metadata: z.record(z.any()),
        agentUsed: z.string(),
      }),
      execute: async (input) => {
        let agent;
        let prompt = `Create ${input.contentType} content about "${input.topic}" for ${input.targetAudience} audience with ${input.tone} tone.`;
        
        if (input.keywords?.length) {
          prompt += ` Include these keywords: ${input.keywords.join(', ')}.`;
        }
        
        if (input.guidelines) {
          prompt += ` Follow these guidelines: ${input.guidelines}`;
        }

        // Select appropriate agent based on content type
        switch (input.contentType) {
          case 'blog':
          case 'documentation':
            agent = quotesAgent; // Use quotes agent for inspirational/informative content
            break;
          default:
            agent = quotesAgent; // Default to quotes agent
        }

        const response = await agent.generate(prompt);

        return {
          generatedContent: response.text || 'Content generation failed',
          metadata: {
            wordCount: response.text?.split(' ').length || 0,
            generatedAt: new Date().toISOString(),
            prompt,
          },
          agentUsed: 'quotesAgent',
        };
      },
    },

    // Step 3: Content quality check
    {
      id: 'quality-check',
      name: 'Content Quality Assessment',
      description: 'Assess content quality and compliance',
      inputSchema: z.object({
        generatedContent: z.string(),
        metadata: z.record(z.any()),
        agentUsed: z.string(),
      }),
      outputSchema: z.object({
        qualityScore: z.number(),
        issues: z.array(z.string()),
        recommendations: z.array(z.string()),
        approved: z.boolean(),
        content: z.string(),
      }),
      execute: async (input) => {
        const content = input.generatedContent;
        const issues: string[] = [];
        const recommendations: string[] = [];
        
        // Basic quality checks
        const wordCount = content.split(' ').length;
        if (wordCount < 50) {
          issues.push('Content too short');
          recommendations.push('Expand content with more details');
        }
        
        if (!/[.!?]$/.test(content.trim())) {
          issues.push('Content does not end with proper punctuation');
          recommendations.push('Add proper ending punctuation');
        }
        
        // Calculate quality score
        let qualityScore = 0.8; // Base score
        if (issues.length === 0) qualityScore = 0.95;
        else if (issues.length > 2) qualityScore = 0.6;
        
        const approved = qualityScore >= 0.7;

        return {
          qualityScore,
          issues,
          recommendations,
          approved,
          content,
        };
      },
    },

    // Step 4: Content publishing
    WorkflowSteps.conditional(
      (input) => input.approved,
      'publish-content',
      'content-revision',
      'approval-check'
    ),

    {
      id: 'publish-content',
      name: 'Publish Content',
      description: 'Publish approved content',
      inputSchema: z.any(),
      outputSchema: z.object({
        published: z.boolean(),
        publishUrl: z.string(),
        publishedAt: z.string(),
      }),
      execute: async (input) => {
        // Mock publishing
        const publishUrl = `https://example.com/content/${Date.now()}`;
        console.log(`Publishing content to ${publishUrl}`);
        
        return {
          published: true,
          publishUrl,
          publishedAt: new Date().toISOString(),
        };
      },
    },

    {
      id: 'content-revision',
      name: 'Content Revision Required',
      description: 'Flag content for revision',
      inputSchema: z.any(),
      outputSchema: z.object({
        revisionRequired: z.boolean(),
        issues: z.array(z.string()),
        recommendations: z.array(z.string()),
      }),
      execute: async (input) => {
        return {
          revisionRequired: true,
          issues: input.issues || [],
          recommendations: input.recommendations || [],
        };
      },
    },
  ])
  .errorHandling({
    strategy: 'fail-fast',
    errorNotification: {
      channels: ['webhook'],
      config: { contentTeamWebhook: process.env.CONTENT_WEBHOOK_URL },
    },
  })
  .metadata({ category: 'content', tags: ['ai', 'content', 'generation', 'publishing'] });

/**
 * Customer Service Workflow Template
 * 
 * Automated customer service with agent routing and escalation
 */
const CustomerServiceWorkflow = new WorkflowBuilder('customer-service', 'Automated Customer Service')
  .description('Handle customer inquiries with AI agents and human escalation')
  .addSteps([
    // Step 1: Parse customer inquiry
    WorkflowSteps.validation(
      z.object({
        customerId: z.string(),
        channel: z.enum(['email', 'chat', 'phone', 'social']),
        inquiry: z.string(),
        priority: z.enum(['low', 'medium', 'high', 'urgent']).optional(),
        category: z.string().optional(),
        customerTier: z.enum(['bronze', 'silver', 'gold', 'platinum']).optional(),
      }),
      'parse-inquiry'
    ),

    // Step 2: Classify inquiry
    {
      id: 'classify-inquiry',
      name: 'Inquiry Classification',
      description: 'Classify customer inquiry for appropriate routing',
      inputSchema: z.object({
        customerId: z.string(),
        channel: z.string(),
        inquiry: z.string(),
        priority: z.string().optional(),
        category: z.string().optional(),
        customerTier: z.string().optional(),
      }),
      outputSchema: z.object({
        category: z.string(),
        priority: z.string(),
        suggestedAgent: z.string(),
        confidence: z.number(),
        originalInquiry: z.record(z.any()),
      }),
      execute: async (input) => {
        const inquiry = input.inquiry.toLowerCase();
        
        // Simple classification logic
        let category = 'general';
        let suggestedAgent = 'quotesAgent';
        let priority = input.priority || 'medium';
        
        if (inquiry.includes('weather') || inquiry.includes('forecast')) {
          category = 'weather';
          suggestedAgent = 'weatherAgent';
        } else if (inquiry.includes('advice') || inquiry.includes('help') || inquiry.includes('decision')) {
          category = 'guidance';
          suggestedAgent = 'eightBallAgent';
        } else if (inquiry.includes('inspiration') || inquiry.includes('motivation')) {
          category = 'inspiration';
          suggestedAgent = 'quotesAgent';
        }
        
        // Adjust priority based on keywords
        if (inquiry.includes('urgent') || inquiry.includes('emergency')) {
          priority = 'urgent';
        }

        return {
          category,
          priority,
          suggestedAgent,
          confidence: 0.8,
          originalInquiry: input,
        };
      },
    },

    // Step 3: Generate AI response
    {
      id: 'generate-response',
      name: 'AI Response Generation',
      description: 'Generate response using appropriate AI agent',
      inputSchema: z.object({
        category: z.string(),
        priority: z.string(),
        suggestedAgent: z.string(),
        confidence: z.number(),
        originalInquiry: z.record(z.any()),
      }),
      outputSchema: z.object({
        response: z.string(),
        confidence: z.number(),
        requiresHuman: z.boolean(),
        responseMetadata: z.record(z.any()),
      }),
      execute: async (input) => {
        const inquiry = input.originalInquiry.inquiry;
        let agent;
        let response = '';
        
        // Select and use appropriate agent
        switch (input.suggestedAgent) {
          case 'weatherAgent':
            agent = weatherAgent;
            break;
          case 'eightBallAgent':
            agent = eightBallAgent;
            break;
          case 'quotesAgent':
          default:
            agent = quotesAgent;
        }

        try {
          const agentResponse = await agent.generate(inquiry);
          response = agentResponse.text || 'I apologize, but I was unable to generate a response at this time.';
        } catch (error) {
          response = 'I apologize, but I encountered an error while processing your request. A human agent will assist you shortly.';
        }

        const requiresHuman = input.priority === 'urgent' || input.confidence < 0.6;

        return {
          response,
          confidence: input.confidence,
          requiresHuman,
          responseMetadata: {
            agentUsed: input.suggestedAgent,
            category: input.category,
            generatedAt: new Date().toISOString(),
          },
        };
      },
    },

    // Step 4: Route to human if needed
    WorkflowSteps.conditional(
      (input) => input.requiresHuman,
      'escalate-to-human',
      'send-response',
      'human-routing-check'
    ),

    {
      id: 'send-response',
      name: 'Send AI Response',
      description: 'Send AI-generated response to customer',
      inputSchema: z.any(),
      outputSchema: z.object({
        sent: z.boolean(),
        sentAt: z.string(),
        followUpScheduled: z.boolean(),
      }),
      execute: async (input) => {
        console.log(`Sending response to customer ${input.originalInquiry.customerId}: ${input.response}`);
        
        return {
          sent: true,
          sentAt: new Date().toISOString(),
          followUpScheduled: true,
        };
      },
    },

    {
      id: 'escalate-to-human',
      name: 'Escalate to Human Agent',
      description: 'Route inquiry to human customer service agent',
      inputSchema: z.any(),
      outputSchema: z.object({
        escalated: z.boolean(),
        assignedAgent: z.string(),
        estimatedWaitTime: z.number(),
      }),
      execute: async (input) => {
        const assignedAgent = `human_agent_${Math.floor(Math.random() * 5) + 1}`;
        const estimatedWaitTime = Math.floor(Math.random() * 30) + 5; // 5-35 minutes
        
        console.log(`Escalating inquiry from customer ${input.originalInquiry.customerId} to ${assignedAgent}`);
        
        return {
          escalated: true,
          assignedAgent,
          estimatedWaitTime,
        };
      },
    },
  ])
  .errorHandling({
    strategy: 'continue',
    compensationSteps: ['escalate-to-human'],
    errorNotification: {
      channels: ['slack'],
      config: { customerServiceChannel: process.env.CS_SLACK_CHANNEL },
    },
  })
  .metadata({ category: 'customer-service', tags: ['ai', 'customer-service', 'automation', 'escalation'] });

// Register all workflow templates
workflowRegistry.register(DataProcessingWorkflow.build());
workflowRegistry.register(ApprovalWorkflow.build());
workflowRegistry.register(ContentGenerationWorkflow.build());
workflowRegistry.register(CustomerServiceWorkflow.build());

export {
  DataProcessingWorkflow,
  ApprovalWorkflow,
  ContentGenerationWorkflow,
  CustomerServiceWorkflow,
};