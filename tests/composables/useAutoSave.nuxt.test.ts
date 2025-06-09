/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */
// @vitest-environment nuxt
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { ref, nextTick } from 'vue'
import { useAutoSave } from '~/composables/useAutoSave'

describe('useAutoSave', () => {
  let testData: any
  let autoSave: ReturnType<typeof useAutoSave>
  let mockSaveFunction: any

  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
    
    // Create test data
    testData = ref({
      contextSets: {},
      filesManifest: {}
    })
    
    // Create mock save function
    mockSaveFunction = vi.fn().mockResolvedValue(undefined)
    
    // Initialize auto-save
    autoSave = useAutoSave(testData, {
      key: 'test-auto-save',
      saveInterval: 5000,
      enableUndo: true,
      onSave: mockSaveFunction
    })
  })

  afterEach(() => {
    vi.useRealTimers()
    autoSave.cleanup()
  })

  describe('Initial State', () => {
    it('should initialize with correct default state', () => {
      expect(autoSave.state.value.isSaving).toBe(false)
      expect(autoSave.state.value.isDirty).toBe(false)
      expect(autoSave.state.value.canUndo).toBe(false)
      expect(autoSave.state.value.canRedo).toBe(false)
      expect(autoSave.state.value.lastSaved).toBe(null)
    })
  })

  describe('Data Change Detection', () => {
    it('should mark as dirty when data changes', async () => {
      testData.value.contextSets.testSet = { description: 'test' }
      await nextTick()
      
      expect(autoSave.state.value.isDirty).toBe(true)
    })

    it('should start auto-save timer when data changes', async () => {
      testData.value.contextSets.newSet = { description: 'new set' }
      await nextTick()
      
      // Fast forward to trigger auto-save
      vi.advanceTimersByTime(5000)
      await nextTick()
      
      expect(mockSaveFunction).toHaveBeenCalledWith(testData.value)
    })

    it('should not mark as dirty during save operation', async () => {
      // Start a save operation
      mockSaveFunction.mockImplementation(() => {
        // Change data during save
        testData.value.contextSets.duringSave = { description: 'during save' }
        return Promise.resolve()
      })
      
      testData.value.contextSets.initial = { description: 'initial' }
      await nextTick()
      
      await autoSave.forceSave()
      
      expect(autoSave.state.value.isDirty).toBe(false)
    })
  })

  describe('Manual Save', () => {
    it('should force save immediately', async () => {
      testData.value.contextSets.manualSave = { description: 'manual save' }
      await nextTick()
      
      expect(autoSave.state.value.isDirty).toBe(true)
      
      await autoSave.forceSave()
      
      expect(mockSaveFunction).toHaveBeenCalledWith(testData.value)
      expect(autoSave.state.value.isDirty).toBe(false)
      expect(autoSave.state.value.lastSaved).toBeInstanceOf(Date)
    })

    it('should not save if not dirty', async () => {
      await autoSave.forceSave()
      
      expect(mockSaveFunction).not.toHaveBeenCalled()
    })
  })

  describe('State Management', () => {
    it('should track saving state correctly', async () => {
      let savePromiseResolve: (value?: any) => void
      const savePromise = new Promise(resolve => {
        savePromiseResolve = resolve
      })
      
      mockSaveFunction.mockReturnValue(savePromise)
      
      testData.value.contextSets.savingState = { description: 'saving state' }
      await nextTick()
      
      const forcePromise = autoSave.forceSave()
      
      expect(autoSave.state.value.isSaving).toBe(true)
      
      savePromiseResolve()
      await forcePromise
      
      expect(autoSave.state.value.isSaving).toBe(false)
    })
  })
}) 