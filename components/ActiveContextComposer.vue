<template>
  <!-- Unified Context Set Composition Interface -->
  <div class="w-full">
    <!-- Unified Container with Shared Border -->
    <div class="bg-card rounded-lg border shadow-lg overflow-hidden min-h-[800px] lg:min-h-[900px]">
      
      <!-- Joint Panel Header -->
      <div class="border-b bg-gradient-surface px-6 py-4">
        <div class="flex items-center justify-between">
          <div class="flex-1 min-w-0">
            <!-- Editable Context Set Name -->
            <div v-if="activeContextSetName" class="mt-4 mb-2">
              <div v-if="!isEditingName" class="flex items-center group">
                <h3 class="visual-hierarchy-3 mb-1 text-mobile-subheading sm:text-lg lg:text-2xl" @click="startEditingName">
                  Context Set: {{ activeContextSetName }}
                </h3>
                <Button
                  @click="startEditingName"
                  variant="ghost"
                  size="sm"
                  class="ml-2 opacity-0 group-hover:opacity-100 transition-opacity"
                  title="Edit context set name"
                >
                  <Icon name="lucide:edit-2" class="w-4 h-4" aria-hidden="true" />
                </Button>
              </div>
              <div v-else class="space-y-2">
                <Input
                  ref="nameInput"
                  v-model="editingName"
                  @blur="saveContextSetName"
                  @keydown.enter="saveContextSetName"
                  @keydown.escape="cancelEditingName"
                  class="text-4xl font-semibold h-auto py-2 px-3 border-2 border-primary bg-background"
                  placeholder="Enter context set name"
                />
                <div class="flex items-center space-x-2">
                  <Button @click="saveContextSetName" size="sm" variant="default">
                    <Icon name="lucide:check" class="w-4 h-4 mr-1" aria-hidden="true" />
                    Save
                  </Button>
                  <Button @click="cancelEditingName" size="sm" variant="outline">
                    <Icon name="lucide:x" class="w-4 h-4 mr-1" aria-hidden="true" />
                    Cancel
                  </Button>
                </div>
              </div>
            </div>
            <h3 v-else class="visual-hierarchy-3 mb-2 text-mobile-subheading sm:text-lg lg:text-2xl">
              Context Set Composer
            </h3>

            <!-- Editable Context Set Description -->
            <div v-if="activeContextSetName" class="mb-1">
              <div v-if="!isEditingDescription && activeContextSetDescription" class="flex items-start group">
                <p class="text-lg text-slate-300 cursor-pointer hover:text-slate-200 transition-colors" @click="startEditingDescription">
                  {{ activeContextSetDescription }}
                </p>
                <Button
                  @click="startEditingDescription"
                  variant="ghost"
                  size="sm"
                  class="ml-2 opacity-0 group-hover:opacity-100 transition-opacity"
                  title="Edit description"
                >
                  <Icon name="lucide:edit-2" class="w-3 h-3" aria-hidden="true" />
                </Button>
              </div>
              <div v-else-if="!isEditingDescription && !activeContextSetDescription" class="group">
                <Button
                  @click="startEditingDescription"
                  variant="ghost"
                  size="sm"
                  class="text-muted-foreground hover:text-foreground transition-colors"
                  title="Add description"
                >
                  <Icon name="lucide:plus" class="w-4 h-4 mr-2" aria-hidden="true" />
                  Add description
                </Button>
              </div>
              <div v-else class="space-y-2">
                <Textarea
                  ref="descriptionInput"
                  v-model="editingDescription"
                  @blur="saveContextSetDescription"
                  @keydown.escape="cancelEditingDescription"
                  class="text-lg min-h-[80px] border-2 border-primary bg-background text-slate-300"
                  placeholder="Describe what this context set is for and how it should be used..."
                />
                <div class="flex items-center space-x-2">
                  <Button @click="saveContextSetDescription" size="sm" variant="default">
                    <Icon name="lucide:check" class="w-4 h-4 mr-1" aria-hidden="true" />
                    Save
                  </Button>
                  <Button @click="cancelEditingDescription" size="sm" variant="outline">
                    <Icon name="lucide:x" class="w-4 h-4 mr-1" aria-hidden="true" />
                    Cancel
                  </Button>
                </div>
              </div>
            </div>
          </div>
          
          <!-- Context Set Status & Actions -->
          <div v-if="activeContextSetName" class="flex items-center space-x-4 ml-6">
            <div class="text-right">
              <div class="text-sm font-medium text-foreground">
                {{ activeContextSet?.files?.length || 0 }} files • {{ activeContextSet?.workflow?.length || 0 }} workflow steps
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Unified Content Area -->
      <div class="grid grid-cols-1 lg:grid-cols-2 h-full min-h-[750px] lg:min-h-[850px]">
        
        <!-- Left Panel: Project File Browser -->
        <div class="">
          <div class="h-full flex flex-col">
            <!-- Project File Browser Content -->
            <div class="flex-1 overflow-hidden">
              <ProjectFileBrowser />
            </div>
          </div>
        </div>

        <!-- Right Panel: Active Context Set Editor -->
        <div class="h-full flex flex-col">
          <!-- Active Context Set Sub-header -->
          <div class="border-b bg-muted/30 px-4 py-3">
            <div class="flex items-center justify-between">
              <div>
                <h4 class="visual-hierarchy-4 mb-2 text-mobile-subheading sm:text-md lg:text-md">Context Set Details</h4>
              </div>
            </div>
          </div>
          
          <!-- Active Context Set Editor Content -->
          <div class="flex-1 overflow-hidden">
            <Editor />
          </div>
        </div>

      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import Editor from './active-context-set/Editor.vue'

// State for editing
const isEditingName = ref(false)
const isEditingDescription = ref(false)
const editingName = ref('')
const editingDescription = ref('')

// Template refs for focusing
const nameInput = ref<HTMLInputElement>()
const descriptionInput = ref<HTMLTextAreaElement>()

// Use the project store
const { activeContextSet, updateActiveContextSet } = useProjectStore()

// Accessibility support
const { announceStatus, announceError } = useAccessibility()

// Safe focus helper for test compatibility
const safeFocus = (element: HTMLElement | undefined) => {
  try {
    element?.focus?.()
  } catch (error) {
    // Silently ignore focus errors in test environment
  }
}

const safeSelect = (element: HTMLInputElement | undefined) => {
  try {
    element?.select?.()
  } catch (error) {
    // Silently ignore select errors in test environment
  }
}

// Computed properties for active context set
const activeContextSetName = computed(() => {
  return activeContextSet.value?.name || ''
})

const activeContextSetDescription = computed(() => {
  return activeContextSet.value?.description || ''
})

// Methods for editing
const startEditingName = async () => {
  isEditingName.value = true
  editingName.value = activeContextSetName.value
  await nextTick()
  safeFocus(nameInput.value)
  safeSelect(nameInput.value)
}

const startEditingDescription = async () => {
  isEditingDescription.value = true
  editingDescription.value = activeContextSetDescription.value
  await nextTick()
  safeFocus(descriptionInput.value)
}

const saveContextSetName = () => {
  if (!activeContextSet.value) return
  
  const newName = editingName.value.trim()
  if (!newName) {
    announceError('Context set name cannot be empty')
    safeFocus(nameInput.value)
    return
  }
  
  if (newName === activeContextSet.value.name) {
    isEditingName.value = false
    return
  }
  
  try {
    updateActiveContextSet({ name: newName })
    isEditingName.value = false
    announceStatus(`Context set renamed to: ${newName}`)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to rename context set'
    announceError(message)
    safeFocus(nameInput.value)
  }
}

const saveContextSetDescription = () => {
  if (!activeContextSet.value) return
  
  const newDescription = editingDescription.value.trim()
  if (newDescription === activeContextSet.value.description) {
    isEditingDescription.value = false
    return
  }
  
  try {
    updateActiveContextSet({ description: newDescription })
    isEditingDescription.value = false
    announceStatus('Context set description updated')
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to update description'
    announceError(message)
    safeFocus(descriptionInput.value)
  }
}

const cancelEditingName = () => {
  isEditingName.value = false
  editingName.value = ''
}

const cancelEditingDescription = () => {
  isEditingDescription.value = false
  editingDescription.value = ''
}
</script>

<style scoped>
/* Unified panel styling */
.border-r {
  border-right: 1px solid var(--border);
}

/* Sub-header styling for unified look */
.bg-muted\/30 {
  background-color: rgba(156, 163, 175, 0.1);
}

/* Main working area height adjustments */
.min-h-\[800px\] {
  min-height: 800px;
}

.min-h-\[750px\] {
  min-height: 750px;
}

.min-h-\[850px\] {
  min-height: 850px;
}

/* Mobile height adjustments for better UX */
@media (max-width: 768px) {
  .min-h-\[800px\] {
    min-height: 600px;
  }
  
  .min-h-\[750px\] {
    min-height: 550px;
  }
  
  .min-h-\[850px\] {
    min-height: 580px;
  }
}

/* Tablet height adjustments */
@media (min-width: 769px) and (max-width: 1023px) {
  .min-h-\[800px\] {
    min-height: 700px;
  }
  
  .min-h-\[750px\] {
    min-height: 650px;
  }
  
  .min-h-\[850px\] {
    min-height: 680px;
  }
}

/* Desktop enhanced heights */
@media (min-width: 1024px) {
  .lg\:min-h-\[900px\] {
    min-height: 900px;
  }
  
  .lg\:min-h-\[850px\] {
    min-height: 850px;
  }
}
</style>
