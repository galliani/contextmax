<!--
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
-->
<template>
  <Dialog v-model:open="isOpen">
    <DialogContent class="max-w-6xl max-h-[90vh] flex flex-col">
      <DialogHeader>
        <DialogTitle class="flex items-center justify-start space-x-4">
          <div class="flex items-center space-x-2">
            <Icon name="lucide:file-text" class="w-5 h-5" />
            <span>{{ currentFileName }}</span>
          </div>
          <Button
            v-if="currentFileContent"
            variant="outline"
            size="sm"
            @click="copyContent"
          >
            <Icon name="lucide:clipboard" class="w-4 h-4 mr-2" />
            Copy to Clipboard
          </Button>
          <Button
            v-if="isContextSetsPreview"
            variant="default"
            size="sm"
            @click="showUsageGuide"
          >
            <Icon name="lucide:info" class="w-4 h-4 mr-2" />
            Usage Guide
          </Button>
        </DialogTitle>
        <DialogDescription>
          File Content
        </DialogDescription>
      </DialogHeader>

      <div class="flex-1 overflow-hidden">
        <div v-if="!currentFileContent" class="flex-1 flex items-center justify-center border rounded-lg h-[60vh]">
          <div class="text-center">
            <Icon name="lucide:file-x" class="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
            <p class="text-sm text-muted-foreground">No file content available</p>
          </div>
        </div>
        
        <div v-else class="border rounded-lg overflow-auto h-[60vh] bg-slate-50 dark:bg-slate-900">
          <CodeRenderer
            :content="currentFileContent"
            :file-path="currentFileName"
            :allow-line-click="false"
            line-numbers-class="bg-muted/30 border-muted"
            line-numbers-text-class="text-muted-foreground"
          />
        </div>
      </div>

      <DialogFooter>
        <Button @click="closeModal" variant="outline">
          Close
        </Button>
        <Button
          v-if="isContextSetsPreview"
          @click="showUsageGuide"
          variant="default"
        >
          <Icon name="lucide:info" class="w-4 h-4 mr-2" />
          View Usage Guide
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>

  <!-- Usage Guide Modal -->
  <HowToUseModal 
    v-model:open="showUsageModal" 
    title="How to Use Context Sets"
    description="Configure your IDE to work with the exported context-sets.json file for intelligent context switching."
    :example-context-set-name="exampleContextSetName"
    :show-success-icon="false"
  />
</template>

<script setup lang="ts">
import { logger } from '~/utils/logger'

const { 
  currentFileContent, 
  currentFileName, 
  isFileContentModalOpen, 
  closeFileContentModal,
  generateContextSetsJSONWithPrefix,
  contextSetNames
} = useProjectStore()

const { success, error } = useNotifications()

// Modal state for usage guide
const showUsageModal = ref(false)

// Check if this is a context-sets.json preview
const isContextSetsPreview = computed(() => {
  return currentFileName.value?.includes('context-sets.json') && 
         currentFileName.value?.includes('Preview')
})

// Get example context set name for the guide
const exampleContextSetName = computed(() => {
  const names = contextSetNames.value
  return names.length > 0 ? `context:${names[0]}` : 'context:myContextSet'
})

// Show usage guide
const showUsageGuide = () => {
  showUsageModal.value = true
}

async function copyContent() {
  if (!currentFileContent.value) return
  
  try {
    let contentToCopy = currentFileContent.value
    
    // Check if this is a JSON preview file - if so, regenerate with context: prefixes
    if (currentFileName.value?.includes('context-sets.json') && 
        currentFileName.value?.includes('Preview')) {
      try {
        const prefixedData = generateContextSetsJSONWithPrefix()
        contentToCopy = JSON.stringify(prefixedData, null, 2)
      } catch (error) {
        console.warn('Failed to generate prefixed JSON, using original content:', error)
        // Fall back to original content if prefix generation fails
      }
    }
    
    await navigator.clipboard.writeText(contentToCopy)
    success('Copied', 'Content copied to clipboard.')
  }
  catch (err) {
    logger.error('Failed to copy:', err)
    error('Copy Failed', 'Could not copy content to clipboard.')
  }
}

// Two-way binding for modal open state
const isOpen = computed({
  get: () => isFileContentModalOpen.value,
  set: (value) => {
    if (!value) {
      closeFileContentModal()
    }
  }
})

// Computed properties for file content display
const fileLines = computed(() => {
  if (!currentFileContent.value) return []
  return currentFileContent.value.split('\n')
})


const totalLines = computed(() => {
  return fileLines.value.length
})

// Close modal function
function closeModal() {
  closeFileContentModal()
}
</script> 