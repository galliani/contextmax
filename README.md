# ContextMax ![Coverage Status](badges/coverage.svg)

Stop AI Guesswork. Make Your LLM Finally Understand Your Complex, Mature Codebase.

ContextMax is a free, browser-based, privacy-first tool that empowers developers to create, manage, and share highly-specific, reusable context sets for Large Language Models (LLMs). Guide your AI with pinpoint accuracy to get more relevant, consistent, and architecturally-aware assistance on your most complex projects.


## The Problem: Is Your LLM Lost in Your Code?

Even the most powerful LLMs can struggle when faced with large, mature, or domain-specific codebases. Without deep, specific knowledge, AI assistants often provide:

- **Generic**, unhelpful suggestions that miss the nuances of your architecture.
- **Inconsistent code** that doesn't follow your established patterns.
- Responses that **require you to waste valuable time re-explaining context** or correcting mistakes.

Your team's expertise and your project's architectural integrity are your most valuable assets. Your AI tools should respect and leverage them, not ignore them.

## The Solution: You Conduct the AI

ContextMax puts your project experts in control. It allows your most knowledgeable developers to visually create "Context Sets"—precise instruction packets that act as a guidebook for your AI assistant.

By defining exactly what files, specific line ranges, and operational workflows are relevant for a given task, you transform your LLM from a generalist into a specialized, highly effective partner for your unique codebase.


## Key Features

- **Visual Context Builder**: Intuitively create and manage context-sets.json files without writing JSON by hand.
- **Privacy First**: Runs entirely in your browser using the File System Access API. Your code is never uploaded and never leaves your machine.
- **Pinpoint Accuracy**: Go beyond whole-file context. Select multiple, non-contiguous line ranges across different files to give the LLM surgical focus.
**Workflow Definition**: Explain complex processes by mapping out the sequence of file interactions, helping the AI understand data flow and interdependencies.
**Reusable & Shareable Context**: The output is a clean context-sets.json file that you can commit to your repository. This allows your entire team to provide consistent, expert-level context to their LLMs.
**Auto-Generated Indexes**: Automatically creates a filesManifest for robust file referencing and a fileContextsIndex to help other tools understand how files and context sets relate.


## How It Works

1. **Load Your Project**: Open the ContextMax web app and select your local project folder. Your code stays local.
2. **Define Context Sets**: Visually create named sets (e.g., "UserAuth_Flow"). Add relevant files to each set, implicitly populating a central filesManifest.
3. **Refine with Precision**: For each file in a set, specify whether to include the whole file or pinpoint exact line ranges.
4. **Map Workflows**: Define step-by-step workflows to explain how different code parts work together.
5. **Export & Use**: Download your context-sets.json file. Use it with your favorite IDE and LLM (e.g., via .cursorrules in Cursor) to provide powerful, curated context in your prompts.


## The context-sets.json Artifact

The core output of ContextMax is a single, version-controllable JSON file with four main parts:

- **filesManifest**: An ID-based registry of all files you've deemed relevant, with paths and comments.

- **contextSets**: Your named context sets, defining which files (via IDs), line ranges, and workflows are included.

- **fileContextsIndex**: 
An auto-generated index mapping file IDs to the context sets that use them, useful for tooling and analysis.

- **schemaVersion**: Versions the file structure itself.


## Tech Stack

- Nuxt.js (Vue.js 3)
- npm as the package manager
- Tailwind CSS, Reka-ui, and shadcn-nuxt for the styling
- File System Access API for local file interaction
- browser's localStorage and indexedDB for persistence
- 'jinaai/jina-embeddings-v2-base-code' (300mb+ size) as the locally-embedded LLM for semantic search


## Getting Started

To run ContextMax locally for development:

### Prerequisites:

- Node.js (v18.x or later recommended)
- npm or yarn or pnpm

### Installation & Running Locally

Clone the repository:

```bash
git clone https://github.com/galliani/contextmax.git
cd contextmax

npm install

# or yarn install or pnpm install
# Run the development server:
npm run dev
```

Open http://localhost:3000 in a compatible browser (e.g., Chrome, Edge) that supports the File System Access API.


## Contributing

We believe in empowering developers and are excited to build this tool with the community. Contributions are welcome!

Whether it's bug reports, feature suggestions, or code contributions, we appreciate your help!


## License

This project is licensed under the Mozilla Public License 2.0. See the [LICENSE](LICENSE) file for details.