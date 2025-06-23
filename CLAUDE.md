# CLAUDE.md - AI Assistant Guidelines

> This file provides comprehensive guidance to Claude Code (claude.ai/code) when working with the ContextMax codebase. It contains project-specific instructions, architectural details, and development practices that help maintain consistency and quality.

## Project Overview

**ContextMax** is a privacy-first, browser-based web application built with Nuxt.js 3 that helps developers create precise, reusable context sets for Large Language Models (LLMs).

### Core Principles
- **Privacy First**: All processing happens client-side, no code ever leaves the user's machine
- **Developer Focused**: Built by developers for developers working with complex codebases
- **LLM Agnostic**: Works with any LLM that accepts context (Claude, GPT, Gemini, etc.)
- **Performance Optimized**: Uses WebGPU, IndexedDB caching, and OPFS for speed

## Development Commands

```bash
# Start development server
npm run dev

# Clean development (removes .nuxt cache)
npm run dev:clean

# Fresh start (clean + reinstall)
npm run dev:fresh

# Build for production
npm run build

# Run tests
npm run test

# Run tests with coverage
npm run test:coverage

# Generate coverage badge
npm run coverage:badge
```

**Important Notes**:
- Development server runs on port 3000
- Do not run commands to start/restart the server - assume it's already running
- Always run tests before committing changes
- Maintain 91%+ code coverage

## AI Assistant Guidelines

### Context Sets Tool Selection

When a user references `@context:Name`, resolve it via `context-sets.json` → `sets["context:Name"]`.

#### Processing Order

1. **Check workflows first**

- If workflows exist: Start from `workflow.start.function` and trace to `end`
- If workflows empty: Read all files in the context, prioritizing those with `functionRefs`

2. **File Resolution**

- String → filesIndex[fileId].path → read entire file
- Object → filesIndex[fileId].path → locate specific functionRefs

3. **Impact Analysis**
- Direct: Check context's `uses` array
- Indirect: Check `filesIndex[fileId].contexts` for shared files
- When modifying file_X in ContextA, also consider ContextB if both use file_X

#### Quick Example

User: "Fix the download button in @context:PhotoGallery"
→ Load PhotoGallery context
→ See it uses ["DownloadPhoto"]
→ Find download button via workflow start point or grep functions
→ Check if changes affect DownloadPhoto via shared files

#### Key Rules

- Track changes in memory during session
- Update context-sets.json only when explicitly requested  
- Use functionRefs for surgical precision when available
- No warnings for files outside contexts


## Architecture Overview

### Core Technology Stack

#### Frontend Framework
- **Nuxt.js 3** with Vue.js 3 and TypeScript
- **Tailwind CSS v4** for styling
- **shadcn-nuxt** and **Reka UI** for component system
- **@huggingface/transformers** for client-side AI processing
- **regex** for code parsing to feed to locally-embedded LLM 
- **Vitest** for testing with 91%+ coverage

### Key Architectural Patterns

#### 1. State Management Pattern

Centralized in `composables/useProjectStore.ts` which manages:
- Project files and directory structure
- Context sets and their relationships
- Workflows and execution steps
- File manifest and indexing
- Persistent storage synchronization

#### 2. Browser Storage Strategy

Multi-tier storage approach for performance and persistence:
- File System Access API for reading local project files
- Origin Private File System (OPFS) for persistent browser storage
- IndexedDB cache for performance optimization (`composables/useIndexedDBCache.ts`)

#### 3. Smart Suggestions System

Hybrid AI-powered suggestion engine using:
- Local LLM embeddings via Hugging Face Transformers
- AST-like analysis using regex parsers + 2 local LLMs of `jinaai/jina-embeddings-v2-base-code` and  `Xenova/flan-t5-small`
- File relationship analysis through `composables/useProjectAnalysis.ts`


### Data Models

#### 1. Context Set Data Structure

The `context-sets.json` file uses a structured JSON format:
- `filesIndex` - ID-based file registry with paths and comments
- `contextSets` - Named collections of files, line ranges, and workflows
- `schemaVersion` - Format versioning
- `projectName` - The name of the uploaded directory/folder
- `lastUpdated` - The UTC timestamp that denotes when was the last export done

## Development Practices

### Code Quality Standards

1. **TypeScript Usage**
   - Strict mode enabled
   - Explicit return types for public functions
   - Proper interface definitions for all data structures
   - Avoid `any` type - use `unknown` or proper types

2. **Vue 3 Composition API**
   - Use `<script setup>` syntax
   - Prefer composables for shared logic
   - Reactive refs and computed properties
   - Proper TypeScript integration with `defineProps` and `defineEmits`

3. **Error Handling**
   - Try-catch blocks for async operations
   - User-friendly error messages
   - Fallback UI states for errors
   - Console errors only in development

### Component Development

#### Creating New Components

1. **UI Components**: Use shadcn-vue CLI
   ```bash
   npx shadcn-vue@latest add COMPONENT_NAME
   ```

2. **Feature Components**: Follow this structure
   ```vue
   <template>
     <div class="component-name">
       <!-- Template here -->
     </div>
   </template>

   <script setup lang="ts">
   import { ref, computed } from 'vue'
   import type { ComponentProps } from './types'

   const props = defineProps<ComponentProps>()
   const emit = defineEmits<{
     'update:modelValue': [value: string]
   }>()
   </script>
   ```

### Testing Requirements
1. **Test Organization**
   - Component tests: `tests/components/`
   - Composable tests: `tests/composables/`
   - Utility tests: `tests/utils/`

2. **Testing Stack**
   - Framework: Vitest
   - DOM: happy-dom
   - Vue testing: `@testing-library/vue`
   - Coverage: 91%+ requirement

3. **Test Writing Guidelines**
   ```typescript
   describe('ComponentName', () => {
     it('should render correctly', () => {
       const { getByText } = render(ComponentName)
       expect(getByText('Expected Text')).toBeTruthy()
     })

     it('should handle user interaction', async () => {
       const { getByRole } = render(ComponentName)
       await fireEvent.click(getByRole('button'))
       // Assert expected behavior
     })
   })
   ```

### Privacy & Security Guidelines
1. **Data Handling**
   - ALL file processing must happen client-side
   - NEVER send file content to external servers
   - Use File System Access API for local file access
   - Store persistent data in OPFS, not cloud services

2. **Browser API Usage**
   - File System Access API (Chrome/Edge 86+)
   - Origin Private File System (OPFS)
   - IndexedDB for caching
   - WebGPU for AI acceleration (when available)
