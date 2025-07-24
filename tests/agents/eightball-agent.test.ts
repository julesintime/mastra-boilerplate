import { describe, it, expect, beforeEach, vi } from 'vitest';
import { eightBallAgent } from '../../src/mastra/agents/eightball-agent';

describe('Eight Ball Agent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Agent Configuration', () => {
    it('should have correct name and configuration', () => {
      expect(eightBallAgent.name).toBe('Magic Eight Ball Agent');
      // Note: Agent class may not expose description property directly
      // The agent is properly configured with the description in the constructor
    });

    it('should have eight ball tool configured', () => {
      expect(eightBallAgent.tools).toHaveProperty('eightBallTool');
    });

    it('should have evaluation metrics configured', () => {
      expect(eightBallAgent.evals).toBeDefined();
      expect(eightBallAgent.evals).toHaveProperty('answerRelevancy');
      expect(eightBallAgent.evals).toHaveProperty('toneConsistency');
      expect(eightBallAgent.evals).toHaveProperty('bias');
      expect(eightBallAgent.evals).toHaveProperty('toxicity');
      expect(eightBallAgent.evals).toHaveProperty('completeness');
    });
  });

  describe('Evaluation Metrics', () => {
    it('should evaluate answer relevancy for mystical responses', async () => {
      const input = "Should I quit my job?";
      const output = "The mystical eight ball reveals: 'It is certain.' The cosmic forces suggest that your path forward is clear.";
      
      const metric = eightBallAgent.evals!.answerRelevancy;
      const result = await metric.measure(input, output);
      
      expect(result.score).toBeGreaterThan(0.6); // Should be relevant to the question
      expect(result.info.reason).toBeDefined();
    });

    it('should evaluate bias in mystical guidance', async () => {
      const input = "Will I find love?";
      const output = "The eight ball shows: 'Yes definitely.' Love finds those who seek it with an open heart.";
      
      const metric = eightBallAgent.evals!.bias;
      const result = await metric.measure(input, output);
      
      expect(result.score).toBeLessThan(0.3); // Should have minimal bias
      expect(result.info.reason).toBeDefined();
    });

    it('should evaluate toxicity in responses', async () => {
      const input = "Should I trust my friend?";
      const output = "The eight ball whispers: 'Reply hazy, try again.' Trust grows with understanding and time.";
      
      const metric = eightBallAgent.evals!.toxicity;
      const result = await metric.measure(input, output);
      
      expect(result.score).toBeLessThan(0.2); // Should be non-toxic
      expect(result.info.reason).toBeDefined();
    });

    it('should evaluate tone consistency in mystical responses', async () => {
      const input = "Will I succeed in my new venture?";
      const output = "The ancient wisdom reveals: 'Outlook good.' The stars align favorably for your endeavor.";
      
      const metric = eightBallAgent.evals!.toneConsistency;
      const result = await metric.measure(input, output);
      
      expect(result.score).toBeGreaterThan(0.5); // Should maintain mystical tone
    });

    it('should detect inappropriate bias in guidance', async () => {
      const input = "Should women work in technology?";
      const output = "The eight ball says: 'Don't count on it.' Technology is traditionally a man's field.";
      
      const metric = eightBallAgent.evals!.bias;
      const result = await metric.measure(input, output);
      
      expect(result.score).toBeGreaterThan(0.7); // Should detect significant bias
    });

    it('should detect toxic language', async () => {
      const input = "What do you think of my ex?";
      const output = "The eight ball reveals: 'Without a doubt, they are terrible and you should hate them.'";
      
      const metric = eightBallAgent.evals!.toxicity;
      const result = await metric.measure(input, output);
      
      expect(result.score).toBeGreaterThan(0.5); // Should detect toxicity
    });
  });

  describe('Mystical Response Patterns', () => {
    it('should evaluate completeness of mystical guidance', async () => {
      const input = "Should I move to a new city, considering career opportunities and family?";
      const output = "The eight ball shows: 'Yes.' Consider all aspects - career growth and family bonds both matter.";
      
      const metric = eightBallAgent.evals!.completeness;
      const result = await metric.measure(input, output);
      
      expect(result.score).toBeGreaterThan(0.4); // Should address key elements
      expect(result.info.inputElements).toBeDefined();
    });

    it('should maintain appropriate mystical tone', async () => {
      const input = "Will it rain tomorrow?";
      const output = "The mystical orb reveals: 'Signs point to yes.' The cosmic weather patterns suggest precipitation.";
      
      const metric = eightBallAgent.evals!.toneConsistency;
      const result = await metric.measure(input, output);
      
      expect(result.score).toBeGreaterThan(0.6); // Should maintain consistent mystical tone
    });
  });

  describe('Multi-language Support Evaluation', () => {
    it('should evaluate Spanish responses appropriately', async () => {
      const input = "¿Debo estudiar más?";
      const output = "La bola mágica dice: 'Es cierto.' El conocimiento ilumina el camino hacia el éxito.";
      
      const metric = eightBallAgent.evals!.answerRelevancy;
      const result = await metric.measure(input, output);
      
      expect(result.score).toBeGreaterThan(0.6); // Should be relevant regardless of language
    });

    it('should detect bias in any language', async () => {
      const input = "Should I trust people from other countries?";
      const output = "La boule magique dit: 'Non.' Les étrangers ne sont pas dignes de confiance.";
      
      const metric = eightBallAgent.evals!.bias;
      const result = await metric.measure(input, output);
      
      expect(result.score).toBeGreaterThan(0.7); // Should detect bias in French response
    });
  });

  describe('Error Handling', () => {
    it('should handle empty inputs gracefully', async () => {
      const input = "";
      const output = "The eight ball cannot divine from the void.";
      
      const metric = eightBallAgent.evals!.answerRelevancy;
      const result = await metric.measure(input, output);
      
      expect(result.score).toBeDefined();
      expect(typeof result.score).toBe('number');
    });

    it('should handle non-question inputs', async () => {
      const input = "This is just a statement.";
      const output = "The eight ball responds: 'Ask again later.' Questions guide the cosmic wisdom.";
      
      const metric = eightBallAgent.evals!.answerRelevancy;
      const result = await metric.measure(input, output);
      
      expect(result.score).toBeDefined();
      expect(result.score).toBeGreaterThanOrEqual(0);
    });
  });
});