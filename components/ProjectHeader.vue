<!--
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
-->
<template>  
  <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
    <div class="flex-1 min-w-0">
      <div class="flex items-center gap-0 mb-2">
        <h2 id="project-info-heading" class="text-xl lg:text-5xl xl:text-6xl font-semibold tracking-tight">
          {{ selectedFolder?.name || 'Context Sets Manager' }}
        </h2>
        
        <!-- Secondary Actions -->
        <div v-if="selectedFolder" class="flex items-center gap-2">
          <!-- Refresh Project Button -->
          <Button
            variant="outline"
            size="sm"
            class="px-3 py-2 hover:shadow-sm transition-all duration-200"
            :disabled="isRefreshingFiles"
            :aria-label="isRefreshingFiles ? 'Reloading files...' : 'Refresh project from local folder'"
            title="Refresh Project"
            @click="handleRefreshFiles"
          >
            <Icon 
              :name="isRefreshingFiles ? 'lucide:loader-2' : 'lucide:refresh-cw'" 
              :class="[
                'w-4 h-4 mr-0',
                isRefreshingFiles ? 'animate-spin' : ''
              ]" 
              aria-hidden="true" 
            />
            {{ isRefreshingFiles ? 'Reloading...' : 'Reload Files' }}
          </Button>
        </div>
      </div>
      
      <p class="text-sm lg:text-sm text-muted-foreground">
        {{ selectedFolder ? 
          `Project auto-loaded from browser cache (OPFS), no re-uploading needed across sessions` : 
          'Create and manage context sets for your codebase' 
        }}
        {{ autoLoadedFromProject ? ' • context-sets.json auto-loaded' : '' }}
      </p>
    </div>
    
    <div class="flex flex-wrap items-center gap-2 sm:gap-3" role="toolbar" aria-label="Project actions">
      <!-- Primary Actions Group - Download and Preview -->
      <div v-if="hasAnyContextSets" class="flex items-center gap-3 p-1 bg-muted/30 rounded-lg border border-muted/50">
        <!-- Export Label -->
        <span class="text-sm font-medium text-muted-foreground px-0">Export:</span>
        
        <!-- Preview JSON Button - Secondary Action -->
        <Button 
          variant="secondary"
          size="xl"
          class="px-4 py-3 font-medium transition-all duration-200 bg-indigo-900 hover:bg-indigo-800 text-white hover:text-white border-indigo-900"
          title="Preview context-sets.json output"
          @click="handlePreviewContextSetsJSON"
        >
          <Icon name="lucide:eye" class="w-4 h-4 mr-2" aria-hidden="true" />
          Preview/Copy
        </Button>

        <!-- Download JSON Button - Primary Action -->
        <Button 
          variant="default"
          size="xl" 
          class="font-medium px-5 py-3 shadow-md hover:shadow-lg transition-all duration-200 bg-indigo-700 hover:bg-indigo-500 text-white border-indigo-700"
          @click="handleDownloadJSON"
        >
          <Icon name="lucide:download" class="w-4 h-4 mr-2" aria-hidden="true" />
          Download
        </Button>
      </div>
    </div>
  </div>

  <!-- Export Success Modal -->
  <HowToUseModal 
    v-model:open="showExportSuccessModal" 
    title="🎉 Export Successful!"
    description="Your context sets have been exported successfully. Follow the setup below to enable intelligent context switching in your IDE."
    :example-context-set-name="firstContextSetName"
    :show-success-icon="true"
  />

</template>

<script setup lang="ts">
import { logger } from '~/utils/logger'

interface Props {
  autoLoadedFromProject?: boolean
}

const _props = withDefaults(defineProps<Props>(), {
  autoLoadedFromProject: false
})

const emit = defineEmits<{
  (e: 'clear-project'): void
}>()


// Use the project store
const {
  selectedFolder,
  contextSets,
  generateContextSetsJSONWithPrefix,
  fileTree,
  previewContextSetsJSONWithPrefix
} = useProjectStore()

// Smart Context Suggestions (for cache clearing and embedding generation)
const { clearCache, clearIndexedDBCache, generateEmbeddingsOnDemand } = useSmartContextSuggestions()

// Project Manager (for reloading files)
const { reloadFilesFromLocal } = useProjectManager()

// Check if user has created any context sets (for showing Export button prominently)
const hasAnyContextSets = computed(() => {
  return contextSets.value && Object.keys(contextSets.value).length > 0
})

// Get first context set name for example
const firstContextSetName = computed(() => {
  if (contextSets.value && Object.keys(contextSets.value).length > 0) {
    return Object.keys(contextSets.value)[0]
  }
  return 'myContextSet'
})

// Advanced UX Systems
const { success, warning, errorWithRetry } = useNotifications()

// Accessibility support
const { announceStatus, announceError } = useAccessibility()

// Modal state
const showExportSuccessModal = ref(false)

// Project management state
const isRefreshingFiles = ref(false)

// Helper function to prepare files for embedding generation
async function prepareFilesForEmbedding(fileTree: any[]): Promise<Array<{ path: string; content: string }>> {
  const { isLanguageSupported } = useRegexCodeParser()
  const files: Array<{ path: string; content: string }> = []
  
  const traverse = async (items: any[]) => {
    for (const item of items) {
      if (item.type === 'file' && item.handle && isLanguageSupported(item.path)) {
        try {
          const fileHandle = item.handle as FileSystemFileHandle
          const file = await fileHandle.getFile()
          const content = await file.text()
          files.push({ path: item.path, content })
        } catch (error) {
          logger.warn(`Failed to read file ${item.path}:`, error)
        }
      } else if (item.type === 'directory' && item.children) {
        await traverse(item.children)
      }
    }
  }
  
  await traverse(fileTree)
  return files
}





// Handle file refresh
const handleRefreshFiles = async () => {
  isRefreshingFiles.value = true
  
  try {
    // Clear analysis cache before reloading files to ensure fresh analysis
    clearCache()
    await clearIndexedDBCache()
    
    const refreshSuccess = await reloadFilesFromLocal()
    
    if (refreshSuccess) {
      success(
        'Files Refreshed',
        'Project files have been refreshed from your local folder'
      )
      announceStatus('Project files refreshed successfully')
      
      // Auto-generate embeddings for refreshed projects
      try {
        
        // Convert file tree to simple format for embedding generation
        const treeValue = fileTree?.value || []
        const filesToAnalyze = await prepareFilesForEmbedding(treeValue)
        
        if (filesToAnalyze.length > 0) {
          await generateEmbeddingsOnDemand(filesToAnalyze)
        }
      } catch (error) {
        logger.warn('⚠️ Error during automatic embedding generation after refresh:', error)
      }
    } else {
      warning(
        'Refresh Cancelled',
        'File refresh was cancelled or failed'
      )
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    errorWithRetry(
      'Refresh Failed',
      `Error refreshing files: ${message}`,
      handleRefreshFiles
    )
    announceError(`Error refreshing files: ${message}`)
  } finally {
    isRefreshingFiles.value = false
  }
}


// Download JSON functionality (existing)
const handleDownloadJSON = async () => {
  try {
    const contextSetsData = generateContextSetsJSONWithPrefix(undefined, true) // Include timestamp
    const jsonString = JSON.stringify(contextSetsData, null, 2)
    
    // Create and download the file
    const blob = new Blob([jsonString], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'context-sets.json'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
    
    
    // Show success modal
    showExportSuccessModal.value = true
    announceStatus('Context sets downloaded successfully')
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to download context sets'
    errorWithRetry(
      'Download Failed',
      message,
      handleDownloadJSON
    )
    announceError(message)
  }
}


async function handleClearProjectWithConfirmation() {
  emit('clear-project')
  success('Project Cleared', 'Project has been cleared successfully')
  announceStatus('Project cleared')
}



// Preview JSON with context: prefix
const handlePreviewContextSetsJSON = () => {
  previewContextSetsJSONWithPrefix()
}

// Watch for auto-load announcements with enhanced feedback
watch(() => _props.autoLoadedFromProject, (loaded) => {
  if (loaded) {
    success('Auto-loaded', 'Context sets auto-loaded from existing file')
    announceStatus('Context sets auto-loaded from existing file')
  }
})
</script>
