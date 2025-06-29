<!--
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
-->
<template>
  <div class="space-y-4">
    <!-- Header with Add Button -->
    <div class="flex items-center justify-between">
      <div>
        <h3 class="text-lg font-semibold">Child Contexts</h3>
        <p class="text-sm text-muted-foreground">
          Define which context sets this context depends on. Child contexts will be automatically included when exporting.
        </p>
      </div>
      <Button
        @click="showAddDialog = true"
        size="sm"
        :disabled="availableContexts.length === 0"
      >
        <Icon name="lucide:plus" class="w-4 h-4 mr-2" />
        Add Child Context
      </Button>
    </div>

    <!-- Empty State -->
    <div 
      v-if="!activeContextSet?.uses || activeContextSet.uses.length === 0"
      class="text-center py-12 border-2 border-dashed border-muted rounded-lg"
    >
      <Icon name="lucide:link" class="w-12 h-12 mx-auto mb-4 text-muted-foreground opacity-50" />
      <h3 class="text-lg font-medium mb-2">No Child Contexts</h3>
      <p class="text-muted-foreground mb-4 max-w-sm mx-auto">
        This context set doesn't depend on any other contexts yet. Add child contexts to create relationships between your context sets.
      </p>
      <Button
        @click="showAddDialog = true"
        variant="outline"
        :disabled="availableContexts.length === 0"
      >
        <Icon name="lucide:plus" class="w-4 h-4 mr-2" />
        Add Your First Child Context
      </Button>
      <p v-if="availableContexts.length === 0" class="text-xs text-muted-foreground mt-2">
        Create other context sets first to establish relationships
      </p>
    </div>

    <!-- Child Contexts List -->
    <div v-else class="space-y-2">
      <div
        v-for="childContext in activeContextSet?.uses"
        :key="childContext"
        class="flex items-center justify-between p-3 bg-card border rounded-lg hover:bg-muted/30 transition-colors"
      >
        <div class="flex items-center space-x-3">
          <Icon name="lucide:link" class="w-4 h-4 text-primary" />
          <div>
            <p class="font-medium">{{ getContextDisplayName(childContext) }}</p>
            <p class="text-xs text-muted-foreground">
              {{ getContextDescription(childContext) || 'No description' }}
            </p>
          </div>
        </div>
        <Button
          @click="removeChildContext(childContext)"
          variant="ghost"
          size="sm"
          class="text-destructive hover:text-destructive hover:bg-destructive/10"
        >
          <Icon name="lucide:x" class="w-4 h-4" />
        </Button>
      </div>
    </div>

    <!-- Add Child Context Dialog -->
    <Dialog v-model:open="showAddDialog">
      <DialogContent class="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add Child Context</DialogTitle>
          <DialogDescription>
            Select a context set that this context depends on. Child contexts will be automatically included when exporting this context.
          </DialogDescription>
        </DialogHeader>
        
        <div class="space-y-4">
          <!-- Search/Filter -->
          <div class="relative">
            <Icon name="lucide:search" class="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              v-model="searchQuery"
              placeholder="Search context sets..."
              class="pl-9"
            />
          </div>

          <!-- Available Contexts List -->
          <div class="max-h-60 overflow-y-auto space-y-1">
            <div
              v-for="contextName in filteredAvailableContexts"
              :key="contextName"
              @click="addChildContext(contextName)"
              class="flex items-start justify-between p-3 border rounded-lg cursor-pointer hover:bg-muted/50 transition-colors"
            >
              <div class="flex-1 min-w-0">
                <p class="font-medium truncate">{{ getContextDisplayName(contextName) }}</p>
                <p class="text-xs text-muted-foreground mt-1">
                  {{ getContextDescription(contextName) || 'No description' }}
                </p>
                <div class="flex items-center mt-2 space-x-4 text-xs text-muted-foreground">
                  <span>{{ getContextFileCount(contextName) }} files</span>
                  <span>{{ getContextWorkflowCount(contextName) }} workflows</span>
                </div>
              </div>
              <Icon name="lucide:plus-circle" class="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
            </div>
            
            <div v-if="filteredAvailableContexts.length === 0" class="text-center py-8 text-muted-foreground">
              <Icon name="lucide:search-x" class="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p>{{ searchQuery ? 'No matching context sets found' : 'No available context sets to add' }}</p>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button @click="showAddDialog = false" variant="outline">
            Cancel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </div>
</template>

<script setup lang="ts">
import { getContextDisplayName } from '~/utils/contextName'

const {
  activeContextSet,
  updateActiveContextSet,
  contextSetNames,
  contextSets
} = useProjectStore()

const { success, error } = useNotifications()
const { announceStatus, announceError } = useAccessibility()

// Local state
const showAddDialog = ref(false)
const searchQuery = ref('')

// Computed properties
const availableContexts = computed(() => {
  if (!activeContextSet.value) return []
  
  return contextSetNames.value.filter(name => {
    // Exclude current context and already added children
    return name !== activeContextSet.value.name && 
           !activeContextSet.value.uses?.includes(name)
  })
})

const filteredAvailableContexts = computed(() => {
  if (!searchQuery.value) return availableContexts.value
  
  const query = searchQuery.value.toLowerCase()
  return availableContexts.value.filter(name => {
    const contextSet = contextSets.value?.[name]
    return name.toLowerCase().includes(query) ||
           (contextSet?.description || '').toLowerCase().includes(query)
  })
})

// Helper functions
const getContextDescription = (contextName: string): string => {
  return contextSets.value?.[contextName]?.description || ''
}

const getContextFileCount = (contextName: string): number => {
  return contextSets.value?.[contextName]?.files.length || 0
}

const getContextWorkflowCount = (contextName: string): number => {
  return contextSets.value?.[contextName]?.workflows.length || 0
}

// Actions
const addChildContext = (contextName: string) => {
  if (!activeContextSet.value) return
  
  try {
    const currentUses = activeContextSet.value.uses || []
    if (currentUses.includes(contextName)) {
      error('Context Already Added', `"${getContextDisplayName(contextName)}" is already a child context`)
      return
    }
    
    // Check for circular dependencies
    if (wouldCreateCircularDependency(contextName)) {
      error('Circular Dependency', `Adding "${getContextDisplayName(contextName)}" would create a circular dependency`)
      return
    }
    
    const newUses = [...currentUses, contextName]
    updateActiveContextSet({ 
      name: activeContextSet.value.name,
      description: activeContextSet.value.description,
      workflows: activeContextSet.value.workflows,
      uses: newUses
    })
    
    success('Child Context Added', `"${getContextDisplayName(contextName)}" has been added as a child context`)
    announceStatus(`Added ${getContextDisplayName(contextName)} as child context`)
    
    showAddDialog.value = false
    searchQuery.value = ''
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to add child context'
    error('Failed to Add', message)
    announceError(message)
  }
}

const removeChildContext = (contextName: string) => {
  if (!activeContextSet.value) return
  
  try {
    const currentUses = activeContextSet.value.uses || []
    const newUses = currentUses.filter(name => name !== contextName)
    
    updateActiveContextSet({ 
      name: activeContextSet.value.name,
      description: activeContextSet.value.description,
      workflows: activeContextSet.value.workflows,
      uses: newUses
    })
    
    success('Child Context Removed', `"${getContextDisplayName(contextName)}" has been removed from child contexts`)
    announceStatus(`Removed ${getContextDisplayName(contextName)} from child contexts`)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to remove child context'
    error('Failed to Remove', message)
    announceError(message)
  }
}

// Check for circular dependencies
const wouldCreateCircularDependency = (newChildContext: string): boolean => {
  if (!activeContextSet.value) return false
  
  const visited = new Set<string>()
  const currentContext = activeContextSet.value.name
  
  const hasCircularDep = (contextName: string): boolean => {
    if (visited.has(contextName)) {
      return true // Found cycle
    }
    
    if (contextName === currentContext) {
      return true // Would point back to current context
    }
    
    visited.add(contextName)
    
    const context = contextSets.value?.[contextName]
    if (!context?.uses) return false
    
    // Check all children of this context
    for (const childName of context.uses) {
      if (hasCircularDep(childName)) {
        return true
      }
    }
    
    visited.delete(contextName)
    return false
  }
  
  return hasCircularDep(newChildContext)
}
</script>