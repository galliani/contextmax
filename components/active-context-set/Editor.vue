/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */
<template>
  <div>
    <!-- Active Context Set Sub-header -->
    <div class="border-b bg-muted/30 px-4 py-3">
      <div class="flex">
        <div class="flex items-center space-x-3">
          <h3 class="visual-hierarchy-4 mb-2 text-mobile-subheading sm:text-md lg:text-xl">
            Editor
          </h3>
          <p class="text-sm text-muted-foreground"><span v-if="estimatedTokens > 0">~{{ estimatedTokens.toLocaleString() }} tokens</span></p>
          <div class="float-right">
            <Button
              @click="handleExportToClipboard"
              :disabled="isExporting || !activeContextSet || activeContextSet.files.length === 0"
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
        </div>
      </div>
    </div>

    <div class="flex-1 overflow-hidden">
      <div class="bg-gradient-surface rounded-lg border shadow-sophisticated overflow-hidden backdrop-blur-sm h-full">
        <!-- No Active Context Set State -->
        <div v-if="!activeContextSet" class="h-full flex items-center justify-center p-8">
          <div class="text-center max-w-md mx-auto">
            <Icon name="lucide:folder-plus" class="w-16 h-16 mx-auto mb-6 text-muted-foreground opacity-50" aria-hidden="true" />
            <h2 class="visual-hierarchy-2 mb-4 text-mobile-heading sm:text-xl lg:text-2xl">
              No Context Set Selected
            </h2>
            <p class="visual-hierarchy-body text-mobile-body sm:text-base text-muted-foreground mb-6">
              Select an existing context set from the list or create a new one to get started. 
              Context sets help you organize files and workflows for specific parts of your codebase.
            </p>
            <div class="space-y-3">
              <p class="text-sm text-muted-foreground">
                💡 <strong>Tip:</strong> Start by creating a context set, then add relevant files from your project tree.
              </p>
            </div>
          </div>
        </div>

        <!-- Active Context Set Editor -->
        <div v-else class="h-full flex flex-col">          
          <!-- Tabbed Content -->
          <div class="flex-1 min-h-0 flex flex-col">
            <!-- Tab Navigation -->
            <div class="border-b bg-surface-1">
              <nav class="flex space-x-0" role="tablist" aria-label="Context set editor sections">
                <button
                  v-for="tab in tabs"
                  :key="tab.id"
                  type="button"
                  @click="activeTab = tab.id"
                  class="px-4 py-3 text-sm font-medium transition-all duration-200 border-b-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 whitespace-nowrap"
                  :class="{
                    'text-primary border-primary bg-primary/5': activeTab === tab.id,
                    'text-muted-foreground border-transparent hover:text-foreground hover:border-muted': activeTab !== tab.id
                  }"
                  :aria-selected="activeTab === tab.id"
                  :tabindex="activeTab === tab.id ? 0 : -1"
                  role="tab"
                  :aria-controls="`tab-panel-${tab.id}`"
                >
                  <Icon :name="tab.icon" class="w-4 h-4 mr-2 inline" aria-hidden="true" />
                  {{ tab.label }}
                  <span v-if="tab.count !== undefined" class="ml-2 px-2 py-0.5 text-xs rounded-full bg-muted text-muted-foreground">
                    {{ tab.count }}
                  </span>
                </button>
              </nav>
            </div>

            <!-- Tab Content -->
            <div class="flex-1 min-h-0 overflow-hidden">
              <!-- Files Tab -->
              <div
                v-show="activeTab === 'files'"
                id="tab-panel-files"
                class="h-full overflow-y-auto p-6"
                role="tabpanel"
                aria-labelledby="tab-files"
              >
                <FilesList />
              </div>

              <!-- Workflow Tab -->
              <div
                v-show="activeTab === 'workflow'"
                id="tab-panel-workflow"
                class="h-full overflow-y-auto p-6"
                role="tabpanel"
                aria-labelledby="tab-workflow"
              >
                <WorkflowEditor 
                  :workflow="activeContextSet.workflow"
                  @update:workflow="updateWorkflow"
                />
              </div>

              <!-- Entry Points Tab -->
              <div
                v-show="activeTab === 'entryPoints'"
                id="tab-panel-entryPoints"
                class="h-full overflow-y-auto p-6"
                role="tabpanel"
                aria-labelledby="tab-entryPoints"
              >
                <EntryPointsEditor 
                  :entry-points="activeContextSet.entryPoints || []"
                  @update:entry-points="updateEntryPoints"
                />
              </div>

              <!-- System Behavior Tab -->
              <div
                v-show="activeTab === 'systemBehavior'"
                id="tab-panel-systemBehavior"  
                class="h-full overflow-y-auto p-6"
                role="tabpanel"
                aria-labelledby="tab-systemBehavior"
              >
                <SystemBehaviorEditor 
                  :system-behavior="activeContextSet.systemBehavior || {}"
                  @update:system-behavior="updateSystemBehavior"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { WorkflowStep, EntryPoint } from '~/composables/useProjectStore'
import FilesList from './FilesList.vue'
import WorkflowEditor from './WorkflowEditor.vue'
import EntryPointsEditor from './EntryPointsEditor.vue'
import SystemBehaviorEditor from './SystemBehaviorEditor.vue'

const {
  activeContextSet,
  activeContextSetName,
  filesManifest,
  fileTree,
  updateActiveContextSet
} = useProjectStore()

const { announceStatus, announceError } = useAccessibility()
const { success, error } = useNotifications()

// Context Set Exporter
const { exportContextSetToClipboard, calculateTokenCount, isExporting } = useContextSetExporter()

// Tab management
const activeTab = ref('files')

// Export functionality
const estimatedTokens = ref(0)

// Computed tabs with counts
const tabs = computed(() => [
  {
    id: 'files',
    label: 'Files',
    icon: 'lucide:file-text',
    count: activeContextSet.value?.files.length || 0
  },
  {
    id: 'workflow',
    label: 'Workflow',
    icon: 'lucide:workflow',
    count: activeContextSet.value?.workflow.length || 0
  },
  {
    id: 'entryPoints',
    label: 'Entry Points',
    icon: 'lucide:zap',
    count: activeContextSet.value?.entryPoints?.length || 0
  },
  {
    id: 'systemBehavior',
    label: 'System Behavior',
    icon: 'lucide:settings',
    count: activeContextSet.value?.systemBehavior?.processing?.mode ? 1 : 0
  }
])

// Actions
const updateWorkflow = (newWorkflow: WorkflowStep[]) => {
  if (!activeContextSet.value) return
  
  try {
    updateActiveContextSet({ workflow: newWorkflow })
    announceStatus('Workflow updated')
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to update workflow'
    announceError(message)
  }
}

const updateEntryPoints = (newEntryPoints: EntryPoint[]) => {
  if (!activeContextSet.value) return
  
  try {
    updateActiveContextSet({ entryPoints: newEntryPoints })
    announceStatus('Entry points updated')
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to update entry points'
    announceError(message)
  }
}

const updateSystemBehavior = (newSystemBehavior: { processing?: { mode?: 'synchronous' | 'asynchronous' | 'streaming' | 'batch' } } | null) => {
  if (!activeContextSet.value) return
  
  try {
    updateActiveContextSet({ systemBehavior: newSystemBehavior })
    announceStatus('System behavior updated')
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to update system behavior'
    announceError(message)
  }
}

// Export functionality
const handleExportToClipboard = async () => {
  if (!activeContextSet.value || !activeContextSetName.value) {
    error('Export Failed', 'No active context set to export')
    return
  }

  if (activeContextSet.value.files.length === 0) {
    error('Export Failed', 'Context set has no files to export')
    return
  }

  try {
    const result = await exportContextSetToClipboard(
      activeContextSetName.value,
      activeContextSet.value,
      filesManifest.value,
      fileTree.value
    )

    if (result.success) {
      success(
        'Snippet Copied',
        `Context set "${activeContextSetName.value}" copied to clipboard as Markdown (${result.tokenCount.toLocaleString()} tokens)`
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
        fileTree.value
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
    console.warn('Failed to calculate estimated tokens:', err)
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

// Keyboard navigation for tabs
const handleTabKeydown = (event: Event) => {
  const keyboardEvent = event as KeyboardEvent
  if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(keyboardEvent.key)) return
  
  event.preventDefault()
  const currentIndex = tabs.value.findIndex(tab => tab.id === activeTab.value)
  
  let newIndex = currentIndex
  
  switch (keyboardEvent.key) {
    case 'ArrowLeft':
      newIndex = currentIndex > 0 ? currentIndex - 1 : tabs.value.length - 1
      break
    case 'ArrowRight':
      newIndex = currentIndex < tabs.value.length - 1 ? currentIndex + 1 : 0
      break
    case 'Home':
      newIndex = 0
      break
    case 'End':
      newIndex = tabs.value.length - 1
      break
  }
  
  activeTab.value = tabs.value[newIndex].id
}

onMounted(() => {
  // Add keyboard navigation to tab buttons
  const tabButtons = document.querySelectorAll('[role="tab"]')
  tabButtons.forEach(button => {
    button.addEventListener('keydown', handleTabKeydown)
  })
})

onUnmounted(() => {
  const tabButtons = document.querySelectorAll('[role="tab"]')
  tabButtons.forEach(button => {
    button.removeEventListener('keydown', handleTabKeydown)
  })
})
</script> 