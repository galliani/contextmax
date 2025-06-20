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
          Enter a search phrase to find related files. A context set will be created automatically.
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

        <div class="flex justify-end space-x-3">
          <Button type="button" variant="outline" @click="cancelCreate">
            Cancel
          </Button>
          <Button 
            type="submit" 
            :disabled="!isFormValid || isSearching"
            :class="{ 'opacity-50 cursor-not-allowed': !isFormValid || isSearching }"
          >
            <Icon 
              :name="isSearching ? 'lucide:loader-2' : 'lucide:plus'" 
              class="w-4 h-4 mr-2"
              :class="{ 'animate-spin': isSearching }"
            />
            {{ isSearching ? 'Creating & Searching...' : 'Create Context Set' }}
          </Button>
        </div>
      </form>
    </DialogContent>
  </Dialog>
</template>

<script setup lang="ts">
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

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

// Import smart suggestions composable for search
const { performHybridKeywordSearch } = useSmartContextSuggestions()

// Local state
const searchTerm = ref('')
const createError = ref('')
const searchInput = ref<HTMLInputElement>()
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
    
    // Perform keyword search using the context name
    announceStatus(`Created context set: ${name}. Searching for related files...`)
    isSearching.value = true
    
    try {
      // Get all files from the file tree
      const allFiles = getAllFilesFromTree(fileTree.value || [])
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
          console.warn(`Failed to load content for search: ${file.path}:`, error)
        }
      }
      
      // Perform the search using the original search term (not the camelCase name)
      const searchResults = await performHybridKeywordSearch(term, filesToSearch)
      
      // Add top search results to the context set
      let addedCount = 0
      const maxFiles = 10 // Add top 10 results
      
      for (const result of searchResults.data.files.slice(0, maxFiles)) {
        const fileItem = allFiles.find(f => f.path === result.file)
        if (fileItem) {
          try {
            const success = addFileToActiveContextSet(fileItem)
            if (success) addedCount++
          } catch (error) {
            console.warn(`Failed to add file ${result.file}:`, error)
          }
        }
      }
      
      announceStatus(`Context set "${name}" created with ${addedCount} relevant files found`)
    } catch (error) {
      console.error('Search failed:', error)
      // Don't fail the context creation if search fails
      announceStatus(`Context set "${name}" created (search failed)`)
    } finally {
      isSearching.value = false
    }
    
    // Close modal and reset form
    isOpen.value = false
    resetForm()
    
    // Emit created event
    emit('created', name)
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
  createError.value = ''
  isCreating.value = false
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
</script> 