/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

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
      if (loaded) {
        console.log('🎯 Loaded cached embeddings successfully')
      }
      
      // Build AST analysis for search (always needed for current session)
      const supportedFiles = files.filter(file => isLanguageSupported(file.path))
      const total = supportedFiles.length
      
      console.log(`Building AST analysis for ${total} supported files...`)
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
          console.warn(`Failed to parse ${file.path}:`, error)
        }
        
        analysisProgress.value = ((i + 1) / total) * 100
      }

      // Build dependency graph for search
      buildDependencyGraph(supportedFiles)
      
      announceStatus(`Analysis complete. Ready for search.`)
      console.log('Project analysis complete')
      
    } catch (error) {
      console.error('Project analysis failed:', error)
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
    console.log(`🔍 LLM Search Debug: keyword="${keyword}", engine=${typeof $llm?.engine}, status=${$llm?.status}`)
    
    if (!$llm?.engine || $llm?.status !== 'ready') {
      console.warn(`LLM not available for semantic search: engine=${typeof $llm?.engine}, status=${$llm?.status}`)
      return []
    }

    try {
      console.log(`🧠 Generating query embedding for: "${keyword}"`)
      
      // Generate query embedding for the search keyword
      if (typeof $llm.engine === 'function') {
        const queryEmbedding = await $llm.engine(keyword, { 
          pooling: 'mean', 
          normalize: true 
        })

        console.log(`✅ Query embedding generated: ${queryEmbedding.data.length} dimensions`)
        console.log(`📊 Available file embeddings: ${fileEmbeddings.value.size}`)

        const llmMatches: LLMMatch[] = []

        // Calculate semantic similarity for each file
        let processedFiles = 0;
        for (const file of files) {
          const fileEmbedding = fileEmbeddings.value.get(file.path)
          
          if (fileEmbedding) {
            processedFiles++;
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
              console.debug('Filename embedding failed, using content similarity only')
            }
            
            // Log high similarity matches for debugging
            if (similarity > 0.3) {
              console.log(`🎯 High similarity match: ${file.path} (${similarity.toFixed(3)})`)
            }
            
            llmMatches.push({
              file: file.path,
              score: similarity,
              embedding: fileEmbedding
            })
          }
        }

        console.log(`📈 LLM Search Results: processed ${processedFiles} files with embeddings, found ${llmMatches.length} matches`)
        if (llmMatches.length > 0) {
          const topScore = llmMatches[0]?.score || 0;
          console.log(`🏆 Top similarity score: ${topScore.toFixed(3)}`)
        }

        return llmMatches.sort((a, b) => b.score - a.score)
      } else {
        console.warn('LLM engine is not available for semantic search')
        return []
      }
    } catch (error) {
      console.error('LLM search failed:', error)
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

  // Main hybrid search function
  const performHybridKeywordSearch = async (
    keyword: string,
    files: Array<{ path: string; content: string }>
  ): Promise<KeywordSearchSuggestion> => {
    console.log(`🔍 Starting hybrid search for keyword: "${keyword}"`)
    
    // Check if we need to generate embeddings on-demand
    const needsEmbeddings = fileEmbeddings.value.size === 0 && files.length > 0
    if (needsEmbeddings) {
      console.log('📊 No embeddings found, generating on-demand for semantic search...')
      announceStatus('Generating semantic embeddings for first search...')
      await generateEmbeddingsOnDemand(files)
    }
    
    // Stage 1: Structure Search
    console.log('🕵️ Detective By-the-Book (Structure) investigating...')
    const astMatches = performStructureSearch(keyword, files)
    console.log(`Found ${astMatches.length} literal matches`)

    // Stage 2: LLM Search
    console.log('🧠 Detective Insight (LLM) investigating...')
    const llmMatches = await performLLMSearch(keyword, files)
    console.log(`Found ${llmMatches.length} semantic matches`)

    // Stage 3: Combine with synergy
    console.log('⚡ Combining results with synergy boost...')
    const hybridMatches = combineSearchResults(astMatches, llmMatches)
    const synergyCount = hybridMatches.filter(m => m.hasSynergy).length
    console.log(`Final results: ${hybridMatches.length} files, ${synergyCount} with synergy boost`)

    return {
      id: `keyword-search-${keyword.replace(/[^a-zA-Z0-9]/g, '_')}`,
      type: 'keywordSearch',
      title: `Hybrid Search Results for "${keyword}"`,
      description: `Found ${hybridMatches.length} relevant files using AST + LLM analysis`,
      confidence: Math.min(hybridMatches.length * 0.1, 1.0),
      data: {
        keyword,
        files: hybridMatches.slice(0, 20) // Top 20 results
      }
    }
  }

  // ===== TRI-MODEL SEARCH WITH ENTRY POINT ANALYSIS =====

  // Enhanced search with entry point context and Flan-T5 reasoning
  const performTriModelSearch = async (
    keyword: string,
    files: Array<{ path: string; content: string }>,
    entryPointFile?: { path: string; content: string }
  ): Promise<KeywordSearchSuggestion> => {
    console.log(`🚀 Starting tri-model search for keyword: "${keyword}"`)
    if (entryPointFile) {
      console.log(`📍 Starting point: ${entryPointFile.path}`)
    }
    
    // Check if we need to generate embeddings on-demand
    const needsEmbeddings = fileEmbeddings.value.size === 0 && files.length > 0
    if (needsEmbeddings) {
      console.log('📊 Generating embeddings for tri-model search...')
      announceStatus('Generating semantic embeddings...')
      await generateEmbeddingsOnDemand(files)
    }
    
    // Parse entry point if provided
    let entryPointInfo: RegexParsedCodeInfo | null = null
    if (entryPointFile) {
      console.log('🔍 Parsing starting point for dependency analysis...')
      entryPointInfo = await parseCode(entryPointFile.content, entryPointFile.path)
    }
    
    // Stage 1: Structure/Syntax Search
    console.log('🕵️ Stage 1: Structure Analysis...')
    const astMatches = performStructureSearch(keyword, files)
    
    // Stage 2: Semantic Embeddings Search
    console.log('🧠 Stage 2: Semantic Analysis...')
    const llmMatches = await performLLMSearch(keyword, files)
    
    // Stage 3: Enhanced Relationship Analysis
    console.log('📊 Stage 3: Enhanced Relationship Analysis...')
    const syntaxResults = await performEntryPointSyntaxAnalysis(files, entryPointInfo)
    
    // Stage 4: Flan-T5 Classification and Scoring
    console.log('🤖 Stage 4: AI Classification and Scoring...')
    const flanResults = await performFlanT5Analysis(keyword, files, entryPointFile, syntaxResults)
    
    // Stage 5: Combine all scores with tri-model weighting
    console.log('⚡ Stage 5: Combining tri-model results...')
    const triModelMatches = combineTriModelResults(
      astMatches, 
      llmMatches, 
      syntaxResults, 
      flanResults, 
      entryPointFile
    )
    
    console.log(`🎯 Final tri-model results: ${triModelMatches.length} files analyzed`)
    
    return {
      id: `tri-model-search-${keyword.replace(/[^a-zA-Z0-9]/g, '_')}`,
      type: 'keywordSearch',
      title: `AI-Powered Search Results for "${keyword}"`,
      description: `Found ${triModelMatches.length} relevant files using tri-model analysis (Syntax + Semantic + AI Classification)`,
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
      const fileInfo = codeInfoCache.value.get(file.path) || await parseCode(file.content, file.path)
      if (fileInfo) {
        codeInfoCache.value.set(file.path, fileInfo)
        fileInfos.set(file.path, fileInfo)
      }
    }
    
    if (!entryPointInfo) {
      // No entry point specified - perform inter-file relationship analysis
      console.log('📊 Performing inter-file relationship analysis (no entry point)')
      return await analyzeInterFileRelationships(files, fileInfos)
    }
    
    // Entry point specified - use enhanced analysis
    console.log('📊 Performing entry-point-enhanced relationship analysis')
    
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
    
    // Log some statistics
    const avgScore = Array.from(syntaxScores.values()).reduce((a, b) => a + b, 0) / syntaxScores.size
    const filesWithScores = Array.from(syntaxScores.values()).filter(score => score > 0).length
    console.log(`📈 Inter-file analysis: ${filesWithScores}/${files.length} files scored, avg: ${avgScore.toFixed(3)}`)
    
    return syntaxScores
  }

  // Flan-T5 analysis for classification and workflow understanding
  const performFlanT5Analysis = async (
    keyword: string,
    files: Array<{ path: string; content: string }>,
    entryPointFile?: { path: string; content: string },
    syntaxResults?: Map<string, number>
  ): Promise<Map<string, { score: number; classification: string; workflowPosition: string; relevantFunctions?: Array<{ name: string; relevance: number; reason?: string }> }>> => {
    const flanResults = new Map<string, { score: number; classification: string; workflowPosition: string; relevantFunctions?: Array<{ name: string; relevance: number; reason?: string }> }>()
    
    try {
      // Get the text generation model
      const { $llm } = useNuxtApp()
      const textGenModel = await $llm?.getModel?.('textGeneration')
      if (!textGenModel) {
        console.warn('Flan-T5 model not available, skipping AI analysis')
        files.forEach(file => {
          flanResults.set(file.path, { score: 0, classification: 'unknown', workflowPosition: 'unknown' })
        })
        return flanResults
      }
      
      // Process files in batches to avoid overwhelming the model
      const batchSize = 5
      for (let i = 0; i < files.length; i += batchSize) {
        const batch = files.slice(i, i + batchSize)
        
        for (const file of batch) {
          try {
            // Get basic file info
            const fileInfo = codeInfoCache.value.get(file.path)
            const fileName = file.path.split('/').pop() || ''
            const functions = fileInfo?.functions.map(f => f.name).slice(0, 5).join(', ') || 'none'
            const imports = fileInfo?.imports.map(i => i.module).slice(0, 3).join(', ') || 'none'
            
            let classification: string
            
            // If this is the actual selected entry point file, mark it as such
            if (entryPointFile && file.path === entryPointFile.path) {
              classification = 'entry-point'
            } else {
              // For other files, use AI classification but exclude 'entry-point' as an option
              const classificationPrompt = `Entry point file: ${entryPointFile?.path || 'none'} handles "${keyword}"
Current file: ${fileName} at ${file.path}
Functions: ${functions}
Imports: ${imports}
Classify this file's role as: core-logic, helper, config, or unrelated`
              
              const classificationResult = await textGenModel(classificationPrompt)
              classification = extractClassification(classificationResult)
              
              // Ensure no other file gets classified as entry-point
              if (classification === 'entry-point') {
                classification = 'core-logic'
              }
            }
            
            // Workflow position prompt
            const workflowPrompt = `Entry: ${entryPointFile?.path || 'none'} handles ${keyword}
File: ${fileName} with functions: ${functions}
Position in workflow: upstream, downstream, parallel, or unrelated`
            
            const workflowResult = await textGenModel(workflowPrompt)
            const workflowPosition = extractWorkflowPosition(workflowResult)
            
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
            
            // Analyze relevant functions if we have function information
            let relevantFunctions: Array<{ name: string; relevance: number; reason?: string }> = []
            
            if (fileInfo?.functions && fileInfo.functions.length > 0 && classification !== 'unrelated') {
              try {
                // Ask LLM to identify which functions are most relevant
                const functionList = fileInfo.functions.slice(0, 40).map(f => f.name).join(', ')
                const functionAnalysisPrompt = `Searching for: "${keyword}"
File: ${fileName} (${classification})
Functions in file: ${functionList}
Which functions are most relevant to "${keyword}"? List only function names, one per line.`
                
                const functionResult = await textGenModel(functionAnalysisPrompt)
                const relevantFunctionNames = extractRelevantFunctions(functionResult, fileInfo.functions.map(f => f.name))
                
                // Score each function's relevance
                for (const funcName of relevantFunctionNames) {
                  const funcInfo = fileInfo.functions.find(f => f.name === funcName)
                  if (funcInfo) {
                    // Calculate function-specific relevance
                    let funcRelevance = 0.5 // Base relevance
                    
                    // Boost if function name contains keyword
                    if (funcName.toLowerCase().includes(keyword.toLowerCase())) {
                      funcRelevance += 0.3
                    }
                    
                    // Boost based on file classification
                    if (classification === 'entry-point' || classification === 'core-logic') {
                      funcRelevance += 0.2
                    }
                    
                    relevantFunctions.push({
                      name: funcName,
                      startLine: funcInfo.startLine,
                      endLine: funcInfo.endLine,
                      relevance: Math.min(funcRelevance, 1.0),
                      reason: `Related to ${keyword}`,
                      type: 'function' // Default type, could be enhanced later
                    })
                  }
                }
                
                // Sort by relevance
                relevantFunctions.sort((a, b) => b.relevance - a.relevance)
                relevantFunctions = relevantFunctions.slice(0, 5) // Keep top 5
              } catch (funcError) {
                console.debug(`Function analysis failed for ${file.path}:`, funcError)
              }
            }
            
            flanResults.set(file.path, {
              score: finalScore,
              classification,
              workflowPosition,
              relevantFunctions: relevantFunctions.length > 0 ? relevantFunctions : undefined
            })
            
          } catch (error) {
            console.warn(`Flan-T5 analysis failed for ${file.path}:`, error)
            flanResults.set(file.path, { score: 0, classification: 'unknown', workflowPosition: 'unknown' })
          }
        }
        
        // Small delay between batches to avoid overwhelming the model
        if (i + batchSize < files.length) {
          await new Promise(resolve => setTimeout(resolve, 100))
        }
      }
      
    } catch (error) {
      console.error('Flan-T5 analysis failed:', error)
      files.forEach(file => {
        flanResults.set(file.path, { score: 0, classification: 'error', workflowPosition: 'error' })
      })
    }
    
    return flanResults
  }

  // Helper functions for parsing Flan-T5 responses
  const extractClassification = (response: any): string => {
    const text = typeof response === 'string' ? response : response?.[0]?.generated_text || ''
    const classifications = ['entry-point', 'core-logic', 'helper', 'config', 'unrelated']
    
    for (const classification of classifications) {
      if (text.toLowerCase().includes(classification)) {
        return classification
      }
    }
    return 'unknown'
  }

  const extractWorkflowPosition = (response: any): string => {
    const text = typeof response === 'string' ? response : response?.[0]?.generated_text || ''
    const positions = ['upstream', 'downstream', 'parallel', 'unrelated']
    
    for (const position of positions) {
      if (text.toLowerCase().includes(position)) {
        return position
      }
    }
    return 'unknown'
  }

  const extractRelevantFunctions = (response: any, availableFunctions: string[]): string[] => {
    const text = typeof response === 'string' ? response : response?.[0]?.generated_text || ''
    const relevantFunctions: string[] = []
    
    // Split response by lines and look for function names
    const lines = text.split(/[\n,;]/).map(line => line.trim())
    
    for (const line of lines) {
      // Check each available function to see if it appears in the response
      for (const funcName of availableFunctions) {
        if (line.includes(funcName) && !relevantFunctions.includes(funcName)) {
          relevantFunctions.push(funcName)
        }
      }
    }
    
    // If no functions found through exact matching, try fuzzy matching
    if (relevantFunctions.length === 0) {
      for (const funcName of availableFunctions) {
        if (text.toLowerCase().includes(funcName.toLowerCase())) {
          relevantFunctions.push(funcName)
        }
      }
    }
    
    return relevantFunctions
  }

  // Combine tri-model results with intelligent weighting
  const combineTriModelResults = (
    astMatches: ASTMatch[],
    llmMatches: LLMMatch[],
    syntaxResults: Map<string, number>,
    flanResults: Map<string, { score: number; classification: string; workflowPosition: string; relevantFunctions?: Array<{ name: string; relevance: number; reason?: string }> }>,
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
      ...Array.from(flanResults.keys())
    ])
    
    // Find max scores for normalization
    const maxAstScore = Math.max(...astMatches.map(m => m.score), 1)
    const maxLlmScore = Math.max(...llmMatches.map(m => m.score), 1)
    
    for (const filePath of allFiles) {
      const astMatch = astMatches.find(m => m.file === filePath)
      const llmMatch = llmMatches.find(m => m.file === filePath)
      const syntaxScore = syntaxResults.get(filePath) || 0
      const flanResult = flanResults.get(filePath) || { score: 0, classification: 'unknown', workflowPosition: 'unknown' }
      
      // Normalize scores
      const normalizedAstScore = astMatch ? astMatch.score / maxAstScore : 0
      const normalizedLlmScore = llmMatch ? llmMatch.score / maxLlmScore : 0
      const normalizedSyntaxScore = syntaxScore
      const normalizedFlanScore = flanResult.score
      
      // Enhanced synergy detection
      const hasBasicSynergy = !!(astMatch && llmMatch)
      const hasFullSynergy = !!(astMatch && llmMatch && syntaxScore > 0.3 && flanResult.score > 0.5)
      
      // Tri-model weighted scoring
      let finalScore = (
        normalizedAstScore * 0.25 +      // Structure matches
        normalizedLlmScore * 0.35 +      // Semantic similarity
        normalizedSyntaxScore * 0.15 +   // Entry point relationships
        normalizedFlanScore * 0.25       // AI classification and workflow
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
        flanScore: normalizedFlanScore,
        syntaxScore: normalizedSyntaxScore,
        hasSynergy: hasBasicSynergy,
        matches: astMatch?.matches || [],
        classification: flanResult.classification,
        workflowPosition: flanResult.workflowPosition,
        relevantFunctions: flanResult.relevantFunctions
      })
    }
    
    // Sort by final score descending
    return Array.from(fileMap.values()).sort((a, b) => b.finalScore - a.finalScore)
  }

  // Generate embeddings on-demand for search
  const generateEmbeddingsOnDemand = async (files: Array<{ path: string; content: string }>): Promise<void> => {
    if (!$llm?.engine || $llm?.status !== 'ready') {
      console.warn('LLM not available for embedding generation')
      return
    }

    try {
      // Initialize IndexedDB for caching
      const dbInitialized = await initDB()
      if (dbInitialized) {
        await cleanOldCache()
      }

      console.log(`🧠 Generating embeddings for ${files.length} files...`)
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
          console.warn(`Failed to generate embedding for ${file.path}:`, error)
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
          console.log(`💾 Stored project-level embeddings cache for ${Object.keys(fileEmbeddingsRecord).length} files`)
        } catch (error) {
          console.warn('Failed to store project-level embeddings cache:', error)
        }
      }
      
      console.log(`📊 Embeddings: ${embeddingsCacheHits} cached, ${embeddingsGenerated} newly generated`)
      announceStatus(`Generated semantic embeddings for ${fileEmbeddings.value.size} files`)
      
    } catch (error) {
      console.error('On-demand embedding generation failed:', error)
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
    console.log('🧹 Clearing analysis state for project switch...')
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
        console.log(`🎯 Loading cached embeddings for project ${projectHash.substring(0, 8)}...`)
        
        // Restore embeddings for semantic search
        fileEmbeddings.value.clear()
        for (const [filePath, embedding] of Object.entries(cachedEmbeddings.fileEmbeddings)) {
          fileEmbeddings.value.set(filePath, embedding)
        }
        
        console.log(`🔄 Restored ${fileEmbeddings.value.size} file embeddings from cache`)
        
        hasLoadedFromCache.value = true
        console.log(`✅ Loaded cached embeddings for this project`)
        return true
      } else {
        console.log(`📭 No cached embeddings found for project ${projectHash.substring(0, 8)}`)
      }
      
      return false
    } catch (error) {
      console.warn('Failed to load cached embeddings:', error)
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
    console.log('🔍 Current Analysis State:')
    console.log(`  - File embeddings: ${fileEmbeddings.value.size}`)
    console.log(`  - Has loaded from cache: ${hasLoadedFromCache.value}`)
    console.log(`  - LLM status: ${$llm?.status}`)
    console.log(`  - LLM engine: ${typeof $llm?.engine}`)
    
    if (fileEmbeddings.value.size > 0) {
      const firstFile = Array.from(fileEmbeddings.value.keys())[0]
      const firstEmbedding = fileEmbeddings.value.get(firstFile)
      console.log(`  - Sample embedding: ${firstFile} (${firstEmbedding?.length} dims)`)
    }
  }

  // Clear IndexedDB cache completely
  const clearIndexedDBCache = async () => {
    try {
      console.log('🗑️ Clearing IndexedDB cache...')
      const dbInitialized = await initDB()
      if (dbInitialized) {
        // Clear all cached data
        await cleanOldCache(0) // Force clean all by setting maxAge to 0
        console.log('✅ IndexedDB cache cleared')
      }
    } catch (error) {
      console.error('Failed to clear IndexedDB cache:', error)
    }
  }

  // Force re-embedding with current project files
  const forceReembedding = async () => {
    try {
      console.log('🔄 Forcing complete cache clear and re-embedding...')
      
      // Clear both in-memory and IndexedDB cache
      clearCache()
      await clearIndexedDBCache()
      
      console.log('✅ All caches cleared. Next search will regenerate embeddings.')
    } catch (error) {
      console.error('Failed to force re-embedding:', error)
    }
  }

  const forceReembeddingWithFiles = async (files: Array<{ path: string; content: string }>) => {
    try {
      console.log(`🔄 Starting fresh embedding generation for ${files.length} files...`)
      clearCache()
      await generateEmbeddingsOnDemand(files)
      console.log('✅ Re-embedding complete!')
    } catch (error) {
      console.error('Failed to re-embed:', error)
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
    performHybridKeywordSearch,
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