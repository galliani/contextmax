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
              <pre class="text-xs font-mono leading-5"><code v-for="(line, index) in highlightedLines" :key="index" class="block h-5 px-1 hljs" v-html="line"></code></pre>
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
import hljs from 'highlight.js'
const { 
  currentFileContent, 
  currentFileName, 
  isFileContentModalOpen, 
  closeFileContentModal 
} = useProjectStore()

const highlightedLines = ref<string[]>([])

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

// Language detection
const fileExtension = computed(() => {
  const path = currentFileName.value
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

const totalLines = computed(() => {
  return fileLines.value.length
})

// Highlight code using highlight.js
function highlightCode() {
  if (!currentFileContent.value) {
    highlightedLines.value = []
    return
  }
  
  try {
    // Try to highlight with detected language
    const result = hljs.highlight(currentFileContent.value, { language: highlightLanguage.value })
    
    // Split the highlighted code into lines
    highlightedLines.value = result.value.split('\n')
  } catch (error) {
    // Fallback to auto-detection if language is not supported
    try {
      const result = hljs.highlightAuto(currentFileContent.value)
      highlightedLines.value = result.value.split('\n')
    } catch (fallbackError) {
      // If all else fails, escape HTML and display as plain text
      highlightedLines.value = fileLines.value.map(line => 
        line.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      )
    }
  }
}

// Watch for content changes and highlight
watchEffect(() => {
  if (currentFileContent.value) {
    highlightCode()
  }
})

// Close modal function
function closeModal() {
  closeFileContentModal()
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