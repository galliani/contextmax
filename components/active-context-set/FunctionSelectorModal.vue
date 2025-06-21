/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */
<template>
  <Dialog v-model:open="open">
    <DialogContent class="max-w-5xl max-h-[90vh] flex flex-col w-[90vw]">
      <DialogHeader>
        <DialogTitle class="flex items-center space-x-2">
          <Icon name="lucide:function-square" class="w-5 h-5" />
          <span>Select Functions</span>
        </DialogTitle>
        <DialogDescription>
          {{ filePath }}
        </DialogDescription>
      </DialogHeader>

      <div class="flex-1 min-h-0 overflow-hidden flex gap-4">
        <!-- File Content -->
        <div class="flex-1 min-w-0 flex flex-col relative">
          <div class="space-y-3 mb-2">
            <div class="flex items-center justify-between">
              <h4 class="text-sm font-medium">File Content</h4>
              <div class="text-xs text-muted-foreground">
                Highlight function names to select them
              </div>
            </div>
            
            <!-- Search Row -->
            <div class="flex items-center space-x-2">
              <!-- Search Input -->
              <div class="relative flex-1">
                <Icon name="lucide:search" class="absolute left-2 top-1/2 transform -translate-y-1/2 w-3 h-3 text-muted-foreground" />
                <Input 
                  v-model="searchQuery"
                  placeholder="Search in file..."
                  class="pl-7 h-7 text-xs w-full"
                  @keydown.enter="findNext"
                  @keydown.escape="clearSearch"
                />
                <div v-if="searchQuery && searchMatches.length > 0" class="absolute right-2 top-1/2 transform -translate-y-1/2 text-xs text-muted-foreground">
                  {{ currentSearchIndex + 1 }}/{{ searchMatches.length }}
                </div>
              </div>
              
              <!-- Jump to Function Dropdown -->
              <Select v-model="selectedFunction" @update:model-value="jumpToFunction">
                <SelectTrigger class="w-32 h-7 text-xs flex-shrink-0">
                  <SelectValue :placeholder="detectedFunctions.length > 0 ? `${detectedFunctions.length} funcs` : 'No funcs'" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem v-if="detectedFunctions.length === 0" value="no-functions" disabled>
                    No functions detected
                  </SelectItem>
                  <SelectItem v-for="func in detectedFunctions" :key="func.name" :value="func.name">
                    <div class="flex items-center space-x-2">
                      <Icon :name="func.icon" class="w-3 h-3" />
                      <span class="font-mono text-xs">{{ func.name }}</span>
                      <span class="text-xs text-muted-foreground">:{{ func.line }}</span>
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          
          <div v-if="isLoadingContent" class="flex-1 flex items-center justify-center border rounded-lg">
            <div class="text-center">
              <Icon name="lucide:loader-2" class="w-6 h-6 animate-spin mx-auto mb-2 text-muted-foreground" />
              <p class="text-sm text-muted-foreground">Loading file content...</p>
            </div>
          </div>
          
          <div v-else ref="codeContainerRef" class="flex-1 min-h-0 border rounded-lg overflow-auto relative bg-slate-50 dark:bg-slate-900">
            <CodeRenderer
              :content="fileContent"
              :file-path="filePath"
              :highlighted-line-indices="highlightedLineIndices"
              :search-matches="searchMatches"
              :current-search-index="currentSearchIndex"
              @line-click="handleCodeLineClick"
              ref="codeRendererRef"
            />
            
            <!-- Jump indicator overlay -->
            <div 
              v-if="jumpIndicator.visible"
              class="absolute left-0 right-0 h-12 pointer-events-none transition-all duration-500"
              :style="{ 
                top: `${jumpIndicator.top}px`,
                background: 'linear-gradient(to right, transparent, rgba(251, 191, 36, 0.3) 10%, rgba(251, 191, 36, 0.3) 90%, transparent)'
              }"
            >
              <div class="absolute left-4 top-1/2 -translate-y-1/2 bg-yellow-500 text-yellow-900 px-2 py-1 rounded text-xs font-semibold">
                {{ jumpIndicator.functionName }}
              </div>
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
        <div class="w-64 flex flex-col flex-shrink-0 min-w-0">
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '~/components/ui/select'
import hljs from 'highlight.js'

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
const highlightedLineIndices = ref<Set<number>>(new Set())
const codeContainerRef = ref<HTMLElement | null>(null)
const codeRendererRef = ref<InstanceType<typeof CodeRenderer> | null>(null)

// Search state
const searchQuery = ref('')
const searchMatches = ref<Array<{ line: number, start: number, end: number }>>([])
const currentSearchIndex = ref(0)

// Function detection state
const detectedFunctions = ref<Array<{ name: string, line: number, icon: string, type: string }>>([])
const selectedFunction = ref('')

// Jump indicator state
const jumpIndicator = reactive({
  visible: false,
  top: 0,
  functionName: ''
})

const selectionPopover = reactive({
  visible: false,
  x: 0,
  y: 0,
  text: '',
  lineIndex: -1  // Track which line the selection was made on
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

// Language detection
const fileExtension = computed(() => {
  const path = filePath.value
  return path.split('.').pop()?.toLowerCase() || ''
})

// Search functionality
watchEffect(() => {
  if (searchQuery.value) {
    searchInFile()
  } else {
    searchMatches.value = []
    currentSearchIndex.value = 0
  }
})

// Detect functions when file content changes
watchEffect(() => {
  if (fileContent.value) {
    detectFunctions()
    console.log('Detected functions:', detectedFunctions.value)
  }
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
  return highlightedLineIndices.value.has(index)
}

function updateHighlightedLines() {
  const newHighlights = new Set<number>()
  
  selectedFunctions.value.forEach(func => {
    // Use the stored line index directly
    if ('lineIndex' in func && typeof func.lineIndex === 'number') {
      newHighlights.add(func.lineIndex)
    }
  })
  
  highlightedLineIndices.value = newHighlights
}


// Handle line click from CodeRenderer
function handleCodeLineClick(line: string, index: number) {
  if (isLineHighlighted(index)) {
    removeFunctionFromLine(line, index)
  }
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
  
  // Find which line was clicked by checking the event target
  const target = event.target as HTMLElement
  const codeElement = target.closest('code[data-line-index]') as HTMLElement
  if (codeElement) {
    const lineIndex = parseInt(codeElement.dataset.lineIndex || '-1')
    selectionPopover.lineIndex = lineIndex
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
  const lineIndex = selectionPopover.lineIndex
  if (!functionName || lineIndex === -1) return

  // Add new function if it doesn't exist
  const existingIndex = selectedFunctions.value.findIndex(f => f.name === functionName)
  if (existingIndex === -1) {
    selectedFunctions.value.push({
      name: functionName,
      comment: '',
      lineIndex: lineIndex  // Store the line index with the function
    } as FunctionRef & { lineIndex: number })
    updateHighlightedLines()
  }

  // Hide popover and clear selection
  selectionPopover.visible = false
  selectionPopover.lineIndex = -1
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

function removeFunctionFromLine(line: string, lineIndex: number) {
  // Find which function is declared on this line using regex parser
  const { parseCode } = useRegexCodeParser()
  
  try {
    const parsedInfo = parseCode(line, filePath.value)
    let functionToRemove: string | null = null
    
    // Check if this line contains a function declaration
    if (parsedInfo.functions.length > 0) {
      functionToRemove = parsedInfo.functions[0].name
    } else if (parsedInfo.classes.length > 0) {
      functionToRemove = parsedInfo.classes[0].name
    }
    
    if (functionToRemove) {
      // Remove the function that's actually declared on this line
      const index = selectedFunctions.value.findIndex(f => f.name === functionToRemove)
      if (index !== -1) {
        selectedFunctions.value.splice(index, 1)
      }
    }
  } catch (error) {
    console.error('Error parsing line for function removal:', error)
  }
  
  updateHighlightedLines()
}

function saveFunctions() {
  emit('functions-updated', [...selectedFunctions.value])
  open.value = false
}

// Search functions
function searchInFile() {
  const query = searchQuery.value.toLowerCase()
  const matches: Array<{ line: number, start: number, end: number }> = []
  
  fileLines.value.forEach((line, index) => {
    const lowerLine = line.toLowerCase()
    let start = 0
    
    while (true) {
      const found = lowerLine.indexOf(query, start)
      if (found === -1) break
      
      matches.push({
        line: index,
        start: found,
        end: found + query.length
      })
      
      start = found + 1
    }
  })
  
  searchMatches.value = matches
  currentSearchIndex.value = 0
  
  if (matches.length > 0) {
    scrollToSearchMatch(0)
  }
}

function findNext() {
  if (searchMatches.value.length === 0) return
  
  currentSearchIndex.value = (currentSearchIndex.value + 1) % searchMatches.value.length
  scrollToSearchMatch(currentSearchIndex.value)
}

function clearSearch() {
  searchQuery.value = ''
  searchMatches.value = []
  currentSearchIndex.value = 0
}

function scrollToSearchMatch(index: number) {
  const match = searchMatches.value[index]
  if (!match) return
  
  codeRendererRef.value?.scrollToLine(match.line + 1)
}

// Function detection using regex parser
function detectFunctions() {
  const { parseCode } = useRegexCodeParser()
  
  try {
    const parsedInfo = parseCode(fileContent.value, filePath.value)
    
    const functions: Array<{ name: string, line: number, icon: string, type: string }> = []
    
    // Convert parsed functions to our format
    parsedInfo.functions.forEach(func => {
      functions.push({
        name: func.name,
        line: func.startLine + 1, // Convert 0-based to 1-based line numbers
        icon: 'lucide:function-square',
        type: 'function'
      })
    })
    
    // Convert parsed classes to our format
    parsedInfo.classes.forEach(cls => {
      functions.push({
        name: cls.name,
        line: cls.startLine + 1, // Convert 0-based to 1-based line numbers
        icon: 'lucide:box',
        type: 'class'
      })
    })
    
    // Sort by line number
    functions.sort((a, b) => a.line - b.line)
    detectedFunctions.value = functions
  } catch (error) {
    console.error('Error parsing functions with regex parser:', error)
    detectedFunctions.value = []
  }
}


function jumpToFunction(functionName: string) {
  if (!functionName) return
  
  const func = detectedFunctions.value.find(f => f.name === functionName)
  if (func) {
    // Scroll to function first
    codeRendererRef.value?.scrollToLine(func.line)
    
    // Calculate the position for the indicator
    nextTick(() => {
      const lineElement = document.getElementById(`line-${func.line}`)
      if (lineElement && codeContainerRef.value) {
        const containerRect = codeContainerRef.value.getBoundingClientRect()
        const lineRect = lineElement.getBoundingClientRect()
        
        // Show jump indicator
        jumpIndicator.visible = true
        jumpIndicator.top = lineRect.top - containerRect.top + codeContainerRef.value.scrollTop - 6 // Adjust for better alignment
        jumpIndicator.functionName = func.name
        
        // Hide indicator after 3 seconds
        setTimeout(() => {
          jumpIndicator.visible = false
        }, 3000)
      }
    })
  }
  
  // Reset selection
  selectedFunction.value = ''
}

</script>

<style>
/* Import highlight.js theme - using GitHub theme for light/dark compatibility */
@import 'highlight.js/styles/github.css';

/* Override highlight.js styles to work with our existing theme */
.hljs {
  background: transparent !important;
  color: inherit !important;
  padding: 0 !important;
}

/* Ensure our custom highlighting takes precedence */
.bg-primary\/20 {
  background-color: rgb(var(--primary) / 0.2) !important;
}

.hover\:bg-primary\/30:hover {
  background-color: rgb(var(--primary) / 0.3) !important;
}

/* Jump highlight animation */
.jump-highlight {
  background-color: rgb(var(--warning) / 0.3) !important;
  animation: jumpPulse 2s ease-out;
}

@keyframes jumpPulse {
  0% {
    background-color: rgb(var(--warning) / 0.6);
    transform: scale(1.02);
  }
  50% {
    background-color: rgb(var(--warning) / 0.4);
  }
  100% {
    background-color: rgb(var(--warning) / 0.1);
    transform: scale(1);
  }
}

/* Dark mode adjustments */
.dark .hljs-comment,
.dark .hljs-quote {
  color: #6b7280;
}

.dark .hljs-keyword,
.dark .hljs-selector-tag,
.dark .hljs-addition {
  color: #f472b6;
}

.dark .hljs-number,
.dark .hljs-string,
.dark .hljs-meta .hljs-meta-string,
.dark .hljs-literal,
.dark .hljs-doctag,
.dark .hljs-regexp {
  color: #34d399;
}

.dark .hljs-title,
.dark .hljs-section,
.dark .hljs-name,
.dark .hljs-selector-id,
.dark .hljs-selector-class {
  color: #60a5fa;
}

.dark .hljs-attribute,
.dark .hljs-attr,
.dark .hljs-variable,
.dark .hljs-template-variable,
.dark .hljs-class .hljs-title,
.dark .hljs-type {
  color: #fbbf24;
}

.dark .hljs-symbol,
.dark .hljs-bullet,
.dark .hljs-subst,
.dark .hljs-meta,
.dark .hljs-meta .hljs-keyword,
.dark .hljs-selector-attr,
.dark .hljs-selector-pseudo,
.dark .hljs-link {
  color: #c084fc;
}

.dark .hljs-built_in,
.dark .hljs-deletion {
  color: #f87171;
}
</style> 