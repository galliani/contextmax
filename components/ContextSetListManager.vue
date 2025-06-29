<!--
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
-->
<template>
  <div class="bg-gradient-surface overflow-hidden backdrop-blur-sm">
    <!-- Header -->
    <div class="border-b bg-gradient-warm px-4 py-3">
      <div class="flex">
        <div class="flex items-center space-x-3">
          <h3 class="visual-hierarchy-4 font-bold mb-2 text-mobile-subheading sm:text-md lg:text-xl">
            Context Sets List
          </h3>
        </div>
      </div>

      <!-- Mode Description -->
      <p class="text-xs text-muted-foreground">
        <span>
          Select a context set below to start editing.
        </span>
      </p>  
    </div>

    <!-- Content -->
    <div class="content-spacing bg-surface-1">
      <!-- Enhanced Empty State -->
      <div 
        v-if="contextSetNames.length === 0" 
        class="text-center py-8 px-4"
        role="status"
      >
        <!-- Hero Section -->
        <div class="max-w-md mx-auto">
          <div class="mb-6">
            <div class="w-20 h-20 mx-auto mb-4 bg-primary/10 rounded-full flex items-center justify-center">
              <Icon name="lucide:plus-circle" class="w-10 h-10 text-primary" aria-hidden="true" />
            </div>
            <h4 class="text-2xl font-bold text-foreground mb-3">
              Create Your First Context Set
            </h4>
            <p class="text-base text-muted-foreground leading-relaxed mb-6">
              Context sets help you organize specific parts of your codebase for AI analysis. 
              Start by creating one with a descriptive name.
            </p>
          </div>

          <!-- Prominent CTA Button -->
          <Button
            @click="showCreateModal = true"
            size="lg"
            class="w-full sm:w-auto px-8 py-4 text-lg font-semibold bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg hover:shadow-xl transition-all duration-200 mb-6 animate-pulse hover:animate-none"
          >
            <Icon name="lucide:plus" class="w-6 h-6 mr-3" aria-hidden="true" />
            Create Context Set
          </Button>

          <!-- Helpful Tips -->
          <div class="bg-muted/30 rounded-lg p-4 text-left">
            <div class="flex items-start space-x-3 mb-3">
              <Icon name="lucide:lightbulb" class="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" aria-hidden="true" />
              <div>
                <p class="text-sm font-medium text-foreground mb-2">Quick Start Tips:</p>
                <ul class="text-sm text-muted-foreground space-y-1">
                  <li>• Give it a clear name without blank spaces like "Authentication" or "userManagement" or "billing_management"</li>
                  <li>• You can add a description and files after creation</li>
                  <li>• Context sets help organize code for specific AI conversations</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Context Sets Grid -->
      <div 
        v-else
        class="space-y-4"
      >
        <!-- Add Button at Top -->
        <div class="flex">
          <Button
            variant="outline"
            size="sm"
            class="flex items-center"
            @click="showCreateModal = true"
          >
            <Icon name="lucide:plus" class="w-4 h-4 mr-2" aria-hidden="true" />
            Add New Context Set
          </Button>
        </div>

        <!-- Context Sets List -->
        <TransitionGroup
          name="context-list"
          tag="div"
          class="grid grid-cols-1 gap-4 sm:gap-6"
          role="list" 
          aria-label="Context sets"
        >
          <!-- Context Set Cards -->
          <div 
            v-for="setName in sortedContextSetNames" 
            :key="setName"
            class="group relative bg-card rounded-lg border transition-all duration-200 hover:shadow-lg hover:border-primary/50"
            :class="{
              'ring-2 ring-primary ring-offset-2 bg-primary/5 border-primary': activeContextSetName === setName,
              'hover:shadow-elegant': activeContextSetName !== setName
            }"
            role="listitem"
          >
            <!-- Context Set Button -->
            <button
              :ref="el => { if (activeContextSetName === setName) activeContextButton = el }"
              @click="selectContextSet(setName)"
              class="w-full p-4 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 rounded-lg"
              :class="activeContextSetName === setName ? 'cursor-default' : 'cursor-pointer'"
              :aria-label="`Select context set: ${getDisplayName(setName)}${activeContextSetName === setName ? ' (currently active)' : ''}`"
              :aria-pressed="activeContextSetName === setName"
            >
              <div class="flex items-start justify-between mb-3">
                <h4 class="font-semibold truncate pr-2 text-lg" :class="activeContextSetName === setName ? 'text-foreground' : 'text-muted-foreground'">
                  {{ getDisplayName(setName) }}
                </h4>
              </div>
                          
              <div class="flex items-center justify-between text-xs text-muted-foreground">
                <div class="flex items-center space-x-4">
                  <span class="flex items-center">
                    <Icon name="lucide:file" class="w-4 h-4 mr-1.5" aria-hidden="true" />
                    {{ getContextSetFileCount(setName) }} files
                  </span>
                  <span class="flex items-center">
                    <Icon name="lucide:workflow" class="w-4 h-4 mr-1.5" aria-hidden="true" />
                    {{ getContextSetWorkflowStepCount(setName) }} steps
                  </span>
                </div>
                
                <!-- Status indicator -->
                <div 
                  v-if="activeContextSetName === setName"
                  class="text-primary font-medium"
                >
                  Active
                </div>
              </div>
            </button>

            <!-- Delete Button (appears on hover) -->
            <button
              @click.stop="confirmDelete(setName)"
              class="absolute top-3 right-3 opacity-0 group-hover:opacity-100 p-2 hover:bg-destructive/10 text-destructive hover:text-destructive rounded-lg transition-all duration-200 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-destructive focus-visible:ring-offset-1 z-10"
              :aria-label="`Delete context set: ${getDisplayName(setName)}`"
              title="Delete context set"
              tabindex="-1"
            >
              <Icon name="lucide:trash-2" class="w-4 h-4" aria-hidden="true" />
            </button>
          </div>
        </TransitionGroup>
      </div>
    </div>

    <!-- Create Context Set Modal -->
    <AddNewContext
      v-model:open="showCreateModal"
      @created="onContextSetCreated"
    />

    <!-- Delete Confirmation Modal -->
    <DeleteContextConfirmation
      v-model:open="showDeleteModal"
      :context-set-name="contextSetToDelete"
      @deleted="onContextSetDeleted"
      @error="onDeleteError"
    />
  </div>
</template>

<script setup lang="ts">
import { logger } from '~/utils/logger'
import { Button } from '@/components/ui/button'
import AddNewContext from '@/components/context-set-list/AddNewContext.vue'
import DeleteContextConfirmation from '@/components/context-set-list/DeleteContextConfirmation.vue'

const {
  contextSets,
  contextSetNames,
  activeContextSetName,
  setActiveContextSet
} = useProjectStore()

const { announceStatus } = useAccessibility()

// Try to restore last selected context set on component mount
onMounted(() => {
  // Only restore if no context set is currently active and we have context sets available
  if (!activeContextSetName.value && contextSetNames.value.length > 0) {
    const lastSelected = loadLastSelectedContextSet()
    if (lastSelected && contextSetNames.value.includes(lastSelected)) {
      setActiveContextSet(lastSelected)
    }
  }
})

// Modal state
const showCreateModal = ref(false)
const showDeleteModal = ref(false)
const contextSetToDelete = ref('')

// Template ref for active context button
let activeContextButton: HTMLButtonElement | null = null



// Computed property to sort context sets with active one at the top
const sortedContextSetNames = computed(() => {
  if (!contextSetNames.value.length) return []
  
  const names = [...contextSetNames.value]
  const active = activeContextSetName.value
  
  if (!active) return names
  
  // Sort: active context first, then alphabetically
  return names.sort((a, b) => {
    if (a === active) return -1
    if (b === active) return 1
    return getDisplayName(a).localeCompare(getDisplayName(b))
  })
})

// Helper functions
const getContextSetFileCount = (setName: string) => {
  return contextSets.value[setName]?.files?.length || 0
}

const getContextSetWorkflowStepCount = (setName: string) => {
  return contextSets.value[setName]?.workflows?.length || 0
}

const getDisplayName = (setName: string) => {
  return setName.startsWith('context:') ? setName.replace('context:', '') : setName
}

// Save last selected context set to localStorage
const saveLastSelectedContextSet = (setName: string) => {
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem('contextmax-last-context-set', setName)
    } catch (error) {
      logger.warn('Failed to save last context set to localStorage:', error)
    }
  }
}

// Load last selected context set from localStorage
const loadLastSelectedContextSet = (): string | null => {
  if (typeof window === 'undefined') return null
  try {
    return localStorage.getItem('contextmax-last-context-set')
  } catch {
    return null
  }
}

// Safe focus helper for test compatibility
const safeFocus = (element: HTMLButtonElement | null) => {
  try {
    element?.focus?.()
  } catch (error) {
    // Silently ignore focus errors in test environment
  }
}

// Actions
const selectContextSet = (setName: string) => {
  const success = setActiveContextSet(setName)
  if (success) {
    announceStatus(`Selected context set: ${getDisplayName(setName)}`)
    saveLastSelectedContextSet(setName)
    
    // Auto-focus on the active context after transition
    nextTick(() => {
      setTimeout(() => {
        safeFocus(activeContextButton)
      }, 250) // Wait for most of transition to complete
    })
  }
}

const onContextSetCreated = (contextSetName: string) => {
  // Optional: Additional handling when a context set is created
  // The AddNewContext component already handles the creation and activation
  saveLastSelectedContextSet(contextSetName)
  
  // Auto-focus on the newly created context
  nextTick(() => {
    setTimeout(() => {
      safeFocus(activeContextButton)
    }, 100)
  })
}

const confirmDelete = (setName: string) => {
  contextSetToDelete.value = setName
  showDeleteModal.value = true
}

const onContextSetDeleted = (contextSetName: string) => {
  // Reset the state
  contextSetToDelete.value = ''
  // Optional: Additional handling when a context set is deleted
  
  // Clear localStorage if the deleted set was the last selected one
  const lastSelected = loadLastSelectedContextSet()
  if (lastSelected === contextSetName) {
    try {
      localStorage.removeItem('contextmax-last-context-set')
    } catch (error) {
      logger.warn('Failed to remove last context set from localStorage:', error)
    }
  }
}

const onDeleteError = (error: string) => {
  // Optional: Additional error handling
}


</script>

<style scoped>
.line-clamp-2 {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.line-clamp-3 {
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

/* Smooth transition animations for context list reordering */
.context-list-move,
.context-list-enter-active,
.context-list-leave-active {
  transition: all 0.6s cubic-bezier(0.25, 0.46, 0.45, 0.94);
}

.context-list-enter-from {
  opacity: 0;
  transform: translateY(-10px);
}

.context-list-leave-to {
  opacity: 0;
  transform: translateY(10px);
}

/* Ensure leaving items don't affect layout during transition */
.context-list-leave-active {
  position: absolute;
  left: 0;
  right: 0;
}
</style> 