<!--
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
-->
<template>
  <div class="space-y-4">
    <!-- Header -->
    <div class="flex items-center justify-between">
      <div>
        <h3 class="text-lg font-medium text-foreground">All Files in Manifest</h3>
        <p class="text-sm text-muted-foreground">
          Files automatically added when included in any context set
        </p>
      </div>
    </div>

    <!-- Empty State -->
    <div v-if="manifestFiles.length === 0" class="text-center py-8 border-2 border-dashed border-muted rounded-lg">
      <Icon name="lucide:file-x" class="w-12 h-12 mx-auto mb-4 text-muted-foreground opacity-50" aria-hidden="true" />
      <h4 class="text-lg font-medium text-foreground mb-2">No Files in Manifest</h4>
      <p class="text-muted-foreground max-w-sm mx-auto">
        Files will appear here automatically when you add them to context sets.
      </p>
    </div>

    <!-- Files List -->
    <div v-else class="space-y-3">
      <div
        v-for="(file, index) in manifestFiles"
        :key="file.id"
        class="group relative bg-card rounded-lg border p-4 transition-all duration-200 hover:shadow-elegant"
      >
        <!-- File Info -->
        <div class="flex items-start justify-between">
          <div class="flex-1 min-w-0">
            <!-- File Path -->
            <div class="flex items-center space-x-2 mb-2">
              <Icon 
                :name="getFileIcon(file.path)" 
                class="w-4 h-4 flex-shrink-0"
                :class="getFileIconColor(file.path)"
                aria-hidden="true"
              />
              <h4 class="text-sm font-medium text-foreground truncate">
                {{ getFileName(file.path) }}
              </h4>
              <span 
                v-if="getFileExtension(file.path)"
                class="px-2 py-0.5 text-xs font-mono rounded-full border"
                :class="getExtensionBadgeClasses(getFileExtension(file.path))"
              >
                {{ getFileExtension(file.path) }}
              </span>
            </div>

            <!-- Full File Path -->
            <p class="text-xs text-muted-foreground font-mono mb-3 truncate">
              {{ file.path }}
            </p>

            <!-- Global Comment -->
            <div class="mb-3">
              <label :for="`global-comment-${file.id}`" class="block text-xs font-medium text-foreground mb-1">
                Global Comment (applies to all context sets using this file):
              </label>
              <Textarea
                :id="`global-comment-${file.id}`"
                v-model="editingComments[file.id]"
                @blur="updateGlobalComment(file.id)"
                @keydown.enter.ctrl="updateGlobalComment(file.id)"
                class="w-full min-h-[60px] text-xs"
                placeholder="Optional: Describe this file's purpose in your project..."
              />
            </div>

            <!-- Usage Info -->
            <div class="flex items-center space-x-4 text-xs text-muted-foreground">
              <span class="flex items-center">
                <Icon name="lucide:layers" class="w-3 h-3 mr-1" aria-hidden="true" />
                Used in {{ getContextSetUsageCount(file.id) }} context set{{ getContextSetUsageCount(file.id) !== 1 ? 's' : '' }}
              </span>
              <span class="flex items-center">
                <Icon name="lucide:calendar" class="w-3 h-3 mr-1" aria-hidden="true" />
                Added automatically
              </span>
            </div>
          </div>

          <!-- Actions -->
          <div class="flex items-center space-x-2 ml-4">
            <!-- View Context Sets Using This File -->
            <Button
              @click="showUsage(file.id)"
              variant="ghost"
              size="sm"
              class="opacity-0 group-hover:opacity-100 transition-opacity duration-200"
              :aria-label="`View context sets using ${getFileName(file.path)}`"
              title="View usage in context sets"
            >
              <Icon name="lucide:eye" class="w-4 h-4" aria-hidden="true" />
            </Button>

            <!-- View File Content -->
            <Button
              @click="viewFile(file.id, file.path)"
              variant="ghost"
              size="sm"
              class="opacity-0 group-hover:opacity-100 transition-opacity duration-200"
              :aria-label="`View content of ${getFileName(file.path)}`"
              title="View file content"
            >
              <Icon name="lucide:file-text" class="w-4 h-4" aria-hidden="true" />
            </Button>
          </div>
        </div>
      </div>
    </div>

    <!-- Summary Info -->
    <div v-if="manifestFiles.length > 0" class="mt-6 p-4 bg-info/5 border border-info/20 rounded-lg">
      <div class="flex items-start space-x-3">
        <Icon name="lucide:info" class="w-5 h-5 text-info flex-shrink-0 mt-0.5" aria-hidden="true" />
        <div class="text-sm">
          <p class="text-info font-medium mb-1">Global Manifest Information</p>
          <ul class="text-info/80 space-y-1 text-xs">
            <li>• Files are automatically added here when included in any context set</li>
            <li>• Global comments apply to the file across all context sets</li>
            <li>• Context-specific comments can be added within individual context sets</li>
            <li>• Files remain in the manifest even if removed from individual context sets</li>
          </ul>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
const {
  filesManifest,
  contextSets,
  updateFileManifestComment
} = useProjectStore()

const { announceStatus, announceError } = useAccessibility()

// Local editing state for comments
const editingComments = ref<Record<string, string>>({})

// Computed list of files with IDs
const manifestFiles = computed(() => {
  return Object.entries(filesManifest.value).map(([id, file]) => ({
    id,
    path: file.path,
    comment: file.comment
  }))
})

// Initialize editing comments when manifest changes
watch(filesManifest, (newManifest) => {
  Object.entries(newManifest).forEach(([id, file]) => {
    if (!(id in editingComments.value)) {
      editingComments.value[id] = file.comment || ''
    }
  })
}, { immediate: true })

// Helper functions
const getFileName = (path: string): string => {
  return path.split('/').pop() || path
}

const getFileExtension = (path: string): string => {
  const fileName = getFileName(path)
  const ext = fileName.split('.').pop()?.toLowerCase()
  return ext || ''
}

const getFileIcon = (path: string): string => {
  const extension = getFileExtension(path)
  
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

const getFileIconColor = (path: string): string => {
  const extension = getFileExtension(path)
  
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

const getContextSetUsageCount = (fileId: string): number => {
  let count = 0
  Object.values(contextSets.value).forEach(contextSet => {
    const hasFile = contextSet.files.some(file => {
      if (typeof file === 'string') {
        return file === fileId
      } else {
        return file.fileRef === fileId
      }
    })
    if (hasFile) count++
  })
  return count
}

// Actions
const updateGlobalComment = (fileId: string) => {
  const newComment = editingComments.value[fileId]?.trim() || ''
  const currentComment = filesManifest.value[fileId]?.comment || ''
  
  if (newComment === currentComment) return
  
  try {
    updateFileManifestComment(fileId, newComment)
    announceStatus('Global comment updated')
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to update comment'
    announceError(message)
    
    // Revert the editing state
    editingComments.value[fileId] = currentComment
  }
}

const showUsage = (fileId: string) => {
  const fileName = getFileName(filesManifest.value[fileId]?.path || '')
  const usageCount = getContextSetUsageCount(fileId)
  
  announceStatus(`${fileName} is used in ${usageCount} context set${usageCount !== 1 ? 's' : ''}`)
  
  // TODO: Implement usage modal/drawer (future enhancement)
}

const viewFile = (fileId: string, filePath: string) => {
  const fileName = getFileName(filePath)
  announceStatus(`Viewing file: ${fileName}`)
  
  // TODO: Implement file content viewer (CP03 enhancement)
}
</script> 