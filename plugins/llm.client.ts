import { pipeline, env, Pipeline } from '@huggingface/transformers';

// Skip local model check for this browser-based example.
env.allowLocalModels = false;

// Proper pipeline type for feature extraction
type FeatureExtractionPipeline = Pipeline;
type ProgressCallbackFunction = (data: { status: string; name: string; file?: string; progress?: number; loaded?: number; total?: number }) => void;

// Use a singleton pattern to ensure the model is only loaded once.
class LLMServiceImpl {
  private static instance: FeatureExtractionPipeline | null = null;
  public static status: 'loading' | 'ready' | 'error' = 'loading';
  public static modelName: string = 'Xenova/jina-embeddings-v2-small-en';
  public static error: string | null = null;

  static async getInstance(progress_callback?: ProgressCallbackFunction): Promise<FeatureExtractionPipeline> {
    if (this.instance === null) {
      this.status = 'loading';
      try {
        this.instance = await pipeline('feature-extraction', this.modelName, { 
          progress_callback,
          device: 'webgpu',
        });
        this.status = 'ready';
        this.error = null;
        console.log('LLM Service initialized successfully');
      } catch (error) {
        console.warn('WebGPU failed, falling back to CPU:', error);
        try {
          this.instance = await pipeline('feature-extraction', this.modelName, { 
            progress_callback,
            device: 'cpu',
          });
          this.status = 'ready';
          this.error = null;
          console.log('LLM Service initialized successfully (CPU fallback)');
        } catch (cpuError) {
          console.error('Failed to initialize LLM Service:', cpuError);
          this.status = 'error';
          this.error = cpuError instanceof Error ? cpuError.message : 'Unknown error';
          throw cpuError;
        }
      }
    }
    return this.instance;
  }
  
  static getStatus() {
    return this.status;
  }

  static getError() {
    return this.error;
  }

  static async initializeAsync(progress_callback?: ProgressCallbackFunction): Promise<void> {
    try {
      await this.getInstance(progress_callback);
    } catch (error) {
      // Error is already handled in getInstance
      console.error('Async LLM initialization failed:', error);
    }
  }
}

// Export the service for external use
export const LLMService = LLMServiceImpl;

export default defineNuxtPlugin((_nuxtApp) => {
  // Don't block on initialization - return immediately with loading state
  return {
    provide: {
      llm: {
        engine: null,
        status: LLMService.getStatus(),
        service: LLMService,
        error: null
      }
    }
  }
}); 