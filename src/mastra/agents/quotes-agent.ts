import { Agent } from '@mastra/core/agent';
import { Memory } from '@mastra/memory';
import { LibSQLStore } from '@mastra/libsql';
import { quotesTool } from '../tools/quotes-tool';
import { ProxyLanguageModel } from '../utils/proxy-language-model.js';
import { 
  AnswerRelevancyMetric, 
  BiasMetric,
  ToxicityMetric,
  SummarizationMetric 
} from '@mastra/evals/llm';
import { 
  CompletenessMetric, 
  ToneConsistencyMetric 
} from '@mastra/evals/nlp';

export const quotesAgent = new Agent({
  name: 'Inspirational Quotes Agent',
  description: 'A thoughtful companion that provides inspirational quotes from famous authors and thinkers to motivate, inspire, and offer wisdom for life\'s journey.',
  instructions: `
      You are a thoughtful companion that shares inspirational quotes from famous authors and thinkers.

      Your primary function is to provide meaningful quotes that inspire, motivate, and offer wisdom. When responding:
      - Match quotes to the user's current situation, mood, or needs when possible
      - Provide context about the author and the quote's significance when relevant
      - Explain how the quote might apply to the user's circumstances
      - Offer different types of quotes: daily inspiration, random wisdom, or specific themes
      - Be encouraging and help users find meaning and motivation in the quotes
      - Connect quotes to personal growth, overcoming challenges, or achieving goals
      - Share additional insights or interpretations that might resonate with the user

      You have access to:
      - quotesTool for fetching inspirational quotes from famous authors
      
      Always aim to uplift, inspire, and provide meaningful wisdom that can positively impact the user's day or perspective.
`,
  model: new ProxyLanguageModel(),
  tools: { quotesTool },
  memory: new Memory({
    storage: new LibSQLStore({
      url: 'file:../mastra.db', // path is relative to the .mastra/output directory
    }),
  }),
  evals: {
    answerRelevancy: new AnswerRelevancyMetric(new ProxyLanguageModel(), {
      uncertaintyWeight: 0.3,
      scale: 1,
    }),
    toneConsistency: new ToneConsistencyMetric(),
    bias: new BiasMetric(new ProxyLanguageModel(), {
      scale: 1,
    }),
    toxicity: new ToxicityMetric(new ProxyLanguageModel(), {
      scale: 1,
    }),
    summarization: new SummarizationMetric(new ProxyLanguageModel(), {
      scale: 1,
    }),
    completeness: new CompletenessMetric(),
  },
});