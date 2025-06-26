import { pipeline, env, Pipeline } from '@huggingface/transformers';
import { logger } from '~/utils/logger';

// Skip local model check for this browser-based example.
env.allowLocalModels = false;

// Proper pipeline type for feature extraction
type FeatureExtractionPipeline = Pipeline;
type ProgressCallbackFunction = (data: { status: string; name: string; file?: string; progress?: number; loaded?: number; total?: number }) => void;

// OPFS-based model cache manager
class OPFSModelCache {
  private static cacheDir = 'hf-model-cache';
  
  static async init(): Promise<void> {
    try {
      // Request persistent storage first
      if (navigator.storage && navigator.storage.persist) {
        await navigator.storage.persist();
      }
      
      // Create cache directory
      const opfsRoot = await navigator.storage.getDirectory();
      await opfsRoot.getDirectoryHandle(this.cacheDir, { create: true });
      
    } catch (error) {
      logger.error('❌ Failed to initialize OPFS cache:', error);
      throw error;
    }
  }
  
  static async hasCompleteModel(modelName: string): Promise<boolean> {
    try {
      const opfsRoot = await navigator.storage.getDirectory();
      const cacheDir = await opfsRoot.getDirectoryHandle(this.cacheDir);
      const safeModelName = modelName.replace(/[^a-zA-Z0-9.-]/g, '_');
      
      // Check for completion marker
      await cacheDir.getFileHandle(`${safeModelName}.complete`);
      return true;
    } catch {
      return false;
    }
  }
  
  static async markModelComplete(modelName: string): Promise<void> {
    try {
      const opfsRoot = await navigator.storage.getDirectory();
      const cacheDir = await opfsRoot.getDirectoryHandle(this.cacheDir, { create: true });
      const safeModelName = modelName.replace(/[^a-zA-Z0-9.-]/g, '_');
      
      const flagFile = await cacheDir.getFileHandle(`${safeModelName}.complete`, { create: true });
      const writable = await flagFile.createWritable();
      await writable.write(JSON.stringify({
        modelName,
        cachedAt: Date.now(),
        version: '1.0'
      }));
      await writable.close();
    } catch (error) {
      logger.error(`❌ Failed to mark model complete: ${modelName}`, error);
    }
  }
  
  static async clearCache(): Promise<void> {
    try {
      const opfsRoot = await navigator.storage.getDirectory();
      await opfsRoot.removeEntry(this.cacheDir, { recursive: true });
    } catch (error) {
      logger.warn('Failed to clear cache:', error);
    }
  }
}

// Custom fetch wrapper for model file caching
if (typeof window !== 'undefined') {
  const originalFetch = window.fetch;
  let downloadStats = { files: 0, totalSize: 0, cacheHits: 0 };
  
  window.fetch = async (input, init) => {
    const url = input.toString();
    
    
    // Only intercept HuggingFace model files
    if (url.includes('huggingface.co') && (
      url.includes('.onnx') || 
      url.includes('.bin') || 
      url.includes('config.json') || 
      url.includes('tokenizer.json') ||
      url.includes('tokenizer_config.json')
    )) {
      try {
        const opfsRoot = await navigator.storage.getDirectory();
        const cacheDir = await opfsRoot.getDirectoryHandle('hf-model-cache', { create: true });
        
        // Create cache key from URL
        const urlObj = new URL(url);
        const fileName = urlObj.pathname.split('/').pop() || 'unknown';
        const pathHash = btoa(urlObj.pathname).replace(/[^a-zA-Z0-9]/g, '').substring(0, 16);
        const cacheKey = `${pathHash}_${fileName}`;
        
        try {
          // Try to load from cache first
          const cachedFile = await cacheDir.getFileHandle(cacheKey);
          const file = await cachedFile.getFile();
          downloadStats.cacheHits++;
          
          return new Response(file, {
            status: 200,
            headers: {
              'Content-Type': 'application/octet-stream',
              'Content-Length': file.size.toString()
            }
          });
        } catch {
          // Not in cache, download and cache
          const response = await originalFetch(input, init);
          
          if (response.ok) {
            const responseClone = response.clone();
            const arrayBuffer = await responseClone.arrayBuffer();
            const sizeMB = Math.round(arrayBuffer.byteLength / 1024 / 1024 * 100) / 100;
            
            downloadStats.files++;
            downloadStats.totalSize += arrayBuffer.byteLength;
            
            try {
              const fileHandle = await cacheDir.getFileHandle(cacheKey, { create: true });
              const writable = await fileHandle.createWritable();
              await writable.write(arrayBuffer);
              await writable.close();
              
            } catch (cacheError) {
              logger.error(`❌ Failed to cache ${fileName}:`, cacheError);
              if (cacheError.name === 'QuotaExceededError') {
                logger.error('💥 Storage quota exceeded! Consider clearing cache or requesting more storage.');
              }
            }
          }
          
          return response;
        }
      } catch (error) {
        logger.error('❌ Cache interceptor error:', error);
        return originalFetch(input, init);
      }
    }
    
    // Non-model requests go through normally
    return originalFetch(input, init);
  };
  
}

// Model configuration interface
interface ModelConfig {
  name: string;
  modelId: string;
  task: string;
  options?: {
    device?: string;
    dtype?: string;
  };
}

// Default model configurations
const DEFAULT_MODELS: Record<string, ModelConfig> = {
  embeddings: {
    name: 'embeddings',
    modelId: 'jinaai/jina-embeddings-v2-base-code',
    task: 'feature-extraction',
    options: {
      device: 'webgpu',
      dtype: 'fp16'
    }
  }
};

// Multi-model LLM service using singleton pattern
class LLMServiceImpl {
  private static instances: Map<string, Pipeline> = new Map();
  private static statuses: Map<string, 'loading' | 'ready' | 'error'> = new Map();
  private static errors: Map<string, string | null> = new Map();
  private static models: Record<string, ModelConfig> = DEFAULT_MODELS;

  static async getInstance(modelKey: string = 'embeddings', progress_callback?: ProgressCallbackFunction): Promise<Pipeline> {
    const modelConfig = this.models[modelKey];
    if (!modelConfig) {
      throw new Error(`Model '${modelKey}' not found in configuration`);
    }

    if (!this.instances.has(modelKey)) {
      this.statuses.set(modelKey, 'loading');
      try {
        // Initialize OPFS cache system
        await OPFSModelCache.init();
        
        // Check if model is already cached
        const isCached = await OPFSModelCache.hasCompleteModel(modelConfig.modelId);

        // Enhanced progress callback with better cache verification
        let networkDownloadDetected = false;
        const enhancedProgressCallback: ProgressCallbackFunction = (data) => {
          // Only count as "download" if it's actually from network (has file/loaded/total info)
          if (!networkDownloadDetected && 
              data.status === 'progress' && 
              data.file && 
              (data.loaded !== undefined || data.total !== undefined)) {
            networkDownloadDetected = true;
          }
          
          // Add model name to progress data
          progress_callback?.({
            ...data,
            name: `${data.name} (${modelConfig.name})`
          });
        };

        const instance = await pipeline(modelConfig.task as any, modelConfig.modelId, { 
          progress_callback: enhancedProgressCallback,
          ...modelConfig.options
        });
        
        this.instances.set(modelKey, instance);
        
        // Mark model as complete after successful initialization
        if (!isCached) {
          await OPFSModelCache.markModelComplete(modelConfig.modelId);
        }
        
        this.statuses.set(modelKey, 'ready');
        this.errors.set(modelKey, null);
      } catch (error) {
        logger.error(`❌ Failed to initialize ${modelConfig.name} Service:`, error);
        this.statuses.set(modelKey, 'error');
        this.errors.set(modelKey, error instanceof Error ? error.message : 'Unknown error');        
        throw error;
      }
    }
    return this.instances.get(modelKey)!;
  }
  
  static getStatus(modelKey: string = 'embeddings') {
    return this.statuses.get(modelKey) || 'loading';
  }

  static getError(modelKey: string = 'embeddings') {
    return this.errors.get(modelKey) || null;
  }

  static async initializeAsync(modelKey: string = 'embeddings', progress_callback?: ProgressCallbackFunction): Promise<void> {
    try {
      await this.getInstance(modelKey, progress_callback);
    } catch (error) {
      // Error is already handled in getInstance
      logger.error(`Async LLM initialization failed for ${modelKey}:`, error);
    }
  }

  static async initializeAllModels(progress_callback?: ProgressCallbackFunction): Promise<void> {
    const modelKeys = Object.keys(this.models);
    
    // Initialize models sequentially to avoid overwhelming the system
    for (const modelKey of modelKeys) {
      try {
        await this.initializeAsync(modelKey, progress_callback);
      } catch (error) {
        logger.error(`Failed to initialize model ${modelKey}:`, error);
      }
    }
  }

  static getAvailableModels(): string[] {
    return Object.keys(this.models);
  }

  static getModelConfig(modelKey: string): ModelConfig | undefined {
    return this.models[modelKey];
  }

  static addModel(modelKey: string, config: ModelConfig): void {
    this.models[modelKey] = config;
  }

  // Debugging methods
  static async clearModelCache(): Promise<void> {
    await OPFSModelCache.clearCache();
  }
  
  static async checkCacheStatus(modelKey: string = 'embeddings'): Promise<boolean> {
    const modelConfig = this.models[modelKey];
    if (!modelConfig) return false;
    return await OPFSModelCache.hasCompleteModel(modelConfig.modelId);
  }
}

// Export the service for external use
export const LLMService = LLMServiceImpl;

export default defineNuxtPlugin((_nuxtApp) => {
  // Start LLM initialization asynchronously (don't block app startup)
  // Initialize embeddings first, then other models
  LLMService.initializeAllModels();
  
  // Provide a direct embedding function that useSmartContextSuggestions expects (backward compatibility)
  const embeddingFunction = async (text: string, options?: { pooling?: string; normalize?: boolean }) => {
    if (LLMService.getStatus('embeddings') !== 'ready') {
      throw new Error('Embeddings model not ready yet');
    }
    const instance = await LLMService.getInstance('embeddings');
    return await instance(text, options);
  };
  
  // Create enhanced API for multi-model access
  const getModel = async (modelKey: string = 'embeddings') => {
    if (LLMService.getStatus(modelKey) !== 'ready') {
      throw new Error(`Model '${modelKey}' not ready yet`);
    }
    return await LLMService.getInstance(modelKey);
  };
  
  // Create a reactive status getter
  const getStatus = (modelKey?: string) => modelKey ? LLMService.getStatus(modelKey) : LLMService.getStatus();
  
  return {
    provide: {
      llm: {
        // Backward compatibility
        engine: embeddingFunction,
        get status() { return getStatus(); },
        get error() { return LLMService.getError(); },
        
        // New multi-model API
        getModel,
        getStatus,
        getError: (modelKey?: string) => LLMService.getError(modelKey || 'embeddings'),
        service: LLMService,
        availableModels: () => LLMService.getAvailableModels(),
        getModelConfig: (modelKey: string) => LLMService.getModelConfig(modelKey),
        initializeModel: (modelKey: string, progress_callback?: ProgressCallbackFunction) => 
          LLMService.initializeAsync(modelKey, progress_callback),
        initializeAllModels: (progress_callback?: ProgressCallbackFunction) => 
          LLMService.initializeAllModels(progress_callback)
      }
    }
  }
}); 