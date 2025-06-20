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
        </div>
      </div>

        <!-- Mode Description -->
        <p class="text-xs text-muted-foreground">
          <span>
            Define the inner workings of your context set.
          </span>
        </p>      
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


            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { WorkflowStep } from '~/composables/useProjectStore'
import FilesList from './FilesList.vue'
import WorkflowEditor from './WorkflowEditor.vue'

const {
  activeContextSet,
  updateActiveContextSet
} = useProjectStore()

const { announceStatus, announceError } = useAccessibility()

// Tab management
const activeTab = ref('files')


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