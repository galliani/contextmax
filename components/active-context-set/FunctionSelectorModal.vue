/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */
<template>
  <Dialog v-model:open="open">
    <DialogContent class="max-w-6xl max-h-[90vh] flex flex-col">
      <DialogHeader>
        <DialogTitle class="flex items-center space-x-2">
          <Icon name="lucide:function-square" class="w-5 h-5" />
          <span>Select Functions</span>
        </DialogTitle>
        <DialogDescription>
          {{ filePath }}
        </DialogDescription>
      </DialogHeader>

      <div class="flex-1 overflow-hidden flex gap-4">
        <!-- File Content -->
        <div class="flex-1 flex flex-col relative">
          <div class="flex items-center justify-between mb-2">
            <h4 class="text-sm font-medium">File Content</h4>
            <div class="text-xs text-muted-foreground text-right">
              <div>Highlight function names to select them</div>
            </div>
          </div>
          
          <div v-if="isLoadingContent" class="flex-1 flex items-center justify-center border rounded-lg">
            <div class="text-center">
              <Icon name="lucide:loader-2" class="w-6 h-6 animate-spin mx-auto mb-2 text-muted-foreground" />
              <p class="text-sm text-muted-foreground">Loading file content...</p>
            </div>
          </div>
          
          <div v-else ref="codeContainerRef" class="flex-1 border rounded-lg overflow-auto relative">
            <div class="p-4">
              <pre class="text-xs font-mono leading-5 select-text"><code 
                v-for="(line, index) in fileLines" 
                :key="index" 
                class="block px-1 leading-5 group/line" 
                :class="{
                  'bg-primary/30 hover:bg-primary/40 cursor-pointer relative': isLineHighlighted(index)
                }"
                @click="isLineHighlighted(index) ? removeFunctionFromLine(line) : null"
              >{{ line }}<span 
                v-if="isLineHighlighted(index)"
                class="absolute right-2 top-0 opacity-0 group-hover/line:opacity-100 transition-opacity bg-destructive text-destructive-foreground rounded-full w-4 h-4 flex items-center justify-center text-xs hover:bg-destructive/80"
                title="Click to remove function"
              >×</span></code></pre>
            </div>
          </div>
          
          <!-- Popover for adding function -->
          <div
            v-if="selectionPopover.visible"
            :style="{ top: `${selectionPopover.y}px`, left: `${selectionPopover.x}px` }"
            class="absolute bg-background border rounded-lg shadow-lg p-2 flex items-center space-x-2 z-10"
          >
            <span class="text-sm font-mono bg-muted px-2 py-1 rounded">{{ selectionPopover.text }}</span>
            <Button @click="addSelectedFunction" size="sm">
              <Icon name="lucide:plus" class="w-4 h-4 mr-2" />
              Add
            </Button>
          </div>
        </div>

        <!-- Selected Functions -->
        <div class="w-80 flex flex-col">
          <h4 class="text-sm font-medium mb-2">Selected Functions</h4>
          
          <div v-if="selectedFunctions.length === 0" class="flex-1 flex items-center justify-center border border-dashed rounded-lg">
            <div class="text-center text-muted-foreground">
              <Icon name="lucide:function-square" class="w-8 h-8 mx-auto mb-2" />
              <p class="text-sm">No functions selected</p>
              <p class="text-xs">Highlight function names in the code to select them</p>
            </div>
          </div>
          
          <div v-else class="flex-1 overflow-y-auto space-y-3">
            <div
              v-for="(func, index) in selectedFunctions"
              :key="index"
              class="border rounded-lg p-3 space-y-2"
            >
              <div class="flex items-center justify-between">
                <span class="text-sm font-mono">{{ func.name }}</span>
                <Button
                  @click="removeFunction(index)"
                  variant="ghost"
                  size="sm"
                  class="text-destructive hover:text-destructive"
                >
                  <Icon name="lucide:trash-2" class="w-4 h-4" />
                </Button>
              </div>
              
              <Textarea
                v-model="func.comment"
                placeholder="Add a comment for this function..."
                rows="2"
                class="text-xs"
              />
            </div>
          </div>
        </div>
      </div>

      <DialogFooter>
        <Button @click="open = false" variant="outline">
          Cancel
        </Button>
        <Button @click="saveFunctions">
          Save {{ selectedFunctions.length }} Function{{ selectedFunctions.length !== 1 ? 's' : '' }}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>

<script setup lang="ts">
import type { FunctionRef, FileTreeItem } from '~/composables/useProjectStore'

interface Props {
  open: boolean
  fileId: string
  existingFunctions: FunctionRef[]
}

const props = defineProps<Props>()

const emit = defineEmits<{
  'update:open': [value: boolean]
  'functions-updated': [functions: FunctionRef[]]
}>()

const { filesManifest, fileTree } = useProjectStore()

// Local state
const fileContent = ref('')
const isLoadingContent = ref(false)
const selectedFunctions = ref<FunctionRef[]>([])
const highlightedLines = ref<Set<number>>(new Set())
const codeContainerRef = ref<HTMLElement | null>(null)

const selectionPopover = reactive({
  visible: false,
  x: 0,
  y: 0,
  text: ''
})

// Computed
const open = computed({
  get: () => props.open,
  set: (value) => emit('update:open', value)
})

const filePath = computed(() => {
  return filesManifest.value[props.fileId]?.path || 'Unknown file'
})

const fileLines = computed(() => {
  return fileContent.value.split('\n')
})

// Watch for file changes
watch(() => props.fileId, async (newFileId) => {
  if (newFileId && props.open) {
    await loadFileContentForSelection(newFileId)
  }
}, { immediate: true })

watch(() => props.open, async (isOpen) => {
  if (isOpen && props.fileId) {
    await loadFileContentForSelection(props.fileId)
    // Load existing functions
    selectedFunctions.value = props.existingFunctions?.map(func => ({ ...func })) || []
    // Reset highlights
    updateHighlightedLines()
  }
})

// Functions
async function loadFileContentForSelection(fileId: string) {
  isLoadingContent.value = true
  try {
    // Find the file in the tree
    const file = findFileInTree(fileTree.value as FileTreeItem[], filesManifest.value[fileId]?.path)
    if (file && file.handle) {
      const fileHandle = file.handle as FileSystemFileHandle
      const fileObj = await fileHandle.getFile()
      fileContent.value = await fileObj.text()
    }
  } catch (error) {
    console.error('Error loading file content:', error)
    fileContent.value = ''
  } finally {
    isLoadingContent.value = false
  }
}

function findFileInTree(tree: FileTreeItem[], targetPath: string): FileTreeItem | null {
  for (const item of tree) {
    if (item.path === targetPath && item.type === 'file') {
      return item
    }
    if (item.children) {
      const found = findFileInTree(item.children, targetPath)
      if (found) return found
    }
  }
  return null
}

function isLineHighlighted(index: number): boolean {
  return highlightedLines.value.has(index)
}

function updateHighlightedLines() {
  const newHighlights = new Set<number>()
  const lines = fileLines.value
  
  selectedFunctions.value.forEach(func => {
    lines.forEach((line, index) => {
      if (line.includes(func.name)) {
        newHighlights.add(index)
      }
    })
  })
  
  highlightedLines.value = newHighlights
}

// Handle text selection
function handleTextSelection(event: MouseEvent) {
  const selection = window.getSelection()
  if (!selection || selection.isCollapsed) {
    selectionPopover.visible = false
    return
  }

  const selectedText = selection.toString().trim()
  if (!selectedText) {
    selectionPopover.visible = false
    return
  }
  
  const containerRect = codeContainerRef.value?.getBoundingClientRect()
  if (!containerRect) return

  selectionPopover.visible = true
  selectionPopover.x = event.clientX - containerRect.left + 10
  selectionPopover.y = event.clientY - containerRect.top + 10
  selectionPopover.text = selectedText
}

function addSelectedFunction() {
  const functionName = selectionPopover.text
  if (!functionName) return

  // Add new function if it doesn't exist
  const existingIndex = selectedFunctions.value.findIndex(f => f.name === functionName)
  if (existingIndex === -1) {
    selectedFunctions.value.push({
      name: functionName,
      comment: ''
    })
    updateHighlightedLines()
  }

  // Hide popover and clear selection
  selectionPopover.visible = false
  window.getSelection()?.removeAllRanges()
}

// Add event listener for text selection
onMounted(() => {
  document.addEventListener('mouseup', handleTextSelection)
})

onUnmounted(() => {
  document.removeEventListener('mouseup', handleTextSelection)
})

function removeFunction(index: number) {
  selectedFunctions.value.splice(index, 1)
  updateHighlightedLines()
}

function removeFunctionFromLine(line: string) {
  // Find functions that match text in this line
  const functionsToRemove = selectedFunctions.value.filter(func => 
    line.includes(func.name)
  )
  
  // Remove all matching functions
  functionsToRemove.forEach(func => {
    const index = selectedFunctions.value.findIndex(f => f.name === func.name)
    if (index !== -1) {
      selectedFunctions.value.splice(index, 1)
    }
  })
  
  updateHighlightedLines()
}

function saveFunctions() {
  emit('functions-updated', [...selectedFunctions.value])
  open.value = false
}
</script> 