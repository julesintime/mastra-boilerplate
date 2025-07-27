
import { Mastra } from '@mastra/core/mastra';
import { PinoLogger } from '@mastra/loggers';
import { LibSQLStore } from '@mastra/libsql';
import { tripMotivationWorkflow } from './workflows/weather-workflow';
import { contentProductionWorkflowShort } from './workflows/content-production-workflow';
import { weatherAgent } from './agents/weather-agent';
import { eightBallAgent } from './agents/eightball-agent';
import { quotesAgent } from './agents/quotes-agent';
import { researchCoordinatorAgent, webResearchAgent } from './agents/research-coordinator-agent';
import { dataAnalysisAgent } from './agents/data-analysis-agent';
import { contentWriterAgent } from './agents/content-writer-agent';
import { autonomousNetwork } from './networks/autonomous-network';
import { contentProductionNetwork } from './networks/content-production-network';
import { 
  createWeatherAgentServer, 
  createAutonomousNetworkServer, 
  createTripMotivationWorkflowServer,
  createContentGenerationServer,
  createContentProductionWorkflowServer,
  createContentProductionNetworkServer
} from './mcps';

export const mastra = new Mastra({
  workflows: { 
    tripMotivationWorkflow,
    contentProductionWorkflowShort,
  },
  agents: { 
    weatherAgent,
    eightBallAgent,
    quotesAgent,
    researchCoordinatorAgent,
    webResearchAgent,
    dataAnalysisAgent,
    contentWriterAgent,
  },
  vnext_networks: {
    autonomousNetwork,
    contentProductionNetwork,
  },
  mcpServers: {
    weatherAgent: createWeatherAgentServer(weatherAgent),
    autonomousNetwork: createAutonomousNetworkServer(autonomousNetwork),
    tripMotivationWorkflow: createTripMotivationWorkflowServer(tripMotivationWorkflow),
    contentGeneration: createContentGenerationServer(
      researchCoordinatorAgent,
      webResearchAgent,
      dataAnalysisAgent,
      contentWriterAgent
    ),
    contentProductionWorkflow: createContentProductionWorkflowServer(contentProductionWorkflowShort),
    contentProductionNetwork: createContentProductionNetworkServer(contentProductionNetwork),
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
