/**
 * ProxyLanguageModel - Custom LanguageModel with Intelligent Key Rotation
 * 
 * This implements the AI SDK LanguageModel interface while using our proxy manager
 * for rate limiting, key rotation, and quota management.
 */

import { 
  type LanguageModel, 
  type CoreMessage, 
  type GenerateTextResult, 
  type LanguageModelV1,
  type LanguageModelV1CallOptions,
  type LanguageModelV1FinishReason,
  type LanguageModelV1StreamPart
} from 'ai';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { ProxyManager, isRateLimitError } from './proxy-manager.js';

export class ProxyLanguageModel implements LanguageModel, LanguageModelV1 {
  readonly provider: string = 'google';
  readonly modelId: string = 'gemini-2.5-pro';
  readonly specificationVersion: 'v1' = 'v1';
  readonly defaultObjectGenerationMode: 'json' = 'json';
  private proxyManager: ProxyManager;
  
  // Enhanced configuration for long queue waits
  private config = {
    maxAttempts: 5,
    baseRetryDelay: 2000, // Start with 2 seconds
    maxRetryDelay: 30000, // Max 30 seconds between retries
    queueTimeout: 120000, // 2 minutes total timeout for queue operations
    exponentialBackoff: true
  };

  constructor(options?: {
    maxAttempts?: number;
    baseRetryDelay?: number;
    maxRetryDelay?: number;
    queueTimeout?: number;
    exponentialBackoff?: boolean;
  }) {
    this.proxyManager = new ProxyManager('./proxies.json');
    
    // Override defaults with provided options
    if (options) {
      this.config = { ...this.config, ...options };
    }
  }

  async generateText(input: {
    messages: CoreMessage[];
    maxTokens?: number;
    temperature?: number;
    abortSignal?: AbortSignal;
    [key: string]: any;
  }): Promise<GenerateTextResult> {
    return this.executeWithTimeout(async (abortSignal) => {
      await this.proxyManager.initialize();

      // Convert messages to a single prompt
      const prompt = input.messages
        .map(msg => `${msg.role}: ${msg.content}`)
        .join('\n');

      let attempt = 0;

      while (attempt < this.config.maxAttempts) {
        // Check for abort signal
        if (abortSignal?.aborted) {
          throw new Error('Operation was aborted');
        }

        try {
          // Get next available API key
          const { key: apiKey } = await this.proxyManager.getNextKey('gemini');
          
          console.log(`🔑 Using API key: ${apiKey.id} (attempt ${attempt + 1}/${this.config.maxAttempts})`);

          // Initialize Google GenAI with the selected key
          const genAI = new GoogleGenerativeAI(apiKey.key);
          const model = genAI.getGenerativeModel({ model: this.modelId });

          // Make the API call with abort signal check
          const result = await this.makeAPICall(model, prompt, abortSignal);
          const text = result.response.text();

          // Record successful usage
          await this.proxyManager.recordUsage('gemini', apiKey.id, 800, true);

          console.log(`✅ API call successful with key: ${apiKey.id}`);

          return {
            text,
            usage: {
              promptTokens: 100, // Estimated
              completionTokens: 700, // Estimated  
              totalTokens: 800
            },
            finishReason: 'stop'
          };

        } catch (error) {
          attempt++;
          console.error(`❌ API call failed (attempt ${attempt}):`, error.message);

          if (isRateLimitError(error)) {
            console.log(`🚨 Rate limit detected, using exponential backoff...`);
            
            if (attempt < this.config.maxAttempts) {
              const delay = this.calculateRetryDelay(attempt);
              console.log(`⏳ Waiting ${delay}ms before retry ${attempt + 1}...`);
              
              await this.delayWithAbort(delay, abortSignal);
              continue;
            }
          }

          // If not a rate limit error or max attempts reached, throw
          if (attempt >= this.config.maxAttempts) {
            throw new Error(`API call failed after ${attempt} attempts: ${error.message}`);
          }
        }
      }

      throw new Error(`Failed to complete API call after ${this.config.maxAttempts} attempts`);
    }, input.abortSignal);
  }

  // Helper methods for enhanced queue handling
  private calculateRetryDelay(attempt: number): number {
    if (!this.config.exponentialBackoff) {
      return this.config.baseRetryDelay;
    }

    // Exponential backoff: baseDelay * 2^attempt with max limit
    const delay = this.config.baseRetryDelay * Math.pow(2, attempt - 1);
    return Math.min(delay, this.config.maxRetryDelay);
  }

  private async delayWithAbort(ms: number, abortSignal?: AbortSignal): Promise<void> {
    return new Promise((resolve, reject) => {
      if (abortSignal?.aborted) {
        reject(new Error('Operation was aborted'));
        return;
      }

      const timeoutId = setTimeout(resolve, ms);
      
      if (abortSignal) {
        const abortHandler = () => {
          clearTimeout(timeoutId);
          reject(new Error('Operation was aborted'));
        };
        
        abortSignal.addEventListener('abort', abortHandler, { once: true });
      }
    });
  }

  private async executeWithTimeout<T>(
    operation: (abortSignal?: AbortSignal) => Promise<T>,
    externalAbortSignal?: AbortSignal
  ): Promise<T> {
    const controller = new AbortController();
    
    // Create a combined abort signal
    const combinedSignal = this.combineAbortSignals(controller.signal, externalAbortSignal);
    
    // Set up timeout
    const timeoutId = setTimeout(() => {
      controller.abort();
    }, this.config.queueTimeout);

    try {
      const result = await operation(combinedSignal);
      clearTimeout(timeoutId);
      return result;
    } catch (error) {
      clearTimeout(timeoutId);
      if (combinedSignal?.aborted) {
        throw new Error(`Operation timed out after ${this.config.queueTimeout}ms or was aborted`);
      }
      throw error;
    }
  }

  private combineAbortSignals(...signals: (AbortSignal | undefined)[]): AbortSignal | undefined {
    const validSignals = signals.filter(Boolean) as AbortSignal[];
    
    if (validSignals.length === 0) return undefined;
    if (validSignals.length === 1) return validSignals[0];

    const controller = new AbortController();
    
    validSignals.forEach(signal => {
      if (signal.aborted) {
        controller.abort();
      } else {
        signal.addEventListener('abort', () => controller.abort(), { once: true });
      }
    });

    return controller.signal;
  }

  private async makeAPICall(model: any, prompt: string, abortSignal?: AbortSignal): Promise<any> {
    return new Promise(async (resolve, reject) => {
      if (abortSignal?.aborted) {
        reject(new Error('Operation was aborted'));
        return;
      }

      try {
        const result = await model.generateContent(prompt);
        
        if (abortSignal?.aborted) {
          reject(new Error('Operation was aborted'));
          return;
        }
        
        resolve(result);
      } catch (error) {
        reject(error);
      }
    });
  }

  // LanguageModelV1 required methods  
  async doGenerate(options: LanguageModelV1CallOptions & { abortSignal?: AbortSignal }): Promise<{
    text?: string;
    toolCalls?: any[];
    finishReason: LanguageModelV1FinishReason;
    usage: { promptTokens: number; completionTokens: number; totalTokens: number };
    rawCall: { rawPrompt: any; rawSettings: any };
    rawResponse?: any;
    warnings?: any[];
    logprobs?: any;
  }> {
    return this.executeWithTimeout(async (abortSignal) => {
      await this.proxyManager.initialize();

      // Convert options to our format
      const messages = options.prompt.map((msg: any) => ({
        role: msg.role,
        content: msg.content
      }));

      let attempt = 0;

      while (attempt < this.config.maxAttempts) {
        // Check for abort signal
        if (abortSignal?.aborted) {
          throw new Error('Operation was aborted');
        }

        try {
          const { key: apiKey } = await this.proxyManager.getNextKey('gemini');
          
          console.log(`🔑 Using API key: ${apiKey.id} (attempt ${attempt + 1}/${this.config.maxAttempts})`);

          const genAI = new GoogleGenerativeAI(apiKey.key);
          
          // Configure model for JSON output when needed
        const modelConfig: any = { model: this.modelId };
        
        // Check if this is a structured output request
        const isStructuredRequest = options.mode?.type === 'object' || 
                                   JSON.stringify(options).includes('json') ||
                                   JSON.stringify(options).includes('JSON') ||
                                   messages.some((msg: any) => 
                                     msg.content?.includes('JSON') || 
                                     msg.content?.includes('json') ||
                                     msg.content?.includes('{') ||
                                     msg.content?.includes('format')
                                   );
        
        if (isStructuredRequest) {
          modelConfig.generationConfig = {
            response_mime_type: "application/json"
          };
        }

        const model = genAI.getGenerativeModel(modelConfig);

        let prompt = messages
          .map((msg: any) => `${msg.role}: ${msg.content}`)
          .join('\n');

        // Add JSON instruction if this appears to be a structured request
        if (isStructuredRequest && !prompt.includes('JSON')) {
          prompt += '\n\nPlease respond with valid JSON format.';
        }

          // Make the API call with abort signal check
          const result = await this.makeAPICall(model, prompt, abortSignal);
          const text = result.response.text();

          await this.proxyManager.recordUsage('gemini', apiKey.id, 800, true);

          console.log(`✅ doGenerate API call successful with key: ${apiKey.id}`);

          return {
            text,
            finishReason: 'stop' as LanguageModelV1FinishReason,
            usage: {
              promptTokens: 100,
              completionTokens: 700,
              totalTokens: 800
            },
            rawCall: {
              rawPrompt: prompt,
              rawSettings: options
            },
            rawResponse: result
          };

        } catch (error) {
          attempt++;
          console.error(`❌ doGenerate API call failed (attempt ${attempt}):`, error.message);

          if (isRateLimitError(error)) {
            console.log(`🚨 Rate limit detected in doGenerate, using exponential backoff...`);
            
            if (attempt < this.config.maxAttempts) {
              const delay = this.calculateRetryDelay(attempt);
              console.log(`⏳ Waiting ${delay}ms before retry ${attempt + 1}...`);
              
              await this.delayWithAbort(delay, abortSignal);
              continue;
            }
          }

          // If not a rate limit error or max attempts reached, throw
          if (attempt >= this.config.maxAttempts) {
            throw new Error(`doGenerate API call failed after ${attempt} attempts: ${error.message}`);
          }
        }
      }

      throw new Error(`Failed to complete doGenerate API call after ${this.config.maxAttempts} attempts`);
    }, options.abortSignal);
  }

  async doStream(options: LanguageModelV1CallOptions): Promise<{
    stream: ReadableStream<LanguageModelV1StreamPart>;
    rawCall: { rawPrompt: any; rawSettings: any };
    rawResponse?: any;
    warnings?: any[];
  }> {
    throw new Error('doStream not implemented in ProxyLanguageModel - use doGenerate instead');
  }

  // Other LanguageModel required methods (stub implementations for now)
  streamText(input: any): any {
    throw new Error('streamText not implemented in ProxyLanguageModel');
  }

  generateObject(input: any): any {
    throw new Error('generateObject not implemented in ProxyLanguageModel');
  }

  streamObject(input: any): any {
    throw new Error('streamObject not implemented in ProxyLanguageModel');
  }
}