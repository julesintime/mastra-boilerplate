#!/usr/bin/env tsx

/**
 * Automated Evaluation Runner for CI/CD Pipeline
 * 
 * This script runs comprehensive evaluations on all agents and generates reports
 * for continuous integration and quality assurance.
 */

import { weatherAgent } from '../src/mastra/agents/weather-agent';
import { eightBallAgent } from '../src/mastra/agents/eightball-agent';
import { quotesAgent } from '../src/mastra/agents/quotes-agent';
import { mkdir, writeFile } from 'fs/promises';
import { join } from 'path';

// Configuration from environment variables
const config = {
  enabled: process.env.EVAL_CI_ENABLED === 'true',
  failOnThreshold: process.env.EVAL_CI_FAIL_ON_THRESHOLD === 'true',
  reportFormat: process.env.EVAL_CI_REPORT_FORMAT || 'json',
  outputPath: process.env.EVAL_CI_OUTPUT_PATH || './eval-results',
  thresholds: {
    answerRelevancy: parseFloat(process.env.EVAL_THRESHOLD_ANSWER_RELEVANCY || '0.7'),
    faithfulness: parseFloat(process.env.EVAL_THRESHOLD_FAITHFULNESS || '0.8'),
    hallucination: parseFloat(process.env.EVAL_THRESHOLD_HALLUCINATION || '0.3'),
    bias: parseFloat(process.env.EVAL_THRESHOLD_BIAS || '0.2'),
    toxicity: parseFloat(process.env.EVAL_THRESHOLD_TOXICITY || '0.1'),
    completeness: parseFloat(process.env.EVAL_THRESHOLD_COMPLETENESS || '0.6'),
    toneConsistency: parseFloat(process.env.EVAL_THRESHOLD_TONE_CONSISTENCY || '0.7'),
  },
};

interface EvaluationResult {
  agentName: string;
  metricName: string;
  score: number;
  threshold: number;
  passed: boolean;
  info: any;
  timestamp: string;
  testCase: {
    input: string;
    output: string;
    context?: string[];
  };
}

interface EvaluationReport {
  summary: {
    totalTests: number;
    passed: number;
    failed: number;
    passRate: number;
    timestamp: string;
  };
  results: EvaluationResult[];
  agents: {
    [agentName: string]: {
      totalTests: number;
      passed: number;
      failed: number;
      passRate: number;
    };
  };
}

// Test cases for each agent type
const testCases = {
  weather: [
    {
      input: "What's the weather like in London today?",
      output: "London weather today: 15°C with light rain, 80% humidity, winds 12 km/h from the southwest. Good day for indoor activities.",
      context: ["London temperature is 15°C", "Light rain is falling", "Humidity at 80%", "Wind speed 12 km/h southwest"]
    },
    {
      input: "Should I bring an umbrella based on the forecast?",
      output: "Yes, bring an umbrella. The forecast shows 70% chance of rain with scattered showers throughout the day.",
      context: ["70% chance of rain", "Scattered showers expected", "Light to moderate precipitation"]
    },
    {
      input: "What outdoor activities would you recommend for today's weather?",
      output: "With sunny skies and 22°C, perfect weather for hiking, cycling, picnics, or outdoor sports. Light breeze makes it ideal for all outdoor activities.",
      context: ["Sunny skies", "Temperature 22°C", "Light breeze conditions"]
    }
  ],
  eightball: [
    {
      input: "Should I accept this new job offer?",
      output: "The mystical eight ball reveals: 'Outlook good.' The cosmic energies suggest this opportunity aligns with your path. Trust your instincts while considering practical factors.",
      context: []
    },
    {
      input: "Will my relationship work out?",
      output: "The ancient wisdom shows: 'Reply hazy, try again.' Matters of the heart require patience and clear communication. The universe encourages open dialogue.",
      context: []
    },
    {
      input: "Is now a good time to start a business?",
      output: "The eight ball's wisdom: 'Yes, definitely.' The stars align favorably for new ventures. Prepare thoroughly and trust in your abilities.",
      context: []
    }
  ],
  quotes: [
    {
      input: "I need motivation to overcome a difficult challenge",
      output: "Here's wisdom from Nelson Mandela: 'The greatest glory in living lies not in never falling, but in rising every time we fall.' Every challenge strengthens your resilience and reveals your true character.",
      context: []
    },
    {
      input: "Share an inspirational quote about success",
      output: "Maya Angelou once said: 'Success is liking yourself, liking what you do, and liking how you do it.' True success comes from alignment between your values, passions, and actions.",
      context: []
    },
    {
      input: "I need wisdom about making difficult decisions",
      output: "Steve Jobs shared this insight: 'Your time is limited, don't waste it living someone else's life.' Trust your inner wisdom and make choices that reflect your authentic self.",
      context: []
    }
  ]
};

async function runAgentEvaluations(agent: any, agentName: string, cases: any[]): Promise<EvaluationResult[]> {
  const results: EvaluationResult[] = [];
  
  console.log(`\nRunning evaluations for ${agentName}...`);
  
  for (const testCase of cases) {
    console.log(`  Testing: ${testCase.input.substring(0, 50)}...`);
    
    // Get available evaluation metrics for this agent
    const evals = agent.evals || {};
    
    for (const [metricName, metric] of Object.entries(evals)) {
      try {
        // Prepare metric with context if needed
        let evaluationMetric = metric as any;
        if (testCase.context && testCase.context.length > 0 && 
            (metricName === 'faithfulness' || metricName === 'hallucination')) {
          // Create new instance with context
          evaluationMetric = new (metric.constructor as any)(
            (metric as any).model,
            { ...(metric as any).options, context: testCase.context }
          );
        }
        
        const result = await evaluationMetric.measure(testCase.input, testCase.output);
        
        // Determine threshold and pass/fail
        const threshold = getThreshold(metricName);
        const passed = checkThreshold(metricName, result.score, threshold);
        
        results.push({
          agentName,
          metricName,
          score: result.score,
          threshold,
          passed,
          info: result.info,
          timestamp: new Date().toISOString(),
          testCase: {
            input: testCase.input,
            output: testCase.output,
            context: testCase.context
          }
        });
        
        console.log(`    ${metricName}: ${result.score.toFixed(3)} (${passed ? 'PASS' : 'FAIL'})`);
        
      } catch (error) {
        console.error(`    ${metricName}: ERROR - ${error.message}`);
        results.push({
          agentName,
          metricName,
          score: 0,
          threshold: getThreshold(metricName),
          passed: false,
          info: { error: error.message },
          timestamp: new Date().toISOString(),
          testCase: {
            input: testCase.input,
            output: testCase.output,
            context: testCase.context
          }
        });
      }
    }
  }
  
  return results;
}

function getThreshold(metricName: string): number {
  const thresholdMap: { [key: string]: number } = {
    answerRelevancy: config.thresholds.answerRelevancy,
    faithfulness: config.thresholds.faithfulness,
    hallucination: config.thresholds.hallucination,
    bias: config.thresholds.bias,
    toxicity: config.thresholds.toxicity,
    completeness: config.thresholds.completeness,
    toneConsistency: config.thresholds.toneConsistency,
    contentSimilarity: 0.5, // Default threshold
    summarization: 0.6, // Default threshold
  };
  
  return thresholdMap[metricName] || 0.5;
}

function checkThreshold(metricName: string, score: number, threshold: number): boolean {
  // For negative metrics (lower is better), flip the logic
  const negativeMetrics = ['hallucination', 'bias', 'toxicity'];
  
  if (negativeMetrics.includes(metricName)) {
    return score <= threshold;
  } else {
    return score >= threshold;
  }
}

function generateReport(results: EvaluationResult[]): EvaluationReport {
  const passed = results.filter(r => r.passed).length;
  const failed = results.length - passed;
  
  // Group by agent
  const agents: { [key: string]: { totalTests: number; passed: number; failed: number; passRate: number } } = {};
  
  for (const result of results) {
    if (!agents[result.agentName]) {
      agents[result.agentName] = { totalTests: 0, passed: 0, failed: 0, passRate: 0 };
    }
    agents[result.agentName].totalTests++;
    if (result.passed) {
      agents[result.agentName].passed++;
    } else {
      agents[result.agentName].failed++;
    }
  }
  
  // Calculate pass rates
  for (const agentName in agents) {
    const agent = agents[agentName];
    agent.passRate = agent.totalTests > 0 ? agent.passed / agent.totalTests : 0;
  }
  
  return {
    summary: {
      totalTests: results.length,
      passed,
      failed,
      passRate: results.length > 0 ? passed / results.length : 0,
      timestamp: new Date().toISOString()
    },
    results,
    agents
  };
}

async function saveReport(report: EvaluationReport): Promise<void> {
  // Create output directory
  await mkdir(config.outputPath, { recursive: true });
  
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  
  if (config.reportFormat === 'json') {
    const filePath = join(config.outputPath, `evaluation-report-${timestamp}.json`);
    await writeFile(filePath, JSON.stringify(report, null, 2));
    console.log(`\nReport saved to: ${filePath}`);
  }
  
  // Also save a summary for quick viewing
  const summaryPath = join(config.outputPath, 'latest-summary.txt');
  const summaryContent = `
Evaluation Summary - ${report.summary.timestamp}
==============================================

Overall Results:
- Total Tests: ${report.summary.totalTests}
- Passed: ${report.summary.passed}
- Failed: ${report.summary.failed}
- Pass Rate: ${(report.summary.passRate * 100).toFixed(1)}%

Agent Results:
${Object.entries(report.agents).map(([name, stats]) => 
  `- ${name}: ${stats.passed}/${stats.totalTests} (${(stats.passRate * 100).toFixed(1)}%)`
).join('\n')}

Failed Tests:
${report.results.filter(r => !r.passed).map(r => 
  `- ${r.agentName}.${r.metricName}: ${r.score.toFixed(3)} (threshold: ${r.threshold})`
).join('\n')}
`;
  
  await writeFile(summaryPath, summaryContent);
  console.log(`Summary saved to: ${summaryPath}`);
}

async function main() {
  if (!config.enabled) {
    console.log('Evaluation CI is disabled. Set EVAL_CI_ENABLED=true to enable.');
    return;
  }
  
  console.log('Starting Mastra Agent Evaluation Pipeline');
  console.log('=========================================');
  console.log(`Output Path: ${config.outputPath}`);
  console.log(`Fail on Threshold: ${config.failOnThreshold}`);
  console.log(`Report Format: ${config.reportFormat}`);
  
  try {
    const allResults: EvaluationResult[] = [];
    
    // Run evaluations for each agent
    const weatherResults = await runAgentEvaluations(weatherAgent, 'WeatherAgent', testCases.weather);
    const eightballResults = await runAgentEvaluations(eightBallAgent, 'EightBallAgent', testCases.eightball);
    const quotesResults = await runAgentEvaluations(quotesAgent, 'QuotesAgent', testCases.quotes);
    
    allResults.push(...weatherResults, ...eightballResults, ...quotesResults);
    
    // Generate and save report
    const report = generateReport(allResults);
    await saveReport(report);
    
    // Print summary
    console.log('\n=========================================');
    console.log('Evaluation Pipeline Complete');
    console.log('=========================================');
    console.log(`Total Tests: ${report.summary.totalTests}`);
    console.log(`Passed: ${report.summary.passed}`);
    console.log(`Failed: ${report.summary.failed}`);
    console.log(`Pass Rate: ${(report.summary.passRate * 100).toFixed(1)}%`);
    
    // Exit with error code if configured and tests failed
    if (config.failOnThreshold && report.summary.failed > 0) {
      console.log('\nFAILURE: Some evaluation tests failed and EVAL_CI_FAIL_ON_THRESHOLD is enabled.');
      process.exit(1);
    } else {
      console.log('\nSUCCESS: All evaluation tests passed or failure tolerance is enabled.');
      process.exit(0);
    }
    
  } catch (error) {
    console.error('\nERROR: Evaluation pipeline failed:', error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main().catch(console.error);
}

export { main as runEvaluations, config as evaluationConfig };