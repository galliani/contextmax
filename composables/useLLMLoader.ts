import { LLMService } from '~/plugins/llm.client'

interface LLMLoadingState {
  status: 'loading' | 'ready' | 'error';
  progress: number;
  message: string;
  error: string | null;
}

export const useLLMLoader = () => {
  const loadingState = ref<LLMLoadingState>({
    status: 'loading',
    progress: 0,
    message: 'Initializing local AI model...',
    error: null
  })

  const isLoading = computed(() => loadingState.value.status === 'loading')
  const isReady = computed(() => loadingState.value.status === 'ready')
  const hasError = computed(() => loadingState.value.status === 'error')

  const initializeLLM = async () => {
    try {
      loadingState.value = {
        status: 'loading',
        progress: 0,
        message: 'Starting AI model initialization...',
        error: null
      }

      // Initialize with progress callback
      await LLMService.initializeAsync((data) => {
        // Update progress based on the callback data
        if (data.progress !== undefined) {
          loadingState.value.progress = Math.round(data.progress * 100)
        }
        
        // Update message based on status
        switch (data.status) {
          case 'initiate':
            loadingState.value.message = `Downloading ${data.name}...`
            break
          case 'download':
            loadingState.value.message = `Downloading model files...`
            break
          case 'progress':
            loadingState.value.message = `Loading model: ${loadingState.value.progress}%`
            break
          case 'done':
            loadingState.value.message = 'Finalizing initialization...'
            loadingState.value.progress = 100
            break
          default:
            loadingState.value.message = 'Initializing local AI model...'
        }
      })

      // Check final status
      const finalStatus = LLMService.getStatus()
      if (finalStatus === 'ready') {
        loadingState.value = {
          status: 'ready',
          progress: 100,
          message: 'AI model ready!',
          error: null
        }
      } else if (finalStatus === 'error') {
        throw new Error(LLMService.getError() || 'Unknown initialization error')
      }
      
    } catch (error) {
      console.error('LLM initialization failed:', error)
      loadingState.value = {
        status: 'error',
        progress: 0,
        message: 'Failed to initialize AI model',
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  const retryInitialization = async () => {
    // Reset service state if needed
    await initializeLLM()
  }

  return {
    loadingState: readonly(loadingState),
    isLoading,
    isReady,
    hasError,
    initializeLLM,
    retryInitialization
  }
} 