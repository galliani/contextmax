/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */
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
        
        <div v-else class="border rounded-lg overflow-auto h-[60vh]">
          <div class="flex min-h-full">
            <!-- Line Numbers -->
            <div class="bg-muted/30 p-2 text-xs font-mono text-muted-foreground select-none min-w-[60px] border-r sticky left-0">
              <div
                v-for="lineNum in totalLines"
                :key="lineNum"
                class="h-5 flex items-center justify-end px-2"
              >
                {{ lineNum }}
              </div>
            </div>
            
            <!-- Content -->
            <div class="flex-1 p-2">
              <pre class="text-xs font-mono leading-5"><code v-for="(line, index) in fileLines" :key="index" class="block h-5 px-1">{{ line }}</code></pre>
            </div>
          </div>
        </div>
      </div>

      <DialogFooter>
        <Button @click="closeModal" variant="outline">
          Close
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>

<script setup lang="ts">
const { 
  currentFileContent, 
  currentFileName, 
  isFileContentModalOpen, 
  closeFileContentModal 
} = useProjectStore()

const { success, error } = useNotifications()

async function copyContent() {
  if (!currentFileContent.value) return
  
  try {
    await navigator.clipboard.writeText(currentFileContent.value)
    success('Copied', 'Content copied to clipboard.')
  }
  catch (err) {
    console.error('Failed to copy:', err)
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