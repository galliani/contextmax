/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */
<template>
  <div class="mobile-safe-area min-h-screen-dynamic bg-gradient-to-b from-background via-muted/5 to-background">
    <!-- Empty State - No Project Selected -->
    <template v-if="currentView === 'landing'">
      <EmptyState 
        :is-file-system-supported="isFileSystemSupported"
        @select-project="selectProjectFolder"
      />
    </template>

    <!-- Main Tool Interface -->
    <template v-else-if="currentView === 'workspace'">
      <MainInterface
        :auto-loaded-from-project="autoLoadedFromProject"
        :auto-load-error="autoLoadError"
        :is-file-system-supported="isFileSystemSupported"
        @clear-project="clearProjectAndState"
        @select-project="selectProjectFolder"
      />
    </template>

    <!-- File Content Modal -->
    <FileContentModal />
    
    <!-- Project Loading Screen -->
    <FullScreenLoader
      :is-visible="isLoadingFiles || isOPFSCopying"
      :title="isOPFSCopying ? `Setting up ${opfsCopyingProjectName || 'project'}` : 'Loading Project Files'"
      :description="isOPFSCopying ? 'Creating a local copy of your project files in browser cache (OPFS) for seamless access across sessions. This only happens once per project.' : 'Reading project structure and preparing files for analysis. This may take a moment for large projects.'"
      :icon="isOPFSCopying ? 'lucide:hard-drive' : 'lucide:folder-open'"
      :show-progress="isOPFSCopying"
      :progress="opfsCopyProgress"
      :additional-info="isOPFSCopying ? (opfsCopyProgress < 100 ? 'Copying files to local storage...' : 'Finalizing setup...') : 'Analyzing project structure...'"
      :aria-label="isOPFSCopying ? 'Setting up project in local storage' : 'Loading project files'"
    />
  </div>
</template>

<script setup lang="ts">
import { logger } from '~/utils/logger'
import FullScreenLoader from '~/components/ui/FullScreenLoader.vue'

// Use the project store
const {
  currentView,
  clearProject,
  goToLanding,
  goToWorkspace,
  hasSavedData,
  getSavedProjectName,

  loadFromLocalStorage,

  // Loading states
  isLoadingFiles,
  isOPFSCopying,
  opfsCopyProgress,
  opfsCopyingProjectName
} = useProjectStore()

// Use the project manager
const {
  isFileSystemSupported,
  autoLoadedFromProject,
  autoLoadError,
  selectProjectFolder,
  resetState: resetProjectManagerState,
  loadSavedProjectsFromStorage,
  hasSavedProjects
} = useProjectManager()

// Analytics helpers
const { trackDataRestored } = useAnalyticsHelpers()

// Advanced UX Systems
const { success: _success } = useNotifications()

// Accessibility support
const { announceStatus: _announceStatus } = useAccessibility()

// Computed properties
const savedProjectName = computed(() => getSavedProjectName())

// Check support only on client side to avoid hydration issues
onMounted(async () => {
  // Load saved projects from localStorage into reactive state
  loadSavedProjectsFromStorage()
  
  // Check if we have any saved projects
  if (hasSavedProjects()) {
    // Check if we have saved data and should show workspace
    if (hasSavedData()) {
        
      // Track data restoration
      trackDataRestored(savedProjectName.value)
      
      // CRITICAL FIX: Properly await the entire restoration process
      try {
        const { metadataLoaded, opfsRestored } = await loadFromLocalStorage()
        if (metadataLoaded && opfsRestored) {
          // Project fully restored including OPFS data
        } else if (metadataLoaded && !opfsRestored) {
          // Project metadata restored from localStorage, but OPFS data unavailable
          // User will need to reconnect to the project folder to browse files
        } else {
          logger.warn('⚠️ Failed to restore project metadata from localStorage')
        }
      } catch (error) {
        logger.error('❌ Error during restoration:', error)
      }
      
      // Always go to workspace if we have saved data
      goToWorkspace()
    } else {
      // We have saved projects but no current project data - stay on landing
      goToLanding()
    }
  } else {
    // No saved projects - force to landing page
    goToLanding()
  }
})

// Clear project and auto-detection state
function clearProjectAndState() {
  clearProject()
  resetProjectManagerState()
  // Navigate back to landing after clearing
  goToLanding()
}

// Set page title and SEO meta tags for the tool
useHead({
  title: 'contextMax - Create Context Sets for Your LLM',
  meta: [
    { name: 'description', content: 'Create precise, reusable context sets for Large Language Models from your codebase. Privacy-first tool that runs entirely in your browser.' },
    { name: 'keywords', content: 'LLM, context, AI, development, coding, tools, Large Language Models, code context, AI assistant' },
    { name: 'author', content: 'contextMax' },
    { name: 'robots', content: 'index, follow' },
    
    // Open Graph tags
    { property: 'og:title', content: 'contextMax - Create Context Sets for Your LLM' },
    { property: 'og:description', content: 'Create precise, reusable context sets for Large Language Models from your codebase. Privacy-first tool that runs entirely in your browser.' },
    { property: 'og:type', content: 'website' },
    { property: 'og:site_name', content: 'contextMax' },
    { property: 'og:locale', content: 'en_US' },
    
    // Twitter Card tags
    { name: 'twitter:card', content: 'summary_large_image' },
    { name: 'twitter:title', content: 'contextMax - Create Context Sets for Your LLM' },
    { name: 'twitter:description', content: 'Create precise, reusable context sets for Large Language Models from your codebase.' },
    
    // Additional meta tags for better SEO
    { name: 'theme-color', content: '#6366f1' },
    { name: 'msapplication-TileColor', content: '#6366f1' },
    { name: 'application-name', content: 'contextMax' },
    { name: 'format-detection', content: 'telephone=no' }
  ],
  link: [
    { rel: 'canonical', href: typeof window !== 'undefined' ? window.location.href : undefined }
  ]
})
</script>

<style scoped>
@keyframes fadeInUp {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.mobile-safe-area {
  padding-top: env(safe-area-inset-top);
  padding-bottom: env(safe-area-inset-bottom);
}

.min-h-screen-dynamic {
  min-height: 100vh;
  min-height: 100dvh;
}
</style>