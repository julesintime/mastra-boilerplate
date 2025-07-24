import { describe, it, expect, beforeEach, vi } from 'vitest';
import { weatherAgent } from '../../src/mastra/agents/weather-agent';
import { weatherTool } from '../../src/mastra/tools/weather-tool';

// Mock the weather tool to control responses during testing
vi.mock('../../src/mastra/tools/weather-tool', () => ({
  weatherTool: {
    execute: vi.fn(),
  },
}));

describe('Weather Agent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Agent Configuration', () => {
    it('should have correct name and description', () => {
      expect(weatherAgent.name).toBe('Weather Agent');
      expect(weatherAgent.description).toContain('weather information');
      expect(weatherAgent.description).toContain('activity planning');
    });

    it('should have weather tool configured', () => {
      expect(weatherAgent.tools).toHaveProperty('weatherTool');
    });

    it('should have evaluation metrics configured', () => {
      expect(weatherAgent.evals).toBeDefined();
      expect(weatherAgent.evals).toHaveProperty('answerRelevancy');
      expect(weatherAgent.evals).toHaveProperty('faithfulness');
      expect(weatherAgent.evals).toHaveProperty('toneConsistency');
      expect(weatherAgent.evals).toHaveProperty('hallucination');
      expect(weatherAgent.evals).toHaveProperty('contentSimilarity');
      expect(weatherAgent.evals).toHaveProperty('completeness');
    });
  });

  describe('Evaluation Metrics', () => {
    it('should evaluate answer relevancy correctly', async () => {
      const input = "What's the weather in London?";
      const output = "The weather in London is currently 15°C with light rain and 80% humidity.";
      
      const metric = weatherAgent.evals!.answerRelevancy;
      const result = await metric.measure(input, output);
      
      expect(result.score).toBeGreaterThan(0.7); // Should be highly relevant
      expect(result.info.reason).toBeDefined();
    });

    it('should evaluate tone consistency', async () => {
      const input = "Tell me about the weather please";
      const output = "The weather is pleasant today with clear skies.";
      
      const metric = weatherAgent.evals!.toneConsistency;
      const result = await metric.measure(input, output);
      
      expect(result.score).toBeDefined();
      expect(result.score).toBeGreaterThanOrEqual(0);
      expect(result.score).toBeLessThanOrEqual(1);
    });

    it('should evaluate content similarity', async () => {
      const input = "What is the temperature in Paris?";
      const output = "The temperature in Paris is 18 degrees Celsius.";
      
      const metric = weatherAgent.evals!.contentSimilarity;
      const result = await metric.measure(input, output);
      
      expect(result.score).toBeGreaterThan(0.3); // Should have reasonable similarity
      expect(result.info.similarity).toBeDefined();
    });

    it('should evaluate completeness', async () => {
      const input = "Give me weather details for New York including temperature, humidity, and wind";
      const output = "New York weather: Temperature 22°C, Humidity 65%, Wind 15 km/h from the west.";
      
      const metric = weatherAgent.evals!.completeness;
      const result = await metric.measure(input, output);
      
      expect(result.score).toBeGreaterThan(0.7); // Should be quite complete
      expect(result.info.inputElements).toBeDefined();
      expect(result.info.outputElements).toBeDefined();
    });

    it('should detect low relevancy for off-topic responses', async () => {
      const input = "What's the weather in Tokyo?";
      const output = "I love cooking pasta with tomato sauce.";
      
      const metric = weatherAgent.evals!.answerRelevancy;
      const result = await metric.measure(input, output);
      
      expect(result.score).toBeLessThan(0.3); // Should be very low relevancy
    });
  });

  describe('Integration with Evaluation System', () => {
    it('should have properly configured evaluation models', () => {
      const evals = weatherAgent.evals!;
      
      // Check that LLM-based metrics are using the right model
      expect(evals.answerRelevancy).toBeDefined();
      expect(evals.faithfulness).toBeDefined();
      expect(evals.hallucination).toBeDefined();
      
      // Check that NLP metrics are properly configured
      expect(evals.toneConsistency).toBeDefined();
      expect(evals.contentSimilarity).toBeDefined();
      expect(evals.completeness).toBeDefined();
    });

    it('should support evaluation with context for faithfulness', async () => {
      const context = ["The temperature in London is 15°C", "It's raining lightly"];
      const input = "What's the London weather?";
      const output = "London weather is 15°C with light rain.";
      
      // Create a new metric instance with context for this test
      const faithfulnessMetric = weatherAgent.evals!.faithfulness;
      const metricWithContext = new (faithfulnessMetric.constructor as any)(
        faithfulnessMetric.model, 
        { ...faithfulnessMetric.options, context }
      );
      
      const result = await metricWithContext.measure(input, output);
      
      expect(result.score).toBeGreaterThan(0.7); // Should be faithful to context
      expect(result.info.reason).toBeDefined();
    });
  });

  describe('Error Handling', () => {
    it('should handle evaluation errors gracefully', async () => {
      const input = "";
      const output = "";
      
      // Test with empty inputs - should not throw
      const metric = weatherAgent.evals!.completeness;
      const result = await metric.measure(input, output);
      
      expect(result.score).toBeDefined();
      expect(typeof result.score).toBe('number');
    });

    it('should handle very long text inputs', async () => {
      const longInput = "What's the weather? ".repeat(100);
      const longOutput = "The weather is sunny. ".repeat(100);
      
      const metric = weatherAgent.evals!.contentSimilarity;
      const result = await metric.measure(longInput, longOutput);
      
      expect(result.score).toBeDefined();
      expect(result.score).toBeGreaterThanOrEqual(0);
      expect(result.score).toBeLessThanOrEqual(1);
    });
  });
});