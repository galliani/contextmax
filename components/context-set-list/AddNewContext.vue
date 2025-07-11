<!--
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
-->
<template>
  <!-- Create Context Set Modal -->
  <Dialog v-model:open="isOpen">
    <DialogContent class="sm:max-w-md">
      <DialogHeader>
        <DialogTitle>Create New Context Set</DialogTitle>
        <DialogDescription>
          Enter a search phrase and optionally specify where the flow starts from to get more accurate results.
        </DialogDescription>
      </DialogHeader>
      
      <form @submit.prevent="handleCreateContextSet" class="space-y-4">
        <div class="space-y-2">
          <label for="search-term" class="text-sm font-medium text-foreground">
            Search Term *
          </label>
          <Input
            id="search-term"
            v-model="searchTerm"
            placeholder="e.g., authentication system, user management, billing api"
            required
            :aria-invalid="!!(createError || searchTermError)"
            :aria-describedby="(createError || searchTermError) ? 'validation-error' : 'validation-help'"
            class="w-full"
            :class="{
              'border-destructive focus:ring-destructive': !!(createError || searchTermError),
              'border-success focus:ring-success': searchTerm && !searchTermError && !createError
            }"
            ref="searchInput"
          />
          
          <!-- Validation Help Text -->
          <p id="validation-help" class="text-xs text-muted-foreground">
            Use natural language with spaces. The context name will be generated automatically.
          </p>
          
          <!-- Generated Context Name Preview -->
          <p v-if="generatedContextName" class="text-xs text-muted-foreground">
            Context name: <span class="font-mono font-medium">{{ generatedContextName }}</span>
          </p>
          
          <!-- Real-time Validation Error -->
          <p v-if="searchTermError" id="validation-error" class="text-sm text-destructive flex items-start gap-2" role="alert">
            <Icon name="lucide:alert-circle" class="w-4 h-4 flex-shrink-0 mt-0.5" />
            {{ searchTermError }}
          </p>
          
          <!-- Form Submission Error -->
          <p v-else-if="createError" id="validation-error" class="text-sm text-destructive flex items-start gap-2" role="alert">
            <Icon name="lucide:alert-circle" class="w-4 h-4 flex-shrink-0 mt-0.5" />
            {{ createError }}
          </p>
        </div>

        <!-- Do you know where to start? (Optional) -->
        <div class="space-y-2">
          <label class="text-sm font-medium text-foreground">
            Do you know where to start? (Optional)
          </label>
          
          <!-- Start Point Help Text -->
          <p class="text-xs text-muted-foreground">
            If you know which file contains the starting point (e.g., a button, API endpoint, or component), select it here to help the search find more relevant files. This is only used to improve search results.
          </p>
          
          <!-- File Search -->
          <div class="border rounded-md p-3 bg-muted/30">
            <Search 
              :files="fileTree"
              v-model="entryPointSearchTerm"
              @search-results="onEntryPointSearchResults"
              ref="entryPointSearch"
            />
            
            <!-- Search Results for Entry Point Selection -->
            <div v-if="entryPointSearchResults.length > 0 && entryPointSearchTerm" class="mt-3 space-y-2 max-h-48 overflow-y-auto">
              <div class="text-xs font-medium text-muted-foreground mb-2">
                Click to select starting file:
              </div>
              <div
                v-for="file in flattenedEntryPointFiles.slice(0, 10)"
                :key="file.path"
                class="flex items-center justify-between p-2 rounded border cursor-pointer transition-colors"
                :class="{
                  'bg-primary/10 border-primary': selectedEntryPoint?.path === file.path,
                  'hover:bg-muted border-border': selectedEntryPoint?.path !== file.path
                }"
                @click="selectEntryPointFile(file)"
              >
                <div class="flex items-center space-x-2 min-w-0">
                  <Icon name="lucide:file" class="w-4 h-4 text-muted-foreground flex-shrink-0" />
                  <span class="font-mono text-sm truncate">{{ file.path }}</span>
                </div>
                <div v-if="selectedEntryPoint?.path === file.path" class="flex-shrink-0">
                  <Icon name="lucide:check" class="w-4 h-4 text-primary" />
                </div>
              </div>
            </div>
          </div>
          
          <!-- Selected Start Point Preview -->
          <div v-if="selectedEntryPoint" class="flex items-center justify-between p-2 bg-emerald-50 dark:bg-emerald-950 rounded border border-emerald-200 dark:border-emerald-800">
            <div class="flex items-center space-x-2">
              <Icon name="lucide:map-pin" class="w-4 h-4 text-emerald-600" />
              <span class="text-sm text-emerald-700 dark:text-emerald-300">Starting from:</span>
              <span class="font-mono text-sm font-medium text-emerald-800 dark:text-emerald-200">{{ selectedEntryPoint.path }}</span>
            </div>
            <button 
              @click="clearEntryPoint"
              class="text-emerald-600 hover:text-emerald-800 dark:text-emerald-400 dark:hover:text-emerald-200"
              title="Clear starting point"
            >
              <Icon name="lucide:x" class="w-4 h-4" />
            </button>
          </div>
        </div>

        <div class="flex justify-end space-x-3">
          <Button type="button" variant="outline" @click="cancelCreate">
            Cancel
          </Button>
          <Button 
            id="submit-new-context"
            type="submit" 
            :disabled="!isFormValid || isCreating"
            :class="{ 'opacity-50 cursor-not-allowed': !isFormValid || isCreating }"
          >
            <Icon 
              :name="isCreating ? 'lucide:loader-2' : 'lucide:plus'" 
              class="w-4 h-4 mr-2"
              :class="{ 'animate-spin': isCreating }"
            />
            {{ isCreating ? 'Creating...' : 'Create Context Set' }}
          </Button>
        </div>
      </form>
    </DialogContent>
  </Dialog>
</template>

<script setup lang="ts">
import { logger } from '~/utils/logger'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import Search from '@/components/project-file-browser/Search.vue'

interface Props {
  open: boolean
}

interface Emits {
  (e: 'update:open', value: boolean): void
  (e: 'created', contextSetName: string): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

const {
  contextSetNames,
  createContextSet,
  setActiveContextSet,
  fileTree,
  addFileToActiveContextSet
} = useProjectStore()

const { announceStatus, announceError } = useAccessibility()

// Use the filtered file system utilities
const { buildFilteredFileTree } = useFileSystem()

// Import smart suggestions composable for search
const { performTriModelSearch } = useSmartContextSuggestions()

// Local state
const searchTerm = ref('')
const entryPointSearchTerm = ref('')
const entryPointSearchResults = ref<FileTreeItem[]>([])
const selectedEntryPoint = ref<FileTreeItem | null>(null)
const createError = ref('')
const searchInput = ref<HTMLInputElement>()
const entryPointSearch = ref()
const isSearching = ref(false)
const isCreating = ref(false) // Track if we're in the creation process

// Computed properties
const isOpen = computed({
  get: () => props.open,
  set: (value: boolean) => emit('update:open', value)
})

// Helper function to convert search term to camelCase
const toCamelCase = (str: string): string => {
  return str
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '') // Remove special characters
    .split(/\s+/) // Split by spaces
    .filter(word => word.length > 0) // Remove empty strings
    .map((word, index) => {
      if (index === 0) return word
      return word.charAt(0).toUpperCase() + word.slice(1)
    })
    .join('')
}

// Validation functions
const validateSearchTerm = (term: string): string | null => {
  const trimmedTerm = term.trim()
  
  // Check if empty
  if (!trimmedTerm) {
    return 'Search term is required'
  }
  
  // Check minimum length
  if (trimmedTerm.length < 2) {
    return 'Search term must be at least 2 characters'
  }
  
  return null
}

const validateGeneratedName = (name: string): string | null => {
  // Check if name already exists
  if (contextSetNames.value.includes(name)) {
    return `A context set named "${name}" already exists`
  }
  
  return null
}

// Computed properties for generated name and validation
const generatedContextName = computed(() => {
  if (!searchTerm.value.trim()) return ''
  return toCamelCase(searchTerm.value)
})

// Real-time validation
const searchTermError = computed(() => {
  // Don't validate while creating to avoid false positives
  if (!searchTerm.value || isCreating.value) return null
  
  const termError = validateSearchTerm(searchTerm.value)
  if (termError) return termError
  
  // Also check if the generated name would be valid
  if (generatedContextName.value) {
    return validateGeneratedName(generatedContextName.value)
  }
  
  return null
})

const isFormValid = computed(() => {
  return searchTerm.value.trim() && !searchTermError.value && generatedContextName.value
})

// Flatten search results for entry point selection
const flattenedEntryPointFiles = computed(() => {
  const flatten = (files: FileTreeItem[]): FileTreeItem[] => {
    const result: FileTreeItem[] = []
    for (const file of files) {
      if (file.type === 'file') {
        result.push(file)
      } else if (file.children) {
        result.push(...flatten(file.children))
      }
    }
    return result
  }
  
  return flatten(entryPointSearchResults.value)
})

// Actions
const handleCreateContextSet = async () => {
  const term = searchTerm.value.trim()
  const name = generatedContextName.value
  
  // Validate search term
  const termError = validateSearchTerm(term)
  if (termError) {
    createError.value = termError
    announceError(`Validation error: ${termError}`)
    return
  }
  
  // Validate generated name
  const nameError = validateGeneratedName(name)
  if (nameError) {
    createError.value = nameError
    announceError(`Validation error: ${nameError}`)
    return
  }

  try {
    createError.value = ''
    isCreating.value = true // Set flag before creation
    
    const success = createContextSet(name)
    
    if (!success) {
      createError.value = 'A context set with this name already exists'
      announceError(`Error: Context set "${name}" already exists`)
      isSearching.value = false
      isCreating.value = false
      return
    }
    
    // Automatically set the newly created context set as active
    setActiveContextSet(name)
    
    // Close modal immediately after successful context creation
    isOpen.value = false
    announceStatus(`Created context set: ${name}`)
    
    // Emit created event
    emit('created', name)
    
    // Reset form
    resetForm()
    
    // Trigger async search in the AssistedCuration tab
    if (typeof window !== 'undefined') {
      // Dispatch event to switch to AssistedCuration tab and start search
      window.dispatchEvent(new CustomEvent('startAssistedSearch', {
        detail: {
          keyword: term,
          contextSetName: name,
          startingPointFile: selectedEntryPoint.value?.path
        }
      }))
    }
    
    // Perform search asynchronously (non-blocking)
    performAsyncSearch(term, name)
  } catch (error) {
    createError.value = error instanceof Error ? error.message : 'Failed to create context set'
    announceError(`Error creating context set: ${createError.value}`)
    isSearching.value = false
    isCreating.value = false
  }
}

const cancelCreate = () => {
  isOpen.value = false
  resetForm()
}

const resetForm = () => {
  searchTerm.value = ''
  entryPointSearchTerm.value = ''
  entryPointSearchResults.value = []
  selectedEntryPoint.value = null
  createError.value = ''
  isCreating.value = false
}

// Perform search asynchronously after context creation
const performAsyncSearch = async (term: string, contextName: string) => {
  try {
    // Get all files from the file tree (already filtered by buildFilteredFileTree)
    const allFiles = flattenFileTree(fileTree.value || [])
    const filesToSearch: Array<{ path: string; content: string }> = []
    
    // Load file contents for search
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
    
    // Prepare starting point file if selected
    let startingPointFile
    const savedEntryPoint = selectedEntryPoint.value // Save reference before form reset
    if (savedEntryPoint) {
      try {
        const startingPointHandle = savedEntryPoint.handle as FileSystemFileHandle
        const startingPointFileObj = await startingPointHandle.getFile()
        const startingPointContent = await startingPointFileObj.text()
        
        startingPointFile = {
          path: savedEntryPoint.path,
          content: startingPointContent
        }
      } catch (error) {
        logger.warn(`Failed to load starting point file: ${savedEntryPoint.path}:`, error)
      }
    }
    
    // Perform the tri-model search using the original search term
    const searchResults = await performTriModelSearch(term, filesToSearch, startingPointFile)
    
    // Prepare search results for the AssistedCuration component
    const assistedResults = []
    
    // Add starting point file first if specified (with highest priority)
    if (savedEntryPoint) {
      assistedResults.push({
        file: savedEntryPoint.path,
        scorePercentage: 100,
        finalScore: 1.0,
        astScore: 1.0,
        llmScore: 1.0,
        flanScore: 1.0,
        syntaxScore: 1.0,
        hasSynergy: true,
        matches: [term],
        classification: 'entry-point',
        workflowPosition: 'entry'
      })
    }
    
    // Add search results (excluding starting point if it exists)
    for (const result of searchResults.data.files) {
      // Skip if this file is the starting point (already added above)
      if (savedEntryPoint?.path !== result.file) {
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
    }
    
    // Send search results to the TabbedFileBrowser component with metadata
    if (typeof window !== 'undefined' && (window as any).setAssistedSearchResults) {
      const metadata = {
        keyword: term,
        startingPointFile: savedEntryPoint?.path
      }
      await (window as any).setAssistedSearchResults(assistedResults, metadata)
    }
    
    const resultCount = assistedResults.length
    const startPointText = savedEntryPoint ? ' (including starting point)' : ''
    announceStatus(`Found ${resultCount} relevant files for "${contextName}"${startPointText}`)
    
    // Dispatch completion event to stop loading state
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('assistedSearchCompleted', {
        detail: {
          keyword: term,
          contextSetName: contextName,
          resultCount: resultCount
        }
      }))
    }
  } catch (error) {
    logger.error('Async search failed:', error)
    announceError(`Search failed for "${contextName}"`)
    
    // Dispatch failure event to stop loading state
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('assistedSearchFailed', {
        detail: {
          keyword: term,
          contextSetName: contextName,
          error: error instanceof Error ? error.message : 'Unknown error'
        }
      }))
    }
  }
}

// Entry point file selection handlers
const onEntryPointSearchResults = (filteredFiles: FileTreeItem[], searchTerm: string, activeFilters: string[]) => {
  entryPointSearchResults.value = filteredFiles
  
  // Clear selection if current selection no longer matches search
  if (selectedEntryPoint.value && searchTerm) {
    const isStillVisible = flattenedEntryPointFiles.value.some(f => f.path === selectedEntryPoint.value?.path)
    if (!isStillVisible) {
      selectedEntryPoint.value = null
    }
  }
}

const selectEntryPointFile = (file: FileTreeItem) => {
  selectedEntryPoint.value = file
  // Clear the search to hide results after selection
  entryPointSearchTerm.value = ''
  entryPointSearchResults.value = []
  if (entryPointSearch.value) {
    entryPointSearch.value.clearSearch()
  }
}

const clearEntryPoint = () => {
  selectedEntryPoint.value = null
  entryPointSearchTerm.value = ''
  entryPointSearchResults.value = []
  if (entryPointSearch.value) {
    entryPointSearch.value.clearSearch()
  }
}

// Focus management
const safeFocus = (element: HTMLElement | undefined) => {
  try {
    element?.focus?.()
  } catch {
    // Silently ignore focus errors in test environment
  }
}

watch(isOpen, (open) => {
  if (open) {
    resetForm()
    nextTick(() => {
      safeFocus(searchInput.value)
    })
  }
})
// Helper functions
interface FileTreeItem {
  path: string
  name: string
  type: 'file' | 'directory'
  handle?: FileSystemDirectoryHandle | FileSystemFileHandle
  children?: FileTreeItem[]
}

// Simple flatten function for the already-filtered file tree
const flattenFileTree = (tree: FileTreeItem[]): FileTreeItem[] => {
  const files: FileTreeItem[] = []
  
  const traverse = (items: FileTreeItem[]) => {
    for (const item of items) {
      if (item.type === 'file') {
        files.push(item)
      } else if (item.children) {
        traverse(item.children)
      }
    }
  }
  
  traverse(tree)
  return files
}
</script> 