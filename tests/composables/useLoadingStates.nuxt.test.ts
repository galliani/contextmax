/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */
// @vitest-environment nuxt
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { watch, nextTick } from 'vue'
import { useLoadingStates } from '~/composables/useLoadingStates'

describe('useLoadingStates', () => {
  let loadingStates: ReturnType<typeof useLoadingStates>

  beforeEach(() => {
    vi.clearAllMocks()
    loadingStates = useLoadingStates()
    loadingStates.clearAll() // Clear any existing states
  })

  describe('Basic Loading State Management', () => {
    it('should initialize with no loading states', () => {
      expect(loadingStates.isLoading('test')).toBe(false)
      expect(loadingStates.isAnyLoading.value).toBe(false)
      expect(loadingStates.loadingStates.value).toEqual({})
    })

    it('should set loading state to true', () => {
      loadingStates.setLoading('test', true)
      
      expect(loadingStates.isLoading('test')).toBe(true)
      expect(loadingStates.isAnyLoading.value).toBe(true)
      expect(loadingStates.loadingStates.value.test).toBe(true)
    })

    it('should set loading state to false', () => {
      loadingStates.setLoading('test', true)
      loadingStates.setLoading('test', false)
      
      expect(loadingStates.isLoading('test')).toBe(false)
      expect(loadingStates.isAnyLoading.value).toBe(false)
      expect(loadingStates.loadingStates.value.test).toBe(false)
    })

    it('should handle multiple loading states', () => {
      loadingStates.setLoading('test1', true)
      loadingStates.setLoading('test2', true)
      
      expect(loadingStates.isLoading('test1')).toBe(true)
      expect(loadingStates.isLoading('test2')).toBe(true)
      expect(loadingStates.isAnyLoading.value).toBe(true)
    })
  })

  describe('Convenience Methods', () => {
    it('should start loading', () => {
      loadingStates.startLoading('operation')
      
      expect(loadingStates.isLoading('operation')).toBe(true)
      expect(loadingStates.isAnyLoading.value).toBe(true)
    })

    it('should stop loading', () => {
      loadingStates.startLoading('operation')
      loadingStates.stopLoading('operation')
      
      expect(loadingStates.isLoading('operation')).toBe(false)
      expect(loadingStates.isAnyLoading.value).toBe(false)
    })

    it('should toggle loading state', () => {
      expect(loadingStates.isLoading('toggle')).toBe(false)
      
      loadingStates.toggleLoading('toggle')
      expect(loadingStates.isLoading('toggle')).toBe(true)
      
      loadingStates.toggleLoading('toggle')
      expect(loadingStates.isLoading('toggle')).toBe(false)
    })
  })

  describe('isAnyLoading Computed', () => {
    it('should return false when no states are loading', () => {
      expect(loadingStates.isAnyLoading.value).toBe(false)
    })

    it('should return true when at least one state is loading', () => {
      loadingStates.setLoading('test1', false)
      loadingStates.setLoading('test2', false)
      loadingStates.setLoading('test3', true)
      
      expect(loadingStates.isAnyLoading.value).toBe(true)
    })

    it('should return false when all states are stopped', () => {
      loadingStates.setLoading('test1', true)
      loadingStates.setLoading('test2', true)
      
      expect(loadingStates.isAnyLoading.value).toBe(true)
      
      loadingStates.setLoading('test1', false)
      loadingStates.setLoading('test2', false)
      
      expect(loadingStates.isAnyLoading.value).toBe(false)
    })
  })

  describe('Async Operations', () => {
    it('should wrap async operation with loading state', async () => {
      const asyncOperation = vi.fn().mockResolvedValue('result')
      
      expect(loadingStates.isLoading('async')).toBe(false)
      
      const promise = loadingStates.withLoading('async', asyncOperation())
      
      // Should be loading during async operation
      expect(loadingStates.isLoading('async')).toBe(true)
      
      const result = await promise
      
      // Should not be loading after completion
      expect(loadingStates.isLoading('async')).toBe(false)
      expect(result).toBe('result')
      expect(asyncOperation).toHaveBeenCalledOnce()
    })

    it('should handle async operation errors correctly', async () => {
      const asyncOperation = vi.fn().mockRejectedValue(new Error('Test error'))
      
      expect(loadingStates.isLoading('async-error')).toBe(false)
      
      try {
        await loadingStates.withLoading('async-error', asyncOperation())
      } catch (error) {
        expect(error.message).toBe('Test error')
      }
      
      // Should not be loading after error
      expect(loadingStates.isLoading('async-error')).toBe(false)
    })

    it('should handle multiple concurrent async operations', async () => {
      const operation1 = new Promise(resolve => setTimeout(() => resolve('result1'), 100))
      const operation2 = new Promise(resolve => setTimeout(() => resolve('result2'), 50))
      
      const promise1 = loadingStates.withLoading('op1', operation1)
      const promise2 = loadingStates.withLoading('op2', operation2)
      
      // Both should be loading
      expect(loadingStates.isLoading('op1')).toBe(true)
      expect(loadingStates.isLoading('op2')).toBe(true)
      expect(loadingStates.isAnyLoading.value).toBe(true)
      
      const result2 = await promise2
      expect(result2).toBe('result2')
      expect(loadingStates.isLoading('op2')).toBe(false)
      expect(loadingStates.isLoading('op1')).toBe(true) // Still loading
      
      const result1 = await promise1
      expect(result1).toBe('result1')
      expect(loadingStates.isLoading('op1')).toBe(false)
      expect(loadingStates.isAnyLoading.value).toBe(false)
    })
  })

  describe('Batch Operations', () => {
    it('should clear all loading states', () => {
      loadingStates.setLoading('test1', true)
      loadingStates.setLoading('test2', true)
      loadingStates.setLoading('test3', true)
      
      expect(loadingStates.isAnyLoading.value).toBe(true)
      
      loadingStates.clearAll()
      
      expect(loadingStates.isLoading('test1')).toBe(false)
      expect(loadingStates.isLoading('test2')).toBe(false)
      expect(loadingStates.isLoading('test3')).toBe(false)
      expect(loadingStates.isAnyLoading.value).toBe(false)
      expect(loadingStates.loadingStates.value).toEqual({})
    })

    it('should set multiple loading states at once', () => {
      loadingStates.setMultiple({
        operation1: true,
        operation2: true,
        operation3: false
      })
      
      expect(loadingStates.isLoading('operation1')).toBe(true)
      expect(loadingStates.isLoading('operation2')).toBe(true)
      expect(loadingStates.isLoading('operation3')).toBe(false)
      expect(loadingStates.isAnyLoading.value).toBe(true)
    })

    it('should get all loading state names', () => {
      loadingStates.setLoading('state1', true)
      loadingStates.setLoading('state2', false)
      loadingStates.setLoading('state3', true)
      
      const allStates = loadingStates.getAllStates()
      
      expect(allStates).toEqual({
        state1: true,
        state2: false,
        state3: true
      })
    })

    it('should get only active loading states', () => {
      loadingStates.setLoading('active1', true)
      loadingStates.setLoading('inactive', false)
      loadingStates.setLoading('active2', true)
      
      const activeStates = loadingStates.getActiveStates()
      
      expect(activeStates).toEqual(['active1', 'active2'])
    })
  })

  describe('Edge Cases', () => {
    it('should handle undefined/null keys gracefully', () => {
      expect(() => {
        loadingStates.isLoading(undefined as any)
      }).not.toThrow()
      
      expect(() => {
        loadingStates.setLoading(null as any, true)
      }).not.toThrow()
    })

    it('should handle empty string keys', () => {
      loadingStates.setLoading('', true)
      
      expect(loadingStates.isLoading('')).toBe(true)
      expect(loadingStates.isAnyLoading.value).toBe(true)
    })

    it('should handle very long key names', () => {
      const longKey = 'a'.repeat(1000)
      
      loadingStates.setLoading(longKey, true)
      
      expect(loadingStates.isLoading(longKey)).toBe(true)
    })

    it('should handle special characters in keys', () => {
      const specialKey = 'test.key-with_special@chars#123'
      
      loadingStates.setLoading(specialKey, true)
      
      expect(loadingStates.isLoading(specialKey)).toBe(true)
    })
  })

  describe('State Persistence', () => {
    it('should maintain state across multiple get calls', () => {
      loadingStates.setLoading('persistent', true)
      
      expect(loadingStates.isLoading('persistent')).toBe(true)
      expect(loadingStates.isLoading('persistent')).toBe(true)
      expect(loadingStates.isLoading('persistent')).toBe(true)
    })

    it('should maintain state when checking different keys', () => {
      loadingStates.setLoading('key1', true)
      loadingStates.setLoading('key2', false)
      
      expect(loadingStates.isLoading('key1')).toBe(true)
      expect(loadingStates.isLoading('key2')).toBe(false)
      expect(loadingStates.isLoading('key1')).toBe(true) // Should still be true
    })
  })

  describe('Performance', () => {
    it('should handle many loading states efficiently', () => {
      const stateCount = 1000
      
      // Set many states
      for (let i = 0; i < stateCount; i++) {
        loadingStates.setLoading(`state${i}`, i % 2 === 0)
      }
      
      // Check that all states are correctly set
      for (let i = 0; i < stateCount; i++) {
        expect(loadingStates.isLoading(`state${i}`)).toBe(i % 2 === 0)
      }
      
      expect(loadingStates.isAnyLoading.value).toBe(true) // Some states are true
    })

    it('should handle rapid state changes', () => {
      const key = 'rapid-change'
      
      // Rapid changes
      for (let i = 0; i < 100; i++) {
        loadingStates.setLoading(key, i % 2 === 0)
      }
      
      // Final state should be false (100 % 2 === 0 is true, but we set it to i % 2 === 0)
      expect(loadingStates.isLoading(key)).toBe(false)
    })
  })

  describe('Reactive Updates', () => {
    it('should trigger reactive updates on loading states object', async () => {
      const watcher = vi.fn()
      
      watch(loadingStates.loadingStates, watcher, { immediate: true, deep: true })
      
      expect(watcher).toHaveBeenCalledTimes(1)
      
      loadingStates.setLoading('reactive-obj', true)
      await nextTick()
      
      expect(watcher).toHaveBeenCalledTimes(2)
    })
  })
}) 