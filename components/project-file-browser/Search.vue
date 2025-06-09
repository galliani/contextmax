/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */
<template>
  <div class="file-tree-search mb-3 space-y-3">
    <!-- Search Input -->
    <div class="relative">
      <div class="relative">
        <Icon name="lucide:search" class="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input
          ref="searchInput"
          v-model="searchTerm"
          type="text"
          placeholder="Search files..."
          class="w-full pl-10 pr-4 py-2 text-sm border rounded-md bg-background text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all duration-200"
          @input="handleSearchInput"
          @keydown="handleKeyDown"
        />
        <button
          v-if="searchTerm"
          @click="clearSearch"
          class="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors duration-150"
        >
          <Icon name="lucide:x" class="w-4 h-4" />
        </button>
      </div>
    </div>

    <!-- Smart Filters -->
    <div class="flex flex-wrap gap-2">
      <!-- Quick Actions -->
      <div class="flex gap-1 ml-auto">        
        <button
          v-if="activeFilters.length > 0"
          @click="clearFilters"
          class="px-2 py-1 text-xs rounded-md bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground border border-muted transition-all duration-200"
          title="Clear all filters"
        >
          <Icon name="lucide:filter-x" class="w-3 h-3 mr-1 inline" />
          Clear
        </button>
      </div>
    </div>
    
    <!-- Search Results Summary -->
    <div class="flex justify-between items-center text-xs text-muted-foreground">
      <div>
        <span v-if="searchTerm && filteredFiles.length > 0">
          {{ visibleFileCount }} file{{ visibleFileCount !== 1 ? 's' : '' }} found
        </span>
        <span v-else-if="searchTerm && filteredFiles.length === 0">
          No files match "{{ searchTerm }}"
        </span>
        <span v-else-if="activeFilters.length > 0">
          {{ visibleFileCount }} {{ activeFilters.join(', ') }} file{{ visibleFileCount !== 1 ? 's' : '' }}
        </span>
        <span v-else>
          {{ totalFileCount }} files total
        </span>
      </div>
      
      <!-- Performance hint for large projects -->
      <div v-if="totalFileCount > 1000" class="flex items-center gap-1 text-amber-600 dark:text-amber-400">
        <Icon name="lucide:zap" class="w-3 h-3" />
        <span>Use filters for better performance</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
interface FileTreeItem {
  name: string
  path: string
  type: 'file' | 'directory'
  children?: FileTreeItem[]
  handle?: FileSystemFileHandle | FileSystemDirectoryHandle
}

interface Props {
  files: FileTreeItem[]
  modelValue?: string
}

interface Emits {
  'update:modelValue': [value: string]
  'search-results': [filteredFiles: FileTreeItem[], searchTerm: string, activeFilters: string[]]
}

interface FileFilter {
  type: string
  label: string
  icon: string
  extensions: string[]
  count: number
}

const props = withDefaults(defineProps<Props>(), {
  modelValue: '',
  files: () => []
})

const emit = defineEmits<Emits>()

// Refs
const searchInput = ref<HTMLInputElement>()

// Search functionality
const searchTerm = ref(props.modelValue)
const activeFilters = ref<string[]>([])

// Watch for external changes to modelValue
watch(() => props.modelValue, (newValue) => {
  searchTerm.value = newValue
})

// File type analysis
const fileTypeAnalysis = computed(() => {
  const analysis: Record<string, number> = {}
  
  const analyzeFiles = (files: FileTreeItem[]) => {
    if (!files || !Array.isArray(files)) return
    files.forEach(file => {
      if (file.type === 'file') {
        const ext = getFileExtension(file.name)
        if (ext) {
          analysis[ext] = (analysis[ext] || 0) + 1
        }
      } else if (file.children) {
        analyzeFiles(file.children)
      }
    })
  }
  
  analyzeFiles(props.files || [])
  return analysis
})

// Available filter options
const availableFilters = computed((): FileFilter[] => {
  const filterConfigs: Omit<FileFilter, 'count'>[] = [
    {
      type: 'web',
      label: 'Web',
      icon: 'lucide:globe',
      extensions: ['vue', 'js', 'ts', 'jsx', 'tsx', 'html', 'css', 'scss', 'sass', 'less']
    },
    {
      type: 'config',
      label: 'Config',
      icon: 'lucide:settings',
      extensions: ['json', 'yaml', 'yml', 'toml', 'env', 'config']
    },
    {
      type: 'docs',
      label: 'Docs',
      icon: 'lucide:file-text',
      extensions: ['md', 'markdown', 'txt', 'rst', 'adoc']
    },
    {
      type: 'images',
      label: 'Images',
      icon: 'lucide:image',
      extensions: ['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'ico']
    },
    {
      type: 'code',
      label: 'Code',
      icon: 'lucide:file-code',
      extensions: ['py', 'rb', 'php', 'go', 'rs', 'c', 'cpp', 'java', 'kt', 'swift']
    }
  ]
  
  return filterConfigs
    .map(config => ({
      ...config,
      count: config.extensions.reduce((sum, ext) => sum + (fileTypeAnalysis.value[ext] || 0), 0)
    }))
    .filter(filter => filter.count > 0)
    .sort((a, b) => b.count - a.count)
})

// File counts
const totalFileCount = computed(() => {
  const countFiles = (files: FileTreeItem[]): number => {
    if (!files || !Array.isArray(files)) return 0
    return files.reduce((count, file) => {
      if (file.type === 'file') {
        return count + 1
      } else if (file.children) {
        return count + countFiles(file.children)
      }
      return count
    }, 0)
  }
  
  return countFiles(props.files || [])
})

const visibleFileCount = computed(() => {
  return countFiles(filteredFiles.value || [])
})

// Enhanced filtering logic
function getFileExtension(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase()
  return ext || ''
}

function fileMatchesFilters(file: FileTreeItem): boolean {
  if (activeFilters.value.length === 0) return true
  
  const ext = getFileExtension(file.name)
  
  return availableFilters.value.some(filter => 
    activeFilters.value.includes(filter.type) && 
    filter.extensions.includes(ext)
  )
}

function fuzzyMatch(searchTerm: string, text: string): boolean {
  if (!searchTerm) return true
  
  const search = searchTerm.toLowerCase()
  const target = text.toLowerCase()
  
  // Enhanced fuzzy matching with multiple strategies
  
  // 1. Exact substring match (highest priority)
  if (target.includes(search)) return true
  
  // 2. Fuzzy character sequence match
  let searchIndex = 0
  for (let i = 0; i < target.length && searchIndex < search.length; i++) {
    if (target[i] === search[searchIndex]) {
      searchIndex++
    }
  }
  
  return searchIndex === search.length
}

function fileMatches(file: FileTreeItem, search: string): boolean {
  if (!search) return true
  
  // Check file name and full path
  return fuzzyMatch(search, file.name) || fuzzyMatch(search, file.path)
}

// Recursively filter files
function filterFiles(files: FileTreeItem[], search: string): FileTreeItem[] {
  if (!files || !Array.isArray(files)) return []
  return files.reduce((filtered: FileTreeItem[], file) => {
    if (file.type === 'file') {
      // For files, check search match and filter match
      if (fileMatches(file, search) && fileMatchesFilters(file)) {
        filtered.push(file)
      }
    } else {
      // For directories, check if directory itself matches or any children match
      const filteredChildren = file.children ? filterFiles(file.children, search) : []
      const directoryMatches = fileMatches(file, search)
      
      if (directoryMatches || filteredChildren.length > 0) {
        filtered.push({
          ...file,
          children: filteredChildren
        })
      }
    }
    
    return filtered
  }, [])
}

function countFiles(files: FileTreeItem[]): number {
  if (!files || !Array.isArray(files)) return 0
  return files.reduce((count, file) => {
    if (file.type === 'file') {
      return count + 1
    } else if (file.children) {
      return count + countFiles(file.children)
    }
    return count
  }, 0)
}

// Computed filtered files
const filteredFiles = computed(() => {
  return filterFiles(props.files || [], searchTerm.value)
})

// Event handlers
function handleSearchInput() {
  emit('update:modelValue', searchTerm.value)
  emitSearchResults()
}

function handleKeyDown(event: KeyboardEvent) {
  // Ctrl+A to select all visible
  if (event.key === 'a' && (event.ctrlKey || event.metaKey) && event.shiftKey) {
    event.preventDefault()
  }
  
  // Escape to clear search
  if (event.key === 'Escape') {
    clearSearch()
  }
}

function clearSearch() {
  searchTerm.value = ''
  emit('update:modelValue', '')
  emitSearchResults()
  searchInput.value?.focus()
}

function toggleFilter(filterType: string) {
  const index = activeFilters.value.indexOf(filterType)
  if (index === -1) {
    activeFilters.value.push(filterType)
  } else {
    activeFilters.value.splice(index, 1)
  }
  emitSearchResults()
}

function clearFilters() {
  activeFilters.value = []
  emitSearchResults()
}

function emitSearchResults() {
  emit('search-results', filteredFiles.value, searchTerm.value, [...activeFilters.value])
}

// Focus search input (exposed for parent components)
function focus() {
  searchInput.value?.focus()
}

// Emit initial results
onMounted(() => {
  if (searchTerm.value || activeFilters.value.length > 0) {
    emitSearchResults()
  }
})

// Watch for changes and emit results
watch(filteredFiles, emitSearchResults)
watch(activeFilters, emitSearchResults, { deep: true })

// Expose methods for parent components
defineExpose({
  focus,
  clearSearch,
  clearFilters,
  fuzzyMatch,
  fileMatches
})
</script>
