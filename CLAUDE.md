# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

ContextMax is a privacy-first, browser-based web application built with Nuxt.js 3 that helps developers create precise, reusable context sets for Large Language Models. It runs entirely in the browser using the File System Access API - no code is ever uploaded to servers.

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

The development server runs on port 3000. Do not run commands to start/restart the server - assume it's already running.

## Architecture Overview

### Core Technology Stack
- **Nuxt.js 3** with Vue.js 3 and TypeScript
- **Tailwind CSS v4** for styling
- **shadcn-nuxt** and **Reka UI** for component system
- **@huggingface/transformers** for client-side AI processing
- **web-tree-sitter** for code parsing and AST analysis
- **Vitest** for testing with 91%+ coverage

### Key Architectural Patterns

**State Management**: Centralized in `composables/useProjectStore.ts` - handles project files, context sets, workflows, and file manifest.

**Browser Storage Strategy**:
- File System Access API for reading local project files
- Origin Private File System (OPFS) for persistent browser storage
- IndexedDB cache for performance optimization (`composables/useIndexedDBCache.ts`)

**Smart Suggestions System**: Hybrid approach combining:
- Local LLM embeddings via Hugging Face Transformers
- AST analysis using tree-sitter parsers
- File relationship analysis through `composables/useHybridAnalysis.ts`

### Component Organization

```
components/
├── landing/           # Marketing/landing page components
├── active-context-set/ # Context set editing components
├── project-file-browser/ # File tree navigation
└── ui/               # shadcn-based reusable components
```

**Main Interface Flow**:
1. `pages/index.vue` - Routes between landing and workspace
2. `MainInterface.vue` - Core workspace with project browser and context editor
3. `ProjectFileBrowser.vue` - File system navigation
4. `ActiveContextComposer.vue` - Context set creation/editing

### Data Models

**Context Set Structure**: JSON format with four main sections:
- `filesManifest` - ID-based file registry with paths and comments
- `contextSets` - Named collections of files, line ranges, and workflows
- `fileContextsIndex` - Auto-generated mapping of files to context sets
- `schemaVersion` - Format versioning

**Line Range Selection**: Non-contiguous ranges across multiple files using format `[startLine, endLine]`.

## Development Practices

### Component Creation
Use shadcn-vue for new UI components:
```bash
npx shadcn-vue@latest add COMPONENT
```

### Tree-sitter Integration
Grammar files are stored in `public/grammars/` for JavaScript, Python, Ruby, and TypeScript. The `composables/useTreeSitter.ts` handles WASM loading and parsing.

### Testing Strategy
- Component tests in `tests/components/`
- Composable tests in `tests/composables/`
- Uses `@testing-library/vue` with happy-dom
- High coverage requirement (91%+)

### Privacy-First Design
- All file processing happens client-side
- No server-side API calls for file content
- Uses File System Access API (Chrome/Edge only)
- OPFS for cross-session persistence

## Key Composables

- `useProjectStore.ts` - Central state management
- `useHybridAnalysis.ts` - Smart file suggestions using AI + AST
- `useTreeSitter.ts` - Code parsing and syntax analysis
- `useSmartContextSuggestions.ts` - LLM-powered file recommendations
- `useLLMLoader.ts` - Client-side model loading with loading states

## Build Configuration

**WASM Support**: Configured in `nuxt.config.ts` with:
- Nitro experimental WASM support
- Vite optimization exclusions for `web-tree-sitter` and `@huggingface/transformers`
- Global polyfills for browser AI libraries

**Font Configuration**: Inter for UI, JetBrains Mono for code with proper fallbacks and preloading.