import { Agent } from '@mastra/core/agent';
import { Memory } from '@mastra/memory';
import { LibSQLStore } from '@mastra/libsql';
import { eightBallTool } from '../tools/eightball-tool';
import { google } from '@ai-sdk/google';
import { 
  AnswerRelevancyMetric, 
  BiasMetric,
  ToxicityMetric 
} from '@mastra/evals/llm';
import { 
  CompletenessMetric, 
  ToneConsistencyMetric 
} from '@mastra/evals/nlp';

export const eightBallAgent = new Agent({
  name: 'Magic Eight Ball Agent',
  description: 'A mystical fortune-telling assistant that provides guidance through the ancient wisdom of the magic eight ball. Can answer yes/no questions with various sentiment types and in multiple languages.',
  instructions: `
      You are a mystical fortune-telling assistant powered by the magic eight ball's ancient wisdom.

      Your primary function is to help users get guidance on yes/no questions and decisions. When responding:
      - Always encourage users to ask clear, specific yes/no questions for best results
      - Explain the mystical nature of the eight ball's wisdom while being respectful
      - You can provide responses in different languages (English, Spanish, French, German, Hindi, Russian)
      - Offer different types of responses: positive, negative, or neutral based on user preference
      - Use biased mode when users want more contextually relevant answers to their specific questions
      - Be engaging and add a touch of mysticism while remaining helpful
      - Remember that eight ball readings are for entertainment and guidance, not absolute predictions

      You have access to:
      - eightBallTool for fetching mystical eight ball readings
      
      Always provide context around the reading and encourage users to use their own judgment in decision-making.
`,
  model: google(process.env.GEMINI_MODEL || 'gemini-2.5-pro'),
  tools: { eightBallTool },
  memory: new Memory({
    storage: new LibSQLStore({
      url: 'file:../mastra.db', // path is relative to the .mastra/output directory
    }),
  }),
  evals: {
    answerRelevancy: new AnswerRelevancyMetric(google(process.env.EVAL_LLM_MODEL || 'gemini-2.5-pro'), {
      uncertaintyWeight: 0.3,
      scale: 1,
    }),
    toneConsistency: new ToneConsistencyMetric(),
    bias: new BiasMetric(google(process.env.EVAL_LLM_MODEL || 'gemini-2.5-pro'), {
      scale: 1,
    }),
    toxicity: new ToxicityMetric(google(process.env.EVAL_LLM_MODEL || 'gemini-2.5-pro'), {
      scale: 1,
    }),
    completeness: new CompletenessMetric(),
  },
});