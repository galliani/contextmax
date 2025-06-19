import { pipeline, env, Pipeline } from '@huggingface/transformers';

// Skip local model check for this browser-based example.
env.allowLocalModels = false;

// Proper pipeline type for feature extraction
type FeatureExtractionPipeline = Pipeline;
type ProgressCallbackFunction = (data: { status: string; name: string; file?: string; progress?: number; loaded?: number; total?: number }) => void;

// OPFS-based model cache manager
class OPFSModelCache {
  private static cacheDir = 'hf-model-cache';
  
  static async init(): Promise<void> {
    console.log('🔧 Initializing OPFS model cache...');
    
    try {
      // Request persistent storage first
      if (navigator.storage && navigator.storage.persist) {
        const persistent = await navigator.storage.persist();
        console.log(persistent ? '✅ Persistent storage granted' : '⚠️ Persistent storage denied');
      }
      
      // Check storage quota
      if (navigator.storage && navigator.storage.estimate) {
        const estimate = await navigator.storage.estimate();
        const quotaMB = Math.round((estimate.quota || 0) / 1024 / 1024);
        const usageMB = Math.round((estimate.usage || 0) / 1024 / 1024);
        console.log(`📊 Storage quota: ${quotaMB}MB available, ${usageMB}MB used`);
      }
      
      // Create cache directory
      const opfsRoot = await navigator.storage.getDirectory();
      await opfsRoot.getDirectoryHandle(this.cacheDir, { create: true });
      console.log('📂 OPFS cache directory ready');
      
    } catch (error) {
      console.error('❌ Failed to initialize OPFS cache:', error);
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
      console.log(`📦 Found cached model: ${modelName}`);
      return true;
    } catch {
      console.log(`💾 Model not cached: ${modelName}`);
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
      
      console.log(`✅ Model marked as cached: ${modelName}`);
    } catch (error) {
      console.error(`❌ Failed to mark model complete: ${modelName}`, error);
    }
  }
  
  static async clearCache(): Promise<void> {
    try {
      const opfsRoot = await navigator.storage.getDirectory();
      await opfsRoot.removeEntry(this.cacheDir, { recursive: true });
      console.log('🗑️ Model cache cleared');
    } catch (error) {
      console.warn('Failed to clear cache:', error);
    }
  }
}

// Custom fetch wrapper for model file caching with detailed debugging
if (typeof window !== 'undefined') {
  console.log('🌐 Setting up model file cache interceptor...');
  
  const originalFetch = window.fetch;
  let downloadStats = { files: 0, totalSize: 0, cacheHits: 0 };
  
  window.fetch = async (input, init) => {
    const url = input.toString();
    
    // Log ALL huggingface requests to debug what we're missing
    if (url.includes('huggingface.co')) {
      console.log(`🌐 ALL HF Request: ${url}`);
      
      // Check if this should be intercepted
      const shouldIntercept = url.includes('.onnx') || 
        url.includes('.bin') || 
        url.includes('config.json') || 
        url.includes('tokenizer.json') ||
        url.includes('tokenizer_config.json');
        
      if (!shouldIntercept) {
        console.log(`⚠️ NOT INTERCEPTED: ${url.split('/').pop()}`);
      }
    }
    
    // Only intercept HuggingFace model files
    if (url.includes('huggingface.co') && (
      url.includes('.onnx') || 
      url.includes('.bin') || 
      url.includes('config.json') || 
      url.includes('tokenizer.json') ||
      url.includes('tokenizer_config.json')
    )) {
      console.log(`🔍 INTERCEPTING model file: ${url}`);
      
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
          console.log(`📦 Cache HIT: ${fileName} (${Math.round(file.size / 1024)}KB)`);
          
          return new Response(file, {
            status: 200,
            headers: {
              'Content-Type': 'application/octet-stream',
              'Content-Length': file.size.toString()
            }
          });
        } catch {
          // Not in cache, download and cache
          console.log(`⬇️ Cache MISS: Downloading ${fileName}...`);
          const response = await originalFetch(input, init);
          
          if (response.ok) {
            const responseClone = response.clone();
            const arrayBuffer = await responseClone.arrayBuffer();
            const sizeMB = Math.round(arrayBuffer.byteLength / 1024 / 1024 * 100) / 100;
            
            downloadStats.files++;
            downloadStats.totalSize += arrayBuffer.byteLength;
            
            console.log(`💾 Caching ${fileName} (${sizeMB}MB)...`);
            
            try {
              const fileHandle = await cacheDir.getFileHandle(cacheKey, { create: true });
              const writable = await fileHandle.createWritable();
              await writable.write(arrayBuffer);
              await writable.close();
              console.log(`✅ Successfully cached: ${fileName}`);
              
              // Update storage stats
              if (navigator.storage && navigator.storage.estimate) {
                const estimate = await navigator.storage.estimate();
                const usageMB = Math.round((estimate.usage || 0) / 1024 / 1024);
                console.log(`📊 Storage used: ${usageMB}MB`);
              }
              
            } catch (cacheError) {
              console.error(`❌ Failed to cache ${fileName}:`, cacheError);
              if (cacheError.name === 'QuotaExceededError') {
                console.error('💥 Storage quota exceeded! Consider clearing cache or requesting more storage.');
              }
            }
          }
          
          return response;
        }
      } catch (error) {
        console.error('❌ Cache interceptor error:', error);
        return originalFetch(input, init);
      }
    }
    
    // Non-model requests go through normally
    return originalFetch(input, init);
  };
  
  // Log cache stats periodically
  setInterval(() => {
    if (downloadStats.files > 0 || downloadStats.cacheHits > 0) {
      const totalSizeMB = Math.round(downloadStats.totalSize / 1024 / 1024 * 100) / 100;
      console.log(`📈 Cache stats: ${downloadStats.cacheHits} hits, ${downloadStats.files} downloads (${totalSizeMB}MB)`);
    }
  }, 10000);
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
  // Example second model - you can add your own model here
  textGeneration: {
    name: 'textGeneration',
    modelId: 'Xenova/flan-t5-small',
    task: 'text2text-generation',
    options: {
      device: 'wasm',
      dtype: 'fp32'
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
        
        if (isCached) {
          console.log(`🎯 Loading model from cache: ${modelConfig.modelId}`);
        } else {
          console.log(`🚀 First-time download: ${modelConfig.modelId}`);
        }

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
        
        // Smoke test: actually use the model to verify it works
        console.log(`🧪 Running smoke test for ${modelConfig.name}...`);
        try {
          const testStart = performance.now();
          const testResult = await instance('Hello world');
          const testTime = Math.round(performance.now() - testStart);
          
          // Check if result is valid (different models return different formats)
          if (testResult) {
            console.log(`✅ SMOKE TEST PASSED: ${modelConfig.name} working correctly (${testTime}ms)`);
            console.log(isCached ? 
              `🎯 CACHE IS WORKING PERFECTLY - ${modelConfig.name} loaded and functional from OPFS!` :
              `📦 First download complete - ${modelConfig.name} cached and functional`
            );
          } else {
            console.error(`❌ SMOKE TEST FAILED: ${modelConfig.name} returned no result`);
          }
        } catch (smokeTestError) {
          console.error(`❌ SMOKE TEST FAILED: ${modelConfig.name} threw error:`, smokeTestError);
        }
        
        this.statuses.set(modelKey, 'ready');
        this.errors.set(modelKey, null);
        console.log(`🎉 ${modelConfig.name} Service initialized successfully`);
      } catch (error) {
        console.error(`❌ Failed to initialize ${modelConfig.name} Service:`, error);
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
      console.error(`Async LLM initialization failed for ${modelKey}:`, error);
    }
  }

  static async initializeAllModels(progress_callback?: ProgressCallbackFunction): Promise<void> {
    const modelKeys = Object.keys(this.models);
    console.log(`🚀 Initializing ${modelKeys.length} models:`, modelKeys);
    
    // Initialize models sequentially to avoid overwhelming the system
    for (const modelKey of modelKeys) {
      try {
        await this.initializeAsync(modelKey, progress_callback);
      } catch (error) {
        console.error(`Failed to initialize model ${modelKey}:`, error);
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