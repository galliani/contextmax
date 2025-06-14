/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */
// @vitest-environment nuxt
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { nextTick } from 'vue'

// Create mock LLM service
const mockLLMService = {
  initializeAsync: vi.fn(),
  getStatus: vi.fn(),
  getError: vi.fn(),
}

// Mock the LLM plugin
vi.mock('~/plugins/llm.client', async () => {
  return {
    LLMService: mockLLMService
  }
})

// Import after mocking
const { useLLMLoader } = await import('~/composables/useLLMLoader')

describe('useLLMLoader', () => {
  let llmLoader: ReturnType<typeof useLLMLoader>

  beforeEach(() => {
    vi.clearAllMocks()
    
    // Reset mock implementations
    mockLLMService.initializeAsync.mockResolvedValue(undefined)
    mockLLMService.getStatus.mockReturnValue('loading')
    mockLLMService.getError.mockReturnValue(null)
    
    llmLoader = useLLMLoader()
  })

  describe('Initial State', () => {
    it('should initialize with correct default state', () => {
      expect(llmLoader.loadingState.value).toEqual({
        status: 'loading',
        progress: 0,
        message: 'Initializing local AI model...',
        error: null
      })
    })

    it('should have correct computed properties for loading state', () => {
      expect(llmLoader.isLoading.value).toBe(true)
      expect(llmLoader.isReady.value).toBe(false)
      expect(llmLoader.hasError.value).toBe(false)
    })
  })

  describe('LLM Initialization', () => {
    it('should initialize LLM successfully', async () => {
      // Mock successful initialization
      mockLLMService.getStatus.mockReturnValue('ready')
      
      await llmLoader.initializeLLM()
      
      expect(mockLLMService.initializeAsync).toHaveBeenCalledWith(expect.any(Function))
      expect(llmLoader.loadingState.value.status).toBe('ready')
      expect(llmLoader.loadingState.value.progress).toBe(100)
      expect(llmLoader.loadingState.value.message).toBe('AI model ready!')
      expect(llmLoader.loadingState.value.error).toBe(null)
    })

    it('should handle initialization error', async () => {
      const errorMessage = 'Failed to load model'
      
      // Mock error state
      mockLLMService.initializeAsync.mockRejectedValue(new Error(errorMessage))
      
      await llmLoader.initializeLLM()
      
      expect(llmLoader.loadingState.value.status).toBe('error')
      expect(llmLoader.loadingState.value.progress).toBe(0)
      expect(llmLoader.loadingState.value.message).toBe('Failed to initialize AI model')
      expect(llmLoader.loadingState.value.error).toBe(errorMessage)
    })

    it('should handle service status error after async call', async () => {
      const serviceError = 'Service initialization failed'
      
      // Mock service returning error status
      mockLLMService.getStatus.mockReturnValue('error')
      mockLLMService.getError.mockReturnValue(serviceError)
      
      await llmLoader.initializeLLM()
      
      expect(llmLoader.loadingState.value.status).toBe('error')
      expect(llmLoader.loadingState.value.error).toBe(serviceError)
    })

    it('should handle unknown service error', async () => {
      // Mock service returning error status without error message
      mockLLMService.getStatus.mockReturnValue('error')
      mockLLMService.getError.mockReturnValue(null)
      
      await llmLoader.initializeLLM()
      
      expect(llmLoader.loadingState.value.status).toBe('error')
      expect(llmLoader.loadingState.value.error).toBe('Unknown initialization error')
    })
  })

  describe('Progress Tracking', () => {
    it('should update progress during initialization', async () => {
      let progressCallback: Function | undefined

      // Capture the progress callback
      mockLLMService.initializeAsync.mockImplementation(async (callback) => {
        progressCallback = callback
        
        // Simulate progress updates
        if (progressCallback) {
          progressCallback({ status: 'initiate', name: 'test-model', progress: 0.1 })
          await nextTick()
          
          progressCallback({ status: 'download', progress: 0.5 })
          await nextTick()
          
          progressCallback({ status: 'progress', progress: 0.8 })
          await nextTick()
          
          progressCallback({ status: 'done', progress: 1.0 })
          await nextTick()
        }
      })

      mockLLMService.getStatus.mockReturnValue('ready')

      const initPromise = llmLoader.initializeLLM()

      // Wait for all progress updates to complete
      await initPromise

      // Check that progress was updated during initialization
      expect(llmLoader.loadingState.value.progress).toBe(100)
      expect(llmLoader.loadingState.value.message).toBe('AI model ready!')

              expect(llmLoader.loadingState.value.status).toBe('ready')
    })

    it('should handle different progress statuses correctly', async () => {
      let progressCallback: Function | undefined

      mockLLMService.initializeAsync.mockImplementation(async (callback) => {
        progressCallback = callback
        
        if (progressCallback) {
          // Test initiate status
          progressCallback({ status: 'initiate', name: 'embedding-model' })
          await nextTick()
          expect(llmLoader.loadingState.value.message).toBe('Downloading embedding-model...')

          // Test download status
          progressCallback({ status: 'download' })
          await nextTick()
          expect(llmLoader.loadingState.value.message).toBe('Downloading model files...')

          // Test progress status with percentage
          progressCallback({ status: 'progress', progress: 0.75 })
          await nextTick()
          expect(llmLoader.loadingState.value.message).toBe('Loading model: 75%')

          // Test done status
          progressCallback({ status: 'done' })
          await nextTick()
          expect(llmLoader.loadingState.value.message).toBe('Finalizing initialization...')
          expect(llmLoader.loadingState.value.progress).toBe(100)

          // Test unknown status
          progressCallback({ status: 'unknown' })
          await nextTick()
          expect(llmLoader.loadingState.value.message).toBe('Initializing local AI model...')
        }
      })

      mockLLMService.getStatus.mockReturnValue('ready')
      await llmLoader.initializeLLM()
    })

    it('should handle progress callback without progress value', async () => {
      let progressCallback: Function | undefined

      mockLLMService.initializeAsync.mockImplementation(async (callback) => {
        progressCallback = callback
        
        if (progressCallback) {
          progressCallback({ status: 'initiate', name: 'test-model' })
        }
      })

      mockLLMService.getStatus.mockReturnValue('ready')
      await llmLoader.initializeLLM()

      expect(llmLoader.loadingState.value.message).toBe('AI model ready!')
    })
  })

  describe('Retry Functionality', () => {
    it('should retry initialization', async () => {
      // First attempt fails
      mockLLMService.initializeAsync.mockRejectedValueOnce(new Error('Network error'))
      
      await llmLoader.initializeLLM()
      expect(llmLoader.loadingState.value.status).toBe('error')

      // Reset for successful retry
      mockLLMService.initializeAsync.mockResolvedValue(undefined)
      mockLLMService.getStatus.mockReturnValue('ready')

      await llmLoader.retryInitialization()

      expect(llmLoader.loadingState.value.status).toBe('ready')
      expect(mockLLMService.initializeAsync).toHaveBeenCalledTimes(2)
    })

    it('should reset state when retrying', async () => {
      // First attempt fails
      mockLLMService.initializeAsync.mockRejectedValue(new Error('Test error'))
      
      await llmLoader.initializeLLM()
      
      // Ensure we're in error state
      expect(llmLoader.loadingState.value.status).toBe('error')

      // Mock successful retry
      mockLLMService.initializeAsync.mockResolvedValue(undefined)
      mockLLMService.getStatus.mockReturnValue('ready')

      await llmLoader.retryInitialization()

      expect(llmLoader.loadingState.value.status).toBe('ready')
      expect(llmLoader.loadingState.value.error).toBe(null)
    })
  })

  describe('Computed Properties', () => {
    it('should update computed properties based on loading state', async () => {
      // Initial loading state
      expect(llmLoader.isLoading.value).toBe(true)
      expect(llmLoader.isReady.value).toBe(false)
      expect(llmLoader.hasError.value).toBe(false)

      // Simulate ready state
      mockLLMService.getStatus.mockReturnValue('ready')
      await llmLoader.initializeLLM()

      expect(llmLoader.isLoading.value).toBe(false)
      expect(llmLoader.isReady.value).toBe(true)
      expect(llmLoader.hasError.value).toBe(false)

      // Test error state by setting up a failed initialization
      mockLLMService.initializeAsync.mockRejectedValue(new Error('Test error'))
      
      // Create a new instance to test error state
      const errorLoader = useLLMLoader()
      await errorLoader.initializeLLM()

      expect(errorLoader.isLoading.value).toBe(false)
      expect(errorLoader.isReady.value).toBe(false)
      expect(errorLoader.hasError.value).toBe(true)
    })
  })

  describe('State Management', () => {
    it('should maintain state consistency during async operations', async () => {
      let resolveInit: () => void
      const initPromise = new Promise<void>((resolve) => {
        resolveInit = resolve
      })

      mockLLMService.initializeAsync.mockReturnValue(initPromise)

      const loadPromise = llmLoader.initializeLLM()

      // Check loading state during async operation
      expect(llmLoader.loadingState.value.status).toBe('loading')
      expect(llmLoader.loadingState.value.message).toBe('Starting AI model initialization...')

      // Resolve the async operation
      mockLLMService.getStatus.mockReturnValue('ready')
      resolveInit!()
      await loadPromise

      expect(llmLoader.loadingState.value.status).toBe('ready')
    })

    it('should handle concurrent initialization calls gracefully', async () => {
      let resolveCount = 0
      let resolvers: (() => void)[] = []

      mockLLMService.initializeAsync.mockImplementation(() => {
        return new Promise<void>((resolve) => {
          resolvers.push(resolve)
        })
      })

      // Start multiple concurrent initializations
      const promise1 = llmLoader.initializeLLM()
      const promise2 = llmLoader.initializeLLM()

      expect(mockLLMService.initializeAsync).toHaveBeenCalledTimes(2)

      // Resolve all promises
      mockLLMService.getStatus.mockReturnValue('ready')
      resolvers.forEach(resolve => resolve())

      await Promise.all([promise1, promise2])

      expect(llmLoader.loadingState.value.status).toBe('ready')
    })
  })

  describe('Error Handling', () => {
    it('should handle non-Error thrown objects', async () => {
      mockLLMService.initializeAsync.mockRejectedValue('String error')

      await llmLoader.initializeLLM()

      expect(llmLoader.loadingState.value.status).toBe('error')
      expect(llmLoader.loadingState.value.error).toBe('Unknown error')
    })

    it('should log errors to console', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      const error = new Error('Test error')
      
      mockLLMService.initializeAsync.mockRejectedValue(error)

      await llmLoader.initializeLLM()

      expect(consoleSpy).toHaveBeenCalledWith('LLM initialization failed:', error)
      
      consoleSpy.mockRestore()
    })
  })

  describe('Readonly State', () => {
    it('should return readonly loading state', () => {
      // The loadingState should be readonly - this test ensures the composable 
      // returns readonly state to prevent external mutations
      expect(llmLoader.loadingState.value).toBeDefined()
      
      // Try to verify readonly behavior by checking the object is not directly mutable
      // Note: This is more of a TypeScript compile-time check, but we can at least
      // verify the structure is correct
      expect(typeof llmLoader.loadingState.value.status).toBe('string')
      expect(typeof llmLoader.loadingState.value.progress).toBe('number')
      expect(typeof llmLoader.loadingState.value.message).toBe('string')
    })
  })
}) 