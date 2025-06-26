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
          <h3 class="visual-hierarchy-4 mb-2 font-bold text-mobile-subheading sm:text-md lg:text-xl">
            Explorer
          </h3>
          
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
            </Button>
          </div>
        </div>
        
        <!-- Mode Description -->
        <p class="text-xs text-muted-foreground">
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
import { logger } from '~/utils/logger'
import ProjectFileBrowser from './ProjectFileBrowser.vue'
import AssistedCuration from './project-file-browser/AssistedCuration.vue'
import type { CachedSearchResults } from '~/composables/useIndexedDBCache'

type BrowserMode = 'hardcore' | 'assisted'

// Load saved mode from localStorage, default to 'hardcore'
const getSavedMode = (): BrowserMode => {
  if (typeof window === 'undefined') return 'hardcore'
  try {
    const saved = localStorage.getItem('contextmax-file-browser-mode')
    return (saved === 'assisted' || saved === 'hardcore') ? saved : 'hardcore'
  } catch {
    return 'hardcore'
  }
}

// State for the current mode
const currentMode = ref<BrowserMode>(getSavedMode())

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

// Store current search metadata for saving
const currentSearchMetadata = ref<{
  keyword: string
  entryPointFile?: string
} | null>(null)

// Get project store to access current folder name
const { selectedFolder } = useProjectStore()

// Initialize IndexedDB cache
const {
  initDB,
  storeSearchResults,
  generateSearchId,
  getSearchResultsByProject
} = useIndexedDBCache()

// Handle start assisted search event from context creation
const handleStartAssistedSearch = (event: CustomEvent) => {
  // Switch to assisted mode immediately
  currentMode.value = 'assisted'
  
  // The AssistedCuration component will handle showing the loading state
  // and the actual search will be performed by AddNewContext.vue asynchronously
}

// Initialize DB on component mount
onMounted(async () => {
  await initDB()
  
  // Listen for assisted search requests from context creation
  if (typeof window !== 'undefined') {
    window.addEventListener('startAssistedSearch', handleStartAssistedSearch)
  }
})

// Clean up event listeners on unmount
onUnmounted(() => {
  if (typeof window !== 'undefined') {
    window.removeEventListener('startAssistedSearch', handleStartAssistedSearch)
  }
})

// Computed property for search results count
const searchResultsCount = computed(() => searchResultsStore.value.length)

// Save search results to IndexedDB
const saveSearchResults = async (keyword: string, results: any[], entryPointFile?: string) => {
  if (!selectedFolder.value || results.length === 0) return

  const projectName = selectedFolder.value.name
  const searchId = generateSearchId(keyword, projectName)
  
  const searchData: CachedSearchResults = {
    id: searchId,
    keyword,
    projectName,
    results,
    timestamp: Date.now(),
    entryPointFile
  }

  try {
    await storeSearchResults(searchData)
    
    // Refresh search history in AssistedCuration component
    await refreshSearchHistory()
  } catch (error) {
    logger.warn('Failed to save search results:', error)
  }
}

// Provide global access to search results for communication between components
if (typeof window !== 'undefined') {
  (window as any).setAssistedSearchResults = async (results: any[], metadata?: { keyword: string; entryPointFile?: string }) => {
    searchResultsStore.value = results
    currentSearchMetadata.value = metadata || null
    
    // Auto-switch to assisted mode when search results arrive
    if (results.length > 0) {
      currentMode.value = 'assisted'
      
      // Save to IndexedDB if we have metadata
      if (metadata?.keyword) {
        await saveSearchResults(metadata.keyword, results, metadata.entryPointFile)
      }
    }
  }
  
  (window as any).clearAssistedSearchResults = () => {
    searchResultsStore.value = []
    currentSearchMetadata.value = null
  }
  
  (window as any).getAssistedSearchResults = () => {
    return searchResultsStore.value
  }
}

// Function to refresh search history (called from child components)
const refreshSearchHistory = async () => {
  // Emit event to refresh search history in AssistedCuration component
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('refreshSearchHistory'))
  }
}

// Add refresh function to window for child components to call
if (typeof window !== 'undefined') {
  (window as any).refreshSearchHistory = refreshSearchHistory
}

// Computed property for current search keyword
const currentSearchKeyword = computed(() => currentSearchMetadata.value?.keyword || '')

// Provide search results to child components
provide('searchResults', searchResultsStore)
provide('searchResultsCount', searchResultsCount)
provide('currentSearchKeyword', currentSearchKeyword)

const setMode = (mode: BrowserMode) => {
  currentMode.value = mode
  
  // Save to localStorage
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem('contextmax-file-browser-mode', mode)
    } catch (error) {
      logger.warn('Failed to save file browser mode to localStorage:', error)
    }
  }
}
</script>