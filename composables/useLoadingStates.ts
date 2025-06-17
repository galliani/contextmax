/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */
import { ref, computed, reactive } from 'vue'
import { useNotifications } from './useNotifications'

export interface LoadingState {
  id: string
  label: string
  type: 'loading' | 'skeleton' | 'progress' | 'optimistic'
  progress?: number
  startTime: number
  timeout?: number
  onTimeout?: () => void
}

export interface OptimisticUpdate<T> {
  id: string
  data: T
  rollback: () => void
  confirm: () => void
}

interface LoadingManagerState {
  loadingStates: Map<string, LoadingState>
  optimisticUpdates: Map<string, OptimisticUpdate<any>>
  globalLoading: boolean
  simpleStates: Record<string, boolean> // For simple boolean states expected by tests
}

const state = reactive<LoadingManagerState>({
  loadingStates: new Map(),
  optimisticUpdates: new Map(),
  globalLoading: false,
  simpleStates: {}
})

let loadingId = 0

export function useLoadingStates() {
  const { error } = useNotifications()

  // Simple loading state management (for tests)
  const loadingStates = ref(state.simpleStates)
  
  const isLoading = (key: string): boolean => {
    return !!state.simpleStates[key]
  }

  const setLoading = (key: string, loading: boolean) => {
    state.simpleStates[key] = loading
  }

  const startLoading = (key: string) => {
    setLoading(key, true)
  }

  const stopLoading = (key: string) => {
    setLoading(key, false)
  }

  const toggleLoading = (key: string) => {
    setLoading(key, !isLoading(key))
  }

  const clearAll = () => {
    Object.keys(state.simpleStates).forEach(key => {
      delete state.simpleStates[key]
    })
    state.loadingStates.clear()
    state.optimisticUpdates.clear()
    state.globalLoading = false
  }

  const setMultiple = (states: Record<string, boolean>) => {
    Object.entries(states).forEach(([key, value]) => {
      setLoading(key, value)
    })
  }

  const getAllStates = () => {
    return { ...state.simpleStates }
  }

  const getActiveStates = () => {
    return Object.entries(state.simpleStates)
      .filter(([_, loading]) => loading)
      .map(([key, _]) => key)
  }

  const isAnyLoading = computed(() => {
    return Object.values(state.simpleStates).some(loading => loading) || state.loadingStates.size > 0
  })

  // Async operation wrapper
  const withLoading = async <T>(key: string, promise: Promise<T>): Promise<T> => {
    setLoading(key, true)
    try {
      const result = await promise
      setLoading(key, false)
      return result
    } catch (error) {
      setLoading(key, false)
      throw error
    }
  }

  // Advanced loading state management (existing API)
  const isLoadingAdvanced = computed(() => state.loadingStates.size > 0)
  const isGlobalLoading = computed(() => state.globalLoading)
  const loadingCount = computed(() => state.loadingStates.size)
  
  const startLoadingAdvanced = (
    label: string,
    options: {
      type?: LoadingState['type']
      timeout?: number
      onTimeout?: () => void
      global?: boolean
    } = {}
  ): string => {
    const id = `loading-${++loadingId}`
    const startTime = Date.now()
    
    const loadingState: LoadingState = {
      id,
      label,
      type: options.type || 'loading',
      startTime,
      timeout: options.timeout,
      onTimeout: options.onTimeout
    }

    state.loadingStates.set(id, loadingState)
    
    if (options.global) {
      state.globalLoading = true
    }

    // Set timeout if specified
    if (options.timeout) {
      setTimeout(() => {
        const current = state.loadingStates.get(id)
        if (current) {
          stopLoadingAdvanced(id)
          options.onTimeout?.()
          error('Operation Timed Out', `${label} took too long to complete`)
        }
      }, options.timeout)
    }

    return id
  }

  const stopLoadingAdvanced = (id: string) => {
    const loadingState = state.loadingStates.get(id)
    if (loadingState) {
      state.loadingStates.delete(id)
      
      // Check if this was a global loading state
      if (state.globalLoading && state.loadingStates.size === 0) {
        state.globalLoading = false
      }
    }
  }

  const updateProgress = (id: string, progress: number) => {
    const loadingState = state.loadingStates.get(id)
    if (loadingState) {
      loadingState.progress = Math.max(0, Math.min(100, progress))
    }
  }

  const getLoadingState = (id: string) => {
    return state.loadingStates.get(id)
  }

  const getAllLoadingStates = () => {
    return Array.from(state.loadingStates.values())
  }

  // Optimistic Updates
  const startOptimisticUpdate = <T>(
    id: string,
    data: T,
    rollbackFn: () => void
  ): OptimisticUpdate<T> => {
    const optimisticUpdate: OptimisticUpdate<T> = {
      id,
      data,
      rollback: () => {
        rollbackFn()
        state.optimisticUpdates.delete(id)
      },
      confirm: () => {
        state.optimisticUpdates.delete(id)
      }
    }

    state.optimisticUpdates.set(id, optimisticUpdate)
    return optimisticUpdate
  }

  const confirmOptimisticUpdate = (id: string) => {
    const update = state.optimisticUpdates.get(id)
    if (update) {
      update.confirm()
    }
  }

  const rollbackOptimisticUpdate = (id: string) => {
    const update = state.optimisticUpdates.get(id)
    if (update) {
      update.rollback()
    }
  }

  // Advanced loading patterns
  const withLoadingAdvanced = async <T>(
    fn: () => Promise<T>,
    label: string,
    options: Parameters<typeof startLoadingAdvanced>[1] = {}
  ): Promise<T> => {
    const id = startLoadingAdvanced(label, options)
    try {
      const result = await fn()
      stopLoadingAdvanced(id)
      return result
    } catch (error) {
      stopLoadingAdvanced(id)
      throw error
    }
  }

  const withOptimisticUpdate = async <T, R>(
    optimisticData: T,
    applyOptimistic: (data: T) => void,
    rollbackOptimistic: () => void,
    actualOperation: () => Promise<R>,
    label: string
  ): Promise<R> => {
    // Apply optimistic update immediately
    applyOptimistic(optimisticData)
    const optimisticId = `optimistic-${++loadingId}`
    
    const update = startOptimisticUpdate(
      optimisticId,
      optimisticData,
      rollbackOptimistic
    )

    try {
      // Start loading indicator for actual operation
      const loadingId = startLoadingAdvanced(label, { type: 'optimistic' })
      
      const result = await actualOperation()
      
      // Confirm optimistic update
      confirmOptimisticUpdate(optimisticId)
      stopLoadingAdvanced(loadingId)
      
      return result
    } catch (error) {
      // Rollback optimistic update on error
      rollbackOptimisticUpdate(optimisticId)
      throw error
    }
  }

  const withProgress = async <T>(
    fn: (updateProgress: (progress: number) => void) => Promise<T>,
    label: string,
    options: Parameters<typeof startLoadingAdvanced>[1] = {}
  ): Promise<T> => {
    const id = startLoadingAdvanced(label, { ...options, type: 'progress' })
    
    const updateProgressFn = (progress: number) => {
      updateProgress(id, progress)
    }

    try {
      const result = await fn(updateProgressFn)
      stopLoadingAdvanced(id)
      return result
    } catch (error) {
      stopLoadingAdvanced(id)
      throw error
    }
  }

  // Skeleton loading for components
  const createSkeletonLoader = (count: number = 1) => {
    const id = startLoadingAdvanced('Loading content...', { type: 'skeleton' })
    
    return {
      id,
      count,
      stop: () => stopLoadingAdvanced(id)
    }
  }

  // Progressive loading for lists/collections
  const createProgressiveLoader = (label: string) => {
    const items = ref<any[]>([])
    const hasMore = ref(true)
    const loadingMore = ref(false)
    
    const loadMore = async (loadFn: () => Promise<any[]>) => {
      if (loadingMore.value || !hasMore.value) return
      
      loadingMore.value = true
      try {
        const newItems = await loadFn()
        items.value.push(...newItems)
        hasMore.value = newItems.length > 0
      } catch (error) {
        throw error
      } finally {
        loadingMore.value = false
      }
    }

    const reset = () => {
      items.value = []
      hasMore.value = true
      loadingMore.value = false
    }

    return {
      items: readonly(items),
      hasMore: readonly(hasMore),
      loadingMore: readonly(loadingMore),
      loadMore,
      reset
    }
  }

  // Batch operations with progress
  const withBatchProgress = async <T, R>(
    items: T[],
    operation: (item: T, index: number) => Promise<R>,
    label: string,
    options: {
      concurrency?: number
      onItemComplete?: (result: R, item: T, index: number) => void
      onItemError?: (error: any, item: T, index: number) => void
    } = {}
  ): Promise<R[]> => {
    const results: R[] = []
    const concurrency = options.concurrency || 3
    let completed = 0
    
    const id = startLoadingAdvanced(label, { type: 'progress' })
    updateProgress(id, 0)

    const processItem = async (item: T, index: number): Promise<void> => {
      try {
        const result = await operation(item, index)
        results[index] = result
        options.onItemComplete?.(result, item, index)
      } catch (error) {
        options.onItemError?.(error, item, index)
        throw error
      } finally {
        completed++
        updateProgress(id, (completed / items.length) * 100)
      }
    }

    try {
      // Process items in batches
      const batches: Promise<void>[][] = []
      for (let i = 0; i < items.length; i += concurrency) {
        const batch = items
          .slice(i, i + concurrency)
          .map((item, batchIndex) => processItem(item, i + batchIndex))
        batches.push(batch)
      }

      // Execute batches sequentially, items within batches concurrently
      for (const batch of batches) {
        await Promise.all(batch)
      }

      stopLoadingAdvanced(id)
      return results
    } catch (error) {
      stopLoadingAdvanced(id)
      throw error
    }
  }

  // Project-specific loading states (migrated from useProjectStore)
  const createProjectLoadingManager = () => {
    return {
      // File loading
      startFileLoading: () => startLoading('isLoadingFiles'),
      stopFileLoading: () => stopLoading('isLoadingFiles'),
      isFileLoading: () => isLoading('isLoadingFiles'),

      // OPFS operations with progress
      startOPFSCopy: (projectName: string) => {
        setLoading('isOPFSCopying', true)
        state.simpleStates['opfsCopyingProjectName'] = projectName
        return startLoadingAdvanced(`Copying ${projectName} to OPFS`, { type: 'progress' })
      },
      
      updateOPFSProgress: (id: string, progress: number) => {
        updateProgress(id, progress)
        state.simpleStates['opfsCopyProgress'] = progress
      },
      
      stopOPFSCopy: (id: string) => {
        stopLoading('isOPFSCopying')
        delete state.simpleStates['opfsCopyingProjectName']
        delete state.simpleStates['opfsCopyProgress']
        stopLoadingAdvanced(id)
      },

      isOPFSCopying: () => isLoading('isOPFSCopying'),
      getOPFSProgress: () => state.simpleStates['opfsCopyProgress'] || 0,
      getOPFSCopyingProject: () => state.simpleStates['opfsCopyingProjectName'] || null,

      // Project operations
      withProjectOperation: async <T>(
        operation: () => Promise<T>, 
        operationName: string,
        showProgress = false
      ): Promise<T> => {
        if (showProgress) {
          return withProgress(
            async (updateProgressFn) => {
              // For operations that don't naturally have progress, simulate it
              updateProgressFn(25)
              const result = await operation()
              updateProgressFn(100)
              return result
            },
            operationName
          )
        } else {
          return withLoadingAdvanced(operation, operationName)
        }
      }
    }
  }

  return {
    // Simple API (for tests)
    loadingStates,
    isLoading,
    setLoading,
    startLoading,
    stopLoading,
    toggleLoading,
    clearAll,
    setMultiple,
    getAllStates,
    getActiveStates,
    isAnyLoading,
    withLoading,
    
    // Advanced API (existing)
    isLoadingAdvanced,
    isGlobalLoading,
    loadingCount,
    startLoadingAdvanced,
    stopLoadingAdvanced,
    updateProgress,
    getLoadingState,
    getAllLoadingStates,
    startOptimisticUpdate,
    confirmOptimisticUpdate,
    rollbackOptimisticUpdate,
    withLoadingAdvanced,
    withOptimisticUpdate,
    withProgress,
    createSkeletonLoader,
    createProgressiveLoader,
    withBatchProgress,
    optimisticUpdates: readonly(ref(state.optimisticUpdates)),

    // Project-specific loading manager
    createProjectLoadingManager
  }
} 