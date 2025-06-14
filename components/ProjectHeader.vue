/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */
<template>  
  <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
    <div class="flex-1 min-w-0">
      <h2 id="project-info-heading" class="text-xl lg:text-5xl xl:text-6xl mb-2 font-semibold tracking-tight">
        {{ selectedFolder?.name || 'Context Sets Manager' }}
      </h2>
      <p class="text-sm lg:text-base text-muted-foreground">
        {{ selectedFolder ? 
          `Project loaded seamlessly from browser cache (OPFS) - no re-uploading needed across sessions` : 
          'Create and manage context sets for your codebase' 
        }}
        {{ autoLoadedFromProject ? ' • context-sets.json auto-loaded' : '' }}
      </p>
    </div>
    
    <div class="flex flex-wrap items-center gap-2 sm:gap-3" role="toolbar" aria-label="Project actions">
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
            'w-4 h-4 mr-2',
            isRefreshingFiles ? 'animate-spin' : ''
          ]" 
          aria-hidden="true" 
        />
        {{ isRefreshingFiles ? 'Reloading...' : 'Reload Files' }}
      </Button>
      
      <!-- Primary Export JSON Button - Made Prominent -->
      <Button 
        v-if="hasAnyContextSets"
        variant="default"
        size="default" 
        :class="[
          'font-medium px-6 py-2.5 shadow-lg hover:shadow-xl transition-all duration-200 ring-2 hover:ring-primary/40',
          exportStatus.hasStableVersion 
            ? 'bg-primary hover:bg-primary/90 text-primary-foreground ring-primary/20' 
            : 'bg-orange-600 hover:bg-orange-700 text-white ring-orange-500/30 hover:ring-orange-500/50 animate-pulse'
        ]"
        @click="showExportOptions"
      >
        <Icon name="lucide:save" class="w-5 h-5 mr-2" aria-hidden="true" />
        {{ exportStatus.hasStableVersion ? 'Commit Changes' : 'Save to Project' }}
      </Button>
      
      <!-- Preview JSON Output Button -->
      <Button 
        v-if="hasAnyContextSets"
        variant="outline"
        size="sm"
        class="px-3 py-2"
        title="Preview context-sets.json output"
        @click="previewContextSetsJSON"
      >
        <Icon name="lucide:eye" class="w-4 h-4 mr-2" aria-hidden="true" />
        Preview JSON
      </Button>
      
      <!-- Auto-save Status & Secondary Controls -->
      <div class="hidden lg:flex items-center gap-2 px-3 py-2 bg-muted/50 rounded-md text-xs xl:text-sm text-muted-foreground">
        <div class="flex items-center gap-1">
          <div 
            :class="[
              'w-2 h-2 rounded-full',
              autoSaveState.isSaving ? 'bg-warning animate-pulse' : 
              autoSaveState.isDirty ? 'bg-warning' : 'bg-success'
            ]"
            :aria-label="autoSaveStatus"
          />
          <span>{{ autoSaveStatus }}</span>
        </div>
        
        <!-- Export Status Indicator -->
        <div v-if="hasAnyContextSets" class="flex items-center gap-1">
          <div class="w-px h-4 bg-border" aria-hidden="true" />
          <div class="flex items-center gap-1">
            <div 
              :class="[
                'w-2 h-2 rounded-full',
                exportStatus.hasStableVersion ? 'bg-green-500' : 'bg-yellow-500'
              ]"
              :aria-label="exportStatusText"
            />
            <span class="text-xs">{{ exportStatusText }}</span>
          </div>
        </div>
        
        <div class="w-px h-4 bg-border" aria-hidden="true" />
        
        <!-- Undo/Redo Controls -->
        <div class="flex items-center gap-1">               
          <Button
            variant="ghost"
            size="sm"
            class="h-6 w-6 p-0 text-xs"
            :disabled="!autoSaveState.canUndo"
            title="Undo (Ctrl+Z)"
            :aria-label="autoSaveState.canUndo ? 'Undo last action' : 'No actions to undo'"
            @click="handleUndo"
          >
            <Icon name="lucide:undo" class="w-3 h-3" aria-hidden="true" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            class="h-6 w-6 p-0 text-xs"
            :disabled="!autoSaveState.canRedo"
            title="Redo (Ctrl+Y)"
            :aria-label="autoSaveState.canRedo ? 'Redo last action' : 'No actions to redo'"
            @click="handleRedo"
          >
            <Icon name="lucide:redo" class="w-3 h-3" aria-hidden="true" />
          </Button>
        </div>
      </div>
      
      <!-- Force Save Button (when there are unsaved changes) -->
      <Button
        v-if="autoSaveState.isDirty"
        variant="outline"
        size="sm"
        class="px-3 py-2 sm:px-4 hover:shadow-sm transition-all duration-200"
        :disabled="autoSaveState.isSaving"
        :aria-label="autoSaveState.isSaving ? 'Saving...' : 'Save changes now'"
        title="Save Now (Ctrl+S)"
        @click="handleForceSave"
      >
        <Icon 
          :name="autoSaveState.isSaving ? 'lucide:loader-2' : 'lucide:save'" 
          :class="[
            'w-4 h-4 mr-2',
            autoSaveState.isSaving ? 'animate-spin' : ''
          ]" 
          aria-hidden="true" 
        />
        {{ autoSaveState.isSaving ? 'Saving...' : 'Save' }}
      </Button>
      
      <!-- Clear Project Button -->
      <Button
        variant="ghost"
        size="sm"
        class="p-2 hover:bg-destructive/10 transition-colors duration-200"
        :aria-label="`Clear current project`"
        title="Clear project"
        @click="handleClearProjectWithConfirmation"
      >
        <Icon name="lucide:trash-2" class="w-5 h-5" aria-hidden="true" />
        <span class="sr-only">Clear project</span>
      </Button>
    </div>
  </div>

  <!-- Working Copy Status Message -->
  <div v-if="hasAnyContextSets" class="flex items-center justify-center gap-3 text-xs text-muted-foreground bg-muted/30 px-3 py-2 rounded-md border border-muted">
    <div class="flex items-center gap-1">
      <Icon name="lucide:check-circle-2" class="w-3 h-3 text-green-600" />
      <span>Changes auto-saved to workspace</span>
    </div>
    <div v-if="!exportStatus.hasStableVersion" class="flex items-center gap-1">
      <Icon name="lucide:upload" class="w-3 h-3 text-yellow-600" />
      <span>Click "{{ exportStatus.hasStableVersion ? 'Commit Changes' : 'Save to Project' }}" to update project file</span>
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

  <!-- Export Menu Modal -->
  <Dialog v-model:open="showExportMenuModal">
    <DialogContent class="sm:max-w-md">
      <DialogHeader>
        <DialogTitle class="flex items-center gap-3">
          <Icon name="lucide:save" class="w-5 h-5" />
          Save Context Sets
        </DialogTitle>
        <DialogDescription>
          Your changes are auto-saved to workspace. Choose how to commit them to your project.
        </DialogDescription>
      </DialogHeader>
      
      <div class="space-y-3 mt-6">
        <!-- Download JSON Option -->
        <Button
          variant="outline"
          size="default"
          class="w-full justify-start p-4 h-auto"
          @click="handleExportMenuChoice('download')"
        >
          <div class="flex items-center">
            <Icon name="lucide:download" class="w-5 h-5 mr-3 text-primary" aria-hidden="true" />
            <div class="text-left">
              <div class="font-medium">Download JSON</div>
              <div class="text-sm text-muted-foreground">Download for sharing across projects or backup</div>
            </div>
          </div>
        </Button>
        
        <!-- Export to Project Option -->
        <Button
          variant="outline"
          size="default"
          class="w-full justify-start p-4 h-auto"
          :disabled="!exportStatus.canExport"
          @click="handleExportMenuChoice('export')"
        >
          <div class="flex items-center">
            <Icon name="lucide:folder-check" class="w-5 h-5 mr-3 text-primary" aria-hidden="true" />
            <div class="text-left">
              <div class="font-medium">Commit to Project</div>
              <div class="text-sm text-muted-foreground">
                Update the context-sets.json in your project folder
              </div>
            </div>
          </div>
        </Button>
      </div>
      
      <DialogFooter class="mt-6">
        <Button variant="ghost" @click="showExportMenuModal = false">
          Cancel
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>

<script setup lang="ts">
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

interface Props {
  autoLoadedFromProject?: boolean
}

const _props = withDefaults(defineProps<Props>(), {
  autoLoadedFromProject: false
})

const emit = defineEmits<{
  (e: 'clear-project'): void
}>()

// Analytics helpers
const { trackDownload } = useAnalyticsHelpers()

// Use the project store
const {
  selectedFolder,
  contextSets,
  generateContextSetsJSON,
  exportToProjectFolder,
  getExportStatus,
  hasStableVersionInProject,
  reloadFilesFromLocal,
  fileTree,
  previewContextSetsJSON
} = useProjectStore()

// Hybrid Analysis
const { performHybridAnalysis } = useHybridAnalysis()

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
const { success, warning, info, errorWithRetry } = useNotifications()
const { state: autoSaveState, forceSave, undo, redo } = useAutoSave(
  contextSets,
  {
    key: 'context-sets',
    saveInterval: 30000,
    enableUndo: true,
    onSave: async (data) => {
      // Auto-save to localStorage (silent background operation)
      console.log('Auto-saving context sets:', data)
    },
    onRestore: (_data) => {
      // Handle restored data
      info('Draft Restored', 'Your previous work has been restored from auto-save')
    }
  }
)

// Accessibility support
const { announceStatus, announceError } = useAccessibility()

// Modal state
const showExportSuccessModal = ref(false)
const showExportMenuModal = ref(false)
const exportMenuAction = ref<'download' | 'export' | null>(null)

// Project management state
const isRefreshingFiles = ref(false)

// Export status tracking
const exportStatus = ref<{
  hasWorkingCopy: boolean
  hasStableVersion: boolean
  workingCopyMetadata?: unknown
  canExport: boolean
}>({
  hasWorkingCopy: false,
  hasStableVersion: false,
  canExport: false
})

// Update export status when context sets change
watch(contextSets, async () => {
  if (hasAnyContextSets.value) {
    exportStatus.value = await getExportStatus()
  }
}, { immediate: true })

// Auto-save status indicator
const autoSaveStatus = computed(() => {
  if (autoSaveState.value.isSaving) return 'Saving...'
  if (autoSaveState.value.isDirty) return 'Unsaved changes'
  if (autoSaveState.value.lastSaved) {
    const timeSince = Date.now() - autoSaveState.value.lastSaved.getTime()
    const minutes = Math.floor(timeSince / 60000)
    if (minutes < 1) return 'Saved just now'
    if (minutes === 1) return 'Saved 1 minute ago'
    return `Saved ${minutes} minutes ago`
  }
  return 'All changes saved'
})

// Export status indicator
const exportStatusText = computed(() => {
  if (!hasAnyContextSets.value) return ''
  
  if (exportStatus.value.hasStableVersion) {
    return 'Committed'
  } else {
    return 'Uncommitted'
  }
})

// Show export options menu
const showExportOptions = () => {
  showExportMenuModal.value = true
}

// Handle file refresh
const handleRefreshFiles = async () => {
  isRefreshingFiles.value = true
  
  try {
    const refreshSuccess = await reloadFilesFromLocal()
    
    if (refreshSuccess) {
      success(
        'Files Refreshed',
        'Project files have been refreshed from your local folder'
      )
      announceStatus('Project files refreshed successfully')
      
      // Auto-trigger hybrid analysis for refreshed projects
      try {
        console.log('🚀 Auto-triggering hybrid analysis for refreshed project...')
        
        // Convert file tree to simple format for analysis
        const treeValue = fileTree?.value || []
        const analysisResult = await performHybridAnalysis(treeValue, { silent: false })
        
        if (analysisResult.success) {
          console.log('✅ Automatic hybrid analysis completed after refresh')
        } else {
          console.warn('⚠️ Automatic hybrid analysis failed after refresh, but continuing')
        }
      } catch (error) {
        console.warn('⚠️ Error during automatic hybrid analysis after refresh:', error)
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

// Handle export menu selection
const handleExportMenuChoice = async (action: 'download' | 'export') => {
  showExportMenuModal.value = false
  exportMenuAction.value = action
  
  if (action === 'download') {
    await handleDownloadJSON()
  } else if (action === 'export') {
    await handleExportToProject()
  }
}

// Download JSON functionality (existing)
const handleDownloadJSON = async () => {
  try {
    const contextSetsData = generateContextSetsJSON()
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
    
    // Track the download
    trackDownload('context_sets')
    
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

// Export to project folder functionality (new)
const handleExportToProject = async () => {
  try {
    // Check if stable version exists and warn user
    const hasStable = await hasStableVersionInProject()
    
    if (hasStable) {
      warning(
        'Overwrite Existing File',
        'A context-sets.json file already exists in your project. Exporting will overwrite it with your current working copy.',
        {
          persistent: true,
          actions: [
            {
              label: 'Overwrite',
              action: async () => await performExportToProject(),
              style: 'primary'
            },
            {
              label: 'Cancel',
              action: () => {},
              style: 'secondary'
            }
          ]
        }
      )
    } else {
      await performExportToProject()
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to export to project'
    errorWithRetry(
      'Export Failed',
      message,
      handleExportToProject
    )
    announceError(message)
  }
}

// Perform the actual export to project
const performExportToProject = async () => {
  try {
    const result = await exportToProjectFolder()
    
    if (result.success) {
      success(
        'Export Successful!',
        'Your context sets have been saved to context-sets.json in your project folder. This stable version will be loaded when you next open this project.'
      )
      announceStatus('Context sets exported to project folder successfully')
      
      // Update export status
      exportStatus.value = await getExportStatus()
    } else {
      errorWithRetry(
        'Export Failed',
        result.error || 'Unknown error occurred',
        handleExportToProject
      )
      announceError(result.error || 'Failed to export to project')
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to export to project'
    errorWithRetry(
      'Export Failed',
      message,
      handleExportToProject
    )
    announceError(message)
  }
}

async function handleClearProjectWithConfirmation() {
  if (autoSaveState.value.isDirty) {
    warning(
      'Unsaved Changes', 
      'You have unsaved changes. Are you sure you want to clear the project?',
      {
        persistent: true,
        actions: [
          {
            label: 'Clear Anyway',
            action: () => {
              emit('clear-project')
              success('Project Cleared', 'Project has been cleared successfully')
              announceStatus('Project cleared')
            },
            style: 'primary'
          },
          {
            label: 'Cancel',
            action: () => {},
            style: 'secondary'
          }
        ]
      }
    )
  } else {
    emit('clear-project')
    success('Project Cleared', 'Project has been cleared successfully')
    announceStatus('Project cleared')
  }
}

async function handleForceSave() {
  try {
    await forceSave()
    success('Saved', 'Changes saved successfully')
    announceStatus('Changes saved manually')
  } catch {
    errorWithRetry(
      'Save Failed',
      'Could not save your changes. Please try again.',
      handleForceSave
    )
  }
}

function handleUndo() {
  if (autoSaveState.value.canUndo) {
    undo()
    announceStatus('Action undone')
  } else {
    warning('Nothing to Undo', 'No actions available to undo')
  }
}

function handleRedo() {
  if (autoSaveState.value.canRedo) {
    redo()
    announceStatus('Action redone')
  } else {
    warning('Nothing to Redo', 'No actions available to redo')
  }
}

// Watch for auto-load announcements with enhanced feedback
watch(() => _props.autoLoadedFromProject, (loaded) => {
  if (loaded) {
    success('Auto-loaded', 'Context sets auto-loaded from existing file')
    announceStatus('Context sets auto-loaded from existing file')
  }
})
</script>
