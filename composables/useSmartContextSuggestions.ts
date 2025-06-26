/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { logger } from '~/utils/logger'
import type { RegexParsedCodeInfo } from './useRegexCodeParser'
import type { RelevantFunction } from './useIndexedDBCache'

export interface CodeDependency {
  fromFile: string
  toFile: string
  dependencyType: 'import' | 'call' | 'inheritance' | 'composition'
  line: number
  confidence: number // 0-1, how confident we are about this dependency
}

export interface SmartSuggestion {
  id: string
  type: 'keywordSearch'
  title: string
  description: string
  confidence: number
  data: Record<string, unknown>
}

export interface KeywordSearchSuggestion extends SmartSuggestion {
  type: 'keywordSearch'
  data: {
    keyword: string
    files: Array<{
      file: string
      finalScore: number
      scorePercentage: number
      astScore: number
      llmScore: number
      flanScore: number
      syntaxScore: number
      hasSynergy: boolean
      matches: string[]
      classification?: string
      workflowPosition?: string
    }>
  }
}

export interface ASTMatch {
  file: string
  matches: string[]
  score: number
}

export interface LLMMatch {
  file: string
  score: number
  embedding?: number[]
}

export interface HybridMatch {
  file: string
  finalScore: number
  astScore: number
  llmScore: number
  hasSynergy: boolean
  matches: string[]
}


export const useSmartContextSuggestions = () => {
  const { parseCode, isLanguageSupported } = useRegexCodeParser()
  const { announceStatus } = useAccessibility()
  const { $llm } = useNuxtApp() as { $llm?: { engine?: unknown; status?: string } }

  // IndexedDB cache
  const {
    initDB,
    calculateHash,
    calculateProjectHash,
    getCachedEmbedding,
    storeCachedEmbedding,
    getCachedProjectEmbeddings,
    storeCachedProjectEmbeddings,
    cleanOldCache
  } = useIndexedDBCache()

  // Cache for parsed code information and analysis
  const codeInfoCache = ref<Map<string, RegexParsedCodeInfo>>(new Map())
  const dependencyGraph = ref<Map<string, CodeDependency[]>>(new Map())
  const fileEmbeddings = ref<Map<string, number[]>>(new Map())
  const isAnalyzing = ref(false)
  const analysisProgress = ref(0)
  const hasLoadedFromCache = ref(false)

  // Load from cache and build AST analysis for search
  const loadCachedAnalysis = async (
    files: Array<{ path: string; content: string }>
  ): Promise<void> => {
    isAnalyzing.value = true
    analysisProgress.value = 0
    
    try {
      // Try to load cached embeddings first
      const loaded = await loadCachedEmbeddings(files)
      
      // Build AST analysis for search (always needed for current session)
      const supportedFiles = files.filter(file => isLanguageSupported(file.path))
      const total = supportedFiles.length
      
      announceStatus(`Analyzing ${total} files for search...`)

      // Parse each file for search
      for (let i = 0; i < supportedFiles.length; i++) {
        const file = supportedFiles[i]
        
        try {
          const codeInfo = await parseCode(file.content, file.path)
          if (codeInfo) {
            codeInfoCache.value.set(file.path, codeInfo)
          }
        } catch (error) {
          logger.warn(`Failed to parse ${file.path}:`, error)
        }
        
        analysisProgress.value = ((i + 1) / total) * 100
      }

      // Build dependency graph for search
      buildDependencyGraph(supportedFiles)
      
      announceStatus(`Analysis complete. Ready for search.`)
      
    } catch (error) {
      logger.error('Project analysis failed:', error)
      throw error
    } finally {
      isAnalyzing.value = false
      analysisProgress.value = 100
    }
  }

  // Build dependency graph from parsed code information
  const buildDependencyGraph = (files: Array<{ path: string; content: string }>) => {
    dependencyGraph.value.clear()

    for (const file of files) {
      const codeInfo = codeInfoCache.value.get(file.path)
      if (!codeInfo) continue

      const dependencies: CodeDependency[] = []

      // Find import dependencies
      for (const importInfo of codeInfo.imports) {
        const resolvedPath = resolveImportPath(importInfo.module, file.path, files)
        if (resolvedPath) {
          dependencies.push({
            fromFile: file.path,
            toFile: resolvedPath,
            dependencyType: 'import',
            line: importInfo.startLine,
            confidence: 0.9
          })
        }
      }

      // Note: Call dependencies removed - too complex for regex parsing

      if (dependencies.length > 0) {
        dependencyGraph.value.set(file.path, dependencies)
      }
    }
  }

  // ===== HYBRID KEYWORD SEARCH: THE THREE-STAGE DETECTIVE SYSTEM =====

  // Stage 1: Literal Structure Search ("Detective By-the-Book")
  const performStructureSearch = (
    keyword: string, 
    files: Array<{ path: string; content: string }>
  ): ASTMatch[] => {
    const structureMatches: ASTMatch[] = [];

    // 1. TOKENIZE THE INPUT: Break the search query into individual keywords.
    // This regex splits by spaces, underscores, or hyphens.
    const keywords = keyword.toLowerCase().split(/[\s_-]+/).filter(k => k.length > 2); // filter out short words

    if (keywords.length === 0) return []; // No valid keywords to search for

    for (const file of files) {
      const matches: string[] = [];
      let score = 0;
      
             // Define weights for different match types for a more nuanced score
       const weights = {
         className: 1.0,
         functionName: 0.8,
         filePath: 0.6,
         exportName: 0.5,
         importName: 0.4,
         content: 0.1
       };

       // File type importance weighting (some files are more relevant than others)
       const fileTypeWeights = {
         model: 1.2,        // Models are often what developers look for
         controller: 1.1,   // Controllers are important for understanding flow
         service: 1.1,      // Services contain business logic
         component: 1.1,    // Components are key UI elements
         job: 1.0,          // Background jobs
         migration: 0.7,    // Migrations are less commonly what you're looking for
         config: 0.6,       // Config files are supporting
         spec: 0.8,         // Test files are supporting
         test: 0.8          // Test files are supporting
       };

       // Determine file type from path
       const getFileTypeMultiplier = (filePath: string): number => {
         const path = filePath.toLowerCase();
         if (path.includes('/model')) return fileTypeWeights.model;
         if (path.includes('/controller')) return fileTypeWeights.controller;
         if (path.includes('/service')) return fileTypeWeights.service;
         if (path.includes('/component')) return fileTypeWeights.component;
         if (path.includes('/job')) return fileTypeWeights.job;
         if (path.includes('/migrate')) return fileTypeWeights.migration;
         if (path.includes('/config')) return fileTypeWeights.config;
         if (path.includes('/spec') || path.includes('/test')) return fileTypeWeights.spec;
         return 1.0; // Default multiplier
       };

      const matchedKeywords = new Set<string>();

      // 2. SEARCH FOR EACH TOKEN: Loop through each keyword and check for its presence.
      for (const token of keywords) {
        // Check file path
        if (file.path.toLowerCase().includes(token)) {
          if (!matchedKeywords.has(token + '-path')) {
            matches.push(`Path matches "${token}"`);
            score += weights.filePath;
            matchedKeywords.add(token + '-path');
          }
        }

        const codeInfo = codeInfoCache.value.get(file.path);
        if (codeInfo) {
          if (codeInfo.classes.some(c => c.name.toLowerCase().includes(token))) {
            if (!matchedKeywords.has(token + '-class')) {
              matches.push(`Class name matches "${token}"`);
              score += weights.className;
              matchedKeywords.add(token + '-class');
            }
          }
                     if (codeInfo.functions.some(f => f.name.toLowerCase().includes(token))) {
             if (!matchedKeywords.has(token + '-func')) {
               matches.push(`Function name matches "${token}"`);
               score += weights.functionName;
               matchedKeywords.add(token + '-func');
             }
           }
           if (codeInfo.exports.some(e => e.name.toLowerCase().includes(token))) {
             if (!matchedKeywords.has(token + '-export')) {
               matches.push(`Export name matches "${token}"`);
               score += weights.exportName;
               matchedKeywords.add(token + '-export');
             }
           }
           if (codeInfo.imports.some(i => i.module.toLowerCase().includes(token))) {
             if (!matchedKeywords.has(token + '-import')) {
               matches.push(`Import matches "${token}"`);
               score += weights.importName;
               matchedKeywords.add(token + '-import');
             }
           }
        }

        const contentMatches = (file.content.toLowerCase().match(new RegExp(token, 'g')) || []).length;
        if (contentMatches > 0) {
          if (!matchedKeywords.has(token + '-content')) {
            matches.push(`Content matches "${token}"`);
            score += Math.min(contentMatches * weights.content, 0.5);
            matchedKeywords.add(token + '-content');
          }
        }
      }
      
             // 3. REWARD MULTI-KEYWORD MATCHES: If a file matched multiple unique keywords, give it a boost.
       if (matchedKeywords.size > 1) {
           score *= (1 + (matchedKeywords.size - 1) * 0.25); // e.g., 2 keywords = 1.25x boost, 3 = 1.5x boost
       }

       // 4. APPLY FILE TYPE WEIGHTING: Some file types are more important to developers
       const fileTypeMultiplier = getFileTypeMultiplier(file.path);
       score *= fileTypeMultiplier;

       if (matches.length > 0) {
         structureMatches.push({ file: file.path, matches, score });
       }
    }

    return structureMatches;
  };

  // Stage 2: Semantic LLM Search ("Detective Insight")
  const performLLMSearch = async (
    keyword: string, 
    files: Array<{ path: string; content: string }>
  ): Promise<LLMMatch[]> => {
    if (!$llm?.engine || $llm?.status !== 'ready') {
      logger.warn(`LLM not available for semantic search: engine=${typeof $llm?.engine}, status=${$llm?.status}`)
      return []
    }

    try {
      // Generate query embedding for the search keyword
      if (typeof $llm.engine === 'function') {
        const queryEmbedding = await $llm.engine(keyword, { 
          pooling: 'mean', 
          normalize: true 
        })

        const llmMatches: LLMMatch[] = []

        // Calculate semantic similarity for each file
        for (const file of files) {
          const fileEmbedding = fileEmbeddings.value.get(file.path)
          
          if (fileEmbedding) {
            let similarity = cosineSimilarity(queryEmbedding.data, fileEmbedding)
            
            // FILENAME SEMANTIC BOOST: If the filename itself is semantically related, boost the score
            const fileName = file.path.split('/').pop()?.replace(/\.[^/.]+$/, '') || ''
            const fileNameWords = fileName.split(/[_-]/).join(' ')
            
            // Generate embedding for just the filename context
            try {
              const fileNameEmbedding = await $llm.engine(`file named ${fileNameWords}`, { 
                pooling: 'mean', 
                normalize: true 
              })
              const fileNameSimilarity = cosineSimilarity(queryEmbedding.data, fileNameEmbedding.data)
              
              // Blend the content similarity with filename similarity (weighted toward content)
              similarity = (similarity * 0.7) + (fileNameSimilarity * 0.3)
            } catch {
              // If filename embedding fails, just use the content similarity
            }
            
            llmMatches.push({
              file: file.path,
              score: similarity,
              embedding: fileEmbedding
            })
          }
        }

        return llmMatches.sort((a, b) => b.score - a.score)
      } else {
        logger.warn('LLM engine is not available for semantic search')
        return []
      }
    } catch (error) {
      logger.error('LLM search failed:', error)
      return []
    }
  }

  // Stage 3: Synergy and Intelligent Ranking ("The Powerful Combination")
  const combineSearchResults = (
    astMatches: ASTMatch[], 
    llmMatches: LLMMatch[],
    synergyMultiplier: number = 2.0, // Increased multiplier for a stronger boost
    astWeight: number = 0.4, // Weight for the AST score
    llmWeight: number = 0.6  // Weight for the LLM score
  ): HybridMatch[] => {
    const fileMap = new Map<string, HybridMatch>()

    // Find the max possible AST score for normalization. Add 1 to avoid division by zero.
    const maxAstScore = astMatches.reduce((max, m) => Math.max(max, m.score), 1)

    // Initialize with all unique files from both lists to ensure nothing is missed
    const allFiles = new Set([...astMatches.map(m => m.file), ...llmMatches.map(m => m.file)])

    for (const filePath of allFiles) {
      const astMatch = astMatches.find(m => m.file === filePath)
      const llmMatch = llmMatches.find(m => m.file === filePath)

      // Normalize scores to be on the same scale (0 to 1)
      const normalizedAstScore = astMatch ? astMatch.score / maxAstScore : 0
      const llmScore = llmMatch ? llmMatch.score : 0

      const hasSynergy = !!(astMatch && llmMatch)
      
      // Calculate the base weighted average score
      let finalScore = (normalizedAstScore * astWeight) + (llmScore * llmWeight)

      // Apply a powerful synergy boost if both "detectives" found the file
      if (hasSynergy) {
        finalScore *= synergyMultiplier
      }

      fileMap.set(filePath, {
        file: filePath,
        finalScore: Math.min(finalScore, 5), // Cap the final score to prevent runaway values
        astScore: normalizedAstScore,
        llmScore: llmScore,
        hasSynergy,
        matches: astMatch?.matches || []
      })
    }

    return Array.from(fileMap.values()).sort((a, b) => b.finalScore - a.finalScore)
  }


  // ===== TRI-MODEL SEARCH WITH ENTRY POINT ANALYSIS =====

  // Enhanced search with entry point context and Flan-T5 reasoning
  const performTriModelSearch = async (
    keyword: string,
    files: Array<{ path: string; content: string }>,
    entryPointFile?: { path: string; content: string }
  ): Promise<KeywordSearchSuggestion> => {
    // Check if we need to generate embeddings on-demand
    const needsEmbeddings = fileEmbeddings.value.size === 0 && files.length > 0
    if (needsEmbeddings) {
      announceStatus('Generating semantic embeddings...')
      await generateEmbeddingsOnDemand(files)
    }
    
    // Parse entry point if provided
    let entryPointInfo: RegexParsedCodeInfo | null = null
    if (entryPointFile) {
      try {
        entryPointInfo = await parseCode(entryPointFile.content, entryPointFile.path)
      } catch (error) {
        logger.warn(`Failed to parse entry point file ${entryPointFile.path}:`, error)
        // Continue without entry point analysis
      }
    }
    
    // Stage 1: Structure/Syntax Search
    const astMatches = performStructureSearch(keyword, files)
    
    // Stage 2: Semantic Embeddings Search
    const llmMatches = await performLLMSearch(keyword, files)
    
    // Stage 3: Enhanced Relationship Analysis
    const syntaxResults = await performEntryPointSyntaxAnalysis(files, entryPointInfo)
    
    // Stage 4: Embedding-based Classification and Scoring
    const classificationResults = await performEmbeddingBasedClassification(keyword, files, entryPointFile, syntaxResults)
    
    // Stage 5: Combine all scores with tri-model weighting
    const triModelMatches = combineTriModelResults(
      astMatches, 
      llmMatches, 
      syntaxResults, 
      classificationResults, 
      entryPointFile
    )
    
    return {
      id: `tri-model-search-${keyword.replace(/[^a-zA-Z0-9]/g, '_')}`,
      type: 'keywordSearch',
      title: `AI-Powered Search Results for "${keyword}"`,
      description: `Found ${triModelMatches.length} relevant files using tri-model analysis (Syntax + Semantic + Embedding Classification)`,
      confidence: Math.min(triModelMatches.length * 0.1, 1.0),
      data: {
        keyword,
        files: triModelMatches.slice(0, 20) // Top 20 results
      }
    }
  }

  // Enhanced syntax analysis - find file relationships with or without entry point
  const performEntryPointSyntaxAnalysis = async (
    files: Array<{ path: string; content: string }>,
    entryPointInfo: RegexParsedCodeInfo | null
  ): Promise<Map<string, number>> => {
    const syntaxScores = new Map<string, number>()
    
    // Parse all files first to get their structure
    const fileInfos = new Map<string, RegexParsedCodeInfo>()
    for (const file of files) {
      try {
        const fileInfo = codeInfoCache.value.get(file.path) || await parseCode(file.content, file.path)
        if (fileInfo) {
          codeInfoCache.value.set(file.path, fileInfo)
          fileInfos.set(file.path, fileInfo)
        }
      } catch (error) {
        logger.warn(`Failed to parse ${file.path} for syntax analysis:`, error)
        // Continue without this file's parsing info
      }
    }
    
    if (!entryPointInfo) {
      // No entry point specified - perform inter-file relationship analysis
      return await analyzeInterFileRelationships(files, fileInfos)
    }
    
    // Entry point specified - use enhanced analysis
    
    // Get all imported modules from entry point
    const importedModules = new Set(entryPointInfo.imports.map(imp => imp.module))
    const exportedFunctions = new Set(entryPointInfo.exports.map(exp => exp.name))
    const entryPointFunctions = new Set(entryPointInfo.functions.map(func => func.name))
    
    for (const file of files) {
      let score = 0
      
      const fileInfo = fileInfos.get(file.path)
      if (fileInfo) {
        // Score based on import relationships
        const fileImports = new Set(fileInfo.imports.map(imp => imp.module))
        const fileExports = new Set(fileInfo.exports.map(exp => exp.name))
        const fileFunctions = new Set(fileInfo.functions.map(func => func.name))
        
        // Direct import relationship (entry point imports this file or vice versa)
        if (importedModules.has(file.path) || fileImports.has(entryPointInfo.imports[0]?.module)) {
          score += 0.8
        }
        
        // Function name matches (entry point calls functions in this file)
        const functionOverlap = [...entryPointFunctions].filter(func => fileFunctions.has(func))
        if (functionOverlap.length > 0) {
          score += functionOverlap.length * 0.3
        }
        
        // Export/import matching (this file exports what entry point might use)
        const exportImportMatch = [...fileExports].filter(exp => entryPointFunctions.has(exp))
        if (exportImportMatch.length > 0) {
          score += exportImportMatch.length * 0.4
        }
      }
      
      syntaxScores.set(file.path, Math.min(score, 1.0))
    }
    
    // Get base inter-file relationship scores for all files
    const baseRelationshipScores = await analyzeInterFileRelationships(files, fileInfos)
    
    // Enhance entry point scores with base relationship scores
    for (const [filePath, entryPointScore] of syntaxScores) {
      const baseScore = baseRelationshipScores.get(filePath) || 0
      // Entry point gets 70% weight, base relationships get 30% weight
      const combinedScore = (entryPointScore * 0.7) + (baseScore * 0.3)
      syntaxScores.set(filePath, Math.min(combinedScore, 1.0))
    }
    
    return syntaxScores
  }

  // Analyze inter-file relationships without entry point
  const analyzeInterFileRelationships = async (
    files: Array<{ path: string; content: string }>,
    fileInfos: Map<string, RegexParsedCodeInfo>
  ): Promise<Map<string, number>> => {
    const syntaxScores = new Map<string, number>()
    
    // Build a global index of imports, exports, and functions across all files
    const globalExports = new Map<string, string[]>() // module -> exported functions
    const globalImports = new Map<string, string[]>() // file -> imported modules
    const globalFunctions = new Map<string, string[]>() // file -> function names
    
    // First pass: collect all imports, exports, and functions
    for (const [filePath, fileInfo] of fileInfos) {
      // Track what this file exports
      const exports = fileInfo.exports.map(exp => exp.name)
      if (exports.length > 0) {
        globalExports.set(filePath, exports)
      }
      
      // Track what this file imports
      const imports = fileInfo.imports.map(imp => imp.module)
      if (imports.length > 0) {
        globalImports.set(filePath, imports)
      }
      
      // Track functions in this file
      const functions = fileInfo.functions.map(func => func.name)
      if (functions.length > 0) {
        globalFunctions.set(filePath, functions)
      }
    }
    
    // Second pass: calculate relationship scores for each file
    for (const file of files) {
      let score = 0
      const fileInfo = fileInfos.get(file.path)
      
      if (!fileInfo) {
        syntaxScores.set(file.path, 0)
        continue
      }
      
      const fileImports = globalImports.get(file.path) || []
      const fileExports = globalExports.get(file.path) || []
      const fileFunctions = globalFunctions.get(file.path) || []
      
      // Score 1: Import/Export Centrality
      // Files that are imported by many other files are likely important
      let importedByCount = 0
      for (const [otherFile, otherImports] of globalImports) {
        if (otherFile !== file.path && otherImports.includes(file.path)) {
          importedByCount++
        }
      }
      if (importedByCount > 0) {
        score += Math.min(importedByCount * 0.2, 0.6) // Max 0.6 for being imported
      }
      
      // Score 2: Function Name Patterns
      // Files with functions that have similar names to the search keyword get boosted
      const commonPrefixes = ['get', 'set', 'create', 'delete', 'update', 'handle', 'process', 'validate']
      const hasCommonPatterns = fileFunctions.some(func => 
        commonPrefixes.some(prefix => func.toLowerCase().startsWith(prefix))
      )
      if (hasCommonPatterns) {
        score += 0.2
      }
      
      // Score 3: Shared Dependencies
      // Files that import similar modules are likely related
      let sharedDependencyScore = 0
      for (const [otherFile, otherImports] of globalImports) {
        if (otherFile !== file.path) {
          const sharedImports = fileImports.filter(imp => otherImports.includes(imp))
          if (sharedImports.length > 0) {
            sharedDependencyScore += sharedImports.length * 0.1
          }
        }
      }
      score += Math.min(sharedDependencyScore, 0.4) // Max 0.4 for shared dependencies
      
      // Score 4: Directory Proximity
      // Files in related directories (e.g., same parent folder) are likely related
      const fileParts = file.path.split('/')
      const directoryDepth = fileParts.length
      if (directoryDepth > 1) {
        const parentDir = fileParts[fileParts.length - 2]
        // Files in 'components', 'utils', 'services' directories get slight boost
        const importantDirs = ['components', 'composables', 'utils', 'services', 'stores', 'api']
        if (importantDirs.includes(parentDir.toLowerCase())) {
          score += 0.15
        }
      }
      
      // Score 5: File Size Heuristic
      // Files with more functions are potentially more important
      if (fileFunctions.length > 3) {
        score += Math.min(fileFunctions.length * 0.05, 0.25) // Max 0.25 boost
      }
      
      syntaxScores.set(file.path, Math.min(score, 1.0))
    }
    
    // Statistics available for debugging if needed
    const avgScore = Array.from(syntaxScores.values()).reduce((a, b) => a + b, 0) / syntaxScores.size
    const filesWithScores = Array.from(syntaxScores.values()).filter(score => score > 0).length
    
    return syntaxScores
  }

  // Embedding-based classification to replace Flan-T5 functionality
  const performEmbeddingBasedClassification = async (
    keyword: string,
    files: Array<{ path: string; content: string }>,
    entryPointFile?: { path: string; content: string },
    syntaxResults?: Map<string, number>
  ): Promise<Map<string, { score: number; classification: string; workflowPosition: string; relevantFunctions?: Array<{ name: string; relevance: number; reason?: string }> }>> => {
    const classificationResults = new Map<string, { score: number; classification: string; workflowPosition: string; relevantFunctions?: Array<{ name: string; relevance: number; reason?: string }> }>()
    
    try {
      // Check if embeddings model is available
      if (!$llm?.engine || $llm?.status !== 'ready') {
        logger.warn('Embeddings model not available for classification')
        files.forEach(file => {
          classificationResults.set(file.path, { score: 0, classification: 'unknown', workflowPosition: 'unknown' })
        })
        return classificationResults
      }
      
      // Pre-computed embeddings for classification categories
      // These represent typical patterns for each file type
      const classificationEmbeddings = new Map<string, number[]>()
      
      // Generate embeddings for classification categories
      const classifications = {
        'entry-point': 'main entry application startup initialization bootstrap router controller endpoint',
        'core-logic': 'business logic core functionality algorithm processing computation service',
        'helper': 'utility helper utils common shared tools lib library',
        'config': 'configuration settings options environment variables constants',
        'unrelated': 'test spec documentation readme example demo'
      }
      
      // Generate embeddings for each classification
      for (const [classification, keywords] of Object.entries(classifications)) {
        if (typeof $llm.engine === 'function') {
          const embedding = await $llm.engine(keywords, { pooling: 'mean', normalize: true })
          classificationEmbeddings.set(classification, embedding.data)
        }
      }
      
      // Workflow position embeddings
      const workflowEmbeddings = new Map<string, number[]>()
      const workflowPositions = {
        'upstream': 'input source beginning start initial data entry request',
        'downstream': 'output result final end response return completion',
        'parallel': 'concurrent async parallel independent side branch',
        'unrelated': 'separate independent disconnected isolated unconnected'
      }
      
      // Generate embeddings for workflow positions
      for (const [position, keywords] of Object.entries(workflowPositions)) {
        if (typeof $llm.engine === 'function') {
          const embedding = await $llm.engine(keywords, { pooling: 'mean', normalize: true })
          workflowEmbeddings.set(position, embedding.data)
        }
      }
      
      // Process all files
      for (const file of files) {
        try {
          // Get basic file info
          const fileInfo = codeInfoCache.value.get(file.path)
          const fileName = file.path.split('/').pop() || ''
          const fileExtension = fileName.split('.').pop() || ''
          const filePath = file.path.toLowerCase()
          
          // Create a content representation for embedding
          const functions = fileInfo?.functions.map(f => f.name).join(' ') || ''
          const imports = fileInfo?.imports.map(i => i.module).join(' ') || ''
          const exports = fileInfo?.exports.map(e => e.name).join(' ') || ''
          
          // Generate embedding for the file context
          const fileContext = `${fileName} ${filePath} ${functions} ${imports} ${exports} ${file.content.substring(0, 500)}`
          let fileEmbedding: number[] = []
          
          if (typeof $llm.engine === 'function') {
            const embeddingResult = await $llm.engine(fileContext, { pooling: 'mean', normalize: true })
            fileEmbedding = embeddingResult.data
          }
          
          // Classify the file by finding the most similar classification
          let classification = 'unknown'
          let maxClassificationSimilarity = -1
          
          // Special case: entry point file
          if (entryPointFile && file.path === entryPointFile.path) {
            classification = 'entry-point'
          } else {
            for (const [category, categoryEmbedding] of classificationEmbeddings) {
              // Skip entry-point classification for non-entry files
              if (category === 'entry-point') continue
              
              const similarity = cosineSimilarity(fileEmbedding, categoryEmbedding)
              if (similarity > maxClassificationSimilarity) {
                maxClassificationSimilarity = similarity
                classification = category
              }
            }
          }
          
          // Determine workflow position
          let workflowPosition = 'unknown'
          let maxWorkflowSimilarity = -1
          
          for (const [position, positionEmbedding] of workflowEmbeddings) {
            const similarity = cosineSimilarity(fileEmbedding, positionEmbedding)
            if (similarity > maxWorkflowSimilarity) {
              maxWorkflowSimilarity = similarity
              workflowPosition = position
            }
          }
            
            // Calculate relevance score based on classification and syntax
            let relevanceScore = 0
            const syntaxScore = syntaxResults?.get(file.path) || 0
            
            switch (classification) {
              case 'entry-point':
                relevanceScore = 0.9
                break
              case 'core-logic':
                relevanceScore = 0.8
                break
              case 'helper':
                relevanceScore = 0.6
                break
              case 'config':
                relevanceScore = 0.4
                break
              default:
                relevanceScore = 0.2
            }
            
            // Boost score based on workflow position
            if (workflowPosition === 'downstream' || workflowPosition === 'upstream') {
              relevanceScore += 0.2
            } else if (workflowPosition === 'parallel') {
              relevanceScore += 0.1
            }
            
            // Combine with syntax score
            const finalScore = Math.min((relevanceScore * 0.7) + (syntaxScore * 0.3), 1.0)
            
            // Analyze relevant functions using embeddings
            let relevantFunctions: Array<{ name: string; relevance: number; reason?: string }> = []
            
            if (fileInfo?.functions && fileInfo.functions.length > 0 && classification !== 'unrelated') {
              try {
                // Generate embedding for the search keyword
                let keywordEmbedding: number[] = []
                if (typeof $llm.engine === 'function') {
                  const embeddingResult = await $llm.engine(keyword, { pooling: 'mean', normalize: true })
                  keywordEmbedding = embeddingResult.data
                }
                
                // Score each function's relevance
                for (const funcInfo of fileInfo.functions.slice(0, 40)) {
                  const funcName = funcInfo.name
                  
                  // Generate embedding for function context
                  const funcContext = `function ${funcName} ${funcInfo.name.replace(/([A-Z])/g, ' $1').toLowerCase()}`
                  let funcEmbedding: number[] = []
                  
                  if (typeof $llm.engine === 'function') {
                    const embeddingResult = await $llm.engine(funcContext, { pooling: 'mean', normalize: true })
                    funcEmbedding = embeddingResult.data
                  }
                  
                  // Calculate semantic similarity
                  const semanticSimilarity = cosineSimilarity(keywordEmbedding, funcEmbedding)
                  
                  // Calculate function-specific relevance
                  let funcRelevance = semanticSimilarity * 0.7 // Base on semantic similarity
                  
                  // Boost if function name contains keyword
                  if (funcName.toLowerCase().includes(keyword.toLowerCase())) {
                    funcRelevance += 0.3
                  }
                  
                  // Only include functions with reasonable relevance
                  if (funcRelevance > 0.3) {
                    relevantFunctions.push({
                      name: funcName,
                      startLine: funcInfo.startLine,
                      endLine: funcInfo.endLine,
                      relevance: Math.min(funcRelevance, 1.0),
                      reason: `Semantically related to ${keyword}`,
                      type: 'function'
                    })
                  }
                }
                
                // Sort by relevance and keep top 5
                relevantFunctions.sort((a, b) => b.relevance - a.relevance)
                relevantFunctions = relevantFunctions.slice(0, 5)
              } catch (funcError) {
                // Function analysis failed - continue without function details
                logger.warn('Function analysis failed:', funcError)
              }
            }
            
            classificationResults.set(file.path, {
              score: finalScore,
              classification,
              workflowPosition,
              relevantFunctions: relevantFunctions.length > 0 ? relevantFunctions : undefined
            })
            
          } catch (error) {
            logger.warn(`Embedding-based classification failed for ${file.path}:`, error)
            classificationResults.set(file.path, { score: 0, classification: 'unknown', workflowPosition: 'unknown' })
          }
        }
      
    } catch (error) {
      logger.error('Embedding-based classification failed:', error)
      files.forEach(file => {
        classificationResults.set(file.path, { score: 0, classification: 'error', workflowPosition: 'error' })
      })
    }
    
    return classificationResults
  }


  // Combine tri-model results with intelligent weighting
  const combineTriModelResults = (
    astMatches: ASTMatch[],
    llmMatches: LLMMatch[],
    syntaxResults: Map<string, number>,
    classificationResults: Map<string, { score: number; classification: string; workflowPosition: string; relevantFunctions?: Array<{ name: string; relevance: number; reason?: string }> }>,
    entryPointFile?: { path: string; content: string }
  ): Array<{
    file: string
    finalScore: number
    scorePercentage: number
    astScore: number
    llmScore: number
    flanScore: number
    syntaxScore: number
    hasSynergy: boolean
    matches: string[]
    classification?: string
    workflowPosition?: string
    relevantFunctions?: RelevantFunction[]
  }> => {
    const fileMap = new Map()
    
    // Get all unique files
    const allFiles = new Set([
      ...astMatches.map(m => m.file),
      ...llmMatches.map(m => m.file),
      ...Array.from(syntaxResults.keys()),
      ...Array.from(classificationResults.keys())
    ])
    
    // Find max scores for normalization
    const maxAstScore = Math.max(...astMatches.map(m => m.score), 1)
    const maxLlmScore = Math.max(...llmMatches.map(m => m.score), 1)
    
    for (const filePath of allFiles) {
      const astMatch = astMatches.find(m => m.file === filePath)
      const llmMatch = llmMatches.find(m => m.file === filePath)
      const syntaxScore = syntaxResults.get(filePath) || 0
      const classificationResult = classificationResults.get(filePath) || { score: 0, classification: 'unknown', workflowPosition: 'unknown' }
      
      // Normalize scores
      const normalizedAstScore = astMatch ? astMatch.score / maxAstScore : 0
      const normalizedLlmScore = llmMatch ? llmMatch.score / maxLlmScore : 0
      const normalizedSyntaxScore = syntaxScore
      const normalizedClassificationScore = classificationResult.score
      
      // Enhanced synergy detection
      const hasBasicSynergy = !!(astMatch && llmMatch)
      const hasFullSynergy = !!(astMatch && llmMatch && syntaxScore > 0.3 && classificationResult.score > 0.5)
      
      // Tri-model weighted scoring
      let finalScore = (
        normalizedAstScore * 0.25 +      // Structure matches
        normalizedLlmScore * 0.35 +      // Semantic similarity
        normalizedSyntaxScore * 0.15 +   // Entry point relationships
        normalizedClassificationScore * 0.25       // Embedding-based classification and workflow
      )
      
      // Apply synergy multipliers
      if (hasFullSynergy) {
        finalScore *= 1.8  // Strong boost for full synergy
      } else if (hasBasicSynergy) {
        finalScore *= 1.4  // Moderate boost for basic synergy
      }
      
      // Entry point boost - prioritize the entry point file itself
      if (entryPointFile && filePath === entryPointFile.path) {
        finalScore *= 1.5
      }
      
      // Calculate percentage (cap at 100%)
      const scorePercentage = Math.min(Math.round(finalScore * 100), 100)
      
      fileMap.set(filePath, {
        file: filePath,
        finalScore,
        scorePercentage,
        astScore: normalizedAstScore,
        llmScore: normalizedLlmScore,
        flanScore: normalizedClassificationScore,
        syntaxScore: normalizedSyntaxScore,
        hasSynergy: hasBasicSynergy,
        matches: astMatch?.matches || [],
        classification: classificationResult.classification,
        workflowPosition: classificationResult.workflowPosition,
        relevantFunctions: classificationResult.relevantFunctions
      })
    }
    
    // Sort by final score descending
    return Array.from(fileMap.values()).sort((a, b) => b.finalScore - a.finalScore)
  }

  // Generate embeddings on-demand for search
  const generateEmbeddingsOnDemand = async (files: Array<{ path: string; content: string }>): Promise<void> => {
    if (!$llm?.engine || $llm?.status !== 'ready') {
      logger.warn('LLM not available for embedding generation')
      return
    }

    try {
      // Initialize IndexedDB for caching
      const dbInitialized = await initDB()
      if (dbInitialized) {
        await cleanOldCache()
      }

      let embeddingsCacheHits = 0
      let embeddingsGenerated = 0
      
      for (let i = 0; i < files.length; i++) {
        const file = files[i]
        
        try {
          // Calculate file hash for caching
          const fileHash = await calculateHash(file.content)
          
          // Check for cached embedding
          let embedding: number[] | null = null
          if (dbInitialized) {
            embedding = await getCachedEmbedding(file.path, fileHash)
            if (embedding) {
              embeddingsCacheHits++
              fileEmbeddings.value.set(file.path, embedding)
              continue
            }
          }

          // Generate new embedding
          const searchableContent = `${file.path} ${file.content.substring(0, 1000)}`
          const codeSample = searchableContent.substring(0, 3000)
          
          if (typeof $llm.engine === 'function') {
            const embeddingResult = await $llm.engine(codeSample, {
              pooling: 'mean',
              normalize: true
            })
            
            embedding = embeddingResult.data
            if (embedding) {
              fileEmbeddings.value.set(file.path, embedding)
              embeddingsGenerated++
              
              // Cache the new embedding
              if (dbInitialized) {
                await storeCachedEmbedding(file.path, fileHash, embedding)
              }
            }
          }
        } catch (error) {
          logger.warn(`Failed to generate embedding for ${file.path}:`, error)
        }
      }
      
      // Store project-level embeddings cache if any embeddings were generated
      if (embeddingsGenerated > 0 && dbInitialized && fileEmbeddings.value.size > 0) {
        try {
          const projectHash = await calculateProjectHash(files)
          const fileEmbeddingsRecord: Record<string, number[]> = {}
          
          for (const [filePath, embedding] of fileEmbeddings.value.entries()) {
            fileEmbeddingsRecord[filePath] = embedding
          }
          
          await storeCachedProjectEmbeddings(projectHash, fileEmbeddingsRecord)
        } catch (error) {
          logger.warn('Failed to store project-level embeddings cache:', error)
        }
      }
      
      announceStatus(`Generated semantic embeddings for ${fileEmbeddings.value.size} files`)
      
    } catch (error) {
      logger.error('On-demand embedding generation failed:', error)
      announceStatus('Failed to generate embeddings for semantic search')
    }
  }


  // Utility function for cosine similarity
  const cosineSimilarity = (A: number[], B: number[]): number => {
    let dotProduct = 0, normA = 0, normB = 0
    for (let i = 0; i < A.length; i++) {
      dotProduct += A[i] * B[i]
      normA += A[i] * A[i]
      normB += B[i] * B[i]
    }
    if (normA === 0 || normB === 0) return 0
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB))
  }


  // ===== UTILITY METHODS =====

  const resolveImportPath = (
    importModule: string,
    fromFile: string,
    files: Array<{ path: string; content: string }>
  ): string | null => {
    // Simple resolution - could be enhanced
    const possiblePaths = [
      importModule,
      `${importModule}.js`,
      `${importModule}.ts`,
      `${importModule}/index.js`,
      `${importModule}/index.ts`
    ]

    for (const path of possiblePaths) {
      if (files.some(f => f.path.endsWith(path))) {
        return files.find(f => f.path.endsWith(path))?.path || null
      }
    }

    return null
  }


  // Clear all analysis state (for project switches)
  const clearAnalysisState = () => {
    codeInfoCache.value.clear()
    dependencyGraph.value.clear()
    fileEmbeddings.value.clear()
    hasLoadedFromCache.value = false
  }

  // Load cached embeddings on startup for search functionality
  const loadCachedEmbeddings = async (
    files: Array<{ path: string; content: string }>
  ): Promise<boolean> => {
    try {
      const dbInitialized = await initDB()
      if (!dbInitialized) return false

      const projectHash = await calculateProjectHash(files)
      const cachedEmbeddings = await getCachedProjectEmbeddings(projectHash)
      
      if (cachedEmbeddings) {
        // Restore embeddings for semantic search
        fileEmbeddings.value.clear()
        for (const [filePath, embedding] of Object.entries(cachedEmbeddings.fileEmbeddings)) {
          fileEmbeddings.value.set(filePath, embedding)
        }
        
        hasLoadedFromCache.value = true
        return true
      }
      
      return false
    } catch (error) {
      logger.warn('Failed to load cached embeddings:', error)
      return false
    }
  }

  const clearCache = () => {
    codeInfoCache.value.clear()
    dependencyGraph.value.clear()
    fileEmbeddings.value.clear()
    hasLoadedFromCache.value = false
  }

  // Debug function to check current state
  const debugCurrentState = () => {
    logger.log('🔍 Current Analysis State:')
    logger.log(`  - File embeddings: ${fileEmbeddings.value.size}`)
    logger.log(`  - Has loaded from cache: ${hasLoadedFromCache.value}`)
    logger.log(`  - LLM status: ${$llm?.status}`)
    logger.log(`  - LLM engine: ${typeof $llm?.engine}`)
    
    if (fileEmbeddings.value.size > 0) {
      const firstFile = Array.from(fileEmbeddings.value.keys())[0]
      const firstEmbedding = fileEmbeddings.value.get(firstFile)
      logger.log(`  - Sample embedding: ${firstFile} (${firstEmbedding?.length} dims)`)
    }
  }

  // Clear IndexedDB cache completely
  const clearIndexedDBCache = async () => {
    try {
      const dbInitialized = await initDB()
      if (dbInitialized) {
        // Clear all cached data
        await cleanOldCache(0) // Force clean all by setting maxAge to 0
      }
    } catch (error) {
      logger.error('Failed to clear IndexedDB cache:', error)
    }
  }

  // Force re-embedding with current project files
  const forceReembedding = async () => {
    try {
      // Clear both in-memory and IndexedDB cache
      clearCache()
      await clearIndexedDBCache()
    } catch (error) {
      logger.error('Failed to force re-embedding:', error)
    }
  }

  const forceReembeddingWithFiles = async (files: Array<{ path: string; content: string }>) => {
    try {
      clearCache()
      await generateEmbeddingsOnDemand(files)
    } catch (error) {
      logger.error('Failed to re-embed:', error)
    }
  }

  // Expose debug functions globally for console access
  if (typeof window !== 'undefined') {
    (window as any).debugSmartSuggestions = {
      debugState: debugCurrentState,
      clearCache,
      clearIndexedDBCache,
      forceReembedding,
      forceReembeddingWithFiles,
      getEmbeddingsCount: () => fileEmbeddings.value.size,
    }
  }

  return {
    // State
    isAnalyzing: readonly(isAnalyzing),
    analysisProgress: readonly(analysisProgress),
    hasLoadedFromCache: readonly(hasLoadedFromCache),
    
    // Methods
    loadCachedAnalysis,
    performTriModelSearch,
    generateEmbeddingsOnDemand,
    loadCachedEmbeddings,
    clearCache,
    clearAnalysisState,
    clearIndexedDBCache,
    debugCurrentState,
    
    // Expose for debugging
    codeInfoCache: readonly(codeInfoCache),
    dependencyGraph: readonly(dependencyGraph),
    fileEmbeddings: readonly(fileEmbeddings)
  }
} 