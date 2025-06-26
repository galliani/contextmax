# ContextMax ![Coverage Status](badges/coverage.svg)

> Stop AI Guesswork. Make Your LLM Finally Understand Your Complex, Mature Codebase.

ContextMax is a **free, browser-based, privacy-first** tool that empowers developers to create, manage, and share highly-specific, reusable context sets for Large Language Models (LLMs). Guide your AI with pinpoint accuracy to get more relevant, consistent, and architecturally-aware assistance on your most complex projects.

🚀 **[Try ContextMax Live](https://contextmax.dev)** | 📖 **[Documentation](docs/)** | 💬 **[Discord Community](https://discord.gg/contextmax)**


## The Problem: Is Your LLM Lost in Your Code?

Even the most powerful LLMs can struggle when faced with large, mature, or domain-specific codebases. Without deep, specific knowledge, AI assistants often provide:

- **Generic**, unhelpful suggestions that miss the nuances of your architecture.
- **Inconsistent code** that doesn't follow your established patterns.
- Responses that **require you to waste valuable time re-explaining context** or correcting mistakes.

Your team's expertise and your project's architectural integrity are your most valuable assets. Your AI tools should respect and leverage them, not ignore them.

## The Solution: You Conduct the AI

ContextMax puts your project experts in control. It allows your most knowledgeable developers to visually create "Context Sets"—precise instruction packets that act as a guidebook for your AI assistant.

By defining exactly what files, specific line ranges, and operational workflows are relevant for a given task, you transform your LLM from a generalist into a specialized, highly effective partner for your unique codebase.


## ✨ Key Features

- 🎨 **Visual Context Builder**: Intuitively create and manage context-sets.json files without writing JSON by hand.
- 🔒 **Privacy First**: Runs entirely in your browser using the File System Access API. Your code is never uploaded and never leaves your machine.
- 🎯 **Pinpoint Accuracy**: Go beyond whole-file context. Select multiple, non-contiguous line ranges across different files to give the LLM surgical focus.
- 🔄 **Workflow Definition**: Explain complex processes by mapping out the sequence of file interactions, helping the AI understand data flow and interdependencies.
- 📦 **Reusable & Shareable Context**: The output is a clean context-sets.json file that you can commit to your repository. This allows your entire team to provide consistent, expert-level context to their LLMs.
- 🗂️ **Auto-Generated Indexes**: Automatically creates a filesManifest for robust file referencing and a fileContextsIndex to help other tools understand how files and context sets relate.
- 🤖 **Built-in AI Models**: Two local LLMs for enhanced code understanding without external API calls.
- ⚡ **Performance Optimized**: IndexedDB caching and WebGPU acceleration for seamless experience.


## 🚀 Quick Start

```bash
# Clone and install
git clone https://github.com/galliani/contextmax.git
cd contextmax
npm install

# Start development server
npm run dev
```

Open http://localhost:3000 in Chrome/Edge and start creating context sets!

## 📖 How It Works

1. **Load Your Project**: Open the ContextMax web app and select your local project folder. Your code stays local.
2. **Define Context Sets**: Visually create named sets (e.g., "UserAuth_Flow"). Add relevant files to each set, implicitly populating a central filesManifest.
3. **Refine with Precision**: For each file in a set, specify whether to include the whole file or pinpoint exact line ranges.
4. **Map Workflows**: Define step-by-step workflows to explain how different code parts work together.
5. **Export & Use**: Download your context-sets.json file. Use it with your favorite IDE and LLM (e.g., via .cursorrules in Cursor) to provide powerful, curated context in your prompts.


## 📋 The context-sets.json Format

The core output of ContextMax is a single, version-controllable JSON file:

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


## 🛠️ Tech Stack

- **Framework**: Nuxt.js 3 (Vue.js 3) with TypeScript
- **Styling**: Tailwind CSS v4, Reka UI, shadcn-nuxt
- **AI/ML**: @huggingface/transformers with WebGPU acceleration
- **Code Parsing**: using Regex
- **Storage**: File System Access API, OPFS, IndexedDB
- **Testing**: Vitest with coverage and badge generation
- **Package Manager**: npm

## 🤖 Local AI Models

ContextMax includes two powerful LLM models that run entirely in your browser:

### 1. Embeddings Model: `jinaai/jina-embeddings-v2-base-code` (~300MB)
- **Purpose**: Semantic search and code understanding
- **Use Case**: Powers the smart search functionality to find relevant files and code sections based on meaning rather than just keywords
- **Technology**: Feature extraction using WebGPU acceleration
- **Benefits**: Helps you discover related code patterns and dependencies you might miss with traditional text search

### 2. Text Generation Model: `Xenova/flan-t5-small` (~180MB)
- **Purpose**: Natural language generation and text processing
- **Use Case**: Can be used for generating code comments, documentation, or assisting with text-based AI tasks
- **Technology**: Text-to-text generation using WASM backend for stability
- **Benefits**: Provides local text generation capabilities without sending data to external services

#### Using the Models

Both models are automatically downloaded and cached on first use. You can access them programmatically:

```typescript
// Access the embeddings model (for semantic search)
const { getModel } = useLLMLoader()
const embeddingsModel = await getModel('embeddings')
const embeddings = await embeddingsModel('your code snippet')

// Access the text generation model
const textGenModel = await getModel('textGeneration')
const result = await textGenModel('Explain this code:')

// Check model status
const { getModelState } = useLLMLoader()
const embeddingsReady = getModelState('embeddings').value.status === 'ready'
const textGenReady = getModelState('textGeneration').value.status === 'ready'

// Initialize all models at once
const { initializeAllModels } = useLLMLoader()
await initializeAllModels()
```

**Privacy**: Both models run completely offline in your browser. No code or data is ever sent to external servers.


## 💻 Development

### Prerequisites

- Node.js v18.x or later
- Chrome/Edge browser (for File System Access API)
- npm (comes with Node.js)

### Available Commands

```bash
# Development
npm run dev          # Start dev server on port 3000
npm run dev:clean    # Clean start (removes .nuxt cache)
npm run dev:fresh    # Fresh start (clean + reinstall)

# Building
npm run build        # Build for production
npm run preview      # Preview production build

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


## 🤝 Contributing

We believe in empowering developers and are excited to build this tool with the community. Contributions are welcome!

### Ways to Contribute

- 🐛 **Report Bugs**: Use GitHub Issues with detailed reproduction steps
- 💡 **Suggest Features**: Open a discussion in GitHub Discussions
- 📝 **Improve Documentation**: PRs for docs are always appreciated
- 🔧 **Submit Code**: Follow our coding standards and include tests

### Development Workflow

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

Please ensure all tests pass and maintain our 91%+ coverage requirement.


## 📄 License

This project is licensed under the Mozilla Public License 2.0. See the [LICENSE](LICENSE) file for details.

---

<p align="center">
  Made with ❤️ by the ContextMax team and contributors
</p>