
import { Mastra } from '@mastra/core/mastra';
import { PinoLogger } from '@mastra/loggers';
import { LibSQLStore } from '@mastra/libsql';
import { tripMotivationWorkflow } from './workflows/weather-workflow';
import { weatherAgent } from './agents/weather-agent';
import { eightBallAgent } from './agents/eightball-agent';
import { quotesAgent } from './agents/quotes-agent';
import { autonomousNetwork } from './networks/autonomous-network';
import { createWeatherAgentServer, createAutonomousNetworkServer, createTripMotivationWorkflowServer } from './mcps';

export const mastra = new Mastra({
  workflows: { tripMotivationWorkflow },
  agents: { 
    weatherAgent,
    eightBallAgent,
    quotesAgent,
  },
  vnext_networks: {
    autonomousNetwork,
  },
  mcpServers: {
    weatherAgent: createWeatherAgentServer(weatherAgent),
    autonomousNetwork: createAutonomousNetworkServer(autonomousNetwork),
    tripMotivationWorkflow: createTripMotivationWorkflowServer(tripMotivationWorkflow),
  },
  storage: new LibSQLStore({
    // stores telemetry, evals, and agent performance data with persistence
    url: "file:../evaluations.db", // Separate database for evaluation data persistence
  }),
  logger: new PinoLogger({
    name: 'Mastra',
    level: 'debug', // Enable debug level for comprehensive logging
  }),
  telemetry: {
    serviceName: 'mastra-agent-framework',
    enabled: true,
    sampling: {
      type: 'always_on', // Sample all traces for development
    },
    export: {
      type: 'console', // Console output for development, change to 'otlp' for production
    },
  },
});
