import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

const QuoteResponse = z.object({
  id: z.string(),
  text: z.string(),
  author: z.object({
    id: z.string(),
    name: z.string(),
  }),
});

export const quotesTool = createTool({
  id: 'Inspirational Quotes',
  description: 'Get inspirational quotes from famous authors and thinkers. Can fetch random quotes, quote of the day, or specific quotes by ID.',
  inputSchema: z.object({
    type: z.enum(['random', 'quote-of-the-day', 'specific']).optional().describe('Type of quote to fetch (default: random)'),
    id: z.string().optional().describe('Specific quote ID to fetch (only used when type is "specific")'),
  }),
  outputSchema: QuoteResponse,
  execute: async ({ context }) => {
    try {
      const { type = 'random', id } = context;
      
      let quoteId = 'random';
      
      if (type === 'quote-of-the-day') {
        quoteId = 'quote-of-the-day';
      } else if (type === 'specific' && id) {
        quoteId = id;
      }
      
      const url = `https://www.quoterism.com/api/quotes/${quoteId}`;
      
      const response = await fetch(url);
      
      if (!response.ok) {
        if (response.status === 404) {
          throw new Error('Quote not found');
        }
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      
      // Validate the response structure
      if (!data.id || !data.text || !data.author?.name) {
        throw new Error('Invalid quote data received from API');
      }
      
      return {
        id: data.id,
        text: data.text,
        author: {
          id: data.author.id || 'unknown',
          name: data.author.name,
        },
      };
    } catch (error) {
      console.error('Error fetching quote:', error);
      throw new Error(`Failed to fetch quote: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  },
});