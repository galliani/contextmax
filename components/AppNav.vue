<!--
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 -->
<template>
  <!-- Enhanced Floating Navbar with Navigation -->
  <nav class="absolute top-6 left-1/2 transform -translate-x-1/2 z-50 bg-card/90 backdrop-blur-xl border border-muted-foreground/20 rounded-full shadow-2xl max-w-4xl">
    <div class="flex items-center justify-between px-8 py-4">
      <!-- Logo/Brand and AI Status -->
      <div class="flex items-center gap-4">
        <a 
          href="https://contextmax.dev" target="_blank" rel="noopener noreferrer"
          class="text-2xl font-bold text-foreground tracking-wide hover:text-primary transition-colors duration-200"
        >
          contextMax <span class="text-xs text-muted-foreground font-normal">by 51NewYork</span>
        </a>
        
        <!-- AI Models Status -->
        <div class="flex items-center gap-2">
          <div 
            v-for="modelKey in availableModels" 
            :key="modelKey" 
            class="flex items-center gap-1.5"
            :title="getModelTooltip(modelKey)"
          >
            <div 
              :class="[
                'w-2 h-2 rounded-full transition-all duration-300',
                getStatusColor(modelKey),
                shouldPulsate(modelKey) ? 'animate-pulse' : ''
              ]"
            ></div>
            <span class="text-xs text-muted-foreground">{{ getModelDisplayName(modelKey) }}</span>
          </div>
        </div>
      </div>

      <!-- Navigation Items -->
      <div class="flex items-center gap-4">        
        <!-- Divider -->
        <div v-if="hasSavedProjects()" class="w-px h-6 bg-border"></div>
        
        <!-- Project Section (only show if there are saved projects) -->
        <div v-if="hasSavedProjects()" class="flex items-center gap-1">
          <!-- "Project:" Label -->
          <span class="text-sm text-muted-foreground mr-2">Project</span>
          
          <!-- Current Project Name Button -->
          <Button
            @click="goToWorkspace"
            variant="ghost"
            size="sm"
            :class="currentView === 'workspace' ? 'bg-primary/10 text-primary' : ''"
            class="px-3 py-2 font-medium"
          >
            <Icon name="lucide:code" class="w-4 h-4 mr-2" />
            {{ selectedFolder?.name || getCurrentProjectName() }}
          </Button>
          
          <!-- Switch Project Button (only if multiple projects) -->
          <Button
            v-if="availableProjects.length > 1"
            @click="showProjectSwitcher"
            variant="ghost"
            size="sm"
            class="px-3 py-2"
            title="Switch Project"
          >
            <span class="text-sm mr-1">Switch</span>
            <Icon name="lucide:chevron-down" class="w-4 h-4" />
          </Button>
        </div>
        
        <!-- Add Project Button -->
        <Button
          @click="$emit('select-project')"
          :disabled="!isFileSystemSupported"
          variant="outline"
          size="sm"
          class="px-3 py-2 bg-primary/5 hover:bg-primary/10 border-primary/20"
        >
          <Icon name="lucide:plus" class="w-4 h-4 mr-2" />
          Add
        </Button>
      </div>
    </div>
  </nav>

  <!-- Project Switcher Modal -->
  <Dialog v-model:open="showProjectSwitcherModal">
    <DialogContent class="sm:max-w-md">
      <DialogHeader>
        <DialogTitle class="flex items-center gap-3">
          <Icon name="lucide:folder-open" class="w-5 h-5" />
          Switch Project
        </DialogTitle>
        <DialogDescription>
          Switch to a different saved project. Your current work is auto-saved.
        </DialogDescription>
      </DialogHeader>
      
      <div class="space-y-3 mt-6">
        <div v-if="availableProjects.length === 0" class="text-center py-8 text-muted-foreground">
          <Icon name="lucide:folder-x" class="w-12 h-12 mx-auto mb-4 opacity-50" aria-hidden="true" />
          <p class="font-medium mb-2">No Saved Projects</p>
          <p class="text-sm">Use "Add" to add a project folder.</p>
        </div>
        
        <div v-else class="space-y-2">
          <Button
            v-for="project in availableProjects"
            :key="project.name"
            @click="handleProjectSwitch(project.name)"
            variant="outline"
            size="default"
            class="w-full justify-start p-4 h-auto"
            :disabled="isSwitchingProject || project.name === selectedFolder?.name"
          >
            <div class="flex items-center">
              <Icon 
                :name="project.name === selectedFolder?.name ? 'lucide:check-circle' : 'lucide:folder'" 
                class="w-5 h-5 mr-3 text-primary" 
                aria-hidden="true" 
              />
              <div class="text-left flex-1">
                <div class="font-medium">{{ project.name }}</div>
                <div class="text-sm text-muted-foreground">
                  {{ project.name === selectedFolder?.name ? 'Current project' : formatLastAccessed(project.lastAccessed) }}
                </div>
              </div>
            </div>
          </Button>
        </div>
      </div>
      
      <DialogFooter class="mt-6">
        <Button variant="ghost" @click="showProjectSwitcherModal = false">
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
import { LLMService } from '~/plugins/llm.client'

interface Props {
  isFileSystemSupported: boolean
}

const _props = withDefaults(defineProps<Props>(), {
  isFileSystemSupported: false
})

const _emit = defineEmits<{
  (e: 'select-project'): void
}>()

// Use the project store
const {
  currentView,
  selectedFolder,
  goToLanding,
  goToWorkspace,
} = useProjectStore()

// Project Manager (for saved projects functionality)
const {
  hasSavedProjects,
  savedProjects,
  switchToProject
} = useProjectManager()

// LLM Status
const { 
  getModelState,
  getAvailableModels
} = useLLMLoader()

const availableModels = getAvailableModels()

// Advanced UX Systems
const { success, errorWithRetry } = useNotifications()

// Accessibility support
const { announceStatus, announceError } = useAccessibility()

// Project switcher state
const showProjectSwitcherModal = ref(false)
const isSwitchingProject = ref(false)

// Available projects for switching
const availableProjects = computed(() => {
  return savedProjects.value
})

// Get current project name for navbar
const getCurrentProjectName = (): string => {
  // If we have a selected folder, use its name
  if (selectedFolder.value?.name) {
    return selectedFolder.value.name
  }
  
  // Otherwise, get the most recently accessed project
  if (savedProjects.value.length > 0) {
    return savedProjects.value[0].name // First item is most recently accessed
  }
  
  return 'Workspace'
}

// Project switcher functions
const showProjectSwitcher = () => {
  showProjectSwitcherModal.value = true
}

// Handle project switching
const handleProjectSwitch = async (projectName: string) => {
  if (projectName === selectedFolder.value?.name) {
    showProjectSwitcherModal.value = false
    return
  }
  
  isSwitchingProject.value = true
  
  try {
    const switchSuccess = await switchToProject(projectName)
    
    if (switchSuccess) {
      showProjectSwitcherModal.value = false
      success(
        'Project Switched',
        `Successfully switched to project "${projectName}"`
      )
      announceStatus(`Switched to project ${projectName}`)
      // Navigate to workspace after successful switch
      goToWorkspace()
    } else {
      errorWithRetry(
        'Switch Failed',
        `Failed to switch to project "${projectName}". The project may not be available in local storage.`,
        () => handleProjectSwitch(projectName)
      )
      announceError(`Failed to switch to project ${projectName}`)
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    errorWithRetry(
      'Switch Failed',
      `Error switching to project "${projectName}": ${message}`,
      () => handleProjectSwitch(projectName)
    )
    announceError(`Error switching to project: ${message}`)
  } finally {
    isSwitchingProject.value = false
  }
}

// Format last accessed time
const formatLastAccessed = (timestamp: number): string => {
  const now = Date.now()
  const diff = now - timestamp
  const minutes = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days = Math.floor(diff / 86400000)
  
  if (minutes < 1) return 'Just now'
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? '' : 's'} ago`
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`
  if (days < 7) return `${days} day${days === 1 ? '' : 's'} ago`
  
  return new Date(timestamp).toLocaleDateString()
}

// LLM Status Functions
const getModelDisplayName = (modelKey: string) => {
  const displayNames: Record<string, string> = {
    embeddings: 'Embeddings',
    textGeneration: 'Text Gen'
  }
  return displayNames[modelKey] || modelKey
}

const getStatusColor = (modelKey: string) => {
  const serviceStatus = LLMService.getStatus(modelKey)
  const modelState = getModelState(modelKey).value
  
  // Determine if we're downloading vs initializing
  const isDownloading = modelState.progress > 0 && modelState.progress < 100 && 
                       (modelState.message.includes('Downloading') || modelState.message.includes('Loading model'))
  
  switch (serviceStatus) {
    case 'ready':
      return 'bg-green-500'
    case 'error':
      return 'bg-red-500'
    case 'loading':
      return isDownloading ? 'bg-yellow-500' : 'bg-blue-500'
    default:
      return 'bg-gray-400'
  }
}

const shouldPulsate = (modelKey: string) => {
  const serviceStatus = LLMService.getStatus(modelKey)
  return serviceStatus === 'loading'
}

const getModelTooltip = (modelKey: string) => {
  const serviceStatus = LLMService.getStatus(modelKey)
  const modelState = getModelState(modelKey).value
  const displayName = getModelDisplayName(modelKey)
  
  switch (serviceStatus) {
    case 'ready':
      return `${displayName}: Ready`
    case 'error':
      return `${displayName}: Error - ${modelState.error || 'Unknown error'}`
    case 'loading':
      if (modelState.progress > 0) {
        return `${displayName}: ${modelState.progress}% - ${modelState.message}`
      }
      return `${displayName}: ${modelState.message}`
    default:
      return `${displayName}: Unknown status`
  }
}
</script>

<style scoped>
.animate-pulse {
  animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
}

@keyframes pulse {
  0%, 100% {
    opacity: 1;
  }
  50% {
    opacity: 0.5;
  }
}
</style> 