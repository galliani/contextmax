<template>
  <div class="mobile-safe-area min-h-screen-dynamic bg-gradient-to-b from-background via-muted/5 to-background">
    <!-- Enhanced Floating Navbar with Navigation -->
    <nav class="absolute top-6 left-1/2 transform -translate-x-1/2 z-50 bg-card/90 backdrop-blur-xl border border-muted-foreground/20 rounded-full shadow-2xl max-w-4xl">
      <div class="flex items-center justify-between px-8 py-4">
        <!-- Logo/Brand -->
        <button 
          @click="goToLanding"
          class="text-2xl font-bold text-foreground tracking-wide hover:text-primary transition-colors duration-200"
        >
          contextMax
        </button>
        
        <!-- Navigation Items (only show if there's saved data) -->
        <div v-if="hasSavedData()" class="flex items-center gap-4">
          <!-- Navigation Buttons -->
          <div class="flex items-center gap-2">
            <Button
              @click="goToLanding"
              variant="ghost"
              size="sm"
              :class="currentView === 'landing' ? 'bg-primary/10 text-primary' : ''"
              class="px-4 py-2"
            >
              <Icon name="lucide:home" class="w-4 h-4 mr-2" />
              Home
            </Button>
            
            <Button
              @click="goToWorkspace"
              variant="ghost" 
              size="sm"
              :class="currentView === 'workspace' ? 'bg-primary/10 text-primary' : ''"
              class="px-4 py-2"
            >
              <Icon name="lucide:code" class="w-4 h-4 mr-2" />
              Workspace
            </Button>
            
            <!-- Change Project Button -->
            <Button
              @click="selectProjectFolder"
              :disabled="!isFileSystemSupported"
              variant="outline"
              size="sm"
              class="px-4 py-2 bg-primary/5 hover:bg-primary/10 border-primary/20"
            >
              <Icon name="lucide:folder-plus" class="w-4 h-4 mr-2" />
              Change Project
            </Button>
          </div>
        </div>
      </div>
    </nav>

    <!-- Landing Page Content -->
    <template v-if="currentView === 'landing'">
      <!-- Hero Section -->
      <LandingHeroSection 
        :is-file-system-supported="isFileSystemSupported"
        @select-project="selectProjectFolder"
        @scroll-to-features="scrollToFeatures"
      />

      <!-- Problem Section -->
      <LandingProblemSection />

      <!-- Solution Section -->
      <LandingSolutionSection />

      <!-- Features Section -->
      <LandingFeaturesSection />

      <!-- Benefits Section -->
      <LandingBenefitsSection />

      <!-- Target Audience Section -->
      <LandingAudienceSection />

      <!-- FAQ Section -->
      <LandingFaqSection :faqs="faqData" />

      <!-- Secondary CTA Section -->
      <LandingCtaSection @scroll-to-top="scrollToTop" />

      <!-- Footer -->
      <LandingFooter />
    </template>

    <!-- Main Tool Interface -->
    <template v-else-if="currentView === 'workspace'">
      <MainInterface
        :auto-loaded-from-project="autoLoadedFromProject"
        :auto-load-error="autoLoadError"
        @clear-project="clearProjectAndState"
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
  setSelectedFolder,
  setFileTree,
  setIsLoadingFiles,
  clearProject,
  autoLoadContextSetsFromProject,
  goToLanding,
  goToWorkspace,
  hasSavedData,
  getSavedProjectName,
  loadFromLocalStorage,
  isOPFSAvailable,
  copyProjectToOPFS,
  // OPFS loading state
  isOPFSCopying,
  opfsCopyProgress,
  opfsCopyingProjectName
} = useProjectStore()

// Analytics helpers
const { trackProjectSelection, trackDataRestored, trackProjectRestored } = useAnalyticsHelpers()

// Check if File System Access API is supported
const isFileSystemSupported = ref(false)

// Auto-detection state
const autoLoadedFromProject = ref(false)
const autoLoadError = ref('')

// Computed properties
const savedProjectName = computed(() => getSavedProjectName())

// FAQ data - easily modifiable
const faqData = ref([
  {
    question: "Is my code uploaded anywhere when I use this tool? Is it secure?",
    answer: "No, your code is never uploaded to any server. contextMax runs entirely in your web browser. It uses the modern File System Access API, which allows the tool (running on your computer) to read your project files locally. All processing and context set definition happens on your machine. Your code and the generated context-sets.json file remain private to you unless you choose to share the JSON file yourself. We encourage you to verify this by checking your browser's Network tab – you'll see no code is transmitted."
  },
  {
    question: "How is this different from just copy-pasting code into my LLM or using my IDE's basic \"@file\" feature?",
    answer: "While basic methods allow you to show files to an LLM, contextMax helps you create highly structured, precise, and reusable \"Context Sets.\" You can pinpoint exact line ranges (even non-contiguous ones across multiple files), define crucial workflows (how different code parts interact), and name these sets for consistent use by your whole team. This level of detail and reusability leads to significantly more accurate and context-aware LLM responses, especially on large, mature codebases where general file references or whole file contexts aren't enough."
  },
  {
    question: "Will this really make my LLM interactions better and more accurate?",
    answer: "Yes. By providing LLMs with curated, expert-defined context that highlights critical code sections, specific line numbers, and their operational relationships (via workflows), you eliminate much of the guesswork for the AI. This allows it to generate more relevant, accurate, and architecturally consistent code, suggestions, or explanations for your specific project. The goal is to transform your LLM from a generalist into a specialist for your codebase."
  },
  {
    question: "Is this tool complicated to learn or time-consuming to use?",
    answer: "contextMax is designed with a visual interface to be intuitive for technical users. While defining truly effective context for a complex feature does require thought (as you, the expert, know what's important), the tool aims to make the process of capturing, structuring, and reusing that knowledge straightforward. The initial time investment in creating a context set for a key feature can save significant time and frustration later by improving LLM accuracy for everyone on your team."
  },
  {
    question: "What does the tool actually produce, and how do I use that output?",
    answer: "The tool helps you create and then lets you download a single configuration file named context-sets.json. This JSON file contains:\n• filesManifest: A list of all project files you've decided are relevant, each with a unique ID and a comment.\n• contextSets: Your named sets, detailing which files (via their IDs), specific line ranges, and workflows belong to each.\n• fileContextsIndex: An auto-generated index that helps relate file IDs back to the context sets they're used in.\nYou then instruct your IDE's LLM (e.g., via custom rules like .cursorrules for Cursor with Claude, or other methods depending on your LLM tool and IDE) to read and use this context-sets.json file. When you reference a context set name in your prompts, the LLM (guided by the rules) uses the JSON to fetch the precise, curated context."
  },
  {
    question: "Is this tool really free? What's the plan for the future?",
    answer: "Yes, contextMax is completely free to use. We have plans of monetization from other avenues, so this main tool will remain free."
  },
  {
    question: "How does a web page access my local project files? That sounds like a security risk.",
    answer: "The tool uses a standard, modern web technology called the File System Access API. This API is designed with security in mind and is supported by most modern browsers. Crucially, it requires your explicit permission through your browser's native file/folder picker before the application can access any files or folders. Access is granted only to the specific directory you select and is typically limited to the current session or until you close the tab (depending on browser implementation and permissions granted). The processing happens locally in your browser, not on a remote server.\n\nFor seamless project persistence across browser sessions, we also use OPFS (Origin Private File System) - a secure browser storage system that creates a local copy of your project files within your browser's private storage area. This allows the tool to restore your projects automatically when you return, without requiring re-upload or re-permission. OPFS data is isolated per website origin and cannot be accessed by other websites, ensuring your project data remains private and secure."
  },
  {
    question: "Does this tool \"talk\" to the LLM for me, or automatically update the context sets if my code changes?",
    answer: "For this version, contextMax is a dedicated tool to help you create and manage the context-sets.json configuration file. It does not directly send prompts to or receive responses from LLMs.\nRegarding updates: The tool itself doesn't automatically detect code changes in your repository and update the line numbers in your context-sets.json file on disk. We've discussed instructions for your IDE's LLM agent (like Claude via .cursorrules) to track line number changes in its memory during an active coding session and only update the JSON file when you explicitly ask it to. The maintenance of the context-sets.json file to reflect committed code changes is a process managed by you (by editing through this tool) and your team, though future versions or CI/CD integrations could explore more automation."
  },
  {
    question: "Do you track usage or collect data?",
    answer: "We do collect data in the form of anonymous usage metrics to help us develop the tool better and improve it. We are not in the business of selling your data."
  }
])

// Check support only on client side to avoid hydration issues
onMounted(async () => {
  isFileSystemSupported.value = typeof window !== 'undefined' && 'showDirectoryPicker' in window
  
  // Check if we have saved data and should show workspace
  if (hasSavedData()) {
    console.log('🔄 Found saved data, attempting auto-restoration...')
    
    // Track data restoration
    trackDataRestored(savedProjectName.value)
    
    // CRITICAL FIX: Properly await the entire restoration process
    try {
      const restored = await loadFromLocalStorage()
      if (restored) {
        console.log('✅ Project fully restored including OPFS data')
      } else {
        console.warn('⚠️ Failed to restore project metadata from localStorage')
      }
    } catch (error) {
      console.error('❌ Error during restoration:', error)
    }
    
    // Always go to workspace if we have saved data
    goToWorkspace()
  }
})

// File handling functions
async function selectProjectFolder() {
  console.log('selectProjectFolder called, isFileSystemSupported:', isFileSystemSupported.value)
  
  if (!isFileSystemSupported.value) {
    console.log('File System Access API not supported')
    return
  }

  try {
    console.log('Calling showDirectoryPicker...')
    
    // Check if this is a fresh selection (no saved data before we start)
    const hadSavedDataBefore = hasSavedData()
    
    const directoryHandle = await window.showDirectoryPicker({
      mode: 'read'
    })
    
    console.log('Directory selected:', directoryHandle)
    
    // Track successful project selection
    trackProjectSelection()
    
    setSelectedFolder(directoryHandle)
    await loadProjectFiles(directoryHandle, hadSavedDataBefore)
    
    // Navigate to workspace for fresh selections, or if explicitly restoring
    if (!hadSavedDataBefore) {
      console.log('Fresh project selection - navigating to workspace')
      goToWorkspace()
    } else {
      console.log('Folder reconnected for existing project')
    }
  } catch (error: unknown) {
    if (error instanceof Error && error.name !== 'AbortError') {
      console.error('Error selecting folder:', error)
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
    
    // Copy to OPFS for persistent access (if OPFS is supported and it's a new project)
    if (isOPFSAvailable() && !hadSavedDataBefore) {
      console.log('Copying project to OPFS for persistent access...')
      try {
        const copied = await copyProjectToOPFS(directoryHandle)
        if (copied) {
          console.log('Project successfully copied to OPFS')
        } else {
          console.warn('Failed to copy project to OPFS, but continuing with regular functionality')
        }
      } catch (error) {
        console.warn('OPFS copy failed, but continuing with regular functionality:', error)
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

// Scroll to features section
function scrollToFeatures() {
  if (import.meta.client) {
    const element = document.getElementById('features')
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' })
    }
  }
}

// Scroll to top
function scrollToTop() {
  if (import.meta.client) {
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }
}

// Set page title and SEO meta tags
useHead({
  title: 'Make Your LLM Finally Understand Your Complex, Mature Codebase.',
  meta: [
    { name: 'description', content: 'Improve the speed and accuracy, whilst saving tokens, of your LLM coder when working on complex, mature codebases by providing it with precise, reusable context definitions that acts a GPS to the LLM for your codebases.' },
    { name: 'keywords', content: 'LLM, context, AI, development, coding, tools, Large Language Models, project management, code context, AI assistant' },
    { name: 'author', content: 'contextMax' },
    { name: 'robots', content: 'index, follow' },
    
    // Open Graph tags
    { property: 'og:title', content: 'Make Your LLM Finally Understand Your Complex, Mature Codebase - contextMax' },
    { property: 'og:description', content: 'Improve the speed and accuracy, whilst saving tokens, of your LLM coder when working on complex, mature codebases by providing it with precise, reusable context definitions that acts a GPS to the LLM for your codebases.' },
    { property: 'og:type', content: 'website' },
    { property: 'og:site_name', content: 'contextMax' },
    { property: 'og:locale', content: 'en_US' },
    
    // Twitter Card tags
    { name: 'twitter:card', content: 'summary_large_image' },
    { name: 'twitter:title', content: 'contextMax - Smart Project Snippet Manager' },
    { name: 'twitter:description', content: 'Create curated context sets for Large Language Models from your codebase. Streamline your AI-assisted development workflow.' },
    
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

.animate-fadeInUp {
  animation: fadeInUp 0.6s ease-out forwards;
  opacity: 0;
}

@keyframes pulseSubtle {
  0%, 100% {
    box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25), 0 0 0 0 rgba(var(--primary), 0.4);
  }
  50% {
    box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25), 0 0 0 8px rgba(var(--primary), 0.1);
  }
}

@keyframes bounceGentle {
  0%, 20%, 50%, 80%, 100% {
    transform: translateY(0);
  }
  40% {
    transform: translateY(-3px);
  }
  60% {
    transform: translateY(-1px);
  }
}

.animate-pulse-subtle {
  animation: pulseSubtle 3s ease-in-out infinite;
}

.animate-bounce-gentle {
  animation: bounceGentle 4s ease-in-out infinite;
}
</style> 