<div align="center">
  <img src="public/logo-transparent.png" alt="ContextMax Logo" width="120" height="120" />
  
  # ContextMax

  <p align="center">
    <strong>Tell your LLM exactly what parts of your codebase matter for each task.</strong>
  </p>

  <div align="center">
    <img src="static/images/context-creation-cut-cropped-3x.gif" alt="Creating Context Sets Demo using contextMax" />
  </div>
</div>

<h4 align="center">
  <a href="https://contextmax.dev">Home Page</a> |
  <a href="https://curator.contextmax.dev">Try it Yourself</a>
</h4>

<div align="center">
  <a href="https://github.com/galliani/contextmax/blob/main/badges/coverage.svg">
    <img src="badges/coverage.svg" alt="Coverage Status" />
  </a>
  <a href="https://github.com/galliani/contextmax/blob/main/LICENSE">
    <img src="https://img.shields.io/github/license/galliani/contexmax" alt="contextMax is released under the Mozilla Public License." />
  </a>
  <a href="https://www.npmjs.com/package/contextmax">
    <img src="https://img.shields.io/npm/v/contextmax" alt="NPM Package" />
  </a>
  <a href="https://twitter.com/intent/follow?screen_name=_galihm">
    <img src="https://img.shields.io/twitter/follow/GetErgomake.svg?label=Follow%20@_galihm" alt="Follow Me" />
  </a>
</div>

<br>

<p align="center">
  ContextMax is a browser-based tool that lets you create context sets for LLMs. Define which files, functions, and workflows are relevant for specific tasks. Get assistance from the embedded LLM to assist in your search. Your code never leaves your browser.
</p>

<br>

<p align="center">
  <strong>[Youtube Video] How curated context set helps LLM (click to view)</strong>
</p>

<br>


https://github.com/user-attachments/assets/b9d9ba24-2911-4e65-856b-218de3fc0cce



## 🚀 Quick Start

### [QUICKEST] Option 1: Use the hosted version

Go to the [curation tool](https://curator.contextmax.dev).

**Privacy Note**: Even on the hosted version, your code stays in your browser. No files are uploaded to our servers.

### Option 2: Run it locally using the npm package (Recommended)

```bash
npx contextmax
# by default it runs on port 3000, but you can also specify the port like this: 
PORT=3005 npx contextmax
```

This will automatically run the tool locally and open it on your browser.

### Option 3: Development setup

```bash
# Clone and install
git clone https://github.com/galliani/contextmax.git
cd contextmax
npm install

# Start development server
npm run dev
```

Open http://localhost:3000 in Chrome/Edge and start creating context sets!

<br>

## What is ContextMax

ContextMax helps you create context sets - JSON files that tell your LLM which parts of your codebase to focus on. Instead of dumping your entire project into an LLM, you specify:
- Which files are relevant
- Which specific functions matter
- How different parts connect (workflows)

Think of it as creating a map for your LLM to navigate your codebase.

<!-- PLACEHOLDER: Screenshot of the main interface -->
![ContextMax Interface](static/images/MainInterface.png)


### Key Features

- **Visual Builder**: Create context sets through a UI instead of editing JSON
- **100% Private**: Everything runs in your browser. No servers, no uploads
- **Function-Level Context**: Point to specific functions, not just files
- **Workflow Mapping**: Show how files and functions connect in your data flow
- **Version Control Ready**: Output is a simple JSON file you can commit
- **Team Sharing**: Everyone uses the same context definitions
- **Local AI**: Built-in embeddings model for smart file suggestions
- **Fast**: Uses IndexedDB caching and WebGPU when available


### Try It Yourself: See the Difference

Want proof that context sets work? The contextMax codebase itself uses context sets!

First, clone the `contextmax` repo:

```
git clone https://github.com/galliani/contextmax.git
```

**Then, to get the sense of how the curation tool works**

- **Upload the `contextmax` repo** into the tool

**Or to get the sense of how it works**

- **Test with your LLM**:
  - Ask: "How does @context:embeddingsGeneration work?"
  - Ask: "Explain the @context:contextCreation flow"
  - Compare with asking: "How does embedding generation work in this codebase?"

You'll see firsthand how context sets give your LLM laser focus on the right code, reducing token usage by ~80% while getting more accurate answers.


<br>

## Why ContextMax

LLMs often fail on real codebases because they:
- Generate code that ignores your existing patterns
- Miss critical dependencies and relationships
- Suggest solutions that don't fit your architecture
- Force you to repeatedly explain the same context

Even when LLMs succeed, they waste time and tokens searching through your entire codebase, reading irrelevant files to piece together context. With ContextMax, your LLM starts with the exact files and functions it needs, understands the workflow from entry point to completion, and produces accurate results faster with fewer tokens.

ContextMax solves this by letting you define context once and reuse it. Your team gets consistent, accurate AI assistance that actually understands your code structure.


### Without Context Sets

```mermaid
graph TD
    A[Prompt: Fix login bug] --> B[LLM searches codebase]
    B --> C[Grep through all files]
    C --> D[Read many files]
    D --> E[Infer relationships]
    E --> F[Assume architecture]
    F --> G[Generate code]
    G --> H{Code works?}
    H -->|No| I[User provides more context]
    I --> B
    H -->|Yes| J[Done - 10k+ tokens used]
```

### With Manual File Lists

```mermaid
graph TD
    A[User lists: login.vue, auth.controller.ts, user.model.ts] --> B[LLM reads files]
    B --> C[Reads complete files - 3k tokens]
    C --> D[No function targeting]
    D --> E[Identifies relevant functions]
    E --> F[Missing: middleware, validators, utils]
    F --> G[No workflow information]
    G --> H[Generate code]
    H --> I[User adds missing files]
    I --> J[Include more context]
    J --> B
```

### With Context Sets

```mermaid
graph TD
    A[Prompt: Fix login bug] --> B[LLM loads context:UserAuth_Flow]
    B --> C[Read 5 specified files]
    C --> D[Target validatePassword function]
    D --> E[Follow workflow: login → validatePassword → generateToken]
    E --> F[Generate code using existing patterns]
    F --> G[Done - 2k tokens used]
```

<br>

## Architecture

ContextMax is built with a privacy-first, browser-based architecture where all processing happens in your browser. No code ever leaves your machine.

### Key Architecture Highlights

- **🔒 Privacy First**: All processing happens client-side using browser APIs
- **🤖 AI-Enhanced**: Local embeddings model for intelligent code suggestions  
- **⚡ Performance**: Multi-tier caching with IndexedDB and OPFS

### System Architecture

```mermaid
graph TB
    subgraph "User's Browser"
        UI[Vue/Nuxt UI Layer]
        Store[Project Store<br/>useProjectStore.ts]
        
        subgraph "Processing Layer"
            Parser[Code Parser<br/>Regex-based]
            AI[Local AI Models<br/>Jina Embeddings + Flan-T5]
            Analyzer[Project Analyzer<br/>useProjectAnalysis.ts]
            Suggestions[Smart Suggestions<br/>useSmartContextSuggestions.ts]
        end
        
        subgraph "Storage Layer"
            OPFS[Origin Private<br/>File System]
            IDB[IndexedDB Cache<br/>useIndexedDBCache.ts]
            FS[File System API<br/>useFileSystem.ts]
        end
        
        subgraph "Context Management"
            ContextSets[Context Sets<br/>useContextSets.ts]
            Exporter[Context Exporter<br/>useContextSetExporter.ts]
        end
    end
    
    LocalFiles[Local Project Files]
    Export[context-sets.json]
    
    LocalFiles --> FS
    UI --> Store
    Store --> Parser
    Parser --> AI
    AI --> Analyzer
    Analyzer --> Suggestions
    Suggestions --> Store
    Store --> OPFS
    Store --> IDB
    Store --> ContextSets
    ContextSets --> Exporter
    Exporter --> Export
    
    style UI fill:#e1f5fe
    style AI fill:#fff9c4
    style Export fill:#c8e6c9
```

### Data Flow

```mermaid
graph LR
    subgraph "Input Phase"
        PF[Project Files]
        User[User Actions]
    end
    
    subgraph "Processing Phase"
        Load[File Loader<br/>buildFilteredFileTree]
        Parse[Parse & Index<br/>prepareFilesForEmbedding]
        Embed[Generate Embeddings<br/>generateEmbeddingsOnDemand]
        Cache[Cache Manager<br/>storeCachedEmbedding]
        Search[Tri-Model Search<br/>performTriModelSearch]
    end
    
    subgraph "Context Creation Phase"
        Select[File/Function Selection<br/>ActiveContextComposer.vue]
        Define[Define Workflows<br/>WorkflowPointEditor.vue]
        Relate[Set Relationships<br/>ChildContextsList.vue]
        Functions[Function Specification<br/>FunctionSelectorModal.vue]
    end
    
    subgraph "Output Phase"
        JSON[context-sets.json<br/>Export with useContextSetExporter]
        LLM[To Any LLM<br/>@context:references]
    end
    
    PF --> Load
    Load --> Parse
    Parse --> Embed
    Embed --> Cache
    Cache --> Search
    User --> Select
    Search --> Select
    Select --> Functions
    Functions --> Define
    Define --> Relate
    Relate --> JSON
    JSON --> LLM
    
    style Search fill:#fff9c4
    style JSON fill:#c8e6c9
```

### Component Architecture

```mermaid
graph TD
    App[App.vue]
    App --> Header[ProjectHeader.vue<br/>Export Controls]
    App --> FileExplorer[ProjectFileBrowser]
    App --> ContextManager[ContextSetListManager.vue<br/>Context Creation]
    App --> ActiveContext[ActiveContextComposer.vue<br/>Context Specification]
    
    FileExplorer --> Search[Search.vue<br/>File Search]
    FileExplorer --> Assisted[AssistedCuration.vue<br/>AI-Assisted Search]
    
    ContextManager --> AddNew[AddNewContext.vue<br/>Create New Context]
    ContextManager --> ContextList[Context List<br/>Manage Existing]
    
    ActiveContext --> FilesList[FilesList.vue<br/>Selected Files]
    ActiveContext --> Workflows[WorkflowPointEditor.vue<br/>Define Flows]
    ActiveContext --> Functions[FunctionSelectorModal.vue<br/>Pick Functions]
    ActiveContext --> ChildContexts[ChildContextsList.vue<br/>Dependencies]
    
    subgraph "Core Composables"
        Store[useProjectStore<br/>Central State]
        FS[useFileSystem<br/>File Access]
        Export[useContextSetExporter<br/>JSON Export]
        AI[useSmartContextSuggestions<br/>AI Features]
        Cache[useIndexedDBCache<br/>Performance]
        Analysis[useProjectAnalysis<br/>Code Analysis]
        Sets[useContextSets<br/>Context Logic]
    end
    
    Header -.-> Export
    FileExplorer -.-> FS
    FileExplorer -.-> AI
    ContextManager -.-> Store
    ActiveContext -.-> Store
    ActiveContext -.-> Sets
    Assisted -.-> AI
    AI -.-> Cache
    
    style Header fill:#e1f5fe
    style Assisted fill:#fff9c4
    style ActiveContext fill:#f3e5f5
```

### Context Processing Flow

```mermaid
sequenceDiagram
    participant User
    participant UI
    participant Store as useProjectStore
    participant AI as AI Models
    participant Cache as IndexedDB
    participant Export as Exporter
    
    User->>UI: Select project folder
    UI->>Store: Load files via useFileSystem
    Store->>Cache: Check cached embeddings
    
    alt No cache exists
        Store->>AI: prepareFilesForEmbedding()
        AI->>AI: generateEmbeddingsOnDemand()
        AI->>Cache: storeCachedEmbedding()
    end
    
    User->>UI: Search for files/functions
    UI->>AI: performTriModelSearch()
    AI-->>UI: Return suggestions
    
    User->>UI: Create context set
    UI->>Store: createContextSet()
    
    User->>UI: Add files to context
    UI->>Store: Add file references
    
    User->>UI: Specify functions
    UI->>Store: Add functionRefs
    
    User->>UI: Define workflows
    UI->>Store: Store workflow start/end
    
    User->>UI: Set relationships (uses)
    UI->>Store: Update context dependencies
    
    User->>UI: Export context
    UI->>Export: Generate JSON
    Export->>Store: Gather all contexts
    Export->>User: context-sets.json
    
    Note over User: Use @context:name with any LLM
```


<br>

## How It Works

1. **Open your project folder** - Uses File System Access API (Chrome/Edge)
2. **Create context sets** - Name them based on features or workflows (e.g., "UserAuth_Flow")
3. **Add files and functions** - Pick whole files or specific functions
4. **Define workflows** - Show how code flows from entry point to completion
5. **Export context-sets.json** - Use with Cursor, Continue, or any LLM tool

<!-- PLACEHOLDER: Step-by-step screenshots -->
### Visual Walkthrough
| Step | Screenshot |
|------|------------|
| 1. Project Loading | ![Load Project](REPLACE_WITH_STEP1_SCREENSHOT_URL) |
| 2. Context Creation | ![Create Context](REPLACE_WITH_STEP2_SCREENSHOT_URL) |
| 3. Function Selection | ![Select Functions](REPLACE_WITH_STEP3_SCREENSHOT_URL) |
| 4. Workflow Definition | ![Define Workflow](REPLACE_WITH_STEP4_SCREENSHOT_URL) |
| 5. Export JSON | ![Export JSON](REPLACE_WITH_STEP5_SCREENSHOT_URL) |


<br>

## The context-sets.json Format

ContextMax generates a single JSON file you can commit to your repo:

```json
{
  "schemaVersion": "1.0",
  "projectName": "MyProject",
  "filesIndex": {
    "file_abc12345": {
      "path": "src/auth/login.ts",
      "contexts": ["context:UserAuth_Flow"]
    }
  },
  "sets": {
    "context:UserAuth_Flow": {
      "description": "Complete user authentication flow",
      "files": [
        "file_abc12345",
        {
          "fileRef": "file_xyz67890",
          "comment": "User model with authentication methods",
          "functionRefs": [
            { "name": "validatePassword", "comment": "Validates user password" }
          ]
        }
      ],
      "workflows": [{
        "start": {
          "fileRef": "file_abc12345",
          "function": "login",
          "protocol": "http",
          "method": "POST"
        },
        "end": {
          "fileRef": "file_xyz67890",
          "function": "generateToken",
          "protocol": "function"
        }
      }],
      "uses": ["context:Database_Connection"],
      "systemBehavior": {
        "processing": {
          "mode": "synchronous"
        }
      }
    }
  }
}
```


## Tech Stack

- Nuxt.js 3 + Vue 3 + TypeScript
- Tailwind CSS v4, Reka UI, shadcn-nuxt
- @huggingface/transformers (WebGPU)
- Regex-based code parsing
- File System Access API, OPFS, IndexedDB
- Vitest


<br>

## Local AI Models

ContextMax runs AI models directly in your browser:

### Embeddings: `jinaai/jina-embeddings-v2-base-code` (~300MB)
- Semantic code search (finds code by meaning, not just text)
- Auto-classifies files (entry-point, core-logic, helper, config)
- Suggests related files and patterns
- Uses WebGPU for speed

Models download automatically on first use. For programmatic access:

```typescript
const { getModel } = useLLMLoader()
const embeddingsModel = await getModel('embeddings')
const embeddings = await embeddingsModel('your code snippet')
```

All processing happens locally. No external API calls.


<br>

## Development

### Requirements

- Node.js 18+
- Chrome/Edge (for File System Access API)

### Commands

```bash
# Development
npm run dev          # Start dev server on port 3000
npm run dev:clean    # Clean start (removes .nuxt cache)
npm run dev:fresh    # Fresh start (clean + reinstall)

# Building
npm run generate     # Build for production

# Testing
npm run test         # Run tests
npm run test:coverage # Run tests with coverage report
npm run coverage:badge # Generate coverage badge
```

### Browser Compatibility

ContextMax requires browsers that support:
- File System Access API (Chrome 86+, Edge 86+)
- WebGPU (for AI acceleration)
- IndexedDB and OPFS


<br>

## Contributing

We welcome contributions from anyone. Please report bugs via GitHub Issues with reproduction steps.


<br>

## License

Mozilla Public License 2.0 - see [LICENSE](LICENSE)

---

Made by [Galih](https://github.com/galliani) from [51 New York](https://51newyork.com)
