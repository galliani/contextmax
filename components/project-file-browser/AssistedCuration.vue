<!--
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
-->
<template>
  <div class="content-spacing bg-surface-1 h-full flex flex-col">
    <!-- Header -->
    <div id="assisted-curation-header" class="p-4 border-b border-border">
      <div class="flex items-center justify-between mb-3">
        <div>
          <h4 class="text-sm font-medium text-foreground">AI-Curated Results</h4>
          <p class="text-xs text-muted-foreground">
            {{ searchResultsCount }} relevant files found
            <span v-if="searchResults.value && searchResults.value.length > searchResultsCount" class="text-muted-foreground">
              ({{ searchResults.value.length - searchResultsCount }} already in context)
            </span>
            <span v-if="currentSearchKeyword" class="ml-2 px-2 py-0.5 text-xs bg-primary/10 text-primary rounded border border-primary/20 font-mono">
              "{{ currentSearchKeyword }}"
            </span>
          </p>
        </div>
        <Button
          v-if="searchResultsCount > 0"
          @click="clearResults"
          variant="ghost"
          size="sm"
          class="text-xs"
        >
          <Icon name="lucide:x" class="w-3 h-3 mr-1" />
          Clear
        </Button>
      </div>

      <!-- Search Input -->
      <div class="mb-3">
        <form @submit.prevent="handleSearch" class="flex items-center space-x-2">
          <div class="flex-1 relative">
            <Input
              v-model="searchQuery"
              placeholder="Search for files using AI (e.g., authentication, user management, api routes)"
              class="pr-10"
              :disabled="isSearching"
              ref="searchInput"
            />
            <div class="absolute inset-y-0 right-0 flex items-center pr-3">
              <Icon 
                :name="isSearching ? 'lucide:loader-2' : 'lucide:search'"
                class="w-4 h-4 text-muted-foreground"
                :class="{ 'animate-spin': isSearching }"
              />
            </div>
          </div>
          <Button
            type="submit"
            size="sm"
            :disabled="!searchQuery.trim() || isSearching"
            class="px-3"
          >
            <Icon name="lucide:sparkles" class="w-3 h-3 mr-1" />
            Search
          </Button>
        </form>
      </div>

      <!-- Search History Badges -->
      <div v-if="searchHistory.length > 0" class="mb-3">
        <div class="flex items-center space-x-2 mb-2">
          <Icon name="lucide:history" class="w-3 h-3 text-muted-foreground" />
          <span class="text-xs font-medium text-muted-foreground">Recent Searches:</span>
        </div>
        <div class="flex flex-wrap gap-2">
          <div
            v-for="search in searchHistory.slice(0, 8)"
            :key="search.id"
            class="group relative flex items-center space-x-1 px-2 py-1 text-xs bg-secondary/30 hover:bg-secondary/50 text-secondary-foreground rounded border border-secondary/40 transition-colors cursor-pointer"
            @click="() => loadSearchResults(search.id)"
            :title="`Click to load search results for '${search.keyword}'`"
          >
            <Icon name="lucide:search" class="w-3 h-3 flex-shrink-0" />
            <span class="max-w-[80px] truncate font-mono">{{ search.keyword }}</span>
            <span v-if="search.entryPointFile" class="text-xs text-muted-foreground flex-shrink-0">
              📍
            </span>
            <span class="text-xs text-muted-foreground flex-shrink-0 px-1 py-0.5 bg-muted/50 rounded text-[10px] font-medium">
              {{ search.results.length }}
            </span>
            <div
              @click.stop="deleteSearch(search.id)"
              class="opacity-0 group-hover:opacity-100 ml-1 text-destructive hover:text-destructive-foreground transition-opacity cursor-pointer flex items-center justify-center w-4 h-4 flex-shrink-0"
              title="Delete this search"
              role="button"
              tabindex="0"
              @keydown.enter="deleteSearch(search.id)"
              @keydown.space.prevent="deleteSearch(search.id)"
            >
              <Icon name="lucide:x" class="w-3 h-3" />
            </div>
          </div>
        </div>
      </div>

      <!-- Bulk Actions -->
      <div v-if="searchResultsCount > 0" class="flex items-center space-x-2">
        <Button
          @click="addTopResults"
          variant="outline"
          size="sm"
          class="text-xs"
          :disabled="!activeContextSetName"
        >
          <Icon name="lucide:plus-circle" class="w-3 h-3 mr-1" />
          Add Top 5
        </Button>
        <Button
          @click="addAllResults"
          variant="outline"
          size="sm"
          class="text-xs"
          :disabled="!activeContextSetName"
        >
          <Icon name="lucide:download" class="w-3 h-3 mr-1" />
          Add All
        </Button>
      </div>
    </div>

    <!-- Results List -->
    <div class="flex-1 min-h-0 overflow-y-auto">
      <!-- Search Loading State -->
      <div v-if="isSearching" class="flex-1 flex items-center justify-center py-12">
        <div class="text-center max-w-md mx-auto">
          <div class="relative mb-4">
            <Icon name="lucide:sparkles" class="w-12 h-12 mx-auto text-primary animate-pulse" aria-hidden="true" />
            <div class="absolute -bottom-1 -right-1 w-4 h-4 bg-primary rounded-full flex items-center justify-center">
              <Icon name="lucide:loader-2" class="w-3 h-3 text-primary-foreground animate-spin" />
            </div>
          </div>
          <p class="visual-hierarchy-body mb-2 text-mobile-body sm:text-base font-medium text-foreground">
            AI Search in Progress
          </p>
          <p class="text-sm text-muted-foreground mb-4">
            {{ searchStage || 'Initializing search...' }}
          </p>
          
          <!-- Progress Indicator -->
          <div class="w-full max-w-xs mx-auto mb-4">
            <div class="w-full bg-secondary rounded-full h-2">
              <div 
                class="bg-primary h-2 rounded-full transition-all duration-300 ease-out"
                :style="{ width: `${searchProgress}%` }"
              ></div>
            </div>
            <div class="flex justify-between mt-2 text-xs text-muted-foreground">
              <span>{{ Math.round(searchProgress) }}%</span>
              <span>{{ searchStage ? 'Processing...' : 'Starting...' }}</span>
            </div>
          </div>
          
          <!-- Stage Details -->
          <div class="text-xs text-muted-foreground space-y-1">
            <div class="flex items-center justify-center space-x-2">
              <Icon 
                name="lucide:layers" 
                class="w-3 h-3"
                :class="searchProgress >= 20 ? 'text-success' : 'text-muted-foreground'"
              />
              <span :class="searchProgress >= 20 ? 'text-success font-medium' : ''">Structure Analysis</span>
            </div>
            <div class="flex items-center justify-center space-x-2">
              <Icon 
                name="lucide:brain" 
                class="w-3 h-3"
                :class="searchProgress >= 40 ? 'text-success' : 'text-muted-foreground'"
              />
              <span :class="searchProgress >= 40 ? 'text-success font-medium' : ''">Semantic Analysis</span>
            </div>
            <div class="flex items-center justify-center space-x-2">
              <Icon 
                name="lucide:network" 
                class="w-3 h-3"
                :class="searchProgress >= 60 ? 'text-success' : 'text-muted-foreground'"
              />
              <span :class="searchProgress >= 60 ? 'text-success font-medium' : ''">Relationship Analysis</span>
            </div>
            <div class="flex items-center justify-center space-x-2">
              <Icon 
                name="lucide:robot" 
                class="w-3 h-3"
                :class="searchProgress >= 80 ? 'text-success' : 'text-muted-foreground'"
              />
              <span :class="searchProgress >= 80 ? 'text-success font-medium' : ''">AI Classification</span>
            </div>
            <div class="flex items-center justify-center space-x-2">
              <Icon 
                name="lucide:zap" 
                class="w-3 h-3"
                :class="searchProgress >= 95 ? 'text-success' : 'text-muted-foreground'"
              />
              <span :class="searchProgress >= 95 ? 'text-success font-medium' : ''">Final Results</span>
            </div>
          </div>
        </div>
      </div>
      
      <!-- Empty State -->
      <div v-else-if="searchResultsCount === 0" class="flex-1 flex items-center justify-center py-12">
        <div class="text-center max-w-sm mx-auto">
          <Icon name="lucide:sparkles" class="w-12 h-12 mx-auto mb-4 text-muted-foreground opacity-50" aria-hidden="true" />
          <p class="visual-hierarchy-body mb-2 text-mobile-body sm:text-base">No Search Results</p>
          <p class="visual-hierarchy-caption opacity-75 text-mobile-caption sm:text-sm mb-4">
            Create a new context set to get AI-curated file suggestions
          </p>
        </div>
      </div>

      <!-- Search Results -->
      <div v-else class="space-y-3 p-4">
        <div
          v-for="(result, index) in filteredSearchResults"
          :key="result.file"
          class="group relative bg-card rounded-lg border-b px-0 py-4 transition-all duration-200 hover:shadow-elegant"
        >
          <!-- File Info -->
          <div class="flex items-start justify-between">
            <div class="flex-1 min-w-0">
              <!-- File Header -->
              <div class="flex items-center space-x-2 mb-2">
                <Icon 
                  :name="getFileIcon(result.file)" 
                  class="w-4 h-4 flex-shrink-0"
                  :class="getFileIconColor(result.file)"
                  aria-hidden="true"
                />
                <h4 class="text-sm font-medium text-foreground truncate">
                  {{ getFileName(result.file) }}
                </h4>
                <span 
                  v-if="getFileExtension(result.file)"
                  class="px-2 py-0.5 text-xs font-mono rounded-full border"
                  :class="getExtensionBadgeClasses(getFileExtension(result.file))"
                >
                  {{ getFileExtension(result.file) }}
                </span>
              </div>

              <!-- File Path -->
              <p class="text-xs text-muted-foreground font-mono mb-3 truncate">
                {{ result.file }}
              </p>
              
              <!-- AI Score and Classification -->
              <div class="mb-3 p-2 bg-primary/5 rounded border border-primary/20">
                <div class="flex items-center justify-between mb-2">
                  <div class="flex items-center space-x-3">
                    <div class="flex items-center space-x-2">
                      <span class="font-mono text-sm font-semibold text-primary">{{ result.scorePercentage }}%</span>
                      <div class="text-xs text-muted-foreground">
                        AI Score
                      </div>
                    </div>
                    <div v-if="result.classification" class="flex items-center space-x-1">
                      <span class="text-xs px-2 py-1 rounded-full font-medium"
                            :class="getClassificationBadgeClasses(result.classification)">
                        {{ result.classification }}
                      </span>
                    </div>
                  </div>
                  <div v-if="result.workflowPosition && result.workflowPosition !== 'unknown' && result.workflowPosition !== 'unrelated'" 
                       class="text-xs text-muted-foreground">
                    {{ result.workflowPosition }}
                  </div>
                </div>
                
                <!-- Detailed Score Breakdown -->
                <div class="grid grid-cols-4 gap-2 text-xs">
                  <div class="text-center">
                    <div class="font-medium text-muted-foreground">Structure</div>
                    <div class="font-mono text-sm">{{ Math.round(result.astScore * 100) }}%</div>
                  </div>
                  <div class="text-center">
                    <div class="font-medium text-muted-foreground">Semantic</div>
                    <div class="font-mono text-sm">{{ Math.round(result.llmScore * 100) }}%</div>
                  </div>
                  <div class="text-center">
                    <div class="font-medium text-muted-foreground">Syntax</div>
                    <div class="font-mono text-sm">{{ Math.round(result.syntaxScore * 100) }}%</div>
                  </div>
                  <div class="text-center">
                    <div class="font-medium text-muted-foreground">AI Class</div>
                    <div class="font-mono text-sm">{{ Math.round(result.flanScore * 100) }}%</div>
                  </div>
                </div>
                
                <!-- Synergy Indicator -->
                <div v-if="result.hasSynergy" class="mt-2 flex items-center text-xs text-emerald-600 dark:text-emerald-400">
                  <Icon name="lucide:zap" class="w-3 h-3 mr-1" />
                  Multi-model synergy detected
                </div>
              </div>

              <!-- Relevant Functions -->
              <div v-if="result.relevantFunctions && result.relevantFunctions.length > 0" class="mb-3">
                <p class="text-xs font-medium text-foreground mb-1">
                  <Icon name="lucide:function-square" class="w-3 h-3 inline-block mr-1" />
                  AI-Identified Relevant Functions:
                </p>
                <div class="flex flex-wrap gap-1">
                  <div
                    v-for="(func, funcIndex) in getUniqueRelevantFunctions(result.relevantFunctions)"
                    :key="funcIndex"
                    class="group relative"
                  >
                    <div class="flex items-center space-x-1 px-2 py-1 text-xs bg-primary/10 text-primary rounded border border-primary/20">
                      <span class="font-mono">{{ func.name }}</span>
                      <span class="text-primary/60">
                        ({{ Math.round(func.relevance * 100) }}%)
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <!-- Actions -->
            <div class="flex items-center space-x-1 ml-4">
              <!-- View File -->
              <Button
                @click="viewFile(result.file)"
                variant="outline"
                size="sm"
                class="h-8 px-2 text-xs border-border/50 hover:border-border hover:bg-accent/50"
                :aria-label="`View content of ${getFileName(result.file)}`"
                title="View file content"
              >
                <Icon name="lucide:eye" class="w-3 h-3 mr-1" aria-hidden="true" />
                View
              </Button>

              <!-- Add to Context Set -->
              <Button
                v-if="!isFileInContext(result.file)"
                @click="addFileToContext(result)"
                variant="outline"
                size="sm"
                class="h-8 px-2 text-xs border-primary/30 text-primary hover:border-primary hover:bg-primary/10"
                :disabled="!activeContextSetName"
                :aria-label="`Add ${getFileName(result.file)} to context set`"
                title="Add to context set"
              >
                <Icon name="lucide:plus" class="w-3 h-3 mr-1" aria-hidden="true" />
                Add
              </Button>
              
              <!-- Already Added State -->
              <Button
                v-else
                variant="outline"
                size="sm"
                class="h-8 px-2 text-xs border-success/30 text-success cursor-default"
                disabled
                :aria-label="`${getFileName(result.file)} is already in context set`"
                title="Already in context set"
              >
                <Icon name="lucide:check" class="w-3 h-3 mr-1" aria-hidden="true" />
                Added
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { logger } from '~/utils/logger'
import type { FileTreeItem } from '~/composables/useProjectStore'
import type { CachedSearchResults } from '~/composables/useIndexedDBCache'
import { Input } from '@/components/ui/input'

const {
  fileTree,
  activeContextSetName,
  activeContextSet,
  addFileToActiveContextSet,
  loadFileContent,
  selectedFolder,
  filesManifest,
  findFileIdByPath
} = useProjectStore()

const { announceStatus, announceError } = useAccessibility()

// Import smart suggestions composable for search
const { performTriModelSearch } = useSmartContextSuggestions()

// Initialize IndexedDB cache
const {
  initDB,
  getSearchResultsByProject,
  getSearchResultsById,
  deleteSearchResults
} = useIndexedDBCache()

// Inject search results from parent component
const searchResults = inject('searchResults', ref([]))
const currentSearchKeyword = inject('currentSearchKeyword', ref(''))

// Filter out files that are already in the context set
const filteredSearchResults = computed(() => {
  if (!searchResults.value || !Array.isArray(searchResults.value)) {
    return []
  }
  return searchResults.value.filter(result => !isFileInContext(result.file))
})

// Update search results count to reflect filtered results
const searchResultsCount = computed(() => filteredSearchResults.value.length)

// Local state for search history
const searchHistory = ref<CachedSearchResults[]>([])

// Search state
const searchQuery = ref('')
const isSearching = ref(false)
const searchStage = ref('')
const searchProgress = ref(0)
const searchInput = ref<HTMLInputElement>()

// Load search history on component mount
onMounted(async () => {
  await initDB()
  await loadSearchHistory()
  
  // Listen for search history refresh events
  if (typeof window !== 'undefined') {
    window.addEventListener('refreshSearchHistory', loadSearchHistory)
    
    // Listen for search requests from context creation
    window.addEventListener('startAssistedSearch', handleIncomingSearch)
    window.addEventListener('assistedSearchCompleted', handleSearchCompleted)
    window.addEventListener('assistedSearchFailed', handleSearchFailed)
  }
})

// Clean up event listener on unmount
onUnmounted(() => {
  if (typeof window !== 'undefined') {
    window.removeEventListener('refreshSearchHistory', loadSearchHistory)
    window.removeEventListener('startAssistedSearch', handleIncomingSearch)
    window.removeEventListener('assistedSearchCompleted', handleSearchCompleted)
    window.removeEventListener('assistedSearchFailed', handleSearchFailed)
  }
})

// Load search history for current project
const loadSearchHistory = async () => {
  if (!selectedFolder.value) return
  
  try {
    const history = await getSearchResultsByProject(selectedFolder.value.name)
    searchHistory.value = history
  } catch (error) {
    logger.warn('Failed to load search history:', error)
  }
}

// Watch for project changes to reload search history
watch(selectedFolder, async () => {
  if (selectedFolder.value) {
    await loadSearchHistory()
  }
})

// Helper functions for file handling
const getFileName = (filePath: string): string => {
  return filePath.split('/').pop() || filePath
}

const getFileExtension = (filePath: string): string => {
  const fileName = getFileName(filePath)
  const ext = fileName.split('.').pop()?.toLowerCase()
  return ext || ''
}

const getFileIcon = (filePath: string): string => {
  const extension = getFileExtension(filePath)
  
  const iconMap: Record<string, string> = {
    'vue': 'lucide:file-code',
    'js': 'lucide:file-code',
    'ts': 'lucide:file-code',
    'jsx': 'lucide:file-code',
    'tsx': 'lucide:file-code',
    'html': 'lucide:globe',
    'css': 'lucide:palette',
    'json': 'lucide:braces',
    'md': 'lucide:file-text',
    'py': 'lucide:file-code',
    'rb': 'lucide:file-code',
    'php': 'lucide:file-code',
    'go': 'lucide:file-code'
  }
  
  return iconMap[extension] || 'lucide:file'
}

const getFileIconColor = (filePath: string): string => {
  const extension = getFileExtension(filePath)
  
  const colorMap: Record<string, string> = {
    'vue': 'text-green-500',
    'js': 'text-yellow-500',
    'ts': 'text-blue-500',
    'jsx': 'text-cyan-500',
    'tsx': 'text-cyan-600',
    'html': 'text-orange-500',
    'css': 'text-blue-400',
    'json': 'text-amber-500',
    'md': 'text-gray-600 dark:text-gray-300',
    'py': 'text-yellow-600',
    'rb': 'text-red-600',
    'php': 'text-indigo-600',
    'go': 'text-cyan-600'
  }
  
  return colorMap[extension] || 'text-muted-foreground'
}

const getExtensionBadgeClasses = (extension: string): string => {
  const colorMap: Record<string, string> = {
    'vue': 'bg-green-50 text-green-700 border-green-200 dark:bg-green-950 dark:text-green-300 dark:border-green-800',
    'js': 'bg-yellow-50 text-yellow-700 border-yellow-200 dark:bg-yellow-950 dark:text-yellow-300 dark:border-yellow-800',
    'ts': 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-800',
    'css': 'bg-blue-50 text-blue-600 border-blue-200 dark:bg-blue-950 dark:text-blue-400 dark:border-blue-800',
    'json': 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-800'
  }
  
  return colorMap[extension] || 'bg-muted/50 text-muted-foreground border-muted'
}

const getClassificationBadgeClasses = (classification: string): string => {
  const classMap: Record<string, string> = {
    'entry-point': 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300',
    'core-logic': 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300',
    'helper': 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300',
    'config': 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300',
    'unrelated': 'bg-gray-100 text-gray-700 dark:bg-gray-900 dark:text-gray-300',
    'unknown': 'bg-gray-100 text-gray-700 dark:bg-gray-900 dark:text-gray-300'
  }
  
  return classMap[classification] || 'bg-gray-100 text-gray-700 dark:bg-gray-900 dark:text-gray-300'
}

// Deduplicate relevant functions, keeping only the highest relevance score for each function name
const getUniqueRelevantFunctions = (functions: any[]): any[] => {
  if (!functions || !Array.isArray(functions)) return []
  
  const functionMap = new Map<string, any>()
  
  for (const func of functions) {
    const existing = functionMap.get(func.name)
    
    // If no existing function with this name, or this one has higher relevance, keep it
    if (!existing || func.relevance > existing.relevance) {
      functionMap.set(func.name, func)
    }
  }
  
  // Return as array, sorted by relevance (highest first)
  return Array.from(functionMap.values()).sort((a, b) => b.relevance - a.relevance)
}

// Helper function to find a FileTreeItem by path in the file tree
const findFileInTree = (tree: any[], targetPath: string): any | null => {
  for (const item of tree) {
    if (item.path === targetPath && item.type === 'file') {
      return item
    }
    if (item.children) {
      const found = findFileInTree(item.children, targetPath)
      if (found) return found
    }
  }
  return null
}

// Check if file is already in the active context set
const isFileInContext = (filePath: string): boolean => {
  if (!activeContextSet.value) return false
  
  // Find the file ID for this path
  const fileId = findFileIdByPath(filePath)
  if (!fileId) return false
  
  // Check if this file ID is in the context set
  return activeContextSet.value.files.some(fileEntry => {
    const entryId = typeof fileEntry === 'string' 
      ? fileEntry 
      : fileEntry.fileRef
    return entryId === fileId
  })
}

// Actions
const viewFile = async (filePath: string) => {
  const fileName = getFileName(filePath)
  
  // Find the actual FileTreeItem in the file tree to get the handle
  const fileItem = findFileInTree(fileTree.value, filePath)
  
  if (!fileItem) {
    announceError(`Could not find file in project tree: ${fileName}`)
    logger.error('File not found in tree:', filePath)
    return
  }
  
  try {
    // Use the store's loadFileContent function which opens the modal
    await loadFileContent(fileItem)
    announceStatus(`Opened file viewer for: ${fileName}`)
  } catch (error) {
    announceError(`Failed to load file content: ${fileName}`)
    logger.error('Error loading file content:', error)
  }
}

const addFileToContext = async (result: any) => {
  if (!activeContextSetName.value) {
    announceError('No active context set selected')
    return
  }

  const fileName = getFileName(result.file)
  const fileItem = findFileInTree(fileTree.value, result.file)
  
  if (!fileItem) {
    announceError(`Could not find file in project tree: ${fileName}`)
    return
  }

  try {
    // Prepare function refs from relevant functions (deduplicated and filtered)
    const uniqueFunctions = getUniqueRelevantFunctions(result.relevantFunctions || [])
    const functionRefs = uniqueFunctions
      .filter((func: any) => func.relevance >= 0.3) // Include functions with 30%+ relevance
      .map((func: any) => ({
        name: func.name,
        comment: func.reason || `AI relevance: ${Math.round(func.relevance * 100)}%`
      }))
    
    
    const success = addFileToActiveContextSet(fileItem, {
      classification: result.classification,
      functionRefs: functionRefs.length > 0 ? functionRefs : undefined
    })
    
    if (success) {
      const funcText = functionRefs && functionRefs.length > 0 
        ? ` with ${functionRefs.length} relevant function${functionRefs.length > 1 ? 's' : ''}`
        : ''
      announceStatus(`Added ${fileName} to ${activeContextSetName.value}${funcText}`)
    } else {
      announceStatus(`${fileName} is already in ${activeContextSetName.value}`)
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to add file'
    announceError(message)
  }
}

const addTopResults = async () => {
  if (!activeContextSetName.value) {
    announceError('No active context set selected')
    return
  }

  const topResults = filteredSearchResults.value.slice(0, 5)
  let addedCount = 0
  
  for (const result of topResults) {
    if (!isFileInContext(result.file)) {
      const fileItem = findFileInTree(fileTree.value, result.file)
      if (fileItem) {
        try {
          // Prepare function refs from relevant functions (deduplicated and filtered)
          const uniqueFunctions = getUniqueRelevantFunctions(result.relevantFunctions || [])
          const functionRefs = uniqueFunctions
            .filter((func: any) => func.relevance >= 0.3)
            .map((func: any) => ({
              name: func.name,
              comment: func.reason || `AI relevance: ${Math.round(func.relevance * 100)}%`
            }))
          
          const success = addFileToActiveContextSet(fileItem, {
            classification: result.classification,
            functionRefs: functionRefs.length > 0 ? functionRefs : undefined
          })
          if (success) addedCount++
        } catch (error) {
          logger.warn(`Failed to add ${result.file}:`, error)
        }
      }
    }
  }
  
  const filesWithFunctions = topResults.filter(r => {
    const uniqueFunctions = getUniqueRelevantFunctions(r.relevantFunctions || [])
    return uniqueFunctions.some((f: any) => f.relevance >= 0.3)
  }).length
  const funcText = filesWithFunctions > 0 ? ` (${filesWithFunctions} with AI-selected functions)` : ''
  announceStatus(`Added ${addedCount} files to ${activeContextSetName.value}${funcText}`)
}

const addAllResults = async () => {
  if (!activeContextSetName.value) {
    announceError('No active context set selected')
    return
  }

  let addedCount = 0
  
  for (const result of filteredSearchResults.value) {
    if (!isFileInContext(result.file)) {
      const fileItem = findFileInTree(fileTree.value, result.file)
      if (fileItem) {
        try {
          // Prepare function refs from relevant functions (deduplicated and filtered)
          const uniqueFunctions = getUniqueRelevantFunctions(result.relevantFunctions || [])
          const functionRefs = uniqueFunctions
            .filter((func: any) => func.relevance >= 0.3)
            .map((func: any) => ({
              name: func.name,
              comment: func.reason || `AI relevance: ${Math.round(func.relevance * 100)}%`
            }))
          
          const success = addFileToActiveContextSet(fileItem, {
            classification: result.classification,
            functionRefs: functionRefs.length > 0 ? functionRefs : undefined
          })
          if (success) addedCount++
        } catch (error) {
          logger.warn(`Failed to add ${result.file}:`, error)
        }
      }
    }
  }
  
  const filesWithFunctions = filteredSearchResults.value.filter((r: any) => {
    const uniqueFunctions = getUniqueRelevantFunctions(r.relevantFunctions || [])
    return uniqueFunctions.some((f: any) => f.relevance >= 0.3)
  }).length
  const funcText = filesWithFunctions > 0 ? ` (${filesWithFunctions} with AI-selected functions)` : ''
  announceStatus(`Added ${addedCount} files to ${activeContextSetName.value}${funcText}`)
}

// Load search results from history
const loadSearchResults = async (searchId: string) => {
  try {
    
    if (!getSearchResultsById || typeof getSearchResultsById !== 'function') {
      throw new Error('getSearchResultsById is not available')
    }
    
    const cachedSearch = await getSearchResultsById(searchId)
    
    if (cachedSearch) {
      // Restore search results to the global store
      if (typeof window !== 'undefined' && (window as any).setAssistedSearchResults) {
        const metadata = {
          keyword: cachedSearch.keyword,
          entryPointFile: cachedSearch.entryPointFile
        }
        await (window as any).setAssistedSearchResults(cachedSearch.results, metadata)
      }
      announceStatus(`Loaded search results for "${cachedSearch.keyword}"`)
    } else {
      announceError('Search results not found')
    }
  } catch (error) {
    logger.error('Failed to load search results:', error)
    announceError('Failed to load search results')
  }
}

// Delete search from history
const deleteSearch = async (searchId: string) => {
  try {
    const success = await deleteSearchResults(searchId)
    if (success) {
      // Remove from local history
      searchHistory.value = searchHistory.value.filter(search => search.id !== searchId)
      announceStatus('Search deleted from history')
    } else {
      announceError('Failed to delete search from history')
    }
  } catch (error) {
    logger.warn('Failed to delete search:', error)
    announceError('Failed to delete search from history')
  }
}

const clearResults = () => {
  if (typeof window !== 'undefined' && (window as any).clearAssistedSearchResults) {
    (window as any).clearAssistedSearchResults()
  }
  announceStatus('Cleared search results')
}

// Helper function to get all files from tree (reused from AddNewContext.vue)
const getAllFilesFromTree = (tree: FileTreeItem[]): FileTreeItem[] => {
  const files: FileTreeItem[] = []
  
  const traverse = (items: FileTreeItem[]) => {
    if (!Array.isArray(items)) return
    
    for (const item of items) {
      if (item?.type === 'file') {
        files.push(item)
      } else if (item?.children && Array.isArray(item.children)) {
        traverse(item.children)
      }
    }
  }
  
  traverse(tree)
  return files
}

// Handle incoming search from context creation
const handleIncomingSearch = (event: CustomEvent) => {
  const { keyword, contextSetName, startingPointFile } = event.detail
  
  // Show loading state immediately
  isSearching.value = true
  searchQuery.value = keyword
  searchStage.value = 'Initializing search from context creation...'
  searchProgress.value = 0
  
  // Announce the search is starting
  announceStatus(`Starting AI search for context set "${contextSetName}"...`)
}

// Handle search completion
const handleSearchCompleted = (event: CustomEvent) => {
  const { keyword, contextSetName, resultCount } = event.detail
  
  // Reset search state
  isSearching.value = false
  searchStage.value = ''
  searchProgress.value = 0
  
  // Clear search input
  searchQuery.value = ''
  
  // Announce completion
  announceStatus(`Search completed for "${contextSetName}": ${resultCount} files found`)
}

// Handle search failure
const handleSearchFailed = (event: CustomEvent) => {
  const { keyword, contextSetName, error } = event.detail
  
  // Reset search state
  isSearching.value = false
  searchStage.value = ''
  searchProgress.value = 0
  
  // Clear search input
  searchQuery.value = ''
  
  // Announce failure
  announceError(`Search failed for "${contextSetName}": ${error}`)
}

// Handle search form submission
const handleSearch = async () => {
  const term = searchQuery.value.trim()
  
  if (!term) {
    announceError('Please enter a search term')
    return
  }

  if (!selectedFolder.value) {
    announceError('No project selected')
    return
  }

  try {
    isSearching.value = true
    searchStage.value = 'Preparing files for analysis...'
    searchProgress.value = 5
    announceStatus(`Searching for "${term}"...`)
    
    // Get all files from the file tree
    const allFiles = getAllFilesFromTree(fileTree.value || [])
    const filesToSearch: Array<{ path: string; content: string }> = []
    
    // Load file contents for search
    searchStage.value = `Loading file contents (${allFiles.length} files)...`
    searchProgress.value = 10
    
    for (const file of allFiles) {
      try {
        if (file.handle && file.type === 'file') {
          const fileHandle = file.handle as FileSystemFileHandle
          const fileObj = await fileHandle.getFile()
          const content = await fileObj.text()
          
          filesToSearch.push({
            path: file.path,
            content: content
          })
        }
      } catch (error) {
        logger.warn(`Failed to load content for search: ${file.path}:`, error)
      }
    }
    
    searchStage.value = 'Starting tri-model AI analysis...'
    searchProgress.value = 15
    
    // Create progress tracking wrapper
    const progressTracker = {
      onEmbeddingGeneration: () => {
        searchStage.value = 'Generating semantic embeddings...'
        searchProgress.value = 25
      },
      onStructureAnalysis: () => {
        searchStage.value = 'Analyzing code structure and patterns...'
        searchProgress.value = 35
      },
      onSemanticAnalysis: () => {
        searchStage.value = 'Performing semantic similarity analysis...'
        searchProgress.value = 50
      },
      onRelationshipAnalysis: () => {
        searchStage.value = 'Analyzing inter-file relationships...'
        searchProgress.value = 65
      },
      onAIClassification: () => {
        searchStage.value = 'AI classification and function analysis...'
        searchProgress.value = 80
      },
      onCombiningResults: () => {
        searchStage.value = 'Combining tri-model results...'
        searchProgress.value = 90
      },
      onFinalizing: () => {
        searchStage.value = 'Finalizing search results...'
        searchProgress.value = 95
      }
    }
    
    // Monkey-patch console.log temporarily to track progress
    const originalConsoleLog = console.log
    console.log = (...args) => {
      const message = args.join(' ')
      if (message.includes('📊 Generating embeddings for tri-model search')) {
        progressTracker.onEmbeddingGeneration()
      } else if (message.includes('🕵️ Stage 1: Structure Analysis')) {
        progressTracker.onStructureAnalysis()
      } else if (message.includes('🧠 Stage 2: Semantic Analysis')) {
        progressTracker.onSemanticAnalysis()
      } else if (message.includes('📊 Stage 3: Enhanced Relationship Analysis')) {
        progressTracker.onRelationshipAnalysis()
      } else if (message.includes('🤖 Stage 4: AI Classification')) {
        progressTracker.onAIClassification()
      } else if (message.includes('⚡ Stage 5: Combining tri-model results')) {
        progressTracker.onCombiningResults()
      } else if (message.includes('🎯 Final tri-model results')) {
        progressTracker.onFinalizing()
      }
      originalConsoleLog(...args)
    }
    
    try {
      // Perform the tri-model search
      const searchResults = await performTriModelSearch(term, filesToSearch)
      
      // Restore original console.log
      console.log = originalConsoleLog
      
      return searchResults
    } catch (error) {
      // Restore original console.log on error
      console.log = originalConsoleLog
      throw error
    }
    
    // Prepare search results for display
    searchStage.value = 'Preparing results for display...'
    searchProgress.value = 98
    
    const assistedResults = []
    
    // Add search results
    for (const result of searchResults.data.files) {
      assistedResults.push({
        file: result.file,
        scorePercentage: result.scorePercentage,
        finalScore: result.finalScore,
        astScore: result.astScore,
        llmScore: result.llmScore,
        flanScore: result.flanScore,
        syntaxScore: result.syntaxScore,
        hasSynergy: result.hasSynergy,
        matches: result.matches || [],
        classification: result.classification,
        workflowPosition: result.workflowPosition,
        relevantFunctions: result.relevantFunctions
      })
    }
    
    // Send search results to the global store with metadata
    if (typeof window !== 'undefined' && (window as any).setAssistedSearchResults) {
      const metadata = {
        keyword: term
      }
      await (window as any).setAssistedSearchResults(assistedResults, metadata)
    }
    
    searchStage.value = 'Search completed successfully!'
    searchProgress.value = 100
    
    // Brief delay to show completion
    await new Promise(resolve => setTimeout(resolve, 500))
    
    const resultCount = assistedResults.length
    announceStatus(`Found ${resultCount} relevant files for "${term}"`)
    
    // Clear search input after successful search
    searchQuery.value = ''
    
  } catch (error) {
    logger.error('Search failed:', error)
    searchStage.value = 'Search failed - please try again'
    searchProgress.value = 0
    announceError('Search failed. Please try again.')
  } finally {
    // Reset search state after a brief delay
    setTimeout(() => {
      isSearching.value = false
      searchStage.value = ''
      searchProgress.value = 0
    }, 1000)
  }
}
</script>