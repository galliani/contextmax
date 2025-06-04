<template>
  <Dialog v-model:open="open">
    <DialogContent class="max-w-6xl max-h-[90vh] flex flex-col">
      <DialogHeader>
        <DialogTitle class="flex items-center space-x-2">
          <Icon name="lucide:scissors" class="w-5 h-5" />
          <span>Select Line Ranges</span>
        </DialogTitle>
        <DialogDescription>
          {{ filePath }}
        </DialogDescription>
      </DialogHeader>

      <div class="flex-1 overflow-hidden flex gap-4">
        <!-- File Content -->
        <div class="flex-1 flex flex-col">
          <div class="flex items-center justify-between mb-2">
            <h4 class="text-sm font-medium">File Content</h4>
            <div class="text-xs text-muted-foreground text-right">
              <div>Click and drag, or Shift+hover to select</div>
              <div>Keyboard: ↑↓ to navigate, Shift+↑↓ to select</div>
            </div>
          </div>
          
          <div v-if="isLoadingContent" class="flex-1 flex items-center justify-center border rounded-lg">
            <div class="text-center">
              <Icon name="lucide:loader-2" class="w-6 h-6 animate-spin mx-auto mb-2 text-muted-foreground" />
              <p class="text-sm text-muted-foreground">Loading file content...</p>
            </div>
          </div>
          
          <div v-else class="flex-1 border rounded-lg overflow-auto relative" @mouseup="endSelection" @mouseleave="handleMouseLeave">
            <div class="flex min-h-full">
              <!-- Line Numbers -->
              <div class="bg-muted/30 p-2 text-xs font-mono text-muted-foreground select-none min-w-[60px] border-r sticky left-0">
                <div
                  v-for="lineNum in totalLines"
                  :key="lineNum"
                  :data-line="lineNum"
                  class="line-number h-5 flex items-center justify-between px-2 cursor-pointer hover:bg-muted/50 relative focus:outline-none focus:ring-2 focus:ring-primary/50"
                  :class="{
                    'bg-primary/30 text-primary font-medium': isLineSelected(lineNum),
                    'bg-blue-500/30 text-blue-100 border-l-2 border-blue-500': isLineInRange(lineNum) && !isLineSelected(lineNum),
                    'ring-2 ring-primary/50': isKeyboardMode && focusedLine === lineNum
                  }"
                  :tabindex="lineNum === 1 ? 0 : -1"
                  @mousedown="startSelection(lineNum)"
                  @mouseover="handleLineHover(lineNum, $event)"
                  @click="handleLineClick(lineNum)"
                  @keydown="handleKeyDown($event, lineNum)"
                  @focus="handleLineFocus(lineNum)"
                >
                  <span></span>
                  <span>{{ lineNum }}</span>
                  
                  <!-- Inline Add Button for Pending Range -->
                  <div 
                    v-if="pendingRange && lineNum === getMiddleLineOfPendingRange()"
                    class="absolute left-full ml-2 flex space-x-1 z-20"
                  >
                    <Button @click="confirmPendingRange" @mousedown.stop size="sm" class="text-xs h-6 px-2">
                      <Icon name="lucide:plus" class="w-3 h-3 mr-1" />
                      Add
                    </Button>
                  </div>
                  
                  <!-- Inline Remove Button for Confirmed Range -->
                  <div 
                    v-if="hoveredRangeIndex !== null && lineNum === getMiddleLineOfRange(hoveredRangeIndex)"
                    class="absolute left-full ml-2 flex space-x-1 z-20"
                  >
                    <Button @click="removeHoveredRange" @mousedown.stop variant="destructive" size="sm" class="text-xs h-6 px-2">
                      <Icon name="lucide:trash-2" class="w-3 h-3 mr-1" />
                      Remove
                    </Button>
                    <Button @click="hoveredRangeIndex = null" @mousedown.stop variant="outline" size="sm" class="text-xs h-6 px-2">
                      <Icon name="lucide:x" class="w-3 h-3" />
                    </Button>
                  </div>
                </div>
              </div>
              
              <!-- Content -->
              <div class="flex-1 p-2">
                <pre class="text-xs font-mono leading-5"><code v-for="(line, index) in fileLines" :key="index" :data-line="index + 1" :class="{
                  'bg-primary/30': isLineSelected(index + 1),
                  'bg-blue-500/30 border-l-2 border-blue-500': isLineInRange(index + 1) && !isLineSelected(index + 1)
                }" class="block h-5 px-1" @mousedown="startSelection(index + 1)" @mouseover="handleLineHover(index + 1, $event)">{{ line }}</code></pre>
              </div>
            </div>
          </div>
        </div>

        <!-- Selected Ranges -->
        <div class="w-80 flex flex-col">
          <h4 class="text-sm font-medium mb-2">Selected Ranges</h4>
          
          <div v-if="ranges.length === 0" class="flex-1 flex items-center justify-center border border-dashed rounded-lg">
            <div class="text-center text-muted-foreground">
              <Icon name="lucide:mouse-pointer-click" class="w-8 h-8 mx-auto mb-2" />
              <p class="text-sm">No ranges selected</p>
              <p class="text-xs">Click and drag on line numbers to select ranges</p>
            </div>
          </div>
          
          <div v-else class="flex-1 overflow-y-auto space-y-3">
            <div
              v-for="(range, index) in ranges"
              :key="index"
              class="border rounded-lg p-3 space-y-2"
            >
              <div class="flex items-center justify-between">
                <span class="text-sm font-mono">{{ range.start }}-{{ range.end }}</span>
                <Button
                  @click="removeRange(index)"
                  variant="ghost"
                  size="sm"
                  class="text-destructive hover:text-destructive"
                >
                  <Icon name="lucide:trash-2" class="w-4 h-4" />
                </Button>
              </div>
              
              <Textarea
                v-model="range.comment"
                placeholder="Add a comment for this range..."
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
        <Button @click="saveRanges">
          Save {{ ranges.length }} Range{{ ranges.length !== 1 ? 's' : '' }}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>

<script setup lang="ts">
import type { LineRange, FileTreeItem } from '~/composables/useProjectStore'

interface Props {
  open: boolean
  fileId: string
  existingRanges: LineRange[]
}

const props = defineProps<Props>()

const emit = defineEmits<{
  'update:open': [value: boolean]
  'ranges-updated': [ranges: LineRange[]]
}>()

const { filesManifest, fileTree } = useProjectStore()

// Local state
const fileContent = ref('')
const isLoadingContent = ref(false)
const ranges = ref<LineRange[]>([])
const isSelecting = ref(false)
const selectionStart = ref(0)
const selectionEnd = ref(0)
const pendingRange = ref<{ start: number; end: number } | null>(null)
const hoveredRangeIndex = ref<number | null>(null)
const focusedLine = ref(1)
const isKeyboardMode = ref(false)

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

const totalLines = computed(() => {
  return fileLines.value.length
})

// Watch for file changes
watch(() => props.fileId, async (newFileId) => {
  if (newFileId && props.open) {
    await loadFileContentForSelection(newFileId)
  }
  // Clear pending range when file changes
  pendingRange.value = null
  hoveredRangeIndex.value = null
  focusedLine.value = 1
  isKeyboardMode.value = false
}, { immediate: true })

watch(() => props.open, async (isOpen) => {
  if (isOpen && props.fileId) {
    await loadFileContentForSelection(props.fileId)
    // Load existing ranges
    ranges.value = props.existingRanges.map(range => ({ ...range }))
    // Reset focus state
    focusedLine.value = 1
    isKeyboardMode.value = false
    
    // Focus the first line after modal opens
    nextTick(() => {
      const firstLineElement = document.querySelector('[data-line="1"]') as HTMLElement
      if (firstLineElement) {
        firstLineElement.focus()
      }
    })
  }
  // Clear pending range when modal opens/closes
  pendingRange.value = null
  hoveredRangeIndex.value = null
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

function startSelection(lineNum: number) {
  isSelecting.value = true
  selectionStart.value = lineNum
  selectionEnd.value = lineNum
}

function updateSelection(lineNum: number) {
  if (isSelecting.value) {
    selectionEnd.value = lineNum
  }
}

function endSelection() {
  if (isSelecting.value) {
    isSelecting.value = false
    
    const start = Math.min(selectionStart.value, selectionEnd.value)
    const end = Math.max(selectionStart.value, selectionEnd.value)
    
    // Check if this range overlaps with existing ranges
    const hasOverlap = ranges.value.some(range => 
      !(end < range.start || start > range.end)
    )
    
    if (!hasOverlap && start <= end && start > 0) {
      // Create pending range instead of adding directly
      pendingRange.value = { start, end }
    }
  }
}

function isLineSelected(lineNum: number): boolean {
  // Show selection during active selection or pending range
  if (isSelecting.value) {
    const start = Math.min(selectionStart.value, selectionEnd.value)
    const end = Math.max(selectionStart.value, selectionEnd.value)
    return lineNum >= start && lineNum <= end
  }
  
  if (pendingRange.value) {
    return lineNum >= pendingRange.value.start && lineNum <= pendingRange.value.end
  }
  
  return false
}

function isLineInRange(lineNum: number): boolean {
  return ranges.value.some(range => lineNum >= range.start && lineNum <= range.end)
}

function getLineRangeIndex(lineNum: number): number | null {
  for (let i = 0; i < ranges.value.length; i++) {
    if (lineNum >= ranges.value[i].start && lineNum <= ranges.value[i].end) {
      return i
    }
  }
  return null
}

function checkForHover(lineNum: number) {
  // Only handle hover logic when not selecting
  if (!isSelecting.value) {
    // Check if this line is part of a confirmed range
    const rangeIndex = getLineRangeIndex(lineNum)
    if (rangeIndex !== null && rangeIndex !== hoveredRangeIndex.value) {
      hoveredRangeIndex.value = rangeIndex
    } else if (rangeIndex === null) {
      hoveredRangeIndex.value = null
    }
  }
}

function handleMouseLeave() {
  endSelection()
  hoveredRangeIndex.value = null
}

function confirmPendingRange() {
  if (pendingRange.value) {
    const newRange = {
      start: pendingRange.value.start,
      end: pendingRange.value.end,
      comment: ''
    }
    ranges.value.push(newRange)
    
    // Sort ranges by start line
    ranges.value.sort((a, b) => a.start - b.start)
    
    // Clear pending state
    pendingRange.value = null
  }
}

function cancelPendingRange() {
  pendingRange.value = null
}

function removeRange(index: number) {
  ranges.value.splice(index, 1)
}

function saveRanges() {
  emit('ranges-updated', [...ranges.value])
}

// Prevent text selection and add keyboard navigation
onMounted(() => {
  document.addEventListener('selectstart', preventDefault)
  document.addEventListener('mouseup', endSelection)
  document.addEventListener('keydown', handleGlobalKeyDown)
})

onUnmounted(() => {
  document.removeEventListener('selectstart', preventDefault)
  document.removeEventListener('mouseup', endSelection)
  document.removeEventListener('keydown', handleGlobalKeyDown)
})

function preventDefault(e: Event) {
  if (isSelecting.value) {
    e.preventDefault()
    return false
  }
}

function handleGlobalKeyDown(event: KeyboardEvent) {
  // Only handle if the modal is open and not focused on input elements
  if (!props.open) return
  
  const target = event.target as HTMLElement
  if (target.tagName === 'TEXTAREA' || target.tagName === 'INPUT') return
  
  // Handle global keyboard shortcuts
  switch (event.key) {
    case 'Escape':
      if (isSelecting.value) {
        event.preventDefault()
        cancelSelection()
      } else if (pendingRange.value) {
        event.preventDefault()
        cancelPendingRange()
      }
      break
      
    case 'Enter':
      if (pendingRange.value) {
        event.preventDefault()
        confirmPendingRange()
      }
      break
  }
}

function removeHoveredRange() {
  if (hoveredRangeIndex.value !== null) {
    ranges.value.splice(hoveredRangeIndex.value, 1)
    hoveredRangeIndex.value = null
  }
}

function getMiddleLineOfPendingRange(): number {
  if (pendingRange.value) {
    return Math.floor((pendingRange.value.start + pendingRange.value.end) / 2)
  }
  return 0
}

function getMiddleLineOfRange(index: number): number {
  if (index !== null && index !== undefined) {
    const range = ranges.value[index]
    return Math.floor((range.start + range.end) / 2)
  }
  return 0
}

function handleLineHover(lineNum: number, event?: MouseEvent) {
  // If shift is held, start/continue selection
  if (event && event.shiftKey && !isSelecting.value) {
    startSelectionFromHover(lineNum)
  } else if (isSelecting.value) {
    updateSelection(lineNum)
  } else {
    checkForHover(lineNum)
  }
}

function handleLineClick(lineNum: number) {
  isKeyboardMode.value = false
  focusedLine.value = lineNum
}

function handleKeyDown(event: KeyboardEvent, lineNum: number) {
  isKeyboardMode.value = true
  
  switch (event.key) {
    case 'ArrowDown':
      event.preventDefault()
      if (event.shiftKey) {
        // Extend or start selection downward
        handleKeyboardSelection(lineNum, lineNum + 1)
      } else {
        // Move focus down
        moveFocus(1)
      }
      break
      
    case 'ArrowUp':
      event.preventDefault()
      if (event.shiftKey) {
        // Extend or start selection upward
        handleKeyboardSelection(lineNum, lineNum - 1)
      } else {
        // Move focus up
        moveFocus(-1)
      }
      break
      
    case 'Enter':
    case ' ':
      event.preventDefault()
      if (event.shiftKey) {
        // Start selection at current line
        startSelection(lineNum)
      } else if (pendingRange.value) {
        // Confirm pending range
        confirmPendingRange()
      }
      break
      
    case 'Escape':
      event.preventDefault()
      if (isSelecting.value) {
        cancelSelection()
      } else if (pendingRange.value) {
        cancelPendingRange()
      }
      break
  }
}

function handleLineFocus(lineNum: number) {
  focusedLine.value = lineNum
  isKeyboardMode.value = true
}

function startSelectionFromHover(lineNum: number) {
  if (!isSelecting.value) {
    isSelecting.value = true
    selectionStart.value = lineNum
    selectionEnd.value = lineNum
  }
}

function handleKeyboardSelection(currentLine: number, targetLine: number) {
  if (targetLine < 1 || targetLine > totalLines.value) return
  
  if (!isSelecting.value) {
    // Start new selection
    startSelection(currentLine)
    updateSelection(targetLine)
  } else {
    // Continue existing selection
    updateSelection(targetLine)
  }
  
  // Move focus to target line
  focusedLine.value = targetLine
  focusLineElement(targetLine)
}

function moveFocus(direction: number) {
  const newLine = focusedLine.value + direction
  if (newLine >= 1 && newLine <= totalLines.value) {
    focusedLine.value = newLine
    focusLineElement(newLine)
  }
}

function focusLineElement(lineNum: number) {
  // Focus the line element
  nextTick(() => {
    const lineElement = document.querySelector(`[data-line="${lineNum}"]`) as HTMLElement
    if (lineElement) {
      lineElement.focus()
    }
  })
}

function cancelSelection() {
  isSelecting.value = false
  selectionStart.value = 0
  selectionEnd.value = 0
}
</script> 