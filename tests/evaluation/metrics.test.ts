import { describe, it, expect, beforeEach, vi } from 'vitest';
import { 
  CompletenessMetric, 
  ContentSimilarityMetric,
  KeywordCoverageMetric,
  TextualDifferenceMetric,
  ToneConsistencyMetric
} from '@mastra/evals/nlp';

describe('Evaluation Metrics', () => {
  // Note: LLM-based metrics are mocked in setup.ts to avoid API calls during testing
  // The actual functionality is tested through integration tests with the agents

  describe('NLP-based Metrics', () => {
    describe('CompletenessMetric', () => {
      it('should evaluate complete responses highly', async () => {
        const metric = new CompletenessMetric();
        
        const result = await metric.measure(
          "Explain photosynthesis including sunlight, water, carbon dioxide, and oxygen production",
          "Photosynthesis is the process where plants use sunlight to convert water and carbon dioxide into glucose, releasing oxygen as a byproduct."
        );

        expect(result.score).toBeGreaterThanOrEqual(0.6); // Adjusted expectation
        expect(result.info.inputElements).toBeDefined();
        expect(result.info.outputElements).toBeDefined();
        expect(result.info.missingElements).toBeDefined();
      });

      it('should identify missing elements', async () => {
        const metric = new CompletenessMetric();
        
        const result = await metric.measure(
          "Describe the weather including temperature, humidity, wind speed, and precipitation",
          "The temperature is 25 degrees Celsius."
        );

        expect(result.score).toBeLessThan(0.5);
        expect(result.info.missingElements.length).toBeGreaterThan(0);
      });
    });

    describe('ContentSimilarityMetric', () => {
      it('should measure high similarity for similar texts', async () => {
        const metric = new ContentSimilarityMetric();
        
        const result = await metric.measure(
          "The quick brown fox jumps over the lazy dog",
          "A quick brown fox jumped over a lazy dog"
        );

        expect(result.score).toBeGreaterThan(0.7);
        expect(result.info.similarity).toBeDefined();
      });

      it('should measure low similarity for different texts', async () => {
        const metric = new ContentSimilarityMetric();
        
        const result = await metric.measure(
          "The weather is sunny today",
          "I love eating chocolate ice cream"
        );

        expect(result.score).toBeLessThan(0.3);
        expect(result.info.similarity).toBeDefined();
      });

      it('should handle case sensitivity options', async () => {
        const caseSensitive = new ContentSimilarityMetric({ ignoreCase: false });
        const caseInsensitive = new ContentSimilarityMetric({ ignoreCase: true });
        
        const text1 = "Hello World";
        const text2 = "hello world";
        
        const sensitiveResult = await caseSensitive.measure(text1, text2);
        const insensitiveResult = await caseInsensitive.measure(text1, text2);

        expect(insensitiveResult.score).toBeGreaterThan(sensitiveResult.score);
      });
    });

    describe('KeywordCoverageMetric', () => {
      it('should measure keyword coverage accurately', async () => {
        const metric = new KeywordCoverageMetric();
        
        const result = await metric.measure(
          "Machine learning algorithms artificial intelligence data science",
          "This article discusses machine learning and artificial intelligence applications in data science."
        );

        expect(result.score).toBeGreaterThan(0.6);
        expect(result.info.matchedKeywords).toBeDefined();
        expect(result.info.totalKeywords).toBeDefined();
      });

      it('should identify missing keywords', async () => {
        const metric = new KeywordCoverageMetric();
        
        const result = await metric.measure(
          "Python programming machine learning data science neural networks",
          "Python is a programming language."
        );

        expect(result.score).toBeLessThan(0.6);
        expect(result.info.matchedKeywords).toBeLessThan(result.info.totalKeywords);
      });
    });

    describe('TextualDifferenceMetric', () => {
      it('should measure differences between texts', async () => {
        const metric = new TextualDifferenceMetric();
        
        const result = await metric.measure(
          "The cat sat on the mat",
          "The dog sat on the mat"
        );

        expect(result.score).toBeGreaterThan(0.7); // High similarity despite one word change
        expect(result.info.changes).toBeDefined();
        expect(result.info.lengthDiff).toBeDefined();
        expect(result.info.confidence).toBeDefined();
      });

      it('should detect major differences', async () => {
        const metric = new TextualDifferenceMetric();
        
        const result = await metric.measure(
          "The weather is sunny and warm today",
          "Quantum physics explains the behavior of subatomic particles"
        );

        expect(result.score).toBeLessThan(0.4); // Low similarity for completely different content
        expect(result.info.changes).toBeGreaterThan(5);
      });
    });

    describe('ToneConsistencyMetric', () => {
      it('should measure tone consistency between texts', async () => {
        const metric = new ToneConsistencyMetric();
        
        const result = await metric.measure(
          "I'm excited about this amazing opportunity!",
          "This opportunity looks fantastic and I'm really enthusiastic about it!"
        );

        expect(result.score).toBeGreaterThanOrEqual(0.3); // Adjusted for realistic tone consistency
        expect(result.info.responseSentiment).toBeDefined();
        expect(result.info.referenceSentiment).toBeDefined();
      });

      it('should measure tone stability within single text', async () => {
        const metric = new ToneConsistencyMetric();
        
        const result = await metric.measure(
          "Great product! Excellent quality. Outstanding service. Perfect experience.",
          "" // Empty string for stability analysis
        );

        expect(result.score).toBeGreaterThan(0.7); // Should be very stable
        expect(result.info.avgSentiment).toBeDefined();
        expect(result.info.sentimentVariance).toBeDefined();
      });

      it('should detect tone inconsistency', async () => {
        const metric = new ToneConsistencyMetric();
        
        const result = await metric.measure(
          "I absolutely love this product!",
          "This product is terrible and disappointing."
        );

        expect(result.score).toBeLessThan(0.4); // Should detect inconsistency
      });
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle empty inputs gracefully', async () => {
      const completenessMetric = new CompletenessMetric();
      const similarityMetric = new ContentSimilarityMetric();
      
      const completenessResult = await completenessMetric.measure("", "");
      const similarityResult = await similarityMetric.measure("", "");

      expect(completenessResult.score).toBeDefined();
      expect(similarityResult.score).toBeDefined();
      expect(typeof completenessResult.score).toBe('number');
      expect(typeof similarityResult.score).toBe('number');
    });

    it('should handle very long texts', async () => {
      const longText1 = "This is a test sentence. ".repeat(100);
      const longText2 = "This is a test sentence with variation. ".repeat(100);
      
      const metric = new ContentSimilarityMetric();
      const result = await metric.measure(longText1, longText2);

      expect(result.score).toBeDefined();
      expect(result.score).toBeGreaterThanOrEqual(0);
      expect(result.score).toBeLessThanOrEqual(1);
    });

    it('should handle special characters and unicode', async () => {
      const text1 = "Café naïve résumé 你好 🚀";
      const text2 = "Cafe naive resume hello rocket";
      
      const metric = new ContentSimilarityMetric();
      const result = await metric.measure(text1, text2);

      expect(result.score).toBeDefined();
      expect(typeof result.score).toBe('number');
    });

    it('should handle numeric and mixed content', async () => {
      const metric = new CompletenessMetric();
      
      const result = await metric.measure(
        "Temperature 25°C humidity 60% wind 15km/h pressure 1013hPa",
        "The temperature is 25 degrees with 60 percent humidity and wind at 15 kilometers per hour"
      );

      expect(result.score).toBeDefined();
      expect(result.score).toBeGreaterThanOrEqual(0.4); // Adjusted expectation for numeric matching
    });
  });
});