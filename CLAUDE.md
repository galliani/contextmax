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

```

**Important Notes**:
- Development server runs on port 3000
- Do not run commands to start/restart the server - assume it's already running
- Always run tests before committing changes
- Maintain 91%+ code coverage

## Architecture Overview

### Core Technology Stack

#### Frontend Framework
- **Nuxt.js 3** with Vue.js 3 and TypeScript
- **Tailwind CSS v4** for styling
- **shadcn-nuxt** and **Reka UI** for component system
- **@huggingface/transformers** for client-side AI processing
- **web-tree-sitter** for code parsing and AST analysis
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

### Component Organization

```
components/
├── landing/              # Marketing/landing page components
│   ├── Hero.vue         # Main landing hero section
│   └── Features.vue     # Feature showcase
├── active-context-set/   # Context set editing components
│   ├── ActiveContextComposer.vue  # Main editor
│   ├── FileItem.vue              # Individual file representation
│   └── LineRangeSelector.vue     # Line range UI
├── project-file-browser/ # File tree navigation
│   ├── ProjectFileBrowser.vue    # Main browser component
│   └── FileTree.vue              # Recursive tree structure
└── ui/                  # shadcn-based reusable components
    ├── button/          # Button variations
    ├── dialog/          # Modal dialogs
    └── tooltip/         # Hover tooltips
```

#### Main Interface Flow
1. `pages/index.vue` - Routes between landing and workspace
2. `MainInterface.vue` - Core workspace with project browser and context editor
3. `ProjectFileBrowser.vue` - File system navigation
4. `ActiveContextComposer.vue` - Context set creation/editing

### Data Models

#### 1. Context Set Data Structure

The `context-sets.json` file uses a structured JSON format:
- `filesManifest` - ID-based file registry with paths and comments
- `contextSets` - Named collections of files, line ranges, and workflows
- `fileContextsIndex` - Auto-generated mapping of files to context sets
- `schemaVersion` - Format versioning

#### 2. Line Range Selection

Supports non-contiguous, multi-file selections:
- Format: `[startLine, endLine]` arrays
- Multiple ranges per file allowed
- 1-indexed line numbers
- Automatic sorting and merging of overlapping ranges

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

### Tree-sitter Integration

#### Grammar Support
- Grammar files location: `public/grammars/`
- Supported languages: JavaScript, Python, Ruby, TypeScript
- WASM parser: `composables/useTreeSitter.ts`

#### Usage Example
```typescript
const { parseCode, getSymbols } = useTreeSitter()
const ast = await parseCode(sourceCode, 'javascript')
const symbols = getSymbols(ast)
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

2. **Security Practices**
   - Sanitize all user inputs
   - Validate file paths before access
   - Use Content Security Policy headers
   - No eval() or dynamic code execution

3. **Browser API Usage**
   - File System Access API (Chrome/Edge 86+)
   - Origin Private File System (OPFS)
   - IndexedDB for caching
   - WebGPU for AI acceleration (when available)

## Key Composables Reference

### Core Composables

#### `useProjectStore.ts`
- **Purpose**: Central state management for all project data
- **Key Methods**: `loadProject()`, `saveContextSet()`, `updateFileManifest()`
- **Usage**: Auto-imported in components needing project state

#### `useProjectAnalysis.ts`  
- **Purpose**: Analyzes project structure and generates insights
- **Key Methods**: `analyzeProject()`, `findRelatedFiles()`, `generateWorkflow()`
- **Usage**: Called when project is loaded or context suggestions needed

#### `useTreeSitter.ts`
- **Purpose**: Parses code into AST for intelligent analysis
- **Key Methods**: `parseCode()`, `getSymbols()`, `findReferences()`
- **Usage**: Powers code understanding features

#### `useSmartContextSuggestions.ts`
- **Purpose**: AI-powered context suggestions
- **Key Methods**: `getSuggestions()`, `rankByRelevance()`  
- **Usage**: Provides intelligent file and code recommendations

#### `useLLMLoader.ts`
- **Purpose**: Manages local LLM models
- **Key Methods**: `getModel()`, `getModelState()`, `initializeAllModels()`
- **Usage**: Loads and manages Hugging Face models

## Build & Deployment Configuration

### WASM Support

Configured in `nuxt.config.ts`:
- Nitro experimental WASM support
- Vite optimization exclusions for `web-tree-sitter` and `@huggingface/transformers`
- Global polyfills for browser AI libraries

### Font Configuration

- **UI Font**: Inter (system font stack fallback)
- **Code Font**: JetBrains Mono (monospace fallback)
- **Loading Strategy**: Preload critical fonts, lazy load variants

### Performance Optimizations

1. **Code Splitting**
   - Lazy load heavy components
   - Dynamic imports for AI models
   - Route-based splitting

2. **Caching Strategy**
   - IndexedDB for parsed AST cache
   - OPFS for file content cache
   - Service Worker for offline support

3. **Bundle Size**
   - Tree-shake unused components
   - Minimize third-party dependencies
   - Use CDN for large assets

## Common Development Scenarios

### Adding a New Feature

1. Create feature branch from `main`
2. Add components in appropriate directory
3. Write tests with >91% coverage
4. Update relevant documentation
5. Run full test suite before PR

### Debugging Tips

- Use Vue DevTools for component state
- Check IndexedDB in browser DevTools
- Enable verbose logging with `DEBUG=contextmax:*`
- Test File System API in incognito mode

### Performance Profiling

1. Use Chrome DevTools Performance tab
2. Focus on:
   - Initial load time (<3s target)
   - File parsing speed
   - UI responsiveness
   - Memory usage with large projects

## AI Assistant Guidelines

When modifying this codebase:

1. **Respect Privacy**: Never add features that upload user code
2. **Maintain Type Safety**: Use TypeScript strictly
3. **Follow Patterns**: Match existing code style and architecture
4. **Test Coverage**: Ensure changes maintain 91%+ coverage
5. **Document Changes**: Update this file for architectural changes
6. **Performance First**: Profile changes for performance impact
7. **Accessibility**: Ensure all UI changes are keyboard/screen-reader friendly