<!--
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
-->
<template>
  <div class="content-spacing bg-surface-1 h-full flex flex-col">
    <!-- Header -->
    <div class="p-4 border-b border-border">
      <div class="flex items-center justify-between mb-3">
        <div>
          <h4 class="text-sm font-medium text-foreground">AI-Curated Results</h4>
          <p class="text-xs text-muted-foreground">
            {{ searchResultsCount }} relevant files found
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
      <!-- Empty State -->
      <div v-if="searchResultsCount === 0" class="flex-1 flex items-center justify-center py-12">
        <div class="text-center max-w-sm mx-auto">
          <Icon name="lucide:sparkles" class="w-12 h-12 mx-auto mb-4 text-muted-foreground opacity-50" aria-hidden="true" />
          <p class="visual-hierarchy-body mb-2 text-mobile-body sm:text-base">No Search Results</p>
          <p class="visual-hierarchy-caption opacity-75 text-mobile-caption sm:text-sm mb-4">
            Create a new context set to get AI-curated file suggestions
          </p>
          <p class="text-xs text-muted-foreground">
            💡 <strong>Tip:</strong> Use descriptive search terms for better results
          </p>
        </div>
      </div>

      <!-- Search Results -->
      <div v-else class="space-y-3 p-4">
        <div
          v-for="(result, index) in searchResults"
          :key="result.file"
          class="group relative bg-card rounded-lg border p-4 transition-all duration-200 hover:shadow-elegant"
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

              <!-- Matches -->
              <div v-if="result.matches && result.matches.length > 0" class="mb-3">
                <p class="text-xs font-medium text-foreground mb-1">Keyword Matches:</p>
                <div class="flex flex-wrap gap-1">
                  <span
                    v-for="(match, matchIndex) in result.matches.slice(0, 5)"
                    :key="matchIndex"
                    class="px-2 py-1 text-xs bg-secondary/30 text-secondary-foreground rounded border"
                  >
                    {{ match }}
                  </span>
                  <span v-if="result.matches.length > 5" class="text-xs text-muted-foreground">
                    +{{ result.matches.length - 5 }} more
                  </span>
                </div>
              </div>
            </div>

            <!-- Actions -->
            <div class="flex items-center space-x-2 ml-4">
              <!-- View File -->
              <Button
                @click="viewFile(result.file)"
                variant="ghost"
                size="sm"
                class="opacity-0 group-hover:opacity-100 transition-opacity duration-200"
                :aria-label="`View content of ${getFileName(result.file)}`"
                title="View file content"
              >
                <Icon name="lucide:eye" class="w-4 h-4" aria-hidden="true" />
              </Button>

              <!-- Add to Context Set -->
              <Button
                @click="addFileToContext(result)"
                variant="ghost"
                size="sm"
                class="opacity-0 group-hover:opacity-100 transition-opacity duration-200"
                :class="isFileInContext(result.file) ? 'text-success' : 'text-primary'"
                :disabled="!activeContextSetName || isFileInContext(result.file)"
                :aria-label="`Add ${getFileName(result.file)} to context set`"
                :title="isFileInContext(result.file) ? 'Already in context set' : 'Add to context set'"
              >
                <Icon 
                  :name="isFileInContext(result.file) ? 'lucide:check' : 'lucide:plus-circle'" 
                  class="w-4 h-4" 
                  aria-hidden="true" 
                />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { FileTreeItem } from '~/composables/useProjectStore'

const {
  fileTree,
  activeContextSetName,
  activeContextSet,
  addFileToActiveContextSet,
  loadFileContent
} = useProjectStore()

const { announceStatus, announceError } = useAccessibility()

// Inject search results from parent component
const searchResults = inject('searchResults', ref([]))
const searchResultsCount = inject('searchResultsCount', computed(() => 0))

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
  
  return activeContextSet.value.files.some(fileEntry => {
    const entryPath = typeof fileEntry === 'string' 
      ? fileEntry 
      : fileEntry.fileRef
    // We need to check by path since we have the path but context set has fileId
    // This is a simplified check - in practice we'd need to resolve the fileId to path
    return entryPath === filePath
  })
}

// Actions
const viewFile = async (filePath: string) => {
  const fileName = getFileName(filePath)
  
  // Find the actual FileTreeItem in the file tree to get the handle
  const fileItem = findFileInTree(fileTree.value, filePath)
  
  if (!fileItem) {
    announceError(`Could not find file in project tree: ${fileName}`)
    console.error('File not found in tree:', filePath)
    return
  }
  
  try {
    // Use the store's loadFileContent function which opens the modal
    await loadFileContent(fileItem)
    announceStatus(`Opened file viewer for: ${fileName}`)
  } catch (error) {
    announceError(`Failed to load file content: ${fileName}`)
    console.error('Error loading file content:', error)
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
    const success = addFileToActiveContextSet(fileItem, {
      classification: result.classification
    })
    
    if (success) {
      announceStatus(`Added ${fileName} to ${activeContextSetName.value}`)
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

  const topResults = searchResults.value.slice(0, 5)
  let addedCount = 0
  
  for (const result of topResults) {
    if (!isFileInContext(result.file)) {
      const fileItem = findFileInTree(fileTree.value, result.file)
      if (fileItem) {
        try {
          const success = addFileToActiveContextSet(fileItem, {
            classification: result.classification
          })
          if (success) addedCount++
        } catch (error) {
          console.warn(`Failed to add ${result.file}:`, error)
        }
      }
    }
  }
  
  announceStatus(`Added ${addedCount} files to ${activeContextSetName.value}`)
}

const addAllResults = async () => {
  if (!activeContextSetName.value) {
    announceError('No active context set selected')
    return
  }

  let addedCount = 0
  
  for (const result of searchResults.value) {
    if (!isFileInContext(result.file)) {
      const fileItem = findFileInTree(fileTree.value, result.file)
      if (fileItem) {
        try {
          const success = addFileToActiveContextSet(fileItem, {
            classification: result.classification
          })
          if (success) addedCount++
        } catch (error) {
          console.warn(`Failed to add ${result.file}:`, error)
        }
      }
    }
  }
  
  announceStatus(`Added ${addedCount} files to ${activeContextSetName.value}`)
}

const clearResults = () => {
  if (typeof window !== 'undefined' && (window as any).clearAssistedSearchResults) {
    (window as any).clearAssistedSearchResults()
  }
  announceStatus('Cleared search results')
}
</script>