import { Agent } from '@mastra/core/agent';
import { groq } from '@ai-sdk/groq';
import { Memory } from '@mastra/memory';
import { LibSQLStore } from '@mastra/libsql';
import { weatherTool } from '../tools/weather-tool';
import { weatherVectorQueryTool, weatherGraphQueryTool } from '../../../libs/rag/conditional-tools';
import { 
  AnswerRelevancyMetric, 
  FaithfulnessMetric, 
  HallucinationMetric 
} from '@mastra/evals/llm';
import { 
  CompletenessMetric, 
  ContentSimilarityMetric,
  ToneConsistencyMetric 
} from '@mastra/evals/nlp';

export const weatherAgent = new Agent({
  name: 'Weather Agent',
  description: 'A helpful weather assistant that provides accurate weather information and activity planning based on weather conditions. Can fetch real-time weather data and suggest location-appropriate activities.',
  instructions: `
      You are a helpful weather assistant that provides accurate weather information and can help planning activities based on the weather.

      Your primary function is to help users get weather details for specific locations. When responding:
      - Always ask for a location if none is provided
      - If the location name isn't in English, please translate it
      - If giving a location with multiple parts (e.g. "New York, NY"), use the most relevant part (e.g. "New York")
      - Include relevant details like humidity, wind conditions, and precipitation
      - Keep responses concise but informative
      - If the user asks for activities and provides the weather forecast, suggest activities based on the weather forecast.
      - If the user asks for activities, respond in the format they request.

      You have access to:
      - weatherTool for fetching current weather data from Open-Meteo API
      - weatherVectorQueryTool for searching through weather and activity knowledge base to provide comprehensive recommendations
`,
  model: groq(process.env.GROQ_MODEL || 'llama-3.3-70b-versatile'),
  tools: { weatherTool, weatherVectorQueryTool, weatherGraphQueryTool },
  memory: new Memory({
    storage: new LibSQLStore({
      url: 'file:../mastra.db', // path is relative to the .mastra/output directory
    }),
  }),
  evals: {
    answerRelevancy: new AnswerRelevancyMetric(groq('llama-3.3-70b-versatile'), {
      uncertaintyWeight: 0.3,
      scale: 1,
    }),
    faithfulness: new FaithfulnessMetric(groq('llama-3.3-70b-versatile'), {
      scale: 1,
      context: [], // Will be populated dynamically during evaluation
    }),
    toneConsistency: new ToneConsistencyMetric(),
    hallucination: new HallucinationMetric(groq('llama-3.3-70b-versatile'), {
      scale: 1,
      context: [], // Will be populated dynamically during evaluation
    }),
    contentSimilarity: new ContentSimilarityMetric({
      ignoreCase: true,
      ignoreWhitespace: true,
    }),
    completeness: new CompletenessMetric(),
  },
});
