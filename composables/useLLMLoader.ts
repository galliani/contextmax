import { LLMService } from '~/plugins/llm.client'

interface LLMLoadingState {
  status: 'loading' | 'ready' | 'error';
  progress: number;
  message: string;
  error: string | null;
}

interface ModelLoadingState extends LLMLoadingState {
  modelKey: string;
}

export const useLLMLoader = () => {
  // Global loading state (for backward compatibility)
  const loadingState = ref<LLMLoadingState>({
    status: 'loading',
    progress: 0,
    message: 'Initializing local AI model...',
    error: null
  })

  // Individual model loading states
  const modelStates = ref<Record<string, ModelLoadingState>>({})

  const isLoading = computed(() => loadingState.value.status === 'loading')
  const isReady = computed(() => loadingState.value.status === 'ready')
  const hasError = computed(() => loadingState.value.status === 'error')

  // Multi-model computed properties
  const getModelState = (modelKey: string) => {
    return computed(() => modelStates.value[modelKey] || {
      status: 'loading',
      progress: 0,
      message: 'Not initialized',
      error: null,
      modelKey
    })
  }

  const isModelLoading = (modelKey: string) => computed(() => 
    getModelState(modelKey).value.status === 'loading'
  )
  
  const isModelReady = (modelKey: string) => computed(() => 
    getModelState(modelKey).value.status === 'ready'
  )
  
  const hasModelError = (modelKey: string) => computed(() => 
    getModelState(modelKey).value.status === 'error'
  )

  const areAllModelsReady = computed(() => {
    // Include forceUpdate to make this reactive to service status changes
    forceUpdate.value
    
    const availableModels = LLMService.getAvailableModels()
    if (availableModels.length === 0) return false
    
    // Just check the service status - it's the source of truth
    return availableModels.every(modelKey => {
      return LLMService.getStatus(modelKey) === 'ready'
    })
  })

  const getOverallProgress = computed(() => {
    const availableModels = LLMService.getAvailableModels()
    if (availableModels.length === 0) return 0
    
    const totalProgress = availableModels.reduce((sum, modelKey) => 
      sum + getModelState(modelKey).value.progress, 0
    )
    return Math.round(totalProgress / availableModels.length)
  })

  const initializeLLM = async (modelKey: string = 'embeddings') => {
    try {
      // Initialize model state if not exists
      if (!modelStates.value[modelKey]) {
        modelStates.value[modelKey] = {
          status: 'loading',
          progress: 0,
          message: 'Starting AI model initialization...',
          error: null,
          modelKey
        }
      }

      modelStates.value[modelKey].status = 'loading'
      modelStates.value[modelKey].error = null

      // Initialize with progress callback
      await LLMService.initializeAsync(modelKey, (data) => {
        // Update progress based on the callback data
        if (data.progress !== undefined) {
          modelStates.value[modelKey].progress = Math.round(data.progress * 100)
        }
        
        // Update message based on status
        switch (data.status) {
          case 'initiate':
            modelStates.value[modelKey].message = `Downloading ${data.name}...`
            break
          case 'download':
            modelStates.value[modelKey].message = `Downloading model files...`
            break
          case 'progress':
            modelStates.value[modelKey].message = `Loading model: ${modelStates.value[modelKey].progress}%`
            break
          case 'done':
            modelStates.value[modelKey].message = 'Finalizing initialization...'
            modelStates.value[modelKey].progress = 100
            break
          default:
            modelStates.value[modelKey].message = 'Initializing local AI model...'
        }
      })

      // Check final status
      const finalStatus = LLMService.getStatus(modelKey)
      if (finalStatus === 'ready') {
        modelStates.value[modelKey] = {
          status: 'ready',
          progress: 100,
          message: 'AI model ready!',
          error: null,
          modelKey
        }
      } else if (finalStatus === 'error') {
        throw new Error(LLMService.getError(modelKey) || 'Unknown initialization error')
      }
      
    } catch (error) {
      console.error(`LLM initialization failed for ${modelKey}:`, error)
      modelStates.value[modelKey] = {
        status: 'error',
        progress: 0,
        message: 'Failed to initialize AI model',
        error: error instanceof Error ? error.message : 'Unknown error',
        modelKey
      }
    }

    // Update global state for backward compatibility (use embeddings model as default)
    if (modelKey === 'embeddings') {
      loadingState.value = { ...modelStates.value[modelKey] }
    }
  }

  const initializeAllModels = async () => {
    try {
      const availableModels = LLMService.getAvailableModels()
      console.log(`Initializing ${availableModels.length} models:`, availableModels)

      // Initialize all models concurrently
      const initPromises = availableModels.map(modelKey => initializeLLM(modelKey))
      await Promise.allSettled(initPromises)

      // Update global state based on embeddings model (for backward compatibility)
      if (modelStates.value['embeddings']) {
        loadingState.value = { ...modelStates.value['embeddings'] }
      }
    } catch (error) {
      console.error('Failed to initialize all models:', error)
    }
  }

  const retryInitialization = async (modelKey?: string) => {
    if (modelKey) {
      await initializeLLM(modelKey)
    } else {
      // Retry embeddings model for backward compatibility
      await initializeLLM('embeddings')
    }
  }

  const getModel = async (modelKey: string = 'embeddings') => {
    const { $llm } = useNuxtApp()
    return await $llm.getModel(modelKey)
  }

  const getAvailableModels = () => {
    return LLMService.getAvailableModels()
  }

  const getModelConfig = (modelKey: string) => {
    return LLMService.getModelConfig(modelKey)
  }

  // Force reactive trigger when service status changes
  const forceUpdate = ref(0)
  
  // Sync model states with service status on mount and periodically
  onMounted(() => {
    const syncStates = () => {
      const availableModels = LLMService.getAvailableModels()
      let hasChanges = false
      
      availableModels.forEach(modelKey => {
        const serviceStatus = LLMService.getStatus(modelKey)
        const currentState = modelStates.value[modelKey]
        
        if (serviceStatus === 'ready' && (!currentState || currentState.status !== 'ready')) {
          // Model is ready but not in our state - sync it
          modelStates.value[modelKey] = {
            status: 'ready',
            progress: 100,
            message: 'AI model ready!',
            error: null,
            modelKey
          }
          hasChanges = true
        }
      })
      
      if (hasChanges) {
        // Force reactive update
        forceUpdate.value++
        console.log('🔄 Synced model states with service status')
      }
    }
    
    // Initial sync
    syncStates()
    
    // Check every 500ms for status changes until all models are ready
    // This polling is only for cached models being initialized, not downloading
    const startTime = Date.now()
    const maxPollingTime = 5 * 60 * 1000 // 5 minutes
    
    const interval = setInterval(() => {
      const elapsed = Date.now() - startTime
      
      // Stop polling after 5 minutes to avoid infinite polling
      if (elapsed > maxPollingTime) {
        clearInterval(interval)
        console.warn('⏰ Stopped model status polling after 5 minutes timeout')
        return
      }
      
      const allReady = LLMService.getAvailableModels().every(key => 
        LLMService.getStatus(key) === 'ready'
      )
      
      if (allReady) {
        syncStates()
        clearInterval(interval)
        console.log('✅ All models ready, stopped status polling')
      } else {
        syncStates()
        
        // Log progress for debugging (only show occasionally)
        if (elapsed % 10000 < 500) { // Every 10 seconds
          const statuses = LLMService.getAvailableModels().map(key => 
            `${key}: ${LLMService.getStatus(key)}`
          )
          console.log(`⏳ Polling model status (${Math.round(elapsed/1000)}s): ${statuses.join(', ')}`)
        }
      }
    }, 500)
  })

  return {
    // Backward compatibility
    loadingState: readonly(loadingState),
    isLoading,
    isReady,
    hasError,
    initializeLLM,
    retryInitialization,

    // Multi-model API
    modelStates: readonly(modelStates),
    getModelState,
    isModelLoading,
    isModelReady,
    hasModelError,
    areAllModelsReady,
    getOverallProgress,
    initializeAllModels,
    getModel,
    getAvailableModels,
    getModelConfig
  }
} 