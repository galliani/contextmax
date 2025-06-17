/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */
<template>
  <div class="space-y-4">
    <!-- Header -->
    <div class="flex items-center justify-between">
      <div>
        <h4 class="text-md font-semibold text-foreground">Files in This Context Set</h4>
        <p class="text-sm text-muted-foreground">
          {{ fileList.length }} file{{ fileList.length !== 1 ? 's' : '' }} included
        </p>
      </div>
    </div>

    <!-- Empty State -->
    <div v-if="fileList.length === 0" class="text-center py-12 border-2 border-dashed border-muted rounded-lg">
      <Icon name="lucide:file-plus" class="w-12 h-12 mx-auto mb-4 text-muted-foreground opacity-50" aria-hidden="true" />
      <h4 class="text-lg font-medium text-foreground mb-2">No Files Added Yet</h4>
      <p class="text-muted-foreground mb-4 max-w-sm mx-auto">
        Add files from the project browser on the right to include them in this context set.
      </p>
      <div class="space-y-2 text-sm text-muted-foreground">
        <p>💡 <strong>Tip:</strong> Use the project file browser to select and add files</p>
        <p>📝 You can specify functions for each file after adding them</p>
      </div>
    </div>

    <!-- Files List -->
    <div v-else class="space-y-3">
      <div
        v-for="(fileEntry, index) in fileList"
        :key="getFileId(fileEntry)"
        class="group relative bg-card rounded-lg border p-4 transition-all duration-200 hover:shadow-elegant"
      >
        <!-- File Info -->
        <div class="flex items-start justify-between">
          <div class="flex-1 min-w-0">
            <!-- File Path -->
            <div class="flex items-center space-x-2 mb-2">
              <Icon 
                :name="getFileIcon(fileEntry)" 
                class="w-4 h-4 flex-shrink-0"
                :class="getFileIconColor(fileEntry)"
                aria-hidden="true"
              />
              <h4 class="text-sm font-medium text-foreground truncate">
                {{ getFileName(fileEntry) }}
              </h4>
              <span 
                v-if="getFileExtension(fileEntry)"
                class="px-2 py-0.5 text-xs font-mono rounded-full border"
                :class="getExtensionBadgeClasses(getFileExtension(fileEntry))"
              >
                {{ getFileExtension(fileEntry) }}
              </span>
            </div>

            <!-- File Path -->
            <p class="text-xs text-muted-foreground font-mono mb-3 truncate">
              {{ getFilePath(fileEntry) }}
            </p>

            <!-- Function Refs Display -->
            <div v-if="hasFunctionRefs(fileEntry)" class="mb-3">
              <p class="text-xs font-medium text-foreground mb-1">Specific Functions:</p>
              <div class="flex flex-wrap gap-1">
                <span
                  v-for="(func, funcIndex) in getFunctionRefs(fileEntry)"
                  :key="funcIndex"
                  class="px-2 py-1 text-xs bg-primary/10 text-primary rounded border border-primary/20"
                >
                  {{ func.name }}
                  <span v-if="func.comment" class="text-primary/70">
                    • {{ func.comment }}
                  </span>
                </span>
              </div>
            </div>

            <!-- File Comment -->
            <div v-if="getFileComment(fileEntry)" class="mb-3">
              <p class="text-xs font-medium text-foreground mb-1">Comment for this context:</p>
              <p class="text-xs text-muted-foreground italic bg-muted/50 p-2 rounded">
                {{ getFileComment(fileEntry) }}
              </p>
            </div>

            <!-- Inclusion Type -->
            <div class="flex items-center space-x-4 text-xs text-muted-foreground">
              <span class="flex items-center">
                <Icon 
                  :name="hasFunctionRefs(fileEntry) ? 'lucide:function-square' : 'lucide:file'" 
                  class="w-3 h-3 mr-1" 
                  aria-hidden="true" 
                />
                {{ hasFunctionRefs(fileEntry) ? 'Specific functions' : 'Whole file' }}
              </span>
            </div>
          </div>

          <!-- Actions -->
          <div class="flex items-center space-x-2 ml-4">
            <!-- View File -->
            <Button
              @click="viewFile(fileEntry)"
              variant="ghost"
              size="sm"
              class="opacity-0 group-hover:opacity-100 transition-opacity duration-200"
              :aria-label="`View content of ${getFileName(fileEntry)}`"
              title="View file content"
            >
              <Icon name="lucide:eye" class="w-4 h-4" aria-hidden="true" />
            </Button>

            <!-- Specify Functions -->
            <Button
              @click="selectFunctions(fileEntry)"
              variant="ghost"
              size="sm"
              class="opacity-0 group-hover:opacity-100 transition-opacity duration-200"
              :aria-label="`Specify functions for ${getFileName(fileEntry)}`"
              title="Specify functions"
            >
              <Icon name="lucide:function-square" class="w-4 h-4" aria-hidden="true" />
            </Button>

            <!-- Remove from Context Set -->
            <Button
              @click="removeFile(fileEntry)"
              variant="ghost"
              size="sm"
              class="opacity-0 group-hover:opacity-100 text-destructive hover:text-destructive hover:bg-destructive/10 transition-all duration-200"
              :aria-label="`Remove ${getFileName(fileEntry)} from context set`"
              title="Remove from context set"
            >
              <Icon name="lucide:trash-2" class="w-4 h-4" aria-hidden="true" />
            </Button>
          </div>
        </div>
      </div>
    </div>

    <!-- Add Files Help -->
    <div v-if="fileList.length > 0" class="mt-6 p-4 bg-info/5 border border-info/20 rounded-lg">
      <div class="flex items-start space-x-3">
        <Icon name="lucide:info" class="w-5 h-5 text-info flex-shrink-0 mt-0.5" aria-hidden="true" />
        <div class="text-sm">
          <p class="text-info font-medium mb-1">Adding More Files</p>
          <p class="text-info/80">
            Use the project file browser on the right to add more files to this context set. 
            Files are automatically added to the global manifest when included in any context set.
          </p>
        </div>
      </div>
    </div>

    <!-- Function Selection Modal -->
    <FunctionSelectorModal
      v-model:open="isFunctionModalOpen"
      :file-id="selectedFileId"
      :existing-functions="selectedFileFunctions"
      @functions-updated="handleFunctionsUpdated"
    />
  </div>
</template>

<script setup lang="ts">
import type { FileRef, FunctionRef } from '~/composables/useProjectStore'
import FunctionSelectorModal from './FunctionSelectorModal.vue'

const {
  activeContextSet,
  filesManifest,
  removeFileFromActiveContextSet,
  loadFileContent,
  fileTree,
  saveWorkingCopyToOPFS,
  selectedFolder
} = useProjectStore()

const { announceStatus, announceError } = useAccessibility()

// Reactive state for function selection modal
const isFunctionModalOpen = ref(false)
const selectedFileId = ref('')
const selectedFileFunctions = ref<FunctionRef[]>([])

// Computed file list with resolved paths
const fileList = computed(() => {
  if (!activeContextSet.value) return []
  return activeContextSet.value.files
})

// Helper functions
const getFileId = (fileEntry: string | FileRef): string => {
  return typeof fileEntry === 'string' ? fileEntry : fileEntry.fileRef
}

const getFilePath = (fileEntry: string | FileRef): string => {
  const fileId = getFileId(fileEntry)
  return filesManifest.value[fileId]?.path || 'Unknown file'
}

const getFileName = (fileEntry: string | FileRef): string => {
  const path = getFilePath(fileEntry)
  return path.split('/').pop() || path
}

const getFileExtension = (fileEntry: string | FileRef): string => {
  const fileName = getFileName(fileEntry)
  const ext = fileName.split('.').pop()?.toLowerCase()
  return ext || ''
}

const hasFunctionRefs = (fileEntry: string | FileRef): boolean => {
  return typeof fileEntry === 'object' && !!fileEntry.functionRefs?.length
}

const getFunctionRefs = (fileEntry: string | FileRef): FunctionRef[] => {
  if (typeof fileEntry === 'object' && fileEntry.functionRefs) {
    return fileEntry.functionRefs
  }
  return []
}

const getFileComment = (fileEntry: string | FileRef): string => {
  if (typeof fileEntry === 'object' && fileEntry.comment) {
    return fileEntry.comment
  }
  return ''
}

const getFileIcon = (fileEntry: string | FileRef): string => {
  const extension = getFileExtension(fileEntry)
  
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

const getFileIconColor = (fileEntry: string | FileRef): string => {
  const extension = getFileExtension(fileEntry)
  
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

// Actions
const viewFile = async (fileEntry: string | FileRef) => {
  const filePath = getFilePath(fileEntry)
  const fileName = getFileName(fileEntry)
  
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

const selectFunctions = (fileEntry: string | FileRef) => {
  const fileId = getFileId(fileEntry)
  const fileName = getFileName(fileEntry)
  
  // Set up modal state
  selectedFileId.value = fileId
  selectedFileFunctions.value = getFunctionRefs(fileEntry)
  isFunctionModalOpen.value = true
  
  announceStatus(`Opening function selector for: ${fileName}`)
}

const handleFunctionsUpdated = async (newFunctions: FunctionRef[]) => {
  if (!activeContextSet.value || !selectedFileId.value) return
  
  const fileId = selectedFileId.value
  const fileName = filesManifest.value[fileId]?.path.split('/').pop() || 'Unknown file'
  
  // Find the file entry in the active context set
  const fileIndex = activeContextSet.value.files.findIndex(fileEntry => {
    const entryId = typeof fileEntry === 'string' ? fileEntry : fileEntry.fileRef
    return entryId === fileId
  })
  
  if (fileIndex === -1) {
    announceError(`File not found in context set: ${fileName}`)
    return
  }
  
  // Update the file entry with new function refs (direct mutation)
  if (newFunctions.length === 0) {
    // Convert back to simple string reference (whole file)
    activeContextSet.value.files[fileIndex] = fileId
  } else {
    // Create or update FileRef object with function refs
    const fileRef: FileRef = {
      fileRef: fileId,
      functionRefs: [...newFunctions],
      comment: typeof activeContextSet.value.files[fileIndex] === 'object' 
        ? activeContextSet.value.files[fileIndex].comment 
        : ''
    }
    activeContextSet.value.files[fileIndex] = fileRef
  }
  
  // Explicitly save to OPFS
  if (selectedFolder.value) {
    await saveWorkingCopyToOPFS(selectedFolder.value.name)
  }
  
  // Close modal and announce success
  isFunctionModalOpen.value = false
  selectedFileId.value = ''
  selectedFileFunctions.value = []
  
  if (newFunctions.length === 0) {
    announceStatus(`Removed function selections for ${fileName} - now including whole file`)
  } else {
    announceStatus(`Updated functions for ${fileName}: ${newFunctions.length} function${newFunctions.length !== 1 ? 's' : ''} selected`)
  }
}

const removeFile = (fileEntry: string | FileRef) => {
  const fileId = getFileId(fileEntry)
  const fileName = getFileName(fileEntry)
  
  try {
    const success = removeFileFromActiveContextSet(fileId)
    if (success) {
      announceStatus(`Removed ${fileName} from context set`)
    } else {
      announceError(`Failed to remove ${fileName} from context set`)
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to remove file'
    announceError(message)
  }
}
</script> 