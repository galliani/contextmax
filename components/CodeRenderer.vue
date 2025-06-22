<!--
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
-->
<template>
  <div class="flex min-w-0">
    <!-- Line Numbers -->
    <div 
      class="border-r px-2 py-4 select-none flex-shrink-0"
      :class="lineNumbersClass"
    >
      <pre class="text-xs font-mono text-right leading-6" :class="lineNumbersTextClass">
        <code 
          v-for="(line, index) in fileLines" 
          :key="index"
          :id="`line-${index + 1}`"
          class="block"
          :class="getLineNumberClass(index)"
        >{{ formatLineNumber(index + 1) }}</code>
      </pre>
    </div>
    
    <!-- Code Content -->
    <div class="flex-1 min-w-0 p-4 overflow-x-auto">
      <pre class="text-xs font-mono leading-6 select-text whitespace-pre">
        <code 
          v-for="(line, index) in highlightedLines" 
          :key="index" 
          :data-line-index="index"
          class="block px-2 leading-6 group/line relative hljs" 
          :class="getCodeLineClass(index)"
          @click="handleLineClick(line, index)"
          v-html="line"
        ></code>
      </pre>
    </div>
  </div>
</template>

<script setup lang="ts">
import hljs from 'highlight.js'

interface Props {
  content: string
  filePath?: string
  highlightedLineIndices?: Set<number>
  searchMatches?: Array<{ line: number, start: number, end: number }>
  currentSearchIndex?: number
  allowLineClick?: boolean
  showLineNumbers?: boolean
  lineNumbersClass?: string
  lineNumbersTextClass?: string
}

const props = withDefaults(defineProps<Props>(), {
  filePath: '',
  highlightedLineIndices: () => new Set(),
  searchMatches: () => [],
  currentSearchIndex: 0,
  allowLineClick: true,
  showLineNumbers: true,
  lineNumbersClass: 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700',
  lineNumbersTextClass: 'text-slate-500 dark:text-slate-400'
})

const emit = defineEmits<{
  'line-click': [line: string, index: number]
}>()

const highlightedLines = ref<string[]>([])

// Computed properties
const fileLines = computed(() => {
  if (!props.content) return []
  return props.content.split('\n')
})

const fileExtension = computed(() => {
  const path = props.filePath
  return path.split('.').pop()?.toLowerCase() || ''
})

// Language mapping (same as before)
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

// Functions
function formatLineNumber(lineNum: number): string {
  return lineNum.toString().padStart(Math.max(3, totalLines.value.toString().length), ' ')
}

function getLineNumberClass(index: number): string {
  const classes = []
  
  if (isLineHighlighted(index) || isLineInSearchResults(index)) {
    classes.push('bg-primary/20 text-primary font-semibold')
  }
  
  if (isCurrentSearchMatch(index)) {
    classes.push('bg-yellow-200 dark:bg-yellow-900/50')
  }
  
  return classes.join(' ')
}

function getCodeLineClass(index: number): string {
  const classes = []
  
  if (isLineHighlighted(index)) {
    classes.push('bg-primary/20 hover:bg-primary/30')
    if (props.allowLineClick) {
      classes.push('cursor-pointer')
    }
  }
  
  if (isLineInSearchResults(index)) {
    classes.push('bg-yellow-100 dark:bg-yellow-900/30')
  }
  
  if (isCurrentSearchMatch(index)) {
    classes.push('bg-yellow-200 dark:bg-yellow-900/50')
  }
  
  return classes.join(' ')
}

function isLineHighlighted(index: number): boolean {
  return props.highlightedLineIndices.has(index)
}

function isLineInSearchResults(lineIndex: number): boolean {
  return props.searchMatches.some(match => match.line === lineIndex)
}

function isCurrentSearchMatch(lineIndex: number): boolean {
  const currentMatch = props.searchMatches[props.currentSearchIndex]
  return currentMatch?.line === lineIndex
}

function handleLineClick(line: string, index: number) {
  if (props.allowLineClick) {
    emit('line-click', line, index)
  }
}

// Highlight code using highlight.js
function highlightCode() {
  if (!props.content) {
    highlightedLines.value = []
    return
  }
  
  try {
    // Try to highlight with detected language
    const result = hljs.highlight(props.content, { language: highlightLanguage.value })
    
    // Split the highlighted code into lines
    highlightedLines.value = result.value.split('\n')
  } catch (error) {
    // Fallback to auto-detection if language is not supported
    try {
      const result = hljs.highlightAuto(props.content)
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
  if (props.content) {
    highlightCode()
  }
})

// Expose methods for parent components
defineExpose({
  highlightCode,
  scrollToLine: (lineNumber: number) => {
    const lineElement = document.getElementById(`line-${lineNumber}`)
    if (lineElement) {
      lineElement.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  }
})
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