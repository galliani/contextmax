/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { encode } from 'gpt-tokenizer'
import type { ContextSet, FileRef, FileManifestEntry, WorkflowStep, EntryPoint } from './useContextSets'

export interface ExportResult {
  success: boolean
  tokenCount: number
  error?: string
}

export const useContextSetExporter = () => {
  // Reactive state for token count tracking
  const tokenCount = ref(0)
  const isExporting = ref(false)

  /**
   * Find a file in the file tree by path
   */
  const findFileInTree = (tree: any[], targetPath: string): any | null => {
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

  /**
   * Read file content from handle
   */
  const readFileContent = async (fileHandle: FileSystemFileHandle): Promise<string> => {
    try {
      const file = await fileHandle.getFile()
      const content = await file.text()
      return content
    } catch (error) {
      console.error('Failed to read file content:', error)
      throw new Error(`Failed to read file: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Escape XML special characters in text content (for attributes, not CDATA)
   */
  const escapeXml = (text: string): string => {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;')
  }

  /**
   * Generate XML snippet for the active context set
   */
  const exportContextSetToClipboard = async (
    setName: string,
    contextSet: ContextSet,
    filesManifest: Record<string, FileManifestEntry>,
    fileTree: any[]
  ): Promise<ExportResult> => {
    isExporting.value = true
    
    try {
      const xmlParts: string[] = []
      
      // XML Header
      xmlParts.push(`<contextSet name="${escapeXml(setName)}">`)
      xmlParts.push(`  <description><![CDATA[${contextSet.description}]]></description>`)
      xmlParts.push('  <files>')

      // Process each file in the context set
      for (const fileItem of contextSet.files) {
        const fileId = typeof fileItem === 'string' ? fileItem : fileItem.fileRef
        const fileManifest = filesManifest[fileId]
        
        if (!fileManifest) {
          console.warn(`File manifest not found for ID: ${fileId}`)
          continue
        }

        const filePath = fileManifest.path
        
        // Find file in tree to get handle
        const fileTreeItem = findFileInTree(fileTree, filePath)
        if (!fileTreeItem || !fileTreeItem.handle) {
          console.warn(`File handle not found for: ${filePath}`)
          // Add file entry without content
          xmlParts.push(`    <file path="${escapeXml(filePath)}">`)
          xmlParts.push(`      <error>File not accessible or missing</error>`)
          xmlParts.push('    </file>')
          continue
        }

        // Read file content
        let fileContent: string
        try {
          fileContent = await readFileContent(fileTreeItem.handle as FileSystemFileHandle)
        } catch (error) {
          console.error(`Failed to read file content for ${filePath}:`, error)
          xmlParts.push(`    <file path="${escapeXml(filePath)}">`)
          xmlParts.push(`      <error>Failed to read file content: ${error instanceof Error ? escapeXml(error.message) : 'Unknown error'}</error>`)
          xmlParts.push('    </file>')
          continue
        }

        // Generate file XML
        if (typeof fileItem === 'string') {
          // Simple file reference (whole file)
          xmlParts.push(`    <file path="${escapeXml(filePath)}">`)
          if (fileManifest.comment) {
            xmlParts.push(`      <comment><![CDATA[${fileManifest.comment}]]></comment>`)
          }
          xmlParts.push(`      <content><![CDATA[${fileContent}]]></content>`)
          xmlParts.push('    </file>')
        } else {
          // FileRef with specific functions
          xmlParts.push(`    <file path="${escapeXml(filePath)}">`)
          if (fileItem.comment) {
            xmlParts.push(`      <comment><![CDATA[${fileItem.comment}]]></comment>`)
          }
          if (fileManifest.comment) {
            xmlParts.push(`      <manifestComment><![CDATA[${fileManifest.comment}]]></manifestComment>`)
          }
          if (fileItem.functionRefs && fileItem.functionRefs.length > 0) {
            xmlParts.push('      <functions>')
            fileItem.functionRefs.forEach(func => {
              xmlParts.push(`        <function name="${escapeXml(func.name)}"${func.comment ? ` comment="${escapeXml(func.comment)}"` : ''} />`)
            })
            xmlParts.push('      </functions>')
          }
          xmlParts.push(`      <content><![CDATA[${fileContent}]]></content>`)
          xmlParts.push('    </file>')
        }
      }

      xmlParts.push('  </files>')

      // Add Workflows
      if (contextSet.workflow && contextSet.workflow.length > 0) {
        xmlParts.push('  <workflow>')
        contextSet.workflow.forEach((step: WorkflowStep) => {
          xmlParts.push('    <step>')
          xmlParts.push(`      <description><![CDATA[${step.description}]]></description>`)
          if (step.fileRefs && step.fileRefs.length > 0) {
            xmlParts.push('      <fileRefs>')
            step.fileRefs.forEach(ref => {
              // Convert file ID to path for better readability
              const refPath = filesManifest[ref]?.path || ref
              xmlParts.push(`        <fileRef path="${escapeXml(refPath)}" />`)
            })
            xmlParts.push('      </fileRefs>')
          }
          xmlParts.push('    </step>')
        })
        xmlParts.push('  </workflow>')
      }

      // Add Entry Points
      if (contextSet.entryPoints && contextSet.entryPoints.length > 0) {
        xmlParts.push('  <entryPoints>')
        contextSet.entryPoints.forEach((ep: EntryPoint) => {
          const epFilePath = filesManifest[ep.fileRef]?.path || ep.fileRef
          xmlParts.push(`    <entryPoint fileRef="${escapeXml(epFilePath)}" function="${escapeXml(ep.function)}" protocol="${escapeXml(ep.protocol)}" method="${escapeXml(ep.method)}" identifier="${escapeXml(ep.identifier)}" />`)
        })
        xmlParts.push('  </entryPoints>')
      }

      // Add System Behavior
      if (contextSet.systemBehavior?.processing?.mode) {
        xmlParts.push('  <systemBehavior>')
        xmlParts.push(`    <processing mode="${escapeXml(contextSet.systemBehavior.processing.mode)}" />`)
        xmlParts.push('  </systemBehavior>')
      }

      xmlParts.push('</contextSet>')

      const finalXml = xmlParts.join('\n')
      
      // Calculate token count
      const calculatedTokenCount = encode(finalXml).length
      tokenCount.value = calculatedTokenCount

      // Copy to clipboard
      await navigator.clipboard.writeText(finalXml)

      return { success: true, tokenCount: calculatedTokenCount }

    } catch (error) {
      console.error('Failed to export context set:', error)
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
      return { success: false, tokenCount: 0, error: errorMessage }
    } finally {
      isExporting.value = false
    }
  }

  /**
   * Calculate token count for preview without exporting
   */
  const calculateTokenCount = async (
    setName: string,
    contextSet: ContextSet,
    filesManifest: Record<string, FileManifestEntry>,
    fileTree: any[]
  ): Promise<number> => {
    try {
      // This is a simplified version that doesn't read file contents
      // We'll estimate based on the structure
      let estimatedLength = 0
      
      // Basic XML structure
      estimatedLength += setName.length + contextSet.description.length + 200 // overhead
      
      // Estimate file content (we can't read all files for preview)
      estimatedLength += contextSet.files.length * 1000 // rough estimate per file
      
      // Workflow
      if (contextSet.workflow) {
        estimatedLength += contextSet.workflow.reduce((acc, step) => 
          acc + step.description.length + (step.fileRefs?.length || 0) * 50, 0)
      }
      
      // Entry points
      if (contextSet.entryPoints) {
        estimatedLength += contextSet.entryPoints.length * 100
      }
      
      return Math.floor(estimatedLength / 4) // rough tokens estimate
    } catch (error) {
      console.error('Failed to calculate token count:', error)
      return 0
    }
  }

  return {
    // State
    tokenCount: readonly(tokenCount),
    isExporting: readonly(isExporting),

    // Functions
    exportContextSetToClipboard,
    calculateTokenCount
  }
} 