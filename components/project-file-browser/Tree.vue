/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */
<template>
  <div class="file-tree relative">
    <!-- Search Component - Sticky -->
    <div class="sticky top-0 z-10 bg-card border-b pb-3 mb-3">
      <Search
        v-model="searchTerm"
        :files="files"
        @search-results="handleSearchResults"
      />
    </div>

    <!-- File Tree -->
    <div class="file-tree-content">
      <TreeItem
        v-for="file in displayFiles"
        :key="file.path"
        :item="file"
        :level="0"
        :search-term="searchTerm"
        :disabled="!hasActiveHandles"
        @file-selected="$emit('file-selected', $event)"
      />
      
      <div v-if="displayFiles.length === 0 && !searchTerm && !hasActiveFilters" class="text-center py-8 text-muted-foreground">
        <Icon name="lucide:folder-x" class="w-8 h-8 mx-auto mb-2" />
        <p>No files found</p>
      </div>
      
      <!-- Enhanced empty states -->
      <div v-else-if="displayFiles.length === 0 && (searchTerm || hasActiveFilters)" class="text-center py-8 text-muted-foreground">
        <Icon name="lucide:search-x" class="w-8 h-8 mx-auto mb-2" />
        <p class="text-base font-medium mb-2">No matching files found</p>
        <p class="text-sm mb-4">
          {{ searchTerm ? `No files match "${searchTerm}"` : 'No files match the current filters' }}
        </p>
        <div class="flex flex-col sm:flex-row gap-2 justify-center">
          <Button 
            v-if="searchTerm" 
            @click="clearSearch" 
            variant="outline" 
            size="sm"
          >
            <Icon name="lucide:x" class="w-4 h-4 mr-2" />
            Clear search
          </Button>
          <Button 
            v-if="hasActiveFilters" 
            @click="clearFilters" 
            variant="outline" 
            size="sm"
          >
            <Icon name="lucide:filter-x" class="w-4 h-4 mr-2" />
            Clear filters
          </Button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import Search from './Search.vue'
import TreeItem from './TreeItem.vue'

interface FileTreeItem {
  name: string
  path: string
  type: 'file' | 'directory'
  children?: FileTreeItem[]
  handle?: FileSystemFileHandle | FileSystemDirectoryHandle
}

interface Props {
  files: FileTreeItem[]
}

const props = defineProps<Props>()

defineEmits<{
  'file-selected': [file: FileTreeItem]
}>()

// Use the project store
const { hasActiveHandles } = useProjectStore()

// Search state
const searchTerm = ref('')
const filteredFiles = ref<FileTreeItem[]>([])
const activeFilters = ref<string[]>([])

// Computed properties
const hasActiveFilters = computed(() => activeFilters.value.length > 0)

// Display files based on search state
const displayFiles = computed(() => {
  return searchTerm.value || hasActiveFilters.value ? filteredFiles.value : props.files
})

// Handle search results from the search component
function handleSearchResults(filtered: FileTreeItem[], search: string, filters: string[]) {
  filteredFiles.value = filtered
  searchTerm.value = search
  activeFilters.value = filters
}

// Clear search (exposed for empty state buttons)
function clearSearch() {
  searchTerm.value = ''
}

// Clear filters (exposed for empty state buttons)
function clearFilters() {
  activeFilters.value = []
}
</script> 