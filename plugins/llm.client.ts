import { pipeline, env, Pipeline } from '@huggingface/transformers';
import { logger } from '~/utils/logger';

// Skip local model check for this browser-based example.
env.allowLocalModels = false;

// Configure for production deployment
if (typeof window !== 'undefined') {
  // Enable browser cache for better performance
  env.useBrowserCache = true;
  // Remove useCustomCache since we handle caching ourselves with OPFS
  
  // Only use proxy in actual production (not local dev with /curator)
  const isProduction = window.location.hostname !== 'localhost' && 
                      window.location.hostname !== '127.0.0.1' && 
                      !window.location.hostname.includes('.local');
  
  // Configure remote URL to use our proxy when deployed on /curator in production
  if (window.location.pathname.startsWith('/curator') && isProduction) {
    // Use our Cloudflare Worker proxy for Hugging Face models
    env.remoteURL = window.location.origin + '/curator/_hf/';
    env.remotePathTemplate = '{model}/resolve/{revision}/'
  }
  
  // Set custom fetch function to handle CORS and add better error handling
  env.customFetch = async (url: string, options?: RequestInit) => {
    try {
      // If it's a Hugging Face URL and we're on /curator in production, rewrite to use our proxy
      if (url.includes('huggingface.co') && window.location.pathname.startsWith('/curator') && isProduction) {
        const hfPath = url.replace('https://huggingface.co/', '');
        url = window.location.origin + '/curator/_hf/' + hfPath;
        logger.log(`Rewriting HF URL to proxy: ${url}`);
      }
      
      // Add cors mode and credentials
      const fetchOptions: RequestInit = {
        ...options,
        mode: 'cors',
        credentials: 'omit',
      };
      
      const response = await fetch(url, fetchOptions);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status} for URL: ${url}`);
      }
      
      // Check if we're getting HTML instead of expected content
      const contentType = response.headers.get('content-type');
      if (url.includes('.json') && contentType?.includes('text/html')) {
        const text = await response.clone().text();
        logger.error(`Expected JSON but got HTML for ${url}:`, text.substring(0, 200));
        throw new Error(`Invalid response: Expected JSON but received HTML from ${url}`);
      }
      
      return response;
    } catch (error) {
      logger.error(`Failed to fetch model file from ${url}:`, error);
      throw error;
    }
  };
}

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
  
  // Check if we're in production
  const isProduction = window.location.hostname !== 'localhost' && 
                      window.location.hostname !== '127.0.0.1' && 
                      !window.location.hostname.includes('.local');
  
  window.fetch = async (input, init) => {
    let url = input.toString();
    
    // Rewrite Hugging Face URLs to use our proxy when on /curator in production
    if (url.includes('huggingface.co') && window.location.pathname.startsWith('/curator') && isProduction) {
      const hfPath = url.replace('https://huggingface.co/', '');
      url = window.location.origin + '/curator/_hf/' + hfPath;
      input = url;
    }
    
    // Only intercept HuggingFace model files (both original and proxied URLs)
    if ((url.includes('huggingface.co') || url.includes('/_hf/')) && (
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
          // Use CORS-friendly fetch options
          const fetchOptions = {
            ...init,
            mode: 'cors' as RequestMode,
            credentials: 'omit' as RequestCredentials,
          };
          
          const response = await originalFetch(input, fetchOptions);
          
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
          } else {
            logger.error(`❌ Failed to fetch ${fileName}: ${response.status} ${response.statusText}`);
          }
          
          return response;
        }
      } catch (error) {
        logger.error('❌ Cache interceptor error:', error);
        // Try with CORS settings as fallback
        const corsOptions = {
          ...init,
          mode: 'cors' as RequestMode,
          credentials: 'omit' as RequestCredentials,
        };
        return originalFetch(input, corsOptions);
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
  },
  textGeneration: {
    name: 'textGeneration',
    modelId: 'Xenova/flan-t5-small',
    task: 'text2text-generation',
    options: {
      device: 'wasm',
      dtype: 'fp32',
      // Force specific model type to avoid misidentification
      model_type: 't5'
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

        // Add debug logging for production
        logger.log(`Initializing model ${modelKey}: ${modelConfig.modelId} with task: ${modelConfig.task}`);
        
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
        
        // Provide more helpful error messages
        let errorMessage = 'Unknown error';
        if (error instanceof Error) {
          if (error.message.includes('Failed to fetch')) {
            errorMessage = 'Unable to download AI models. This may be due to network restrictions or CORS policy. The app will work without AI-powered suggestions.';
          } else if (error.message.includes('Unsupported model type: bert')) {
            // This error happens when Flan-T5's config is misidentified
            errorMessage = `Model ${modelConfig.modelId} configuration error. The model might be incorrectly loaded in production.`;
            logger.error('Model config might be corrupted or proxy is returning wrong content');
          } else {
            errorMessage = error.message;
          }
        }
        
        this.errors.set(modelKey, errorMessage);
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
        
        // Special handling for Flan-T5 in production
        if (modelKey === 'textGeneration' && error instanceof Error && 
            error.message.includes('Unsupported model type: bert')) {
          logger.warn('Flan-T5 model misidentified as BERT in production. This is a known issue.');
          logger.warn('The app will continue without text generation features.');
          // Don't re-throw the error for this specific case
          continue;
        }
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
  LLMService.initializeAllModels()
  
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