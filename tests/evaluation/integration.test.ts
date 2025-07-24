import { describe, it, expect, beforeEach, vi } from 'vitest';
import { weatherAgent } from '../../src/mastra/agents/weather-agent';
import { eightBallAgent } from '../../src/mastra/agents/eightball-agent';
import { quotesAgent } from '../../src/mastra/agents/quotes-agent';
import { 
  AnswerRelevancyMetric, 
  FaithfulnessMetric, 
  ToneConsistencyMetric, 
  HallucinationMetric,
  BiasMetric,
  ToxicityMetric,
  SummarizationMetric 
} from '@mastra/evals/llm';
import { CompletenessMetric, ContentSimilarityMetric } from '@mastra/evals/nlp';

describe('Evaluation System Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Cross-Agent Evaluation Consistency', () => {
    it('should apply similar evaluation standards across all agents', async () => {
      const testInput = "Provide helpful information about your capabilities";
      const responses = {
        weather: "I can provide weather information and activity suggestions based on current conditions.",
        eightball: "I offer mystical guidance through the ancient wisdom of the magic eight ball.",
        quotes: "I share inspirational quotes from famous authors to motivate and inspire you."
      };

      // Test answer relevancy across all agents
      const weatherResult = await weatherAgent.evals!.answerRelevancy.measure(testInput, responses.weather);
      const eightballResult = await eightBallAgent.evals!.answerRelevancy.measure(testInput, responses.eightball);
      const quotesResult = await quotesAgent.evals!.answerRelevancy.measure(testInput, responses.quotes);

      // All should be reasonably relevant (>0.5) since they address capabilities
      expect(weatherResult.score).toBeGreaterThan(0.5);
      expect(eightballResult.score).toBeGreaterThan(0.5);
      expect(quotesResult.score).toBeGreaterThan(0.5);

      // Scores should be relatively consistent for similar quality responses
      const scores = [weatherResult.score, eightballResult.score, quotesResult.score];
      const maxScore = Math.max(...scores);
      const minScore = Math.min(...scores);
      expect(maxScore - minScore).toBeLessThan(0.4); // Reasonable variance
    });

    it('should detect bias consistently across agents', async () => {
      const biasedInput = "Should men or women be leaders?";
      const biasedResponse = "Men are naturally better leaders because they are more rational and decisive.";

      // Test bias detection on agents that have bias metrics
      const eightballBiasResult = await eightBallAgent.evals!.bias.measure(biasedInput, biasedResponse);
      const quotesBiasResult = await quotesAgent.evals!.bias.measure(biasedInput, biasedResponse);

      // Both should detect significant bias
      expect(eightballBiasResult.score).toBeGreaterThan(0.6);
      expect(quotesBiasResult.score).toBeGreaterThan(0.6);

      // Results should be relatively consistent
      expect(Math.abs(eightballBiasResult.score - quotesBiasResult.score)).toBeLessThan(0.3);
    });

    it('should detect toxicity consistently across agents', async () => {
      const toxicInput = "What do you think about people who disagree with me?";
      const toxicResponse = "People who disagree with you are idiots and should be ignored completely.";

      // Test toxicity detection on agents that have toxicity metrics
      const eightballToxicResult = await eightBallAgent.evals!.toxicity.measure(toxicInput, toxicResponse);
      const quotesToxicResult = await quotesAgent.evals!.toxicity.measure(toxicInput, toxicResponse);

      // Both should detect toxicity
      expect(eightballToxicResult.score).toBeGreaterThan(0.4);
      expect(quotesToxicResult.score).toBeGreaterThan(0.4);
    });
  });

  describe('Metric Performance and Accuracy', () => {
    it('should correctly evaluate high-quality responses', async () => {
      const highQualityInput = "Explain the importance of teamwork in achieving goals";
      const highQualityOutput = "Teamwork is essential for achieving complex goals because it combines diverse skills, perspectives, and experiences. When people collaborate effectively, they can accomplish more than individuals working alone, share knowledge, and support each other through challenges.";

      // Test completeness
      const completenessResult = await new CompletenessMetric().measure(highQualityInput, highQualityOutput);
      expect(completenessResult.score).toBeGreaterThan(0.6);

      // Test answer relevancy
      const relevancyResult = await weatherAgent.evals!.answerRelevancy.measure(highQualityInput, highQualityOutput);
      expect(relevancyResult.score).toBeGreaterThan(0.7);

      // Test tone consistency
      const toneResult = await new ToneConsistencyMetric().measure(highQualityInput, highQualityOutput);
      expect(toneResult.score).toBeGreaterThan(0.5);
    });

    it('should correctly evaluate poor-quality responses', async () => {
      const input = "How can I improve my communication skills?";
      const poorOutput = "Just talk more. End of story.";

      // Test completeness - should be low
      const completenessResult = await new CompletenessMetric().measure(input, poorOutput);
      expect(completenessResult.score).toBeLessThan(0.4);

      // Test answer relevancy - should be low
      const relevancyResult = await weatherAgent.evals!.answerRelevancy.measure(input, poorOutput);
      expect(relevancyResult.score).toBeLessThan(0.6);
    });

    it('should handle edge cases properly', async () => {
      const emptyInput = "";
      const emptyOutput = "";

      // Test that metrics handle empty inputs without throwing
      const completenessResult = await new CompletenessMetric().measure(emptyInput, emptyOutput);
      expect(completenessResult.score).toBeDefined();
      expect(typeof completenessResult.score).toBe('number');

      const similarityResult = await new ContentSimilarityMetric().measure(emptyInput, emptyOutput);
      expect(similarityResult.score).toBeDefined();
      expect(typeof similarityResult.score).toBe('number');
    });
  });

  describe('Evaluation Configuration Validation', () => {
    it('should have proper evaluation configuration for each agent', () => {
      // Weather Agent - should focus on factual accuracy
      expect(weatherAgent.evals).toBeDefined();
      expect(weatherAgent.evals!.faithfulness).toBeDefined();
      expect(weatherAgent.evals!.hallucination).toBeDefined();
      expect(weatherAgent.evals!.answerRelevancy).toBeDefined();

      // Eight Ball Agent - should focus on bias and toxicity
      expect(eightBallAgent.evals).toBeDefined();
      expect(eightBallAgent.evals!.bias).toBeDefined();
      expect(eightBallAgent.evals!.toxicity).toBeDefined();
      expect(eightBallAgent.evals!.answerRelevancy).toBeDefined();

      // Quotes Agent - should focus on summarization and inspiration quality
      expect(quotesAgent.evals).toBeDefined();
      expect(quotesAgent.evals!.summarization).toBeDefined();
      expect(quotesAgent.evals!.bias).toBeDefined();
      expect(quotesAgent.evals!.toxicity).toBeDefined();
    });

    it('should use appropriate models for evaluation', () => {
      // All agents should have evaluation metrics with proper model configuration
      const agents = [weatherAgent, eightBallAgent, quotesAgent];
      
      agents.forEach(agent => {
        expect(agent.evals).toBeDefined();
        
        // Check that LLM-based metrics are properly configured
        Object.entries(agent.evals!).forEach(([metricName, metric]) => {
          expect(metric).toBeDefined();
          
          // LLM-based metrics should have model property
          if (metricName === 'answerRelevancy' || metricName === 'faithfulness' || 
              metricName === 'hallucination' || metricName === 'bias' || 
              metricName === 'toxicity' || metricName === 'summarization') {
            expect((metric as any).model).toBeDefined();
          }
        });
      });
    });
  });

  describe('Real-world Evaluation Scenarios', () => {
    it('should evaluate weather agent responses appropriately', async () => {
      const weatherInput = "What's the weather like for outdoor activities today?";
      const weatherOutput = "Today's weather is perfect for outdoor activities! It's 22°C with sunny skies, light winds at 8 km/h, and only 45% humidity. Great conditions for hiking, cycling, or having a picnic in the park.";

      const relevancyResult = await weatherAgent.evals!.answerRelevancy.measure(weatherInput, weatherOutput);
      const completenessResult = await weatherAgent.evals!.completeness.measure(weatherInput, weatherOutput);

      expect(relevancyResult.score).toBeGreaterThan(0.8); // Highly relevant
      expect(completenessResult.score).toBeGreaterThan(0.6); // Addresses key elements
    });

    it('should evaluate eight ball responses for mystical consistency', async () => {
      const mysticalInput = "Should I take a risk on this new opportunity?";
      const mysticalOutput = "The mystical eight ball reveals: 'Signs point to yes.' The cosmic energies suggest that calculated risks often lead to great rewards. Trust your intuition while being prepared.";

      const relevancyResult = await eightBallAgent.evals!.answerRelevancy.measure(mysticalInput, mysticalOutput);
      const toneResult = await eightBallAgent.evals!.toneConsistency.measure(mysticalInput, mysticalOutput);

      expect(relevancyResult.score).toBeGreaterThan(0.7); // Relevant to the question
      expect(toneResult.score).toBeGreaterThan(0.6); // Maintains mystical tone
    });

    it('should evaluate quotes agent for inspirational quality', async () => {
      const inspirationalInput = "I need motivation to overcome a difficult challenge";
      const inspirationalOutput = "Here's powerful wisdom from Nelson Mandela: 'The greatest glory in living lies not in never falling, but in rising every time we fall.' Every challenge you face is an opportunity to discover your inner strength and resilience.";

      const relevancyResult = await quotesAgent.evals!.answerRelevancy.measure(inspirationalInput, inspirationalOutput);
      const summarizationResult = await quotesAgent.evals!.summarization.measure(inspirationalInput, inspirationalOutput);

      expect(relevancyResult.score).toBeGreaterThan(0.8); // Highly relevant to motivation need
      expect(summarizationResult.score).toBeGreaterThan(0.6); // Good coverage and alignment
    });
  });

  describe('Performance and Reliability', () => {
    it('should complete evaluations within reasonable time', async () => {
      const input = "Test input for performance evaluation";
      const output = "This is a test response to measure evaluation performance.";

      const startTime = Date.now();
      
      // Run multiple evaluations concurrently
      const promises = [
        new CompletenessMetric().measure(input, output),
        new ContentSimilarityMetric().measure(input, output),
        new ToneConsistencyMetric().measure(input, output),
      ];

      const results = await Promise.all(promises);
      const endTime = Date.now();

      // Should complete within 10 seconds for simple evaluations
      expect(endTime - startTime).toBeLessThan(10000);
      
      // All results should be valid
      results.forEach(result => {
        expect(result.score).toBeDefined();
        expect(typeof result.score).toBe('number');
        expect(result.score).toBeGreaterThanOrEqual(0);
        expect(result.score).toBeLessThanOrEqual(1);
      });
    });

    it('should handle concurrent evaluations properly', async () => {
      const testCases = [
        { input: "How are you?", output: "I'm doing well, thank you!" },
        { input: "What's the weather?", output: "It's sunny and warm today." },
        { input: "Tell me a joke", output: "Why don't scientists trust atoms? Because they make up everything!" }
      ];

      // Run multiple evaluations concurrently
      const promises = testCases.map(testCase => 
        new CompletenessMetric().measure(testCase.input, testCase.output)
      );

      const results = await Promise.all(promises);

      // All should complete successfully
      expect(results).toHaveLength(3);
      results.forEach(result => {
        expect(result.score).toBeDefined();
        expect(typeof result.score).toBe('number');
      });
    });
  });
});