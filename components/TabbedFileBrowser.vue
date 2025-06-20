<!--
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
-->
<template>
  <div class="bg-gradient-surface rounded-lg border shadow-sophisticated overflow-hidden backdrop-blur-sm h-full">
    <!-- Tab Header -->
    <div class="border-b border-border bg-card/50 backdrop-blur-sm">
      <div class="content-spacing px-4 py-3">
        <div class="flex items-center justify-between">
          <h3 class="text-sm font-medium text-foreground">File Browser</h3>
          
          <!-- Mode Toggle -->
          <div class="flex items-center space-x-2">
            <Button
              @click="setMode('hardcore')"
              variant="ghost"
              size="sm"
              :class="{
                'bg-primary/10 text-primary': currentMode === 'hardcore',
                'text-muted-foreground hover:text-foreground': currentMode !== 'hardcore'
              }"
              class="text-xs px-3 py-1.5 h-auto"
            >
              <Icon name="lucide:folder-tree" class="w-3 h-3 mr-1.5" />
              Hardcore
            </Button>
            <Button
              @click="setMode('assisted')"
              variant="ghost"
              size="sm"
              :class="{
                'bg-primary/10 text-primary': currentMode === 'assisted',
                'text-muted-foreground hover:text-foreground': currentMode !== 'assisted'
              }"
              class="text-xs px-3 py-1.5 h-auto"
            >
              <Icon name="lucide:sparkles" class="w-3 h-3 mr-1.5" />
              Assisted
              <span v-if="searchResultsCount > 0" class="ml-1 bg-primary text-primary-foreground text-xs rounded-full px-1.5 py-0.5 min-w-[20px] text-center">
                {{ searchResultsCount }}
              </span>
            </Button>
          </div>
        </div>
        
        <!-- Mode Description -->
        <p class="text-xs text-muted-foreground mt-2">
          <span v-if="currentMode === 'hardcore'">
            Browse and manually select files from your project
          </span>
          <span v-else>
            AI-powered search results for intelligent file curation
          </span>
        </p>
      </div>
    </div>

    <!-- Tab Content -->
    <div class="flex-1 flex flex-col min-h-0">
      <!-- Hardcore Mode: Manual File Browser -->
      <div v-if="currentMode === 'hardcore'" class="flex-1 flex flex-col min-h-0">
        <ProjectFileBrowser />
      </div>

      <!-- Assisted Mode: AI Search Results -->
      <div v-else class="flex-1 flex flex-col min-h-0">
        <AssistedCuration />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import ProjectFileBrowser from './ProjectFileBrowser.vue'
import AssistedCuration from './project-file-browser/AssistedCuration.vue'

type BrowserMode = 'hardcore' | 'assisted'

// State for the current mode
const currentMode = ref<BrowserMode>('hardcore')

// Global state management for search results
const searchResultsStore = ref<Array<{
  file: string
  finalScore: number
  scorePercentage: number
  astScore: number
  llmScore: number
  flanScore: number
  syntaxScore: number
  hasSynergy: boolean
  matches: string[]
  classification?: string
  workflowPosition?: string
}>>([])

// Computed property for search results count
const searchResultsCount = computed(() => searchResultsStore.value.length)

// Provide global access to search results for communication between components
if (typeof window !== 'undefined') {
  (window as any).setAssistedSearchResults = (results: any[]) => {
    searchResultsStore.value = results
    // Auto-switch to assisted mode when search results arrive
    if (results.length > 0) {
      currentMode.value = 'assisted'
    }
  }
  
  (window as any).clearAssistedSearchResults = () => {
    searchResultsStore.value = []
  }
  
  (window as any).getAssistedSearchResults = () => {
    return searchResultsStore.value
  }
}

// Provide search results to child components
provide('searchResults', searchResultsStore)
provide('searchResultsCount', searchResultsCount)

const setMode = (mode: BrowserMode) => {
  currentMode.value = mode
}
</script>