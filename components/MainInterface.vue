<!--
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
-->
<template>
  <div class="min-h-screen-dynamic">
    <!-- Navigation -->
    <AppNav 
      :is-file-system-supported="isFileSystemSupported"
      @select-project="emit('select-project')"
    />
    
    <!-- LLM Loading Screen - Only show when no download in progress and models need initialization -->
    <LLMLoadingScreen v-if="showFullScreenLoader" />
    
    <!-- Main Content -->
    <div 
      v-show="!showFullScreenLoader" 
      class="mx-auto px-4 sm:px-6 lg:px-8 mt-12 max-w-full lg:max-w-screen-2xl xl:max-w-screen-2xl space-y-6 lg:space-y-8 py-4 lg:py-6"
    >
      <!-- Two-Column Layout: Project Header + Context Set Composition -->
      <section role="region" aria-labelledby="main-workspace-heading">
        <h2 id="main-workspace-heading" class="sr-only">Main Workspace</h2>
        
        <div class="bg-gradient-surface rounded-t-lg p-4 lg:p-6 border border-b-0 shadow-sophisticated backdrop-blur-sm">
          <!-- Project Header Component -->
          <ProjectHeader 
            :auto-loaded-from-project="autoLoadedFromProject"
            @clear-project="emit('clear-project')"
          />
          

          <!-- Auto-load error notification -->
          <div v-if="autoLoadError" class="mt-4 p-4 bg-destructive/10 border border-destructive/20 rounded-lg" role="alert" aria-live="assertive">
            <div class="flex items-start gap-3">
              <Icon name="lucide:alert-triangle" class="w-5 h-5 mt-0.5 flex-shrink-0 text-destructive" aria-hidden="true" />
              <div class="min-w-0 flex-1">
                <p class="text-sm font-medium mb-1 text-destructive">Auto-Load Error</p>
                <p class="text-xs text-destructive/80">
                  Error auto-loading context-sets.json: {{ autoLoadError }}
                </p>
              </div>
            </div>
          </div>
        </div>

        <!-- Three-Column Content Area -->
        <div class="grid grid-cols-1 xl:grid-cols-4 gap-0 min-h-[800px]">
          
          <!-- Left Column: Context Sets Management (1/4 width) -->
          <div class="xl:col-span-1 bg-gradient-surface rounded-bl-lg border border-t-0 border-r-0 shadow-sophisticated backdrop-blur-sm">
            <div class="p-4 lg:p-6">
              <!-- Context Sets Management -->
              <div role="region" aria-labelledby="context-sets-heading">
                <h3 id="context-sets-heading" class="sr-only">Context Sets Management</h3>
                <ContextSetListManager />
              </div>
            </div>
          </div>

          <!-- Middle Column: Context Set Composition (2/4 width) -->
          <div class="xl:col-span-3 bg-card border border-t-0 border-r-0 shadow-lg overflow-hidden">
            <ActiveContextComposer />
          </div>

        </div>
      </section>

      <!-- Optional: Global Files Manifest Viewer (responsive) -->
      <section 
        v-if="Object.keys(filesManifest).length > 0"
        role="region" 
        aria-labelledby="files-manifest-heading"
      >
        <details class="bg-gradient-surface rounded-lg border shadow-sophisticated overflow-hidden backdrop-blur-sm">
          <summary class="p-4 lg:p-6 border-b bg-gradient-warm cursor-pointer hover:bg-surface-2 transition-colors duration-200">
            <div class="flex items-center justify-between">
              <div>
                <h3 id="files-manifest-heading" class="text-lg lg:text-xl font-semibold mb-1">
                  Global Files Manifest
                </h3>
                <p class="text-sm lg:text-base text-muted-foreground">
                  {{ Object.keys(filesManifest).length }} files registered • Click to view and manage global comments
                </p>
              </div>
              <Icon name="lucide:chevron-down" class="w-5 h-5 text-muted-foreground transition-transform duration-200" aria-hidden="true" />
            </div>
          </summary>
          
          <div class="p-4 lg:p-6 bg-surface-1">
            <div class="animate-fadeIn">
              <GlobalFilesManifestViewer />
            </div>
          </div>
        </details>
      </section>
    </div>

    <!-- File Content Modal -->
    <FileContentModal />
  </div>
</template>

<script setup lang="ts">
import AIToolsPanel from '~/components/AIToolsPanel.vue'
import { LLMService } from '~/plugins/llm.client'

interface Props {
  autoLoadedFromProject?: boolean
  autoLoadError?: string
  isFileSystemSupported?: boolean
}

const _props = withDefaults(defineProps<Props>(), {
  autoLoadedFromProject: false,
  autoLoadError: '',
  isFileSystemSupported: false
})

const emit = defineEmits<{
  (e: 'clear-project'): void
  (e: 'select-project'): void
}>()

// Use the project store
const {
  filesManifest
} = useProjectStore()

// Advanced UX Systems - keeping only what's needed for this component
const { info, errorWithRetry } = useNotifications()

// Accessibility support
const { announceStatus, announceError } = useAccessibility()

// LLM Loading state with multi-model support
const { 
  isLoading, 
  isReady, 
  hasError, 
  initializeLLM,
  modelStates,
  areAllModelsReady,
  getModelState,
  getOverallProgress 
} = useLLMLoader()

// Check if any model is currently downloading or initializing
const hasDownloadingModels = computed(() => {
  const availableModels = ['embeddings', 'textGeneration'] // Based on our model config
  return availableModels.some(modelKey => {
    const serviceStatus = LLMService.getStatus(modelKey)
    
    // If service status is 'loading', assume it's either downloading or initializing
    // We never want to show full screen loader during any loading phase
    return serviceStatus === 'loading'
  })
})

// Show full-screen loader: only when models aren't ready and aren't downloading
const showFullScreenLoader = computed(() => {
  const embedState = getModelState('embeddings').value
  const textGenState = getModelState('textGeneration').value
  
  
  // Never show if all models are ready (using composable that checks service status)
  if (areAllModelsReady.value) return false
  
  // Never show if models are downloading
  if (hasDownloadingModels.value) return false
  
  // Show if any model still needs initialization
  return true
})


// No need to manually initialize - models start downloading from the plugin

// Watch for LLM initialization feedback
watch(isReady, (ready) => {
  if (ready) {
    info('AI Ready', 'Local AI model initialized successfully')
    announceStatus('Local AI model ready')
  }
})

watch(hasError, (error) => {
  if (error) {
    errorWithRetry(
      'AI Initialization Failed',
      'Failed to initialize local AI model. Some features may be limited.',
      () => {
        initializeLLM()
      }
    )
    announceError('Local AI model initialization failed')
  }
})

// Watch for auto-load announcements with enhanced feedback
watch(() => _props.autoLoadedFromProject, (loaded) => {
  if (loaded) {
    info('Auto-loaded', 'Context sets auto-loaded from existing file')
    announceStatus('Context sets auto-loaded from existing file')
  }
})

watch(() => _props.autoLoadError, (error) => {
  if (error) {
    errorWithRetry(
      'Auto-load Failed',
      `Auto-load error: ${error}`,
      () => {
        // Retry auto-load logic here
        info('Retrying', 'Attempting to auto-load again...')
      }
    )
    announceError(`Auto-load error: ${error}`)
  }
})

</script>

<style scoped>
/* Enhanced details/summary styling */
details[open] summary .lucide-chevron-down {
  transform: rotate(180deg);
}

/* Grid responsive improvements */
@media (max-width: 1023px) {
  .grid {
    gap: 1rem;
  }
}

/* Ensure smooth scrolling within panels */
.overflow-y-auto {
  scrollbar-width: thin;
  scrollbar-color: rgba(156, 163, 175, 0.5) transparent;
}

.overflow-y-auto::-webkit-scrollbar {
  width: 6px;
}

.overflow-y-auto::-webkit-scrollbar-track {
  background: transparent;
}

.overflow-y-auto::-webkit-scrollbar-thumb {
  background-color: rgba(156, 163, 175, 0.5);
  border-radius: 3px;
}

.overflow-y-auto::-webkit-scrollbar-thumb:hover {
  background-color: rgba(156, 163, 175, 0.7);
}
</style>