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
            <div class="flex min-w-0">
              <!-- Line Numbers -->
              <div class="bg-slate-100 dark:bg-slate-800 border-r border-slate-200 dark:border-slate-700 px-2 py-4 select-none flex-shrink-0">
                <pre class="text-xs font-mono text-slate-500 dark:text-slate-400 text-right leading-6"><code 
                  v-for="(line, index) in fileLines" 
                  :key="index"
                  :id="`line-${index + 1}`"
                  class="block"
                  :class="{
                    'bg-primary/20 text-primary font-semibold': isLineHighlighted(index) || isLineInSearchResults(index),
                    'bg-yellow-200 dark:bg-yellow-900/50': isCurrentSearchMatch(index)
                  }"
                >{{ (index + 1).toString().padStart(Math.max(3, fileLines.length.toString().length), ' ') }}</code></pre>
              </div>
              
              <!-- Code Content -->
              <div class="flex-1 min-w-0 p-4 overflow-x-auto">
                <pre class="text-xs font-mono leading-6 select-text whitespace-pre"><code 
                  v-for="(line, index) in highlightedLines" 
                  :key="index" 
                  :data-line-index="index"
                  class="block px-2 leading-6 group/line relative hljs" 
                  :class="{
                    'bg-primary/20 hover:bg-primary/30 cursor-pointer': isLineHighlighted(index),
                    'bg-yellow-100 dark:bg-yellow-900/30': isLineInSearchResults(index),
                    'bg-yellow-200 dark:bg-yellow-900/50': isCurrentSearchMatch(index)
                  }"
                  @click="isLineHighlighted(index) ? removeFunctionFromLine(fileLines[index], index) : null"
                  v-html="line"
                ></code></pre>
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
const highlightedLines = ref<string[]>([])
const codeContainerRef = ref<HTMLElement | null>(null)
const highlightedContent = ref('')

// Search state
const searchQuery = ref('')
const searchMatches = ref<Array<{ line: number, start: number, end: number }>>([])
const currentSearchIndex = ref(0)

// Function detection state
const detectedFunctions = ref<Array<{ name: string, line: number, icon: string, type: string }>>([])
const selectedFunction = ref('')

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

// Map file extensions to highlight.js language identifiers
const languageMap: Record<string, string> = {
  js: 'javascript',
  jsx: 'javascript',
  ts: 'typescript',
  tsx: 'typescript',
  py: 'python',
  rb: 'ruby',
  java: 'java',
  cpp: 'cpp',
  c: 'c',
  cs: 'csharp',
  php: 'php',
  go: 'go',
  rs: 'rust',
  swift: 'swift',
  kt: 'kotlin',
  scala: 'scala',
  r: 'r',
  lua: 'lua',
  dart: 'dart',
  vue: 'xml',
  html: 'xml',
  xml: 'xml',
  css: 'css',
  scss: 'scss',
  sass: 'scss',
  less: 'less',
  json: 'json',
  yaml: 'yaml',
  yml: 'yaml',
  md: 'markdown',
  sh: 'bash',
  bash: 'bash',
  zsh: 'bash',
  sql: 'sql',
  dockerfile: 'dockerfile',
  docker: 'dockerfile',
  makefile: 'makefile',
  cmake: 'cmake',
  nginx: 'nginx',
  conf: 'nginx',
  ini: 'ini',
  toml: 'toml'
}

const highlightLanguage = computed(() => {
  return languageMap[fileExtension.value] || 'plaintext'
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

// Detect functions and highlight code when file content changes
watchEffect(() => {
  if (fileContent.value) {
    detectFunctions()
    highlightCode()
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
    highlightCode()
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

// Highlight code using highlight.js
function highlightCode() {
  if (!fileContent.value) {
    highlightedLines.value = []
    return
  }
  
  try {
    // Try to highlight with detected language
    const result = hljs.highlight(fileContent.value, { language: highlightLanguage.value })
    
    // Split the highlighted code into lines
    const lines = result.value.split('\n')
    
    // Process each line
    highlightedLines.value = lines.map((line, index) => {
      let processedLine = line
      
      // Add remove button for highlighted function lines
      if (isLineHighlighted(index)) {
        processedLine += '<span class="absolute right-2 top-0 opacity-0 group-hover/line:opacity-100 transition-opacity bg-destructive text-destructive-foreground rounded-full w-4 h-4 flex items-center justify-center text-xs hover:bg-destructive/80" title="Click to remove function">×</span>'
      }
      
      return processedLine
    })
  } catch (error) {
    // Fallback to auto-detection if language is not supported
    try {
      const result = hljs.highlightAuto(fileContent.value)
      const lines = result.value.split('\n')
      
      highlightedLines.value = lines.map((line, index) => {
        let processedLine = line
        
        if (isLineHighlighted(index)) {
          processedLine += '<span class="absolute right-2 top-0 opacity-0 group-hover/line:opacity-100 transition-opacity bg-destructive text-destructive-foreground rounded-full w-4 h-4 flex items-center justify-center text-xs hover:bg-destructive/80" title="Click to remove function">×</span>'
        }
        
        return processedLine
      })
    } catch (fallbackError) {
      // If all else fails, escape HTML and display as plain text
      highlightedLines.value = fileLines.value.map((line, index) => {
        let escapedLine = line.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        
        if (isLineHighlighted(index)) {
          escapedLine += '<span class="absolute right-2 top-0 opacity-0 group-hover/line:opacity-100 transition-opacity bg-destructive text-destructive-foreground rounded-full w-4 h-4 flex items-center justify-center text-xs hover:bg-destructive/80" title="Click to remove function">×</span>'
        }
        
        return escapedLine
      })
    }
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
    highlightCode()
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
  highlightCode()
}

function removeFunctionFromLine(line: string, lineIndex: number) {
  // Only remove if this line actually declares a function
  const ext = fileExtension.value
  const patterns = getFunctionPatterns(ext)
  
  // Find which function is declared on this line
  let functionToRemove: string | null = null
  
  for (const pattern of patterns) {
    const matches = line.match(pattern.regex)
    if (matches && matches[1]) {
      functionToRemove = matches[1].trim()
      break
    }
  }
  
  if (functionToRemove) {
    // Remove the function that's actually declared on this line
    const index = selectedFunctions.value.findIndex(f => f.name === functionToRemove)
    if (index !== -1) {
      selectedFunctions.value.splice(index, 1)
    }
  }
  
  updateHighlightedLines()
  highlightCode()
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
  
  const lineElement = document.getElementById(`line-${match.line + 1}`)
  if (lineElement) {
    lineElement.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }
}

function isLineInSearchResults(lineIndex: number): boolean {
  return searchMatches.value.some(match => match.line === lineIndex)
}

function isCurrentSearchMatch(lineIndex: number): boolean {
  const currentMatch = searchMatches.value[currentSearchIndex.value]
  return currentMatch?.line === lineIndex
}

// Function detection
function detectFunctions() {
  const functions: Array<{ name: string, line: number, icon: string, type: string }> = []
  const ext = fileExtension.value
  
  const patterns = getFunctionPatterns(ext)
  
  fileLines.value.forEach((line, index) => {
    patterns.forEach(pattern => {
      const matches = line.match(pattern.regex)
      if (matches && matches[1]) {
        const functionName = matches[1].trim()
        if (functionName && !functions.some(f => f.name === functionName)) {
          functions.push({
            name: functionName,
            line: index + 1,
            icon: pattern.icon,
            type: pattern.type
          })
        }
      }
    })
  })
  
  // Sort by line number
  functions.sort((a, b) => a.line - b.line)
  detectedFunctions.value = functions
}

function getFunctionPatterns(extension: string) {
  const patterns = {
    js: [
      { regex: /^\s*function\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s*\(/m, icon: 'lucide:function-square', type: 'function' },
      { regex: /^\s*const\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s*=\s*(?:async\s*)?\(/m, icon: 'lucide:variable', type: 'const' },
      { regex: /^\s*const\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s*=\s*(?:async\s*)?\([^)]*\)\s*=>/m, icon: 'lucide:arrow-right', type: 'arrow' },
      { regex: /^\s*let\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s*=\s*(?:async\s*)?\(/m, icon: 'lucide:variable', type: 'let' },
      { regex: /^\s*var\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s*=\s*(?:async\s*)?\(/m, icon: 'lucide:variable', type: 'var' },
      { regex: /^\s*([a-zA-Z_$][a-zA-Z0-9_$]*)\s*:\s*function\s*\(/m, icon: 'lucide:function-square', type: 'method' },
      { regex: /^\s*async\s+function\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s*\(/m, icon: 'lucide:zap', type: 'async' },
      { regex: /^\s*class\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s*{/m, icon: 'lucide:box', type: 'class' }
    ],
    ts: [
      { regex: /^\s*function\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s*\(/m, icon: 'lucide:function-square', type: 'function' },
      { regex: /^\s*const\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s*=\s*(?:async\s*)?\(/m, icon: 'lucide:variable', type: 'const' },
      { regex: /^\s*const\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s*=\s*(?:async\s*)?\([^)]*\)\s*=>/m, icon: 'lucide:arrow-right', type: 'arrow' },
      { regex: /^\s*async\s+function\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s*\(/m, icon: 'lucide:zap', type: 'async' },
      { regex: /^\s*class\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s*{/m, icon: 'lucide:box', type: 'class' },
      { regex: /^\s*interface\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s*{/m, icon: 'lucide:file-type', type: 'interface' },
      { regex: /^\s*type\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s*=/m, icon: 'lucide:type', type: 'type' }
    ],
    py: [
      { regex: /^\s*def\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*\(/m, icon: 'lucide:function-square', type: 'function' },
      { regex: /^\s*async\s+def\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*\(/m, icon: 'lucide:zap', type: 'async' },
      { regex: /^\s*class\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*[:\(]/m, icon: 'lucide:box', type: 'class' }
    ],
    vue: [
      { regex: /^\s*const\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s*=\s*(?:async\s*)?\(/m, icon: 'lucide:variable', type: 'const' },
      { regex: /^\s*const\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s*=\s*(?:async\s*)?\([^)]*\)\s*=>/m, icon: 'lucide:arrow-right', type: 'arrow' },
      { regex: /^\s*function\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s*\(/m, icon: 'lucide:function-square', type: 'function' },
      { regex: /^\s*async\s+function\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s*\(/m, icon: 'lucide:zap', type: 'async' }
    ]
  }
  
  return patterns[extension as keyof typeof patterns] || patterns.js
}

function jumpToFunction(functionName: string) {
  if (!functionName) return
  
  const func = detectedFunctions.value.find(f => f.name === functionName)
  if (func) {
    const lineElement = document.getElementById(`line-${func.line}`)
    if (lineElement) {
      lineElement.scrollIntoView({ behavior: 'smooth', block: 'center' })
      
      // Highlight the line briefly
      const codeElement = lineElement.parentElement?.nextElementSibling?.children[func.line - 1]
      if (codeElement) {
        codeElement.classList.add('bg-primary/40')
        setTimeout(() => {
          codeElement.classList.remove('bg-primary/40')
        }, 2000)
      }
    }
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