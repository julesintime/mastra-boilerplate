import { vi } from 'vitest';

// Set up environment variables for testing
process.env.GROQ_API_KEY = 'test-groq-key';
process.env.GOOGLE_GENERATIVE_AI_API_KEY = 'test-google-key';
process.env.OPENAI_API_KEY = 'test-openai-key';
process.env.ANTHROPIC_API_KEY = 'test-anthropic-key';

// Mock API responses for evaluation metrics
vi.mock('@ai-sdk/groq', () => ({
  groq: vi.fn(() => ({
    textGenerationModel: vi.fn(),
    provider: 'groq',
    modelId: 'llama-3.3-70b-versatile',
  })),
}));

vi.mock('@ai-sdk/google', () => ({
  google: vi.fn(() => ({
    textGenerationModel: vi.fn(),
    provider: 'google',
    modelId: 'gemini-2.5-flash',
  })),
}));

// Mock successful evaluation responses
const mockEvaluationResponse = {
  score: 0.8,
  info: {
    reason: 'Mock evaluation response for testing purposes'
  }
};

// Mock the evaluation metrics to return predictable results
vi.mock('@mastra/evals/llm', async () => {
  const actual = await vi.importActual('@mastra/evals/llm');
  
  return {
    ...actual,
    AnswerRelevancyMetric: vi.fn().mockImplementation(() => ({
      measure: vi.fn().mockResolvedValue(mockEvaluationResponse),
    })),
    FaithfulnessMetric: vi.fn().mockImplementation(() => ({
      measure: vi.fn().mockResolvedValue(mockEvaluationResponse),
    })),
    HallucinationMetric: vi.fn().mockImplementation(() => ({
      measure: vi.fn().mockResolvedValue({ ...mockEvaluationResponse, score: 0.2 }),
    })),
    BiasMetric: vi.fn().mockImplementation(() => ({
      measure: vi.fn().mockResolvedValue({ ...mockEvaluationResponse, score: 0.1 }),
    })),
    ToxicityMetric: vi.fn().mockImplementation(() => ({
      measure: vi.fn().mockResolvedValue({ ...mockEvaluationResponse, score: 0.1 }),
    })),
    SummarizationMetric: vi.fn().mockImplementation(() => ({
      measure: vi.fn().mockResolvedValue({
        score: 0.7,
        info: {
          reason: 'Mock summarization evaluation',
          alignmentScore: 0.8,
          coverageScore: 0.7,
        }
      }),
    })),
    ContextRelevancyMetric: vi.fn().mockImplementation(() => ({
      measure: vi.fn().mockResolvedValue(mockEvaluationResponse),
    })),
  };
});

// Keep NLP metrics real for accurate testing
export const mockLLMEvaluations = {
  answerRelevancy: mockEvaluationResponse,
  faithfulness: mockEvaluationResponse,
  hallucination: { ...mockEvaluationResponse, score: 0.2 },
  bias: { ...mockEvaluationResponse, score: 0.1 },
  toxicity: { ...mockEvaluationResponse, score: 0.1 },
};