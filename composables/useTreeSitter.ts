/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

// Dynamic import for web-tree-sitter to handle browser compatibility
let Parser: any = null

export interface ParsedCodeInfo {
  functions: Array<{
    name: string
    startLine: number
    endLine: number
    startColumn: number
    endColumn: number
    type: 'function' | 'method' | 'class_method'
  }>
  classes: Array<{
    name: string
    startLine: number
    endLine: number
    startColumn: number
    endColumn: number
  }>
  imports: Array<{
    module: string
    imported: string[]
    startLine: number
    endLine: number
    startColumn: number
    endColumn: number
  }>
  exports: Array<{
    name: string
    startLine: number
    endLine: number
    startColumn: number
    endColumn: number
  }>
  calls: Array<{
    name: string
    startLine: number
    endLine: number
    startColumn: number
    endColumn: number
  }>
}

export interface LanguageSupport {
  extension: string
  grammarFile: string
  displayName: string
}

// Supported languages with their grammar files
const SUPPORTED_LANGUAGES: Record<string, LanguageSupport> = {
  javascript: {
    extension: 'js',
    grammarFile: '/grammars/tree-sitter-javascript.wasm',
    displayName: 'JavaScript'
  },
  typescript: {
    extension: 'ts',
    grammarFile: '/grammars/tree-sitter-typescript.wasm',
    displayName: 'TypeScript'
  },
  python: {
    extension: 'py',
    grammarFile: '/grammars/tree-sitter-python.wasm',
    displayName: 'Python'
  },
  ruby: {
    extension: 'rb',
    grammarFile: '/grammars/tree-sitter-ruby.wasm',
    displayName: 'Ruby'
  }
}

export const useTreeSitter = () => {
  const parser = ref<Parser | null>(null)
  const loadedLanguages = ref<Map<string, any>>(new Map())
  const isInitialized = ref(false)
  const isInitializing = ref(false)
  const initError = ref<string | null>(null)

  // Initialize the parser (one-time setup)
  const initializeParser = async (): Promise<boolean> => {
    if (isInitialized.value || isInitializing.value) {
      return isInitialized.value
    }

    isInitializing.value = true
    initError.value = null

    try {
      // Dynamic import for browser compatibility
      if (!Parser) {
        const module = await import('web-tree-sitter')
        
        // Try different ways to access the Parser
        if (module.default) {
          Parser = module.default
        } else if (module.Parser) {
          Parser = module.Parser
        } else {
          Parser = module
        }
      }
      
      await Parser.init()
      parser.value = new Parser()
      isInitialized.value = true
      console.log('Tree-sitter parser initialized successfully, parser.value:', !!parser.value)
      return true
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
      initError.value = `Failed to initialize tree-sitter: ${errorMessage}`
      console.error('Failed to initialize tree-sitter:', error)
      return false
    } finally {
      isInitializing.value = false
    }
  }

  // Get language key from file extension
  const getLanguageFromExtension = (filePath: string): string | null => {
    const extension = filePath.split('.').pop()?.toLowerCase()
    if (!extension) return null

    for (const [key, config] of Object.entries(SUPPORTED_LANGUAGES)) {
      if (config.extension === extension) {
        return key
      }
    }
    return null
  }

  // Load a language grammar
  const loadLanguage = async (languageKey: string): Promise<any | null> => {
    if (!parser.value) {
      throw new Error('Parser not initialized. Call initializeParser() first.')
    }

    // Return cached language if already loaded
    if (loadedLanguages.value.has(languageKey)) {
      return loadedLanguages.value.get(languageKey)
    }

    const languageConfig = SUPPORTED_LANGUAGES[languageKey]
    if (!languageConfig) {
      throw new Error(`Unsupported language: ${languageKey}`)
    }

    try {
      console.log(`Loading ${languageConfig.displayName} grammar...`)
      
      // Ensure Parser is loaded
      if (!Parser) {
        const module = await import('web-tree-sitter')
        Parser = module.default || module
      }
      
      const Language = await Parser.Language.load(languageConfig.grammarFile)
      loadedLanguages.value.set(languageKey, Language)
      console.log(`${languageConfig.displayName} grammar loaded successfully`)
      return Language
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
      throw new Error(`Failed to load ${languageConfig.displayName} grammar: ${errorMessage}`)
    }
  }

  // Parse code and extract information
  const parseCode = async (code: string, filePath: string): Promise<ParsedCodeInfo | null> => {
    // Ensure parser is initialized
    if (!isInitialized.value || !parser.value) {
      console.warn('Parser not ready, attempting to initialize...')
      const success = await initializeParser()
      if (!success || !parser.value) {
        throw new Error('Parser not initialized')
      }
    }

    const languageKey = getLanguageFromExtension(filePath)
    if (!languageKey) {
      console.warn(`Unsupported file type: ${filePath}`)
      return null
    }

    const language = await loadLanguage(languageKey)
    parser.value.setLanguage(language)
    
    const tree = parser.value.parse(code)
    const rootNode = tree.rootNode
    
    return extractCodeInfo(rootNode, code, languageKey)
  }

  // Extract relevant code information from the syntax tree
  const extractCodeInfo = (rootNode: any, code: string, languageKey: string): ParsedCodeInfo => {
    const lines = code.split('\n')
    const info: ParsedCodeInfo = {
      functions: [],
      classes: [],
      imports: [],
      exports: [],
      calls: []
    }

    // Language-specific extraction logic
    switch (languageKey) {
      case 'javascript':
      case 'typescript':
        extractJavaScriptInfo(rootNode, info, lines)
        break
      case 'python':
        extractPythonInfo(rootNode, info, lines)
        break
      case 'ruby':
        extractRubyInfo(rootNode, info, lines)
        break
    }

    return info
  }

  // JavaScript/TypeScript specific extraction
  const extractJavaScriptInfo = (node: any, info: ParsedCodeInfo, lines: string[]) => {
    const traverse = (currentNode: any) => {
      const nodeType = currentNode.type

      switch (nodeType) {
        case 'function_declaration':
        case 'method_definition':
        case 'arrow_function':
          extractFunction(currentNode, info, lines, 'function')
          break
        case 'class_declaration':
          extractClass(currentNode, info, lines)
          break
        case 'import_statement':
          extractImport(currentNode, info, lines)
          break
        case 'export_statement':
          extractExport(currentNode, info, lines)
          break
        case 'call_expression':
          extractCall(currentNode, info, lines)
          break
      }

      // Recursively traverse child nodes
      for (let i = 0; i < currentNode.childCount; i++) {
        traverse(currentNode.child(i))
      }
    }

    traverse(node)
  }

  // Python specific extraction
  const extractPythonInfo = (node: any, info: ParsedCodeInfo, lines: string[]) => {
    const traverse = (currentNode: any) => {
      const nodeType = currentNode.type

      switch (nodeType) {
        case 'function_definition':
          extractFunction(currentNode, info, lines, 'function')
          break
        case 'class_definition':
          extractClass(currentNode, info, lines)
          break
        case 'import_statement':
        case 'import_from_statement':
          extractImport(currentNode, info, lines)
          break
        case 'call':
          extractCall(currentNode, info, lines)
          break
      }

      for (let i = 0; i < currentNode.childCount; i++) {
        traverse(currentNode.child(i))
      }
    }

    traverse(node)
  }

  // Ruby specific extraction
  const extractRubyInfo = (node: any, info: ParsedCodeInfo, lines: string[]) => {
    const traverse = (currentNode: any) => {
      const nodeType = currentNode.type

      switch (nodeType) {
        case 'method':
          extractFunction(currentNode, info, lines, 'method')
          break
        case 'class':
          extractClass(currentNode, info, lines)
          break
        case 'call':
          extractCall(currentNode, info, lines)
          break
      }

      for (let i = 0; i < currentNode.childCount; i++) {
        traverse(currentNode.child(i))
      }
    }

    traverse(node)
  }

  // Helper functions to extract specific elements
  const extractFunction = (node: any, info: ParsedCodeInfo, lines: string[], type: 'function' | 'method' | 'class_method') => {
    const name = getFunctionName(node)
    if (name) {
      info.functions.push({
        name,
        startLine: node.startPosition.row + 1,
        endLine: node.endPosition.row + 1,
        startColumn: node.startPosition.column,
        endColumn: node.endPosition.column,
        type
      })
    }
  }

  const extractClass = (node: any, info: ParsedCodeInfo, lines: string[]) => {
    const name = getClassName(node)
    if (name) {
      info.classes.push({
        name,
        startLine: node.startPosition.row + 1,
        endLine: node.endPosition.row + 1,
        startColumn: node.startPosition.column,
        endColumn: node.endPosition.column
      })
    }
  }

  const extractImport = (node: any, info: ParsedCodeInfo, lines: string[]) => {
    const importInfo = getImportInfo(node)
    if (importInfo) {
      info.imports.push({
        ...importInfo,
        startLine: node.startPosition.row + 1,
        endLine: node.endPosition.row + 1,
        startColumn: node.startPosition.column,
        endColumn: node.endPosition.column
      })
    }
  }

  const extractExport = (node: any, info: ParsedCodeInfo, lines: string[]) => {
    const name = getExportName(node)
    if (name) {
      info.exports.push({
        name,
        startLine: node.startPosition.row + 1,
        endLine: node.endPosition.row + 1,
        startColumn: node.startPosition.column,
        endColumn: node.endPosition.column
      })
    }
  }

  const extractCall = (node: any, info: ParsedCodeInfo, lines: string[]) => {
    const name = getCallName(node)
    if (name) {
      info.calls.push({
        name,
        startLine: node.startPosition.row + 1,
        endLine: node.endPosition.row + 1,
        startColumn: node.startPosition.column,
        endColumn: node.endPosition.column
      })
    }
  }

  // Utility functions for extracting names from nodes
  const getFunctionName = (node: any): string | null => {
    // Try to find the function name in different node structures
    for (let i = 0; i < node.childCount; i++) {
      const child = node.child(i)
      if (child.type === 'identifier' || child.type === 'property_identifier') {
        return child.text
      }
    }
    return null
  }

  const getClassName = (node: any): string | null => {
    for (let i = 0; i < node.childCount; i++) {
      const child = node.child(i)
      if (child.type === 'identifier' || child.type === 'type_identifier') {
        return child.text
      }
    }
    return null
  }

  const getImportInfo = (node: any): { module: string; imported: string[] } | null => {
    // This is a simplified version - would need more sophisticated parsing
    const text = node.text
    const moduleMatch = text.match(/from\s+['"]([^'"]+)['"]|import\s+['"]([^'"]+)['"]/)
    const module = moduleMatch?.[1] || moduleMatch?.[2]
    
    if (module) {
      return {
        module,
        imported: [] // Would need more parsing to extract specific imports
      }
    }
    return null
  }

  const getExportName = (node: any): string | null => {
    // Simplified export name extraction
    return node.text.split(' ')[1] || null
  }

  const getCallName = (node: any): string | null => {
    for (let i = 0; i < node.childCount; i++) {
      const child = node.child(i)
      if (child.type === 'identifier' || child.type === 'member_expression') {
        return child.text
      }
    }
    return null
  }

  // Check if a language is supported
  const isLanguageSupported = (filePath: string): boolean => {
    const languageKey = getLanguageFromExtension(filePath)
    return languageKey !== null
  }

  // Get supported languages list
  const getSupportedLanguages = (): LanguageSupport[] => {
    return Object.entries(SUPPORTED_LANGUAGES).map(([key, config]) => ({
      ...config,
      extension: key
    }))
  }

  return {
    // State
    isInitialized: readonly(isInitialized),
    isInitializing: readonly(isInitializing),
    initError: readonly(initError),
    
    // Methods
    initializeParser,
    parseCode,
    isLanguageSupported,
    getSupportedLanguages,
    getLanguageFromExtension,
    
    // Supported languages
    SUPPORTED_LANGUAGES: readonly(SUPPORTED_LANGUAGES)
  }
} 