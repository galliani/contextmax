import { pipeline, env } from '@huggingface/transformers';

// Skip local model check for this browser-based example.
env.allowLocalModels = false;

// Pipeline type for feature extraction
type FeatureExtractionPipeline = any;
type ProgressCallbackFunction = (data: any) => void;

// Use a singleton pattern to ensure the model is only loaded once.
export class LLMService {
  private static instance: FeatureExtractionPipeline | null = null;
  public static status: 'loading' | 'ready' | 'error' = 'loading';
  public static modelName: string = 'Xenova/jina-embeddings-v2-small-en';

  static async getInstance(progress_callback?: ProgressCallbackFunction): Promise<FeatureExtractionPipeline> {
    if (this.instance === null) {
      this.status = 'loading';
      try {
        this.instance = await pipeline('feature-extraction', this.modelName, { 
          progress_callback,
          device: 'webgpu' as any, // Try WebGPU first, fallback to CPU
        });
        this.status = 'ready';
        console.log('LLM Service initialized successfully');
      } catch (error) {
        console.warn('WebGPU failed, falling back to CPU:', error);
        try {
          this.instance = await pipeline('feature-extraction', this.modelName, { 
            progress_callback,
            device: 'cpu',
          });
          this.status = 'ready';
          console.log('LLM Service initialized successfully (CPU fallback)');
        } catch (cpuError) {
          console.error('Failed to initialize LLM Service:', cpuError);
          this.status = 'error';
          throw cpuError;
        }
      }
    }
    return this.instance;
  }
  
  static getStatus() {
    return this.status;
  }
}

export default defineNuxtPlugin(async (_nuxtApp) => {
  try {
    const llm = await LLMService.getInstance();
    
    return {
      provide: {
        llm: {
          engine: llm,
          status: LLMService.getStatus(),
          service: LLMService
        }
      }
    }
  } catch (error) {
    console.error('Failed to initialize LLM plugin:', error);
    return {
      provide: {
        llm: {
          engine: null,
          status: 'error' as const,
          service: LLMService,
          error: error instanceof Error ? error.message : 'Unknown error'
        }
      }
    }
  }
}); 