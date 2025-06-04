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
      <!-- Primary Export JSON Button - Made Prominent -->
      <Button 
        v-if="hasAnyContextSets"
        @click="exportContextSets"
        variant="default" 
        size="default"
        class="bg-primary hover:bg-primary/90 text-primary-foreground font-medium px-6 py-2.5 shadow-lg hover:shadow-xl transition-all duration-200 ring-2 ring-primary/20 hover:ring-primary/40"
      >
        <Icon name="lucide:download" class="w-5 h-5 mr-2" aria-hidden="true" />
        Export JSON
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
        
        <div class="w-px h-4 bg-border" aria-hidden="true" />
        
        <!-- Undo/Redo Controls -->
        <div class="flex items-center gap-1">               
          <Button
            variant="ghost"
            size="sm"
            class="h-6 w-6 p-0 text-xs"
            :disabled="!autoSaveState.canUndo"
            @click="handleUndo"
            title="Undo (Ctrl+Z)"
            :aria-label="autoSaveState.canUndo ? 'Undo last action' : 'No actions to undo'"
          >
            <Icon name="lucide:undo" class="w-3 h-3" aria-hidden="true" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            class="h-6 w-6 p-0 text-xs"
            :disabled="!autoSaveState.canRedo"
            @click="handleRedo"
            title="Redo (Ctrl+Y)"
            :aria-label="autoSaveState.canRedo ? 'Redo last action' : 'No actions to redo'"
          >
            <Icon name="lucide:redo" class="w-3 h-3" aria-hidden="true" />
          </Button>
        </div>
      </div>
      
      <!-- Force Save Button (when there are unsaved changes) -->
      <Button
        v-if="autoSaveState.isDirty"
        @click="handleForceSave"
        variant="outline"
        size="sm"
        class="px-3 py-2 sm:px-4 hover:shadow-sm transition-all duration-200"
        :disabled="autoSaveState.isSaving"
        :aria-label="autoSaveState.isSaving ? 'Saving...' : 'Save changes now'"
        title="Save Now (Ctrl+S)"
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
        @click="handleClearProjectWithConfirmation"
        variant="ghost"
        size="sm"
        class="p-2 hover:bg-destructive/10 transition-colors duration-200"
        :aria-label="`Clear current project`"
        title="Clear project"
      >
        <Icon name="lucide:trash-2" class="w-5 h-5" aria-hidden="true" />
        <span class="sr-only">Clear project</span>
      </Button>
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
  generateContextSetsJSON
} = useProjectStore()

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

// Export functionality
const exportContextSets = () => {
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
    
    // Show success modal instead of notification
    showExportSuccessModal.value = true
    announceStatus('Context sets exported successfully')
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to export context sets'
    errorWithRetry(
      'Export Failed',
      message,
      exportContextSets
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
