/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { encode } from 'gpt-tokenizer'
import * as yaml from 'js-yaml'
import type { ContextSet, FileManifestEntry, FileIndexEntry, Workflow, WorkflowPoint } from './useContextSets'

export interface ExportResult {
  success: boolean
  tokenCount: number
  error?: string
}

export interface FileTreeItem {
  path: string
  type: 'file' | 'directory'
  handle?: FileSystemFileHandle | FileSystemDirectoryHandle
  children?: FileTreeItem[]
}

export const useContextSetExporter = () => {
  // Reactive state for token count tracking
  const tokenCount = ref(0)
  const isExporting = ref(false)

  /**
   * Determines the language hint for code blocks based on file extension
   */
  const getLanguageHint = (filePath: string): string => {
    const extension = filePath.split('.').pop()?.toLowerCase()
    
    const languageMap: Record<string, string> = {
      'ts': 'typescript',
      'js': 'javascript',
      'vue': 'vue',
      'jsx': 'jsx',
      'tsx': 'tsx',
      'py': 'python',
      'rb': 'ruby',
      'php': 'php',
      'java': 'java',
      'c': 'c',
      'cpp': 'cpp',
      'cs': 'csharp',
      'go': 'go',
      'rs': 'rust',
      'kt': 'kotlin',
      'swift': 'swift',
      'sh': 'bash',
      'bash': 'bash',
      'zsh': 'zsh',
      'fish': 'fish',
      'ps1': 'powershell',
      'sql': 'sql',
      'html': 'html',
      'css': 'css',
      'scss': 'scss',
      'sass': 'sass',
      'less': 'less',
      'xml': 'xml',
      'yaml': 'yaml',
      'yml': 'yaml',
      'json': 'json',
      'md': 'markdown',
      'markdown': 'markdown',
      'txt': 'text',
      'log': 'text',
      'config': 'text',
      'env': 'bash',
      'dockerfile': 'dockerfile',
      'makefile': 'makefile'
    }
    
    return languageMap[extension || ''] || 'text'
  }

  /**
   * Finds a file handle in the file tree by path
   */
  const findFileHandle = (fileTree: FileTreeItem[], targetPath: string): FileSystemFileHandle | null => {
    for (const item of fileTree) {
      if (item.type === 'file' && item.path === targetPath) {
        return item.handle as FileSystemFileHandle
      }
      if (item.type === 'directory' && item.children) {
        const found = findFileHandle(item.children, targetPath)
        if (found) return found
      }
    }
    return null
  }

  /**
   * Transform workflows from using file IDs to file paths for export
   */
  const transformWorkflowsForExport = (
    workflows: Workflow[],
    filesManifest: Record<string, FileManifestEntry> | Record<string, FileIndexEntry>
  ): Workflow[] => {
    return workflows.map(workflow => ({
      start: {
        ...workflow.start,
        fileRef: filesManifest[workflow.start.fileRef]?.path || workflow.start.fileRef
      },
      end: {
        ...workflow.end,
        fileRef: filesManifest[workflow.end.fileRef]?.path || workflow.end.fileRef
      }
    }))
  }

  /**
   * Recursively resolve context dependencies to avoid circular references
   */
  const resolveDependencies = (
    contextName: string,
    allContexts: Record<string, ContextSet>,
    visited: Set<string> = new Set(),
    resolved: string[] = []
  ): string[] => {
    // Prevent circular dependencies
    if (visited.has(contextName)) {
      return resolved
    }
    
    visited.add(contextName)
    const context = allContexts[contextName]
    
    if (!context || !context.uses || context.uses.length === 0) {
      return resolved
    }
    
    // Process each dependency
    for (const childContext of context.uses) {
      if (!resolved.includes(childContext)) {
        // First resolve the child's dependencies
        resolveDependencies(childContext, allContexts, new Set(visited), resolved)
        // Then add the child itself
        if (!resolved.includes(childContext)) {
          resolved.push(childContext)
        }
      }
    }
    
    return resolved
  }

  /**
   * Build the file content section for a single context
   */
  const buildContextFiles = async (
    contextName: string,
    contextSet: ContextSet,
    filesManifest: Record<string, FileManifestEntry> | Record<string, FileIndexEntry>,
    fileTree: FileTreeItem[]
  ): Promise<string[]> => {
    const markdownBodyParts: string[] = []

    for (const fileItem of contextSet.files) {
      const fileId = typeof fileItem === 'string' ? fileItem : fileItem.fileRef
      const fileEntry = filesManifest[fileId]
      
      if (!fileEntry) {
        console.warn(`File manifest entry not found for ID: ${fileId}`)
        continue
      }

      const filePath = fileEntry.path
      
      try {
        // Find the file handle
        const fileHandle = findFileHandle(fileTree, filePath)
        if (!fileHandle) {
          console.warn(`File handle not found for path: ${filePath}`)
          markdownBodyParts.push(`## FILE: ${filePath}`)
          markdownBodyParts.push('```text')
          markdownBodyParts.push('// File not accessible in current file tree')
          markdownBodyParts.push('```')
          markdownBodyParts.push('')
          continue
        }

        // Read the file content
        const file = await fileHandle.getFile()
        const content = await file.text()
        
        // Determine language hint
        const languageHint = getLanguageHint(filePath)
        
        // Add file section to markdown
        markdownBodyParts.push(`## FILE: ${filePath}`)
        markdownBodyParts.push(`\`\`\`${languageHint}`)
        markdownBodyParts.push(content)
        markdownBodyParts.push('```')
        markdownBodyParts.push('') // Empty line between files
        
      } catch (error) {
        console.error(`Failed to read file ${filePath}:`, error)
        markdownBodyParts.push(`## FILE: ${filePath}`)
        markdownBodyParts.push('```text')
        markdownBodyParts.push(`// Error reading file: ${error instanceof Error ? error.message : 'Unknown error'}`)
        markdownBodyParts.push('```')
        markdownBodyParts.push('')
      }
    }

    return markdownBodyParts
  }

  /**
   * Core function to build the context set string in Markdown with YAML frontmatter format
   * Now supports hierarchical export with dependencies
   */
  const _buildContextSetString = async (
    setName: string,
    contextSet: ContextSet,
    filesManifest: Record<string, FileManifestEntry> | Record<string, FileIndexEntry>,
    fileTree: FileTreeItem[],
    allContexts?: Record<string, ContextSet>
  ): Promise<string> => {
    // Step 1: Resolve dependencies if allContexts is provided
    const childContexts: string[] = []
    if (allContexts && contextSet.uses && contextSet.uses.length > 0) {
      const resolvedDeps = resolveDependencies(setName, allContexts)
      childContexts.push(...resolvedDeps)
    }

    // Step 2: Prepare the main frontmatter with metadata about all contexts
    const frontmatterObject: Record<string, any> = {
      contextSetName: setName,
    }

    // Only add fields that have meaningful content
    if (contextSet.description && contextSet.description.trim()) {
      frontmatterObject.description = contextSet.description
    }

    if (contextSet.workflows && contextSet.workflows.length > 0) {
      frontmatterObject.workflows = transformWorkflowsForExport(contextSet.workflows, filesManifest)
    }

    if (contextSet.uses && contextSet.uses.length > 0) {
      frontmatterObject.uses = contextSet.uses
    }

    // Add metadata about included child contexts
    if (childContexts.length > 0) {
      frontmatterObject.includedContexts = childContexts.map(childName => {
        const childContext = allContexts![childName]
        const metadata: { name: string; description?: string } = { name: childName }
        if (childContext?.description && childContext.description.trim()) {
          metadata.description = childContext.description
        }
        return metadata
      })
    }

    if (contextSet.systemBehavior && Object.keys(contextSet.systemBehavior).length > 0) {
      // Check if systemBehavior has meaningful content
      const hasProcessingMode = contextSet.systemBehavior.processing?.mode
      if (hasProcessingMode) {
        frontmatterObject.systemBehavior = contextSet.systemBehavior
      }
    }

    // Step 3: Serialize to YAML
    const yamlString = yaml.dump(frontmatterObject, { indent: 2, skipInvalid: true })
    const frontmatter = `---\n${yamlString}---`

    // Step 4: Enhanced system prompt for hierarchical contexts
    const hasChildContexts = childContexts.length > 0
    const systemPrompt = `You can analyze the provided project context to help with development tasks. ${hasChildContexts ? 'This export includes the main context and its dependent child contexts in a hierarchical structure.' : 'The context is structured with YAML frontmatter for metadata and markdown for file contents.'}

## How to Use This Context:

1. **Check workflows first** - If workflows exist in the frontmatter, follow the data flow from start to end
2. **File relationships** - If this context has a "uses" array, consider how changes might affect those related contexts
3. **Hierarchical structure** - ${hasChildContexts ? 'Main context appears first, followed by child contexts. Each context section contains its relevant files.' : 'Use the specific files provided rather than making assumptions about the broader codebase.'}
4. **Context boundaries** - ${hasChildContexts ? 'Understand which files belong to which context for better architectural decisions.' : 'Follow existing code patterns and naming conventions shown in the files.'}
5. **Focused analysis** - You can remove child context sections if not needed for your specific task

Use this complete context to answer the user's request accurately and provide implementation details that align with the existing codebase structure.`

    // Step 5: Build hierarchical content sections
    const contentSections: string[] = []
    
    // Main context section
    contentSections.push(`# 📁 MAIN CONTEXT: ${setName}`)
    if (contextSet.description) {
      contentSections.push(`**Description:** ${contextSet.description}`)
    }
    if (contextSet.workflows && contextSet.workflows.length > 0) {
      contentSections.push(`**Workflows:** ${contextSet.workflows.length} defined`)
    }
    contentSections.push('')
    
    const mainContextFiles = await buildContextFiles(setName, contextSet, filesManifest, fileTree)
    contentSections.push(...mainContextFiles)
    
    // Child context sections
    for (const childName of childContexts) {
      const childContext = allContexts![childName]
      if (!childContext) continue
      
      contentSections.push(`# 📁 CHILD CONTEXT: ${childName}`)
      if (childContext.description) {
        contentSections.push(`**Description:** ${childContext.description}`)
      }
      if (childContext.workflows && childContext.workflows.length > 0) {
        contentSections.push(`**Workflows:** ${childContext.workflows.length} defined`)
      }
      if (childContext.uses && childContext.uses.length > 0) {
        contentSections.push(`**Uses:** ${childContext.uses.join(', ')}`)
      }
      contentSections.push('')
      
      const childContextFiles = await buildContextFiles(childName, childContext, filesManifest, fileTree)
      contentSections.push(...childContextFiles)
    }

    // Step 6: Combine everything
    const finalBody = frontmatter + '\n\n' + systemPrompt + '\n\n' + contentSections.join('\n')

    return finalBody
  }

  /**
   * Calculate token count for a context set without exporting
   */
  const calculateTokenCount = async (
    setName: string,
    contextSet: ContextSet,
    filesManifest: Record<string, FileManifestEntry> | Record<string, FileIndexEntry>,
    fileTree: FileTreeItem[],
    allContexts?: Record<string, ContextSet>
  ): Promise<number> => {
    try {
      const contextString = await _buildContextSetString(setName, contextSet, filesManifest, fileTree, allContexts)
      const tokens = encode(contextString)
      return tokens.length
    } catch (error) {
      console.error('Failed to calculate token count:', error)
      return 0
    }
  }

  /**
   * Export context set to clipboard in Markdown format
   */
  const exportContextSetToClipboard = async (
    setName: string,
    contextSet: ContextSet,
    filesManifest: Record<string, FileManifestEntry> | Record<string, FileIndexEntry>,
    fileTree: FileTreeItem[],
    allContexts?: Record<string, ContextSet>
  ): Promise<ExportResult> => {
    if (isExporting.value) {
      return { success: false, tokenCount: 0, error: 'Export already in progress' }
    }

    isExporting.value = true
    
    try {
      // Build the complete context string with hierarchical dependencies
      const contextString = await _buildContextSetString(setName, contextSet, filesManifest, fileTree, allContexts)
      
      // Calculate token count
      const tokens = encode(contextString)
      const finalTokenCount = tokens.length
      tokenCount.value = finalTokenCount

      // Copy to clipboard
      await navigator.clipboard.writeText(contextString)
      
      return {
        success: true,
        tokenCount: finalTokenCount
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
      console.error('Export failed:', error)
      
      return {
        success: false,
        tokenCount: 0,
        error: errorMessage
      }
    } finally {
      isExporting.value = false
    }
  }

  return {
    // Reactive state
    tokenCount: readonly(tokenCount),
    isExporting: readonly(isExporting),
    
    // Functions
    calculateTokenCount,
    exportContextSetToClipboard
  }
} 