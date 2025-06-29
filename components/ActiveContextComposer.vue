<!--
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
-->
<template>
  <!-- Unified Context Set Composition Interface -->
  <div class="w-full">
    <!-- Unified Container with Shared Border -->
    <div class="bg-card rounded-lg border shadow-lg overflow-hidden min-h-[800px] lg:min-h-[900px]">
      
      <!-- Joint Panel Header -->
      <div class="border-b bg-gradient-surface px-6 py-4">
        <div class="flex items-start justify-between">
          <div class="flex-1 min-w-0">
            <!-- Editable Context Set Name -->
            <div v-if="activeContextSetName" class="mt-2 mb-0">
              <div v-if="!isEditingName" class="flex items-center group">
                <Icon name="lucide:folder-open" class="w-12 h-12 mr-2 text-primary" />
                <h3 class="visual-hierarchy-3 mb-1 text-mobile-subheading sm:text-xl lg:text-3xl font-bold" @click="startEditingName">
                  Composer: <span class="text-primary font-extrabold bg-primary/10 px-2 py-1 rounded-md border border-primary/20 animate-pulse">{{ getContextDisplayName(activeContextSetName) }}</span>
                </h3>
                <Button
                  @click="startEditingName"
                  variant="ghost"
                  size="sm"
                  class="ml-2 opacity-0 group-hover:opacity-100 transition-opacity"
                  title="Edit context set name"
                >
                  <Icon name="lucide:edit-2" class="w-4 h-4" aria-hidden="true" />
                </Button>
              </div>
              <div v-else class="space-y-2">
                <Input
                  ref="nameInput"
                  v-model="editingName"
                  @blur="saveContextSetName"
                  @keydown.enter="saveContextSetName"
                  @keydown.escape="cancelEditingName"
                  class="text-4xl font-semibold h-auto py-2 px-3 border-2 border-primary bg-background"
                  placeholder="Enter context set name"
                />
                <div class="flex items-center space-x-2">
                  <Button @click="saveContextSetName" size="sm" variant="default">
                    <Icon name="lucide:check" class="w-4 h-4 mr-1" aria-hidden="true" />
                    Save
                  </Button>
                  <Button @click="cancelEditingName" size="sm" variant="outline">
                    <Icon name="lucide:x" class="w-4 h-4 mr-1" aria-hidden="true" />
                    Cancel
                  </Button>
                </div>
              </div>
            </div>
            <h3 v-else class="visual-hierarchy-3 mb-2 text-mobile-subheading sm:text-lg lg:text-2xl">
              Context Set Composer
            </h3>

            <!-- Editable Context Set Description -->
            <div v-if="activeContextSetName" class="mb-0">
              <div v-if="!isEditingDescription && activeContextSetDescription" class="flex items-start group">
                <p class="text-lg text-slate-300 cursor-pointer hover:text-slate-200 transition-colors" @click="startEditingDescription">
                  {{ activeContextSetDescription }}
                </p>
                <Button
                  @click="startEditingDescription"
                  variant="ghost"
                  size="sm"
                  class="ml-0 opacity-0 group-hover:opacity-100 transition-opacity"
                  title="Edit description"
                >
                  <Icon name="lucide:edit-2" class="w-3 h-3" aria-hidden="true" />
                </Button>
              </div>
              <div v-else-if="!isEditingDescription && !activeContextSetDescription" class="group">
                <Button
                  @click="startEditingDescription"
                  variant="ghost"
                  size="sm"
                  class="ml-0 pl-0 text-muted-foreground hover:text-foreground transition-colors"
                  title="Add description"
                >
                  <Icon name="lucide:plus" class="w-4 h-4 mr-2" aria-hidden="true" />
                  Add description
                </Button>
              </div>
              <div v-else class="space-y-2">
                <Textarea
                  ref="descriptionInput"
                  v-model="editingDescription"
                  @blur="saveContextSetDescription"
                  @keydown.escape="cancelEditingDescription"
                  class="text-lg min-h-[80px] border-2 border-primary bg-background text-slate-300"
                  placeholder="Describe what this context set is for and how it should be used..."
                />
                <div class="flex items-center space-x-2">
                  <Button @click="saveContextSetDescription" size="sm" variant="default">
                    <Icon name="lucide:check" class="w-4 h-4 mr-1" aria-hidden="true" />
                    Save
                  </Button>
                  <Button @click="cancelEditingDescription" size="sm" variant="outline">
                    <Icon name="lucide:x" class="w-4 h-4 mr-1" aria-hidden="true" />
                    Cancel
                  </Button>
                </div>
              </div>
            </div>

          </div>
          
          <!-- Token Estimation & Export Actions -->
          <div v-if="activeContextSetName" class="flex flex-col items-end space-y-3 ml-6 mt-2">
            <!-- Token Estimation & Copy Button -->
            <div class="flex items-center space-x-3">
              <p class="text-sm text-muted-foreground">
                <span v-if="estimatedTokens > 0">~{{ estimatedTokens.toLocaleString() }} tokens</span>
              </p>
              <Button
                @click="handleExportToClipboard"
                :disabled="isExporting || !activeContextSet || !activeContextSet.files || activeContextSet.files.length === 0"
                class="flex items-center space-x-2"
                variant="default"
                size="sm"
              >
                <Icon 
                  :name="isExporting ? 'lucide:loader-2' : 'lucide:clipboard-copy'" 
                  :class="['w-4 h-4', { 'animate-spin': isExporting }]" 
                />
                <span>{{ isExporting ? 'Exporting...' : 'Copy as Snippet' }}</span>
              </Button>
            </div>
            
            <!-- Context Set Status & Actions -->
            <div class="text-right">
              <div class="text-sm font-medium text-foreground">
                {{ activeContextSet?.files?.length || 0 }} files • 
                {{ activeContextSet?.workflows?.length || 0 }} workflows
                <span v-if="activeContextSet?.systemBehavior?.processing?.mode" class="ml-2 px-2 py-0.5 text-xs rounded-full bg-primary/10 text-primary">
                   • {{ activeContextSet.systemBehavior.processing.mode }}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Unified Content Area -->
      <div class="grid grid-cols-1 lg:grid-cols-2 h-full min-h-[750px] lg:min-h-[850px]">
        
        <!-- Left Panel: Project File Browser -->
        <div class="">
          <div class="h-full flex flex-col">
            <!-- Project File Browser Content -->
            <div class="flex-1 overflow-hidden">
              <TabbedFileBrowser />
            </div>
          </div>
        </div>

        <!-- Right Panel: Active Context Set Editor -->
        <div class="h-full flex flex-col">
          <Editor />
        </div>

      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { logger } from '~/utils/logger'
import { getContextDisplayName } from '~/utils/contextName'
import Editor from './active-context-set/Editor.vue'
import TabbedFileBrowser from './TabbedFileBrowser.vue'

// State for editing
const isEditingName = ref(false)
const isEditingDescription = ref(false)
const editingName = ref('')
const editingDescription = ref('')

// Template refs for focusing
const nameInput = ref<HTMLInputElement>()
const descriptionInput = ref<HTMLTextAreaElement>()

// Use the project store
const { activeContextSet, updateActiveContextSet, filesManifest, fileTree, contextSets, generateContextSetsJSONWithPrefix } = useProjectStore()

// Accessibility support
const { announceStatus, announceError } = useAccessibility()
const { success, error } = useNotifications()

// Context Set Exporter
const { exportContextSetToClipboard, calculateTokenCount, isExporting } = useContextSetExporter()

// Export functionality
const estimatedTokens = ref(0)

// Safe focus helper for test compatibility
const safeFocus = (element: HTMLElement | undefined) => {
  try {
    element?.focus?.()
  } catch (error) {
    // Silently ignore focus errors in test environment
  }
}

const safeSelect = (element: HTMLInputElement | undefined) => {
  try {
    element?.select?.()
  } catch (error) {
    // Silently ignore select errors in test environment
  }
}

// Computed properties for active context set
const activeContextSetName = computed(() => {
  return activeContextSet.value?.name || ''
})

const activeContextSetDescription = computed(() => {
  return activeContextSet.value?.description || ''
})


// Methods for editing
const startEditingName = async () => {
  isEditingName.value = true
  editingName.value = getContextDisplayName(activeContextSetName.value)
  await nextTick()
  safeFocus(nameInput.value)
  safeSelect(nameInput.value)
}

const startEditingDescription = async () => {
  isEditingDescription.value = true
  editingDescription.value = activeContextSetDescription.value
  await nextTick()
  safeFocus(descriptionInput.value)
}

const saveContextSetName = () => {
  if (!activeContextSet.value) return
  
  const newName = editingName.value.trim()
  if (!newName) {
    announceError('Context set name cannot be empty')
    safeFocus(nameInput.value)
    return
  }
  
  if (newName === activeContextSet.value.name) {
    isEditingName.value = false
    return
  }
  
  try {
    updateActiveContextSet({ name: newName })
    isEditingName.value = false
    announceStatus(`Context set renamed to: ${getContextDisplayName(newName)}`)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to rename context set'
    announceError(message)
    safeFocus(nameInput.value)
  }
}

const saveContextSetDescription = () => {
  if (!activeContextSet.value) return
  
  const newDescription = editingDescription.value.trim()
  if (newDescription === activeContextSet.value.description) {
    isEditingDescription.value = false
    return
  }
  
  try {
    updateActiveContextSet({ description: newDescription })
    isEditingDescription.value = false
    announceStatus('Context set description updated')
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to update description'
    announceError(message)
    safeFocus(descriptionInput.value)
  }
}

const cancelEditingName = () => {
  isEditingName.value = false
  editingName.value = ''
}

const cancelEditingDescription = () => {
  isEditingDescription.value = false
  editingDescription.value = ''
}


// Export functionality
const handleExportToClipboard = async () => {
  if (!activeContextSet.value || !activeContextSetName.value) {
    error('Export Failed', 'No active context set to export')
    return
  }

  if (!activeContextSet.value.files || activeContextSet.value.files.length === 0) {
    error('Export Failed', 'Context set has no files to export')
    return
  }

  try {
    // Create a prefixed version of the context set for export
    const prefixedContextSetName = activeContextSetName.value.startsWith('context:') 
      ? activeContextSetName.value 
      : `context:${activeContextSetName.value}`
    
    // Create a version of the context set with prefixed names in the 'uses' array
    const prefixedContextSet = {
      ...activeContextSet.value,
      uses: activeContextSet.value.uses?.map(usedName => 
        usedName.startsWith('context:') ? usedName : `context:${usedName}`
      ) || []
    }
    
    // Create prefixed versions of ALL context sets for dependency resolution
    const prefixedAllContexts: Record<string, ContextSet> = {}
    Object.entries(contextSets.value).forEach(([name, contextSet]) => {
      const prefixedName = name.startsWith('context:') ? name : `context:${name}`
      prefixedAllContexts[prefixedName] = {
        ...contextSet,
        uses: contextSet.uses?.map(usedName => 
          usedName.startsWith('context:') ? usedName : `context:${usedName}`
        ) || []
      }
    })
    
    const result = await exportContextSetToClipboard(
      prefixedContextSetName,
      prefixedContextSet,
      filesManifest.value,
      fileTree.value,
      prefixedAllContexts
    )

    if (result.success) {
      success(
        'Snippet Copied',
        `Context set "${getContextDisplayName(prefixedContextSetName)}" copied to clipboard as Markdown (${result.tokenCount.toLocaleString()} tokens)`
      )
      announceStatus(`Context set exported to clipboard with ${result.tokenCount} tokens`)
    } else {
      error('Export Failed', result.error || 'Unknown error occurred')
      announceError(`Failed to export context set: ${result.error || 'Unknown error'}`)
    }
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error'
    error('Export Failed', errorMessage)
    announceError(`Export failed: ${errorMessage}`)
  }
}

// Update estimated token count when context set changes
const updateEstimatedTokens = async () => {
  try {
    // Ensure all required dependencies exist
    if (!activeContextSet.value || !activeContextSetName.value || !filesManifest.value || !fileTree.value) {
      if (estimatedTokens?.value !== undefined) {
        estimatedTokens.value = 0
      }
      return
    }

    // Check if calculateTokenCount is available and is a function
    if (calculateTokenCount && typeof calculateTokenCount === 'function') {
      const tokens = await calculateTokenCount(
        activeContextSetName.value,
        activeContextSet.value,
        filesManifest.value,
        fileTree.value,
        contextSets.value
      )
      if (estimatedTokens?.value !== undefined) {
        estimatedTokens.value = tokens || 0
      }
    } else {
      // In test environment or when function is not available
      if (estimatedTokens?.value !== undefined) {
        estimatedTokens.value = 0
      }
    }
  } catch (err) {
    logger.warn('Failed to calculate estimated tokens:', err)
    if (estimatedTokens?.value !== undefined) {
      estimatedTokens.value = 0
    }
  }
}

// Watch for changes to update token estimate
// Only set up the watcher if the refs exist to avoid "Invalid watch source" errors in tests
if (activeContextSet && activeContextSetName) {
  watch([activeContextSet, activeContextSetName], updateEstimatedTokens, { immediate: true, deep: true })
}
</script>

<style scoped>
/* Unified panel styling */
.border-r {
  border-right: 1px solid var(--border);
}

/* Sub-header styling for unified look */
.bg-muted\/30 {
  background-color: rgba(156, 163, 175, 0.1);
}

/* Main working area height adjustments */
.min-h-\[800px\] {
  min-height: 800px;
}

.min-h-\[750px\] {
  min-height: 750px;
}

.min-h-\[850px\] {
  min-height: 850px;
}

/* Mobile height adjustments for better UX */
@media (max-width: 768px) {
  .min-h-\[800px\] {
    min-height: 600px;
  }
  
  .min-h-\[750px\] {
    min-height: 550px;
  }
  
  .min-h-\[850px\] {
    min-height: 580px;
  }
}

/* Tablet height adjustments */
@media (min-width: 769px) and (max-width: 1023px) {
  .min-h-\[800px\] {
    min-height: 700px;
  }
  
  .min-h-\[750px\] {
    min-height: 650px;
  }
  
  .min-h-\[850px\] {
    min-height: 680px;
  }
}

/* Desktop enhanced heights */
@media (min-width: 1024px) {
  .lg\:min-h-\[900px\] {
    min-height: 900px;
  }
  
  .lg\:min-h-\[850px\] {
    min-height: 850px;
  }
}
</style>
