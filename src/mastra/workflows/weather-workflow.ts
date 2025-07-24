import { createStep, createWorkflow } from '@mastra/core/workflows';
import { z } from 'zod';
import { weatherAgent } from '../agents/weather-agent';
import { quotesAgent } from '../agents/quotes-agent';

const weatherInfoStep = createStep(weatherAgent);

const motivationalQuoteStep = createStep(quotesAgent);

const tripMotivationWorkflow = createWorkflow({
  id: 'trip-motivation-workflow',
  description: 'Get weather information for a destination and receive motivational quotes for your trip',
  inputSchema: z.object({
    destination: z.string().describe('The destination city for your trip'),
  }),
  outputSchema: z.object({
    weatherInfo: z.string().describe('Weather information and activity suggestions'),
    motivationalQuote: z.string().describe('Inspirational quote for your trip'),
  }),
})
  .map(({ inputData }) => {
    // Transform workflow input to match weather agent's expected input
    const { destination } = inputData;
    return {
      prompt: `What's the weather like in ${destination}? Also suggest some activities based on the weather conditions.`
    };
  })
  .then(weatherInfoStep)
  .map(({ inputData, getStepResult }) => {
    // Get weather result and transform it for quotes agent
    const weatherResult = getStepResult(weatherInfoStep);
    return {
      prompt: `I'm planning a trip to ${inputData.destination}. Here's the weather information: ${weatherResult}. Please give me an inspirational quote to motivate me for this trip and help me embrace whatever weather conditions I might encounter.`
    };
  })
  .then(motivationalQuoteStep)
  .map(({ getStepResult }) => {
    // Combine both results for final output
    const weatherInfo = getStepResult(weatherInfoStep);
    const motivationalQuote = getStepResult(motivationalQuoteStep);
    
    return {
      weatherInfo,
      motivationalQuote
    };
  });

tripMotivationWorkflow.commit();

export { tripMotivationWorkflow };
