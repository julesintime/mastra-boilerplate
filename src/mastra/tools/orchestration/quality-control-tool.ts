import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

/**
 * Quality Control Tool
 * 
 * Evaluates quality and consistency of agent outputs throughout the orchestration workflow.
 * Implements comprehensive quality gates and ensures deliverables meet established standards.
 */
export const qualityControlTool = createTool({
  id: 'quality_control',
  description: 'Evaluate quality and consistency of agent outputs, implement quality gates, ensure deliverables meet standards, and provide detailed feedback for improvements.',
  inputSchema: z.object({
    evaluationType: z.enum([
      'content_quality',
      'research_accuracy', 
      'citation_compliance',
      'style_consistency',
      'completeness_check',
      'final_review',
      'cross_agent_consistency'
    ]).describe('Type of quality evaluation to perform'),
    deliverableId: z.string().describe('Unique identifier for the deliverable being evaluated'),
    content: z.object({
      text: z.string().describe('Main content to be evaluated'),
      metadata: z.object({
        author: z.string().optional(),
        taskId: z.string().optional(),
        agent: z.string().optional(),
        contentType: z.enum(['research', 'analysis', 'draft', 'edited_content', 'final_content']).optional(),
        wordCount: z.number().optional(),
        sources: z.array(z.string()).optional(),
      }).optional(),
      relatedContent: z.array(z.object({
        id: z.string(),
        text: z.string(),
        relationship: z.enum(['dependency', 'continuation', 'revision', 'reference']),
      })).optional().describe('Related content for consistency checking'),
    }).describe('Content and context for quality evaluation'),
    qualityStandards: z.object({
      accuracyThreshold: z.number().min(0).max(1).default(0.9).describe('Minimum accuracy score required'),
      completenessThreshold: z.number().min(0).max(1).default(0.8).describe('Minimum completeness score required'),
      clarityThreshold: z.number().min(0).max(1).default(0.85).describe('Minimum clarity score required'),
      consistencyThreshold: z.number().min(0).max(1).default(0.9).describe('Minimum consistency score required'),
      citationRequirements: z.object({
        minimumSources: z.number().default(3),
        citationStyle: z.enum(['APA', 'MLA', 'Chicago', 'Harvard']).default('APA'),
        requirePeerReviewed: z.boolean().default(false),
      }).optional(),
      styleRequirements: z.object({
        tone: z.enum(['formal', 'professional', 'casual', 'academic']).default('professional'),
        voiceConsistency: z.boolean().default(true),
        lengthRequirements: z.object({
          minimum: z.number().optional(),
          maximum: z.number().optional(),
          target: z.number().optional(),
        }).optional(),
      }).optional(),
    }).describe('Quality standards and thresholds for evaluation'),
  }),
  outputSchema: z.object({
    qualityAssessment: z.object({
      overallScore: z.number().min(0).max(1).describe('Overall quality score (0-1)'),
      passedQualityGate: z.boolean().describe('Whether content meets minimum quality standards'),
      evaluationTimestamp: z.string(),
      evaluatorId: z.string().default('Quality Control Tool'),
    }),
    detailedMetrics: z.object({
      accuracy: z.object({
        score: z.number().min(0).max(1),
        details: z.array(z.object({
          claim: z.string(),
          verified: z.boolean(),
          confidence: z.number(),
          sources: z.array(z.string()),
        })),
        issues: z.array(z.string()),
      }),
      completeness: z.object({
        score: z.number().min(0).max(1),
        coverageAnalysis: z.array(z.object({
          requirement: z.string(),
          covered: z.boolean(),
          coverage_percentage: z.number(),
          gaps: z.array(z.string()),
        })),
        missingElements: z.array(z.string()),
      }),
      clarity: z.object({
        score: z.number().min(0).max(1),
        readabilityMetrics: z.object({
          fleschScore: z.number().optional(),
          averageSentenceLength: z.number(),
          complexWords: z.number(),
          passiveVoice: z.number(),
        }),
        clarityIssues: z.array(z.string()),
      }),
      consistency: z.object({
        score: z.number().min(0).max(1),
        styleConsistency: z.object({
          toneVariation: z.number(),
          terminologyConsistency: z.number(),
          formatConsistency: z.number(),
        }),
        crossReferenceConsistency: z.number().optional(),
        inconsistencies: z.array(z.string()),
      }),
      citationCompliance: z.object({
        score: z.number().min(0).max(1),
        totalCitations: z.number(),
        properlyFormatted: z.number(),
        sourceQuality: z.object({
          peerReviewed: z.number(),
          authoritative: z.number(),
          recent: z.number(),
          relevant: z.number(),
        }),
        citationIssues: z.array(z.string()),
      }).optional(),
    }),
    recommendations: z.array(z.object({
      category: z.enum(['critical', 'important', 'minor', 'enhancement']),
      issue: z.string(),
      recommendation: z.string(),
      priority: z.enum(['immediate', 'high', 'medium', 'low']),
      estimatedEffort: z.string(),
      expectedImpact: z.string(),
    })),
    actionPlan: z.object({
      nextSteps: z.array(z.string()),
      requiredRevisions: z.array(z.object({
        section: z.string(),
        type: z.enum(['content', 'citation', 'style', 'structure']),
        description: z.string(),
        assignedAgent: z.string().optional(),
      })),
      approvalStatus: z.enum(['approved', 'conditional_approval', 'requires_revision', 'rejected']),
      escalationRequired: z.boolean(),
    }),
  }),
  execute: async ({ context }) => {
    const { evaluationType, deliverableId, content, qualityStandards } = context;
    
    const evaluationTimestamp = new Date().toISOString();
    
    // Simulate comprehensive quality evaluation
    // In real implementation, this would use advanced NLP analysis, fact-checking APIs, etc.
    
    // Content analysis simulation
    const wordCount = content.text.split(/\s+/).length;
    const sentenceCount = content.text.split(/[.!?]+/).length;
    const averageSentenceLength = wordCount / sentenceCount;
    
    // Simulate accuracy evaluation
    const simulateAccuracyCheck = () => {
      // Extract potential factual claims (simplified simulation)
      const claims = content.text.match(/\d+%|\d+ (users|people|companies|studies)/g) || [];
      
      const claimVerifications = claims.slice(0, 5).map((claim, i) => ({
        claim,
        verified: Math.random() > 0.2, // 80% of claims verified
        confidence: 0.7 + Math.random() * 0.3, // Confidence between 0.7-1.0
        sources: [`source_${i + 1}.com`, `reference_${i + 1}.org`],
      }));
      
      const verifiedCount = claimVerifications.filter(c => c.verified).length;
      const accuracyScore = claims.length > 0 ? verifiedCount / claimVerifications.length : 0.95;
      
      return {
        score: accuracyScore,
        details: claimVerifications,
        issues: claimVerifications
          .filter(c => !c.verified)
          .map(c => `Unverified claim: "${c.claim}"`),
      };
    };

    // Simulate completeness evaluation
    const simulateCompletenessCheck = () => {
      const requirements = [
        'Introduction/Overview',
        'Main Content/Analysis', 
        'Supporting Evidence',
        'Conclusion/Summary',
        'References/Citations',
      ];
      
      const coverageAnalysis = requirements.map(req => {
        const covered = Math.random() > 0.15; // 85% coverage rate
        return {
          requirement: req,
          covered,
          coverage_percentage: covered ? 80 + Math.random() * 20 : Math.random() * 50,
          gaps: covered ? [] : [`Missing or insufficient ${req.toLowerCase()}`],
        };
      });
      
      const totalCoverage = coverageAnalysis.reduce((sum, item) => sum + item.coverage_percentage, 0) / requirements.length;
      const completenessScore = totalCoverage / 100;
      
      return {
        score: completenessScore,
        coverageAnalysis,
        missingElements: coverageAnalysis
          .filter(item => !item.covered)
          .map(item => item.requirement),
      };
    };

    // Simulate clarity evaluation  
    const simulateClarityCheck = () => {
      const complexWordCount = (content.text.match(/\w{8,}/g) || []).length;
      const passiveVoiceCount = (content.text.match(/\b(was|were|is|are|been|being)\s+\w+ed\b/g) || []).length;
      
      // Simplified Flesch Reading Ease calculation
      const fleschScore = 206.835 - (1.015 * averageSentenceLength) - (84.6 * (complexWordCount / wordCount));
      
      const clarityScore = Math.max(0, Math.min(1, (fleschScore + 50) / 100)); // Normalize to 0-1
      
      return {
        score: clarityScore,
        readabilityMetrics: {
          fleschScore: Math.round(fleschScore),
          averageSentenceLength: Math.round(averageSentenceLength * 10) / 10,
          complexWords: complexWordCount,
          passiveVoice: passiveVoiceCount,
        },
        clarityIssues: [
          ...(averageSentenceLength > 20 ? ['Sentences are too long on average'] : []),
          ...(complexWordCount / wordCount > 0.15 ? ['High percentage of complex words'] : []),
          ...(passiveVoiceCount > wordCount * 0.1 ? ['Excessive use of passive voice'] : []),
        ],
      };
    };

    // Simulate consistency evaluation
    const simulateConsistencyCheck = () => {
      const consistencyScore = 0.85 + Math.random() * 0.15; // Generally high consistency
      
      return {
        score: consistencyScore,
        styleConsistency: {
          toneVariation: 0.1 + Math.random() * 0.1,
          terminologyConsistency: 0.9 + Math.random() * 0.1,
          formatConsistency: 0.95 + Math.random() * 0.05,
        },
        crossReferenceConsistency: content.relatedContent ? 0.88 + Math.random() * 0.12 : undefined,
        inconsistencies: consistencyScore < 0.9 ? [
          'Minor tone variations in different sections',
          'Inconsistent terminology usage',
        ] : [],
      };
    };

    // Simulate citation compliance evaluation
    const simulateCitationCompliance = () => {
      if (!qualityStandards.citationRequirements) {
        return undefined;
      }
      
      const citationCount = (content.text.match(/\[\d+\]|\(\w+,?\s*\d{4}\)/g) || []).length;
      const properlyFormatted = Math.floor(citationCount * (0.8 + Math.random() * 0.2));
      
      const citationScore = citationCount >= qualityStandards.citationRequirements.minimumSources ? 
        (properlyFormatted / citationCount) * 0.9 + 0.1 : 
        citationCount / qualityStandards.citationRequirements.minimumSources * 0.7;
      
      return {
        score: Math.min(1, citationScore),
        totalCitations: citationCount,
        properlyFormatted,
        sourceQuality: {
          peerReviewed: Math.floor(citationCount * 0.6),
          authoritative: Math.floor(citationCount * 0.8),
          recent: Math.floor(citationCount * 0.7),
          relevant: Math.floor(citationCount * 0.9),
        },
        citationIssues: [
          ...(citationCount < qualityStandards.citationRequirements.minimumSources ? 
            [`Insufficient citations: ${citationCount}/${qualityStandards.citationRequirements.minimumSources} required`] : []),
          ...(properlyFormatted < citationCount ? 
            [`${citationCount - properlyFormatted} citations have formatting issues`] : []),
        ],
      };
    };

    // Run all evaluations
    const accuracy = simulateAccuracyCheck();
    const completeness = simulateCompletenessCheck();
    const clarity = simulateClarityCheck();
    const consistency = simulateConsistencyCheck();
    const citationCompliance = simulateCitationCompliance();

    // Calculate overall quality score
    const scores = [accuracy.score, completeness.score, clarity.score, consistency.score];
    if (citationCompliance) scores.push(citationCompliance.score);
    const overallScore = scores.reduce((sum, score) => sum + score, 0) / scores.length;

    // Check quality gates
    const passedQualityGate = 
      accuracy.score >= qualityStandards.accuracyThreshold &&
      completeness.score >= qualityStandards.completenessThreshold &&
      clarity.score >= qualityStandards.clarityThreshold &&
      consistency.score >= qualityStandards.consistencyThreshold &&
      (!citationCompliance || citationCompliance.score >= 0.8);

    // Generate recommendations
    const recommendations = [];
    
    if (accuracy.score < qualityStandards.accuracyThreshold) {
      recommendations.push({
        category: 'critical' as const,
        issue: 'Accuracy score below threshold',
        recommendation: 'Review and verify all factual claims with authoritative sources',
        priority: 'immediate' as const,
        estimatedEffort: '2-4 hours',
        expectedImpact: 'Significantly improve content credibility and accuracy',
      });
    }

    if (completeness.score < qualityStandards.completenessThreshold) {
      recommendations.push({
        category: 'important' as const,
        issue: 'Content completeness below standard',
        recommendation: 'Address missing sections and expand on incomplete areas',
        priority: 'high' as const,
        estimatedEffort: '3-6 hours',
        expectedImpact: 'Comprehensive coverage of all required topics',
      });
    }

    if (clarity.score < qualityStandards.clarityThreshold) {
      recommendations.push({
        category: 'important' as const,
        issue: 'Content clarity needs improvement',
        recommendation: 'Simplify complex sentences, reduce passive voice, clarify technical terms',
        priority: 'medium' as const,
        estimatedEffort: '1-3 hours',
        expectedImpact: 'Better readability and user comprehension',
      });
    }

    // Determine approval status and next steps
    const getApprovalStatus = () => {
      if (!passedQualityGate) {
        if (overallScore < 0.6) return 'rejected';
        return 'requires_revision';
      }
      if (overallScore < 0.9) return 'conditional_approval';
      return 'approved';
    };

    const approvalStatus = getApprovalStatus();
    
    const requiredRevisions = [];
    if (accuracy.issues.length > 0) {
      requiredRevisions.push({
        section: 'Factual Claims',
        type: 'content' as const,
        description: 'Verify and correct unverified claims',
        assignedAgent: 'Fact Checker Agent',
      });
    }
    
    if (completeness.missingElements.length > 0) {
      requiredRevisions.push({
        section: completeness.missingElements.join(', '),
        type: 'content' as const,
        description: 'Add missing content sections',
        assignedAgent: 'Writer Agent',
      });
    }

    return {
      qualityAssessment: {
        overallScore: Math.round(overallScore * 100) / 100,
        passedQualityGate,
        evaluationTimestamp,
        evaluatorId: 'Quality Control Tool',
      },
      detailedMetrics: {
        accuracy,
        completeness,
        clarity,
        consistency,
        citationCompliance,
      },
      recommendations,
      actionPlan: {
        nextSteps: [
          ...(approvalStatus === 'approved' ? ['Content approved for delivery'] : []),
          ...(approvalStatus === 'conditional_approval' ? ['Address minor recommendations before final delivery'] : []),
          ...(approvalStatus === 'requires_revision' ? ['Complete required revisions before resubmission'] : []),
          ...(approvalStatus === 'rejected' ? ['Major revisions required - reassess project scope'] : []),
        ],
        requiredRevisions,
        approvalStatus,
        escalationRequired: approvalStatus === 'rejected' || (approvalStatus === 'requires_revision' && overallScore < 0.5),
      },
    };
  },
});