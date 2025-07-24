import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

const EightBallResponse = z.object({
  reading: z.string(),
  locale: z.string(),
});

export const eightBallTool = createTool({
  id: 'Magic Eight Ball',
  description: 'Ask the magic eight ball a yes/no question and get a mystical answer. Can provide responses in different languages and with specific sentiment categories.',
  inputSchema: z.object({
    question: z.string().optional().describe('Your yes/no question for the magic eight ball'),
    category: z.enum(['positive', 'negative', 'neutral']).optional().describe('Type of response you want (positive, negative, or neutral)'),
    locale: z.enum(['en', 'es', 'fr', 'de', 'hi', 'ru']).optional().describe('Language for the response (default: en)'),
    biased: z.boolean().optional().describe('Whether to use biased mode that considers your question for more relevant responses'),
  }),
  outputSchema: EightBallResponse,
  execute: async ({ context }) => {
    try {
      const { question, category, locale = 'en', biased = false } = context;
      
      let url = 'https://eightballapi.com/api';
      const params = new URLSearchParams();
      
      if (locale !== 'en') {
        params.append('locale', locale);
      }
      
      // Use biased mode if question is provided and biased is true
      if (biased && question) {
        url += '/biased';
        params.append('question', question);
      } else if (category) {
        // Use specific category
        url += `/${category}`;
      }
      // Otherwise use random fortune (default)
      
      const fullUrl = params.toString() ? `${url}?${params.toString()}` : url;
      
      const response = await fetch(fullUrl);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      
      return {
        reading: data.reading,
        locale: data.locale || locale,
      };
    } catch (error) {
      console.error('Error fetching eight ball reading:', error);
      throw new Error(`Failed to get eight ball reading: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  },
});