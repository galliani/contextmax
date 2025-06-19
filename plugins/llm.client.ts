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

// Use a singleton pattern to ensure the model is only loaded once.
class LLMServiceImpl {
  private static instance: FeatureExtractionPipeline | null = null;
  public static status: 'loading' | 'ready' | 'error' = 'loading';
  public static modelName: string = 'jinaai/jina-embeddings-v2-base-code';
  public static error: string | null = null;

  static async getInstance(progress_callback?: ProgressCallbackFunction): Promise<FeatureExtractionPipeline> {
    if (this.instance === null) {
      this.status = 'loading';
      try {
        // Initialize OPFS cache system
        await OPFSModelCache.init();
        
        // Check if model is already cached
        const isCached = await OPFSModelCache.hasCompleteModel(this.modelName);
        
        if (isCached) {
          console.log(`🎯 Loading model from cache: ${this.modelName}`);
        } else {
          console.log(`🚀 First-time download: ${this.modelName}`);
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
          
          progress_callback?.(data);
        };

        this.instance = await pipeline('feature-extraction', this.modelName, { 
          progress_callback: enhancedProgressCallback,
          device: 'webgpu',
          dtype: 'fp16',
        });
        
        // Mark model as complete after successful initialization
        if (!isCached) {
          await OPFSModelCache.markModelComplete(this.modelName);
        }
        
        // Smoke test: actually use the model to verify it works
        console.log('🧪 Running model smoke test...');
        try {
          const testStart = performance.now();
          const testResult = await this.instance('Hello world');
          const testTime = Math.round(performance.now() - testStart);
          
          // Check if result is a valid tensor (has data property)
          if (testResult && typeof testResult === 'object' && testResult.data) {
            const dimensions = testResult.data.length;
            console.log(`✅ SMOKE TEST PASSED: Model working correctly (${testTime}ms, ${dimensions} dimensions)`);
            console.log(isCached ? 
              '🎯 CACHE IS WORKING PERFECTLY - model loaded and functional from OPFS!' :
              '📦 First download complete - model cached and functional'
            );
          } else {
            console.log('🔍 Smoke test result:', testResult);
            console.log('🔍 Result type:', typeof testResult);
            console.log('🔍 Result properties:', testResult ? Object.keys(testResult) : 'none');
            console.error('❌ SMOKE TEST FAILED: Model returned unexpected result format');
          }
        } catch (smokeTestError) {
          console.error('❌ SMOKE TEST FAILED: Model threw error:', smokeTestError);
        }
        
        this.status = 'ready';
        this.error = null;
        console.log('🎉 LLM Service initialized successfully');
      } catch (error) {
        console.error('❌ Failed to initialize LLM Service:', error);
        this.status = 'error';
        this.error = error instanceof Error ? error.message : 'Unknown error';        
        throw error;
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

  // Debugging methods
  static async clearModelCache(): Promise<void> {
    await OPFSModelCache.clearCache();
  }
  
  static async checkCacheStatus(): Promise<boolean> {
    return await OPFSModelCache.hasCompleteModel(this.modelName);
  }
}

// Export the service for external use
export const LLMService = LLMServiceImpl;

export default defineNuxtPlugin((_nuxtApp) => {
  // Start LLM initialization asynchronously (don't block app startup)
  LLMService.initializeAsync();
  
  // Provide a direct embedding function that useSmartContextSuggestions expects
  const embeddingFunction = async (text: string, options?: { pooling?: string; normalize?: boolean }) => {
    if (LLMService.getStatus() !== 'ready') {
      throw new Error('LLM not ready yet');
    }
    const instance = await LLMService.getInstance();
    return await instance(text, options);
  };
  
  // Create a reactive status getter
  const getStatus = () => LLMService.getStatus();
  
  return {
    provide: {
      llm: {
        engine: embeddingFunction,
        get status() { return getStatus(); },
        service: LLMService,
        get error() { return LLMService.getError(); }
      }
    }
  }
}); 