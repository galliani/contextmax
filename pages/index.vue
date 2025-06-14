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
    
    <!-- OPFS Loading Screen -->
    <FullScreenLoader
      :is-visible="isOPFSCopying"
      :title="`Setting up ${opfsCopyingProjectName || 'project'}`"
      description="Creating a local copy of your project files in browser cache (OPFS) for seamless access across sessions. This only happens once per project."
      icon="lucide:hard-drive"
      :show-progress="true"
      :progress="opfsCopyProgress"
      :additional-info="opfsCopyProgress < 100 ? 'Copying files to local storage...' : 'Finalizing setup...'"
      aria-label="Setting up project in local storage"
    />
  </div>
</template>

<script setup lang="ts">
import type { FileTreeItem } from '~/composables/useProjectStore'
import FullScreenLoader from '~/components/ui/FullScreenLoader.vue'

// Use the project store
const {
  currentView,
  selectedFolder: _selectedFolder,
  setSelectedFolder,
  setFileTree,
  setIsLoadingFiles,
  clearProject,
  autoLoadContextSetsFromProject,
  goToLanding,
  goToWorkspace,
  hasSavedData,
  hasSavedProjects,
  getSavedProjectName,

  loadFromLocalStorage,
  isOPFSAvailable,
  copyProjectToOPFS,
  getOPFSProjects,
  loadSavedProjectsFromStorage,

  // OPFS loading state
  isOPFSCopying,
  opfsCopyProgress,
  opfsCopyingProjectName
} = useProjectStore()

// Analytics helpers
const { trackProjectSelection, trackDataRestored, trackProjectRestored } = useAnalyticsHelpers()

// Advanced UX Systems
const { success: _success } = useNotifications()

// Accessibility support
const { announceStatus: _announceStatus } = useAccessibility()

// Hybrid Analysis
const { performHybridAnalysis } = useHybridAnalysis()

// Check if File System Access API is supported
const isFileSystemSupported = ref(false)

// Auto-detection state
const autoLoadedFromProject = ref(false)
const autoLoadError = ref('')

// Computed properties
const savedProjectName = computed(() => getSavedProjectName())

// Check support only on client side to avoid hydration issues
onMounted(async () => {
  isFileSystemSupported.value = typeof window !== 'undefined' && 'showDirectoryPicker' in window
  
  // Load saved projects from localStorage into reactive state
  loadSavedProjectsFromStorage()
  
  // Check if we have any saved projects
  if (hasSavedProjects()) {
    // Check if we have saved data and should show workspace
    if (hasSavedData()) {
      console.log('🔄 Found saved data, attempting auto-restoration...')
      
      // Track data restoration
      trackDataRestored(savedProjectName.value)
      
      // CRITICAL FIX: Properly await the entire restoration process
      try {
        const { metadataLoaded, opfsRestored } = await loadFromLocalStorage()
        if (metadataLoaded && opfsRestored) {
          console.log('✅ Project fully restored including OPFS data')
        } else if (metadataLoaded && !opfsRestored) {
          console.log('⚠️ Project metadata restored from localStorage, but OPFS data unavailable')
          console.log('ℹ️ You will need to reconnect to the project folder to browse files')
        } else {
          console.warn('⚠️ Failed to restore project metadata from localStorage')
        }
      } catch (error) {
        console.error('❌ Error during restoration:', error)
      }
      
      // Always go to workspace if we have saved data
      goToWorkspace()
    } else {
      // We have saved projects but no current project data - stay on landing
      console.log('ℹ️ Saved projects found, but no current project data - staying on landing page')
      goToLanding()
    }
  } else {
    // No saved projects - force to landing page
    console.log('ℹ️ No saved projects found - showing landing page')
    goToLanding()
  }
})

// File handling functions (now used for adding new projects)
async function selectProjectFolder() {
  console.log('selectProjectFolder called (Add Project), isFileSystemSupported:', isFileSystemSupported.value)
  
  if (!isFileSystemSupported.value) {
    console.log('File System Access API not supported')
    return
  }

  try {
    console.log('Calling showDirectoryPicker for new project...')
    
    const directoryHandle = await window.showDirectoryPicker({
      mode: 'readwrite'
    })
    
    console.log('Directory selected for new project:', directoryHandle)
    
    // Track successful project selection
    trackProjectSelection()
    
    setSelectedFolder(directoryHandle)
    await loadProjectFiles(directoryHandle, false) // Always treat as fresh selection
    
    console.log('✅ New project added successfully - navigating to workspace')
    goToWorkspace()
  } catch (error: unknown) {
    if (error instanceof Error && error.name !== 'AbortError') {
      console.error('Error selecting folder for new project:', error)
      // Clear auto-detection state on error
      autoLoadedFromProject.value = false
      autoLoadError.value = ''
      // TODO: Show user-friendly error message
    }
  }
}

async function loadProjectFiles(directoryHandle: FileSystemDirectoryHandle, hadSavedDataBefore: boolean) {
  setIsLoadingFiles(true)
  autoLoadedFromProject.value = false
  autoLoadError.value = ''
  
  try {
    // Only try to auto-load context-sets.json if we don't already have saved data
    if (!hadSavedDataBefore) {
      console.log('Attempting to auto-load context-sets.json...')
      const autoLoaded = await autoLoadContextSetsFromProject(directoryHandle)
      if (autoLoaded) {
        autoLoadedFromProject.value = true
        console.log('Successfully auto-loaded existing context-sets.json')
      }
    } else {
      console.log('Skipping auto-load from project file - using saved localStorage data')
    }
    
    // Always load the file tree to enable file browsing
    const files = await readDirectoryRecursively(directoryHandle, '')
    setFileTree(files)
    
    // Copy to OPFS for persistent access (always try if OPFS is supported and we don't have a copy)
    if (isOPFSAvailable()) {
      const projectName = directoryHandle.name
      let shouldCopyToOPFS = false
      
      if (!hadSavedDataBefore) {
        // Fresh project selection - always copy
        shouldCopyToOPFS = true
        console.log('Copying new project to OPFS for persistent access...')
      } else {
        // Reconnecting to existing project - check if OPFS copy exists
        try {
          const opfsProjects = await getOPFSProjects()
          const hasOPFSCopy = opfsProjects.includes(projectName)
          if (!hasOPFSCopy) {
            shouldCopyToOPFS = true
            console.log('No OPFS copy found for existing project, creating one...')
          } else {
            console.log('OPFS copy already exists for project, skipping copy')
          }
        } catch (error) {
          console.warn('Failed to check OPFS projects, will attempt copy anyway:', error)
          shouldCopyToOPFS = true
        }
      }
      
      if (shouldCopyToOPFS) {
        try {
          const copied = await copyProjectToOPFS(directoryHandle)
                  if (copied) {
          console.log('Project successfully copied to OPFS')
          
          // Auto-trigger hybrid analysis for new projects
          try {
            console.log('🚀 Auto-triggering hybrid analysis for new project...')
            const analysisResult = await performHybridAnalysis(files, { silent: false })
            if (analysisResult.success) {
              console.log('✅ Automatic hybrid analysis completed successfully')
            } else {
              console.warn('⚠️ Automatic hybrid analysis failed, but continuing')
            }
          } catch (error) {
            console.warn('⚠️ Error during automatic hybrid analysis:', error)
          }
        } else {
          console.warn('Failed to copy project to OPFS, but continuing with regular functionality')
        }
        } catch (error) {
          console.warn('OPFS copy failed, but continuing with regular functionality:', error)
        }
      }
    }
    
    // If we restored from localStorage, show success message
    if (hadSavedDataBefore) {
      const { success } = useNotifications()
      success(
        'Project Restored Successfully',
        `Your project "${directoryHandle.name}" has been reconnected with your saved work.`
      )
      
      // Track project restoration
      trackProjectRestored(directoryHandle.name)
    }
  } catch (error) {
    console.error('Error loading project:', error)
    if (error instanceof Error) {
      autoLoadError.value = error.message
    }
    setFileTree([])
  } finally {
    setIsLoadingFiles(false)
  }
}

async function readDirectoryRecursively(
  directoryHandle: FileSystemDirectoryHandle, 
  currentPath: string
): Promise<FileTreeItem[]> {
  const items: FileTreeItem[] = []
  
  // Ignore patterns for common directories/files we don't want to show
  const ignorePatterns = [
    'node_modules',
    '.nuxt',
    'dist',
    'build',
    '.next',
    '.svelte-kit',
    'target',
    'vendor',
    'Thumbs.db'
  ]

  try {
    for await (const [name, handle] of directoryHandle.entries()) {
      // Skip files/directories that start with a dot (sensitive files)
      if (name.startsWith('.')) {
        continue
      }
      
      // Skip ignored patterns
      if (ignorePatterns.some(pattern => name.includes(pattern))) {
        continue
      }

      const itemPath = currentPath ? `${currentPath}/${name}` : name

      if (handle.kind === 'directory') {
        const children = await readDirectoryRecursively(handle as FileSystemDirectoryHandle, itemPath)
        items.push({
          name,
          path: itemPath,
          type: 'directory',
          children,
          handle: handle as FileSystemDirectoryHandle
        })
      } else {
        items.push({
          name,
          path: itemPath,
          type: 'file',
          handle: handle as FileSystemFileHandle
        })
      }
    }
  } catch (error) {
    console.error(`Error reading directory ${currentPath}:`, error)
  }

  // Sort: directories first, then files, both alphabetically
  return items.sort((a, b) => {
    if (a.type !== b.type) {
      return a.type === 'directory' ? -1 : 1
    }
    return a.name.localeCompare(b.name)
  })
}

// Clear project and auto-detection state
function clearProjectAndState() {
  clearProject()
  autoLoadedFromProject.value = false
  autoLoadError.value = ''
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