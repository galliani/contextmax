/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */
import { ref, computed, watch } from 'vue'
import type { Ref } from 'vue'
import { useNotifications } from './useNotifications'

export interface AutoSaveOptions {
  key: string
  saveInterval: number
  enableUndo?: boolean
  onSave?: (data: any) => Promise<void>
  onRestore?: (data: any) => void
}

export interface AutoSaveState {
  isSaving: boolean
  isDirty: boolean
  canUndo: boolean
  canRedo: boolean
  lastSaved: Date | null
}

export function useAutoSave(data: Ref<any>, options: AutoSaveOptions) {
  const { success, error } = useNotifications()
  
  // Internal state
  const isSaving = ref(false)
  const isDirty = ref(false)
  const lastSaved = ref<Date | null>(null)
  const undoStack = ref<any[]>([])
  const redoStack = ref<any[]>([])
  
  let saveTimer: NodeJS.Timeout | null = null
  let lastSnapshot: any = null

  // Computed state object
  const state = computed<AutoSaveState>(() => ({
    isSaving: isSaving.value,
    isDirty: isDirty.value,
    canUndo: undoStack.value.length > 0,
    canRedo: redoStack.value.length > 0,
    lastSaved: lastSaved.value
  }))

  // Take snapshot for undo/redo
  const takeSnapshot = () => {
    if (options.enableUndo && data.value) {
    const snapshot = JSON.parse(JSON.stringify(data.value))
    
      // Only add to undo stack if data actually changed
      if (lastSnapshot === null || JSON.stringify(lastSnapshot) !== JSON.stringify(snapshot)) {
        undoStack.value.push(lastSnapshot || {})
      
      // Limit undo stack size
        if (undoStack.value.length > 50) {
        undoStack.value.shift()
      }
        
        // Clear redo stack when new change is made
        redoStack.value = []
        
        lastSnapshot = snapshot
      }
    }
  }

  // Watch for data changes
  watch(data, () => {
    if (!isSaving.value) { // Don't mark dirty during save operation
      takeSnapshot()
      isDirty.value = true
      startAutoSaveTimer()
    }
  }, { deep: true })

  // Timer management
  const startAutoSaveTimer = () => {
    stopAutoSaveTimer()
    
    if (options.saveInterval > 0) {
      saveTimer = setTimeout(async () => {
        await performSave()
      }, options.saveInterval)
    }
  }

  const stopAutoSaveTimer = () => {
    if (saveTimer) {
      clearTimeout(saveTimer)
      saveTimer = null
    }
  }

  // Save operations
  const performSave = async () => {
    if (!isDirty.value || isSaving.value) return
    
    isSaving.value = true
    
    try {
      if (options.onSave) {
        await options.onSave(data.value)
      }
      
      isDirty.value = false
      lastSaved.value = new Date()
      
      // Update last snapshot after successful save
      if (data.value) {
        lastSnapshot = JSON.parse(JSON.stringify(data.value))
      }
      
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error'
      error('Auto-save Failed', `Failed to save automatically: ${errorMessage}`)
    } finally {
      isSaving.value = false
    }
  }

  // Force save
  const forceSave = async () => {
    if (isSaving.value) return
    
    stopAutoSaveTimer()
    await performSave()
      }

  // Undo operation
  const undo = () => {
    if (undoStack.value.length === 0) return
    
    const currentState = JSON.parse(JSON.stringify(data.value))
    const previousState = undoStack.value.pop()
    
    if (previousState) {
      // Add current state to redo stack
      redoStack.value.push(currentState)
      
      // Restore previous state
      isSaving.value = true // Prevent triggering dirty during restore
      Object.assign(data.value, previousState)
      isSaving.value = false
      
      isDirty.value = true // Mark as dirty since we changed the data
    }
  }

  // Redo operation
  const redo = () => {
    if (redoStack.value.length === 0) return
    
    const currentState = JSON.parse(JSON.stringify(data.value))
    const nextState = redoStack.value.pop()
    
    if (nextState) {
      // Add current state to undo stack
      undoStack.value.push(currentState)

      // Restore next state
      isSaving.value = true // Prevent triggering dirty during restore
      Object.assign(data.value, nextState)
      isSaving.value = false
      
      isDirty.value = true // Mark as dirty since we changed the data
      }
    }

  // Initialize
  if (data.value) {
    lastSnapshot = JSON.parse(JSON.stringify(data.value))
    }

  // Cleanup
  const cleanup = () => {
    stopAutoSaveTimer()
  }

  return {
    state,
    forceSave,
    undo,
    redo,
    cleanup
  }
} 