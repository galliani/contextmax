/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */
<template>
  <div>
    <div 
      class="flex items-center py-2 px-3 hover:bg-muted/50 rounded-md group transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
      :style="{ paddingLeft: `${level * 20 + 12}px` }"
      @keydown="handleKeyDown"
      tabindex="0"
      :role="item.type === 'directory' ? 'treeitem' : 'option'"
      :aria-expanded="item.type === 'directory' ? isExpanded : undefined"
      :aria-level="level + 1"
      :aria-selected="item.type === 'file' ? isFileInActiveContextSet : undefined"
      :aria-label="getAriaLabel()"
      :aria-describedby="`file-${item.path.replace(/[^a-zA-Z0-9]/g, '-')}-description`"
    >
      <!-- Directory chevron -->
      <Icon 
        v-if="item.type === 'directory'"
        :name="isExpanded ? 'lucide:chevron-down' : 'lucide:chevron-right'"
        class="w-4 h-4 mr-2 text-muted-foreground transition-transform duration-150 cursor-pointer"
        aria-hidden="true"
        @click="handleChevronClick"
      />
      
      <!-- Context Set Checkbox (only for files) -->
      <div 
        v-if="item.type === 'file'"
        class="flex items-center mr-3"
        @click.stop
      >
        <input
          :id="`checkbox-${item.path.replace(/[^a-zA-Z0-9]/g, '-')}`"
          type="checkbox"
          :checked="isFileInActiveContextSet"
          @change="toggleFileInActiveContextSet"
          class="w-4 h-4 text-primary bg-background border-border rounded focus:ring-primary focus:ring-2 transition-colors duration-150"
          :aria-label="isFileInActiveContextSet ? `Remove ${item.name} from active context set` : `Add ${item.name} to active context set`"
          :title="isFileInActiveContextSet ? 'Remove from active context set' : 'Add to active context set'"
        />
      </div>
      
      <!-- File/Directory icon with enhanced styling -->
      <Icon 
        :name="getIconName(item)"
        class="w-4 h-4 mr-3 transition-colors duration-150 cursor-pointer"
        :class="getIconColorClass(item)"
        :aria-label="`${item.type === 'directory' ? 'Folder' : 'File'}`"
        @click="handleIconClick"
      />
      
      <!-- File/Directory name with enhanced typography -->
      <span 
        class="text-body-sm truncate transition-colors duration-150 flex-1 cursor-pointer"
        :class="getNameClasses(item)"
        v-html="highlightedName"
        :aria-hidden="true"
        @click="handleNameClick"
      >
      </span>
      
      <!-- File extension badge (for files) -->
      <span 
        v-if="item.type === 'file' && getFileExtension(item.name)"
        class="ml-2 px-2 py-0.5 text-xs font-mono rounded-full border transition-all duration-150"
        :class="getExtensionBadgeClasses(getFileExtension(item.name))"
        :aria-label="`${getFileExtension(item.name)} file`"
      >
        {{ getFileExtension(item.name) }}
      </span>
      
      <!-- Screen reader only description -->
      <span 
        :id="`file-${item.path.replace(/[^a-zA-Z0-9]/g, '-')}-description`"
        class="sr-only"
      >
        {{ getScreenReaderDescription() }}
      </span>
    </div>
    
    <!-- Children (recursive) -->
    <div 
      v-if="item.type === 'directory' && isExpanded && item.children" 
      class="space-y-0.5"
      role="group"
      :aria-label="`Contents of ${item.name} folder`"
    >
      <TreeItem
        v-for="child in item.children"
        :key="child.path"
        :item="child"
        :level="level + 1"
        :search-term="searchTerm"
        @file-selected="$emit('file-selected', $event)"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import type { FileTreeItem } from '~/composables/useProjectStore'

interface Props {
  item: FileTreeItem
  level: number
  searchTerm?: string
}

const props = defineProps<Props>()

const {
  loadFileContent,
  addFileToActiveContextSet,
  removeFileFromActiveContextSet,
  activeContextSet,
  findFileIdByPath
} = useProjectStore()

// State for directory expansion
const isExpanded = ref(false)

// Auto-expand directories when searching
watch(() => props.searchTerm, (newSearchTerm) => {
  if (newSearchTerm && props.item.type === 'directory') {
    // Auto-expand if directory or children match search
    if (hasMatchingChildren(props.item, newSearchTerm)) {
      isExpanded.value = true
    }
  } else if (!newSearchTerm) {
    // Collapse when search is cleared (optional behavior)
    // isExpanded.value = false
  }
})

// Check if directory has matching children
function hasMatchingChildren(directory: FileTreeItem, search: string): boolean {
  if (!directory.children || !search) return false
  
  return directory.children.some(child => {
    if (child.type === 'file') {
      return simpleMatch(search, child.name) || simpleMatch(search, child.path)
    } else if (child.children) {
      return simpleMatch(search, child.name) || hasMatchingChildren(child, search)
    }
    return false
  })
}

// Simple matching function for internal use (lighter than full fuzzy match)
function simpleMatch(searchTerm: string, text: string): boolean {
  if (!searchTerm) return true
  return text.toLowerCase().includes(searchTerm.toLowerCase())
}

// Enhanced highlighting with better typography
const highlightedName = computed(() => {
  if (!props.searchTerm) {
    return props.item.name
  }
  
  const search = props.searchTerm.toLowerCase()
  const name = props.item.name
  const nameLower = name.toLowerCase()
  
  // Simple highlighting: if search term is contained in name, highlight it
  if (nameLower.includes(search)) {
    const index = nameLower.indexOf(search)
    if (index >= 0) {
      const before = name.substring(0, index)
      const match = name.substring(index, index + search.length)
      const after = name.substring(index + search.length)
      return `${before}<mark class="bg-primary/20 text-primary px-1 py-0.5 rounded-sm font-medium">${match}</mark>${after}`
    }
  }
  
  return name
})

// Check if this file is in the active context set
const isFileInActiveContextSet = computed(() => {
  if (props.item.type !== 'file' || !activeContextSet.value) return false
  
  // Use findFileIdByPath to check if file exists WITHOUT creating a new entry
  const fileId = findFileIdByPath(props.item.path)
  if (!fileId) return false // File not in manifest, so not in any context set
  
  return activeContextSet.value.files.some(fileEntry => {
    const entryId = typeof fileEntry === 'string' ? fileEntry : fileEntry.fileRef
    return entryId === fileId
  })
})

// Accessibility helpers
function getAriaLabel(): string {
  if (props.item.type === 'directory') {
    return `${props.item.name} folder, ${isExpanded.value ? 'expanded' : 'collapsed'}, level ${props.level + 1}`
  } else {
    const extension = getFileExtension(props.item.name)
    const status = isFileInActiveContextSet.value ? 'in active context set' : 'not in active context set'
    return `${props.item.name}${extension ? ` ${extension} file` : ' file'}, ${status}, level ${props.level + 1}`
  }
}

function getScreenReaderDescription(): string {
  if (props.item.type === 'directory') {
    const childCount = props.item.children?.length || 0
    return `Directory with ${childCount} item${childCount !== 1 ? 's' : ''}. ${isExpanded.value ? 'Currently expanded.' : 'Press Enter or Space to expand.'}`
  } else {
    const extension = getFileExtension(props.item.name)
    return `${extension ? extension.toUpperCase() + ' file' : 'File'} in ${props.item.path}. Press Enter to view file content. Use checkbox to add or remove from active context set.`
  }
}

// Keyboard navigation
function handleKeyDown(event: KeyboardEvent) {
  switch (event.key) {
    case 'Enter':
    case ' ':
      event.preventDefault()
      handleClick()
      break
    case 'ArrowRight':
      if (props.item.type === 'directory' && !isExpanded.value) {
        event.preventDefault()
        isExpanded.value = true
      }
      break
    case 'ArrowLeft':
      if (props.item.type === 'directory' && isExpanded.value) {
        event.preventDefault()
        isExpanded.value = false
      }
      break
    case 'c':
    case 'C':
      if (props.item.type === 'file') {
        event.preventDefault()
        toggleFileInActiveContextSet()
      }
      break
  }
}

// Enhanced styling functions
function getNameClasses(item: FileTreeItem): string {
  const baseClasses = 'group-hover:text-foreground'
  
  if (item.type === 'directory') {
    return `${baseClasses} font-medium text-foreground`
  } else {
    return isFileInActiveContextSet.value 
      ? `${baseClasses} text-primary font-medium text-code`
      : `${baseClasses} text-foreground/80 text-code`
  }
}

function getIconColorClass(item: FileTreeItem): string {
  if (item.type === 'directory') {
    return isExpanded.value ? 'text-primary/70' : 'text-muted-foreground'
  }
  
  const extension = getFileExtension(item.name)
  const colorMap: Record<string, string> = {
    // Web Technologies
    'vue': 'text-green-500',
    'js': 'text-yellow-500',
    'ts': 'text-blue-500',
    'jsx': 'text-cyan-500',
    'tsx': 'text-cyan-600',
    'html': 'text-orange-500',
    'css': 'text-blue-400',
    'scss': 'text-pink-500',
    'sass': 'text-pink-400',
    'less': 'text-indigo-500',
    
    // Data & Config
    'json': 'text-amber-500',
    'yaml': 'text-purple-500',
    'yml': 'text-purple-500',
    'xml': 'text-red-400',
    'toml': 'text-orange-400',
    
    // Documentation
    'md': 'text-gray-600 dark:text-gray-300',
    'txt': 'text-gray-500',
    'pdf': 'text-red-500',
    
    // Images
    'svg': 'text-purple-400',
    'png': 'text-green-400',
    'jpg': 'text-blue-400',
    'jpeg': 'text-blue-400',
    'gif': 'text-pink-400',
    'webp': 'text-teal-400',
    
    // Others
    'rb': 'text-red-600',
    'py': 'text-yellow-600',
    'php': 'text-indigo-600',
    'go': 'text-cyan-600',
    'rs': 'text-orange-600'
  }
  
  return colorMap[extension] || 'text-muted-foreground'
}

function getExtensionBadgeClasses(extension: string): string {
  const colorMap: Record<string, string> = {
    // Web Technologies
    'vue': 'bg-green-50 text-green-700 border-green-200 dark:bg-green-950 dark:text-green-300 dark:border-green-800',
    'js': 'bg-yellow-50 text-yellow-700 border-yellow-200 dark:bg-yellow-950 dark:text-yellow-300 dark:border-yellow-800',
    'ts': 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-800',
    'jsx': 'bg-cyan-50 text-cyan-700 border-cyan-200 dark:bg-cyan-950 dark:text-cyan-300 dark:border-cyan-800',
    'tsx': 'bg-cyan-50 text-cyan-800 border-cyan-300 dark:bg-cyan-950 dark:text-cyan-200 dark:border-cyan-700',
    'css': 'bg-blue-50 text-blue-600 border-blue-200 dark:bg-blue-950 dark:text-blue-400 dark:border-blue-800',
    'json': 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-800',
    'md': 'bg-gray-50 text-gray-600 border-gray-200 dark:bg-gray-950 dark:text-gray-400 dark:border-gray-800'
  }
  
  return colorMap[extension] || 'bg-muted/50 text-muted-foreground border-muted'
}

function getFileExtension(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase()
  return ext || ''
}

// Handle click events
function handleClick() {
  // This is now only for keyboard interactions (Enter/Space)
  // Mouse clicks are handled by specific elements with @click.stop
  if (props.item.type === 'directory') {
    isExpanded.value = !isExpanded.value
  } else {
    // For files, clicking the name will open the file view
    viewFile()
  }
}

function toggleDirectory() {
  if (props.item.type === 'directory') {
    isExpanded.value = !isExpanded.value
  }
}

function toggleFileInActiveContextSet() {
  if (props.item.type !== 'file') return
  
  if (isFileInActiveContextSet.value) {
    // Remove from active context set
    const fileId = findFileIdByPath(props.item.path)
    if (fileId) {
      removeFileFromActiveContextSet(fileId)
    }
  } else {
    // Add to active context set
    addFileToActiveContextSet(props.item)
  }
}

function viewFile() {
  if (props.item.type === 'file') {
    // Just load the file content for viewing - don't emit file-selected which adds to context set
    loadFileContent(props.item)
  }
}

// Enhanced icon selection with more file types
function getIconName(item: FileTreeItem): string {
  if (item.type === 'directory') {
    return isExpanded.value ? 'lucide:folder-open' : 'lucide:folder'
  }
  
  // File type icons based on extension with enhanced mapping
  const extension = getFileExtension(item.name)
  
  const iconMap: Record<string, string> = {
    // Web Technologies
    'vue': 'lucide:file-code',
    'js': 'lucide:file-code',
    'ts': 'lucide:file-code',
    'jsx': 'lucide:file-code',
    'tsx': 'lucide:file-code',
    'html': 'lucide:globe',
    'css': 'lucide:palette',
    'scss': 'lucide:palette',
    'sass': 'lucide:palette',
    'less': 'lucide:palette',
    
    // Data & Config
    'json': 'lucide:braces',
    'yaml': 'lucide:settings',
    'yml': 'lucide:settings',
    'xml': 'lucide:code',
    'toml': 'lucide:settings',
    'env': 'lucide:key',
    
    // Documentation
    'md': 'lucide:file-text',
    'markdown': 'lucide:file-text',
    'txt': 'lucide:file-text',
    'pdf': 'lucide:file-text',
    'doc': 'lucide:file-text',
    'docx': 'lucide:file-text',
    
    // Images
    'svg': 'lucide:image',
    'png': 'lucide:image',
    'jpg': 'lucide:image',
    'jpeg': 'lucide:image',
    'gif': 'lucide:image',
    'webp': 'lucide:image',
    'ico': 'lucide:image',
    
    // Archives
    'zip': 'lucide:archive',
    'tar': 'lucide:archive',
    'gz': 'lucide:archive',
    'rar': 'lucide:archive',
    '7z': 'lucide:archive',
    
    // Programming Languages
    'rb': 'lucide:file-code',
    'py': 'lucide:file-code',
    'php': 'lucide:file-code',
    'go': 'lucide:file-code',
    'rs': 'lucide:file-code',
    'c': 'lucide:file-code',
    'cpp': 'lucide:file-code',
    'java': 'lucide:file-code',
    'kt': 'lucide:file-code',
    'swift': 'lucide:file-code',
    
    // Build & Config
    'lock': 'lucide:lock',
    'dockerfile': 'lucide:container',
    'makefile': 'lucide:wrench',
    'gitignore': 'lucide:git-branch'
  }
  
  return iconMap[extension] || 'lucide:file'
}

function handleNameClick(event: MouseEvent) {
  event.preventDefault()
  event.stopPropagation()
  event.stopImmediatePropagation()
  
  if (props.item.type === 'file') {
    viewFile()
  } else {
    toggleDirectory()
  }
}

function handleIconClick(event: MouseEvent) {
  event.preventDefault()
  event.stopPropagation()
  event.stopImmediatePropagation()
  
  if (props.item.type === 'file') {
    viewFile()
  } else {
    toggleDirectory()
  }
}

function handleChevronClick(event: MouseEvent) {
  event.preventDefault()
  event.stopPropagation()
  event.stopImmediatePropagation()
  
  if (props.item.type === 'directory') {
    toggleDirectory()
  }
}
</script> 