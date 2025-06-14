/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import type { ParsedCodeInfo } from './useTreeSitter'

export interface CodeDependency {
  fromFile: string
  toFile: string
  dependencyType: 'import' | 'call' | 'inheritance' | 'composition'
  line: number
  confidence: number // 0-1, how confident we are about this dependency
}

export interface SmartSuggestion {
  id: string
  type: 'contextSet' | 'relatedFiles' | 'workflow' | 'keywordSearch'
  title: string
  description: string
  confidence: number
  data: Record<string, unknown>
}

export interface ContextSetSuggestion extends SmartSuggestion {
  type: 'contextSet'
  data: {
    suggestedName: string
    files: string[]
    reason: string
    category: 'feature' | 'domain' | 'layer' | 'component'
  }
}

export interface RelatedFilesSuggestion extends SmartSuggestion {
  type: 'relatedFiles'
  data: {
    baseFile: string
    relatedFiles: Array<{
      file: string
      relationship: string
      confidence: number
    }>
  }
}

export interface WorkflowSuggestion extends SmartSuggestion {
  type: 'workflow'
  data: {
    name: string
    steps: Array<{
      file: string
      description: string
      order: number
    }>
  }
}

export interface KeywordSearchSuggestion extends SmartSuggestion {
  type: 'keywordSearch'
  data: {
    keyword: string
    files: Array<{
      file: string
      finalScore: number
      astScore: number
      llmScore: number
      hasSynergy: boolean
      matches: string[]
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

export interface ExtractedKeyword {
  keyword: string
  frequency: number
  sources: Array<'directory' | 'filename' | 'class' | 'function' | 'import' | 'export'>
  confidence: number
  relatedFiles: string[]
}

export const useSmartContextSuggestions = () => {
  const { parseCode, isLanguageSupported } = useTreeSitter()
  const { announceStatus } = useAccessibility()
  const { $llm } = useNuxtApp() as { $llm?: { engine?: unknown; status?: string } }

  // IndexedDB cache
  const {
    initDB,
    calculateHash,
    calculateProjectHash,
    getCachedEmbedding,
    storeCachedEmbedding,
    getCachedProjectAnalysis,
    storeCachedProjectAnalysis,
    cleanOldCache
  } = useIndexedDBCache()

  // Cache for parsed code information and analysis
  const codeInfoCache = ref<Map<string, ParsedCodeInfo>>(new Map())
  const dependencyGraph = ref<Map<string, CodeDependency[]>>(new Map())
  const fileEmbeddings = ref<Map<string, number[]>>(new Map())
  const extractedKeywords = ref<ExtractedKeyword[]>([])
  const isAnalyzing = ref(false)
  const analysisProgress = ref(0)
  const hasLoadedFromCache = ref(false)

  // Enhanced analysis that includes LLM embeddings with caching
  const analyzeProject = async (
    files: Array<{ path: string; content: string }>
  ): Promise<void> => {
    isAnalyzing.value = true
    analysisProgress.value = 0
    
    try {
      // Initialize IndexedDB
      const dbInitialized = await initDB()
      if (dbInitialized) {
        // Clean old cache entries on startup
        await cleanOldCache()
      }

      // Calculate project hash for cache lookup
      const projectHash = await calculateProjectHash(files)
      console.log(`Project hash: ${projectHash.substring(0, 8)}...`)

      // Check if we have cached analysis for this exact project state
      if (dbInitialized) {
        const cachedAnalysis = await getCachedProjectAnalysis(projectHash)
        if (cachedAnalysis) {
          console.log('🎯 Found cached project analysis! Loading from cache...')
          announceStatus('Loading cached analysis...')
          
          // Load cached data
          extractedKeywords.value = cachedAnalysis.extractedKeywords
          
          // Restore file embeddings map
          fileEmbeddings.value.clear()
          for (const [filePath, embedding] of Object.entries(cachedAnalysis.fileEmbeddings)) {
            fileEmbeddings.value.set(filePath, embedding)
          }
          
          // Still need to rebuild AST cache and dependency graph for current session
          const supportedFiles = files.filter(file => isLanguageSupported(file.path))
          for (const file of supportedFiles) {
            try {
              const codeInfo = await parseCode(file.content, file.path)
              if (codeInfo) {
                codeInfoCache.value.set(file.path, codeInfo)
              }
            } catch (error) {
              console.warn(`Failed to parse ${file.path}:`, error)
            }
          }
          
          buildDependencyGraph(supportedFiles)
          hasLoadedFromCache.value = true
          
          announceStatus(`Loaded cached analysis with ${extractedKeywords.value.length} domain keywords`)
          console.log(`✅ Loaded cached analysis with ${extractedKeywords.value.length} keywords and ${Object.keys(cachedAnalysis.fileEmbeddings).length} embeddings`)
          return
        }
      }

      // No cache hit, perform full analysis
      console.log('🔄 No cache found, performing full analysis...')
      const supportedFiles = files.filter(file => isLanguageSupported(file.path))
      const total = supportedFiles.length
      
      console.log(`Analyzing ${total} supported files with hybrid AST + LLM approach...`)
      announceStatus(`Starting hybrid analysis of ${total} files`)

      // Stage 1: Parse each file with tree-sitter (AST analysis)
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
        
        analysisProgress.value = ((i + 1) / total) * 30 // First 30% for AST
      }

      // Stage 2: Generate LLM embeddings with per-file caching
      if ($llm?.engine && $llm?.status === 'ready') {
        announceStatus('Generating semantic embeddings with smart caching...')
        
        let embeddingsCacheHits = 0
        let embeddingsGenerated = 0
        
        for (let i = 0; i < files.length; i++) {
          const file = files[i]
          
          try {
            // Calculate file hash for individual file caching
            const fileHash = await calculateHash(file.content)
            
            // Check for cached embedding
            let embedding: number[] | null = null
            if (dbInitialized) {
              embedding = await getCachedEmbedding(file.path, fileHash)
              if (embedding) {
                embeddingsCacheHits++
                fileEmbeddings.value.set(file.path, embedding)
                analysisProgress.value = 30 + ((i + 1) / files.length) * 60 // 30-90% for LLM
                continue
              }
            }

            // Generate new embedding
            let searchableContent = ''
            const codeInfo = codeInfoCache.value.get(file.path)

            if (codeInfo && (codeInfo.functions.length > 0 || codeInfo.classes.length > 0)) {
              const functionSummaries = codeInfo.functions.map(f => `This file contains a function named ${f.name}.`).join(' ')
              const classSummaries = codeInfo.classes.map(c => `This file contains a class named ${c.name}.`).join(' ')
              const contentHeader = file.content.substring(0, 500)
              searchableContent = `${functionSummaries} ${classSummaries} ${contentHeader}`
            } else {
              searchableContent = `${file.path} ${file.content.substring(0, 1000)}`
            }

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
          
          analysisProgress.value = 30 + ((i + 1) / files.length) * 60 // 30-90% for LLM
        }
        
        console.log(`📊 Embeddings: ${embeddingsCacheHits} cached, ${embeddingsGenerated} newly generated`)
      }

      // Build dependency graph
      buildDependencyGraph(supportedFiles)
      
      // Stage 3: Extract intelligent keywords from all the analyzed data
      announceStatus('Extracting intelligent keywords from codebase...')
      const keywords = extractIntelligentKeywords(supportedFiles)
      extractedKeywords.value = keywords
      console.log(`📊 Extracted ${keywords.length} intelligent keywords from codebase`)
      
      // Cache the complete analysis
      if (dbInitialized) {
        announceStatus('Caching analysis for future sessions...')
        const fileEmbeddingsRecord: Record<string, number[]> = {}
        for (const [filePath, embedding] of fileEmbeddings.value.entries()) {
          fileEmbeddingsRecord[filePath] = embedding
        }
        
        await storeCachedProjectAnalysis(projectHash, keywords, fileEmbeddingsRecord)
        console.log('✅ Cached project analysis for future sessions')
      }
      
      announceStatus(`Hybrid analysis complete. Analyzed ${total} files with both AST and semantic understanding.`)
      console.log('Hybrid project analysis complete')
      
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

      // Find call dependencies (less reliable, but useful)
      for (const call of codeInfo.calls) {
        const possibleFiles = findFilesWithFunction(call.name, files)
        for (const possibleFile of possibleFiles) {
          if (possibleFile !== file.path) {
            dependencies.push({
              fromFile: file.path,
              toFile: possibleFile,
              dependencyType: 'call',
              line: call.startLine,
              confidence: 0.6
            })
          }
        }
      }

      if (dependencies.length > 0) {
        dependencyGraph.value.set(file.path, dependencies)
      }
    }
  }

  // ===== HYBRID KEYWORD SEARCH: THE THREE-STAGE DETECTIVE SYSTEM =====

  // Stage 1: Literal AST Search ("Detective By-the-Book")
  const performASTSearch = (
    keyword: string, 
    files: Array<{ path: string; content: string }>
  ): ASTMatch[] => {
    const astMatches: ASTMatch[] = [];

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
         astMatches.push({ file: file.path, matches, score });
       }
    }

    return astMatches;
  };

  // Stage 2: Semantic LLM Search ("Detective Insight")
  const performLLMSearch = async (
    keyword: string, 
    files: Array<{ path: string; content: string }>
  ): Promise<LLMMatch[]> => {
    if (!$llm?.engine || $llm?.status !== 'ready') {
      console.warn('LLM not available for semantic search')
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
              console.debug('Filename embedding failed, using content similarity only')
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
    
    // Stage 1: AST Search
    console.log('🕵️ Detective By-the-Book (AST) investigating...')
    const astMatches = performASTSearch(keyword, files)
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

  // Generate smart suggestions (now includes hybrid keyword search)
  const generateSuggestions = (
    files: Array<{ path: string; content: string }>
  ): SmartSuggestion[] => {
    const suggestions: SmartSuggestion[] = []

    // Traditional suggestions
    suggestions.push(...generateContextSetSuggestions(files))
    suggestions.push(...generateRelatedFilesSuggestions(files))
    suggestions.push(...generateWorkflowSuggestions(files))

    // Sort by confidence
    return suggestions.sort((a, b) => b.confidence - a.confidence)
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

  // ===== TRADITIONAL SUGGESTION METHODS (ENHANCED) =====

  const generateContextSetSuggestions = (
    files: Array<{ path: string; content: string }>
  ): ContextSetSuggestion[] => {
    const suggestions: ContextSetSuggestion[] = []

    // Group files by directory structure
    const directoryGroups = groupFilesByDirectory(files)
    
    for (const [directory, groupFiles] of directoryGroups.entries()) {
      if (groupFiles.length >= 2) {
        const suggestedName = generateContextSetName(directory)
        
        suggestions.push({
          id: `context-${directory.replace(/[^a-zA-Z0-9]/g, '_')}`,
          type: 'contextSet',
          title: `${suggestedName} Context Set`,
          description: `Group files from ${directory} directory (${groupFiles.length} files)`,
          confidence: Math.min(0.8, groupFiles.length * 0.1),
          data: {
            suggestedName,
            files: groupFiles.map(f => f.path),
            reason: `Files are co-located in ${directory} directory`,
            category: 'layer' as const
          }
        })
      }
    }

    // Group by feature patterns
    const featureGroups = groupFilesByFeature(files)
    
    for (const [feature, groupFiles] of featureGroups.entries()) {
      if (groupFiles.length >= 2) {
        suggestions.push({
          id: `feature-${feature.replace(/[^a-zA-Z0-9]/g, '_')}`,
          type: 'contextSet',
          title: `${feature} Feature`,
          description: `Files related to ${feature} functionality (${groupFiles.length} files)`,
          confidence: Math.min(0.9, groupFiles.length * 0.15),
          data: {
            suggestedName: feature,
            files: groupFiles.map(f => f.path),
            reason: `Files contain related ${feature} functionality`,
            category: 'feature' as const
          }
        })
      }
    }

    return suggestions
  }

  const generateRelatedFilesSuggestions = (
    files: Array<{ path: string; content: string }>
  ): RelatedFilesSuggestion[] => {
    const suggestions: RelatedFilesSuggestion[] = []

    for (const file of files) {
      const dependencies = dependencyGraph.value.get(file.path) || []
      const relatedFiles = dependencies
        .filter(dep => dep.confidence > 0.7)
        .map(dep => ({
            file: dep.toFile,
            relationship: dep.dependencyType,
            confidence: dep.confidence
        }))

      if (relatedFiles.length > 0) {
        suggestions.push({
          id: `related-${file.path.replace(/[^a-zA-Z0-9]/g, '_')}`,
          type: 'relatedFiles',
          title: `Files Related to ${file.path.split('/').pop()}`,
          description: `${relatedFiles.length} files have dependencies with this file`,
          confidence: Math.min(0.8, relatedFiles.length * 0.2),
          data: {
            baseFile: file.path,
            relatedFiles
          }
        })
      }
    }

    return suggestions
  }

  const generateWorkflowSuggestions = (
    _files: Array<{ path: string; content: string }>
  ): WorkflowSuggestion[] => {
    const suggestions: WorkflowSuggestion[] = []
    const entryPoints = findEntryPoints()
    
    for (const entryPoint of entryPoints.slice(0, 3)) {
      const workflow = buildWorkflowFromEntryPoint(entryPoint, 5)
      
      if (workflow.length > 1) {
        suggestions.push({
          id: `workflow-${entryPoint.replace(/[^a-zA-Z0-9]/g, '_')}`,
          type: 'workflow',
          title: `${entryPoint.split('/').pop()} Workflow`,
          description: `Execution flow starting from ${entryPoint}`,
          confidence: Math.min(0.8, workflow.length * 0.1),
          data: {
            name: `${entryPoint.split('/').pop()} Flow`,
            steps: workflow.map((file, index) => ({
              file,
              description: `Step ${index + 1}`,
              order: index + 1
            }))
          }
        })
      }
    }

    return suggestions
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

  const findFilesWithFunction = (
    functionName: string,
    files: Array<{ path: string; content: string }>
  ): string[] => {
    const result: string[] = []

    for (const file of files) {
      const codeInfo = codeInfoCache.value.get(file.path)
      if (codeInfo?.functions.some(f => f.name === functionName)) {
        result.push(file.path)
      }
    }

    return result
  }

  const groupFilesByDirectory = (
    files: Array<{ path: string; content: string }>
  ): Map<string, Array<{ path: string; content: string }>> => {
    const groups = new Map()

    for (const file of files) {
      const directory = file.path.substring(0, file.path.lastIndexOf('/'))
      if (!groups.has(directory)) {
        groups.set(directory, [])
      }
      groups.get(directory).push(file)
    }

    return groups
  }

  const groupFilesByFeature = (
    files: Array<{ path: string; content: string }>
  ): Map<string, Array<{ path: string; content: string }>> => {
    const groups = new Map()
    const commonFeatures = ['auth', 'user', 'admin', 'api', 'component', 'service', 'util']

    for (const feature of commonFeatures) {
      const featureFiles = files.filter(file => 
        file.path.toLowerCase().includes(feature) ||
        file.content.toLowerCase().includes(feature)
      )

      if (featureFiles.length > 0) {
        groups.set(feature, featureFiles)
      }
    }

    return groups
  }

  const generateContextSetName = (directory: string): string => {
    const parts = directory.split('/')
    return parts[parts.length - 1] || 'root'
  }

  const findEntryPoints = (): string[] => {
    const entryPoints: string[] = []
    
    for (const [file, dependencies] of dependencyGraph.value.entries()) {
      const incomingDeps = Array.from(dependencyGraph.value.values())
        .flat()
        .filter(dep => dep.toFile === file)
      
      if (incomingDeps.length === 0 && dependencies.length > 0) {
        entryPoints.push(file)
      }
    }

    return entryPoints
  }

  const buildWorkflowFromEntryPoint = (entryPoint: string, maxDepth: number): string[] => {
    const visited = new Set<string>()
    const workflow: string[] = []
    
    const traverse = (file: string, depth: number) => {
      if (depth >= maxDepth || visited.has(file)) return
    
      visited.add(file)
      workflow.push(file)
      
        const dependencies = dependencyGraph.value.get(file) || []
      for (const dep of dependencies.slice(0, 2)) {
        traverse(dep.toFile, depth + 1)
      }
    }

    traverse(entryPoint, 0)
    return workflow
  }

  // Clear all analysis state (for project switches)
  const clearAnalysisState = () => {
    console.log('🧹 Clearing analysis state for project switch...')
    codeInfoCache.value.clear()
    dependencyGraph.value.clear()
    fileEmbeddings.value.clear()
    extractedKeywords.value = []
    hasLoadedFromCache.value = false
  }

  // Load cached keywords on startup without full analysis
  const loadCachedKeywords = async (
    files: Array<{ path: string; content: string }>
  ): Promise<boolean> => {
    try {
      const dbInitialized = await initDB()
      if (!dbInitialized) return false

      const projectHash = await calculateProjectHash(files)
      const cachedAnalysis = await getCachedProjectAnalysis(projectHash)
      
      if (cachedAnalysis) {
        console.log(`🎯 Loading cached keywords for project ${projectHash.substring(0, 8)}...`)
        extractedKeywords.value = cachedAnalysis.extractedKeywords
        
        // Also restore embeddings for potential searches
        fileEmbeddings.value.clear()
        for (const [filePath, embedding] of Object.entries(cachedAnalysis.fileEmbeddings)) {
          fileEmbeddings.value.set(filePath, embedding)
        }
        
        hasLoadedFromCache.value = true
        console.log(`✅ Loaded ${extractedKeywords.value.length} cached keywords for this project`)
        return true
      } else {
        console.log(`📭 No cached keywords found for project ${projectHash.substring(0, 8)}`)
      }
      
      return false
    } catch (error) {
      console.warn('Failed to load cached keywords:', error)
      return false
    }
  }

  const clearCache = () => {
    codeInfoCache.value.clear()
    dependencyGraph.value.clear()
    fileEmbeddings.value.clear()
    extractedKeywords.value = []
    hasLoadedFromCache.value = false
  }

  // ===== INTELLIGENT KEYWORD EXTRACTION =====
  const extractIntelligentKeywords = (
    files: Array<{ path: string; content: string }>
  ): ExtractedKeyword[] => {
    const keywordMap = new Map<string, {
      frequency: number
      sources: Set<'directory' | 'filename' | 'class' | 'function' | 'import' | 'export'>
      files: Set<string>
    }>()

    // 1. DIRECTORY-BASED EXTRACTION
    for (const file of files) {
      const pathParts = file.path.split('/').filter(part => part.length > 0)
      
      for (const part of pathParts) {
        // Extract meaningful keywords from directory names
        const keywords = extractKeywordsFromString(part)
        
        for (const keyword of keywords) {
          if (!keywordMap.has(keyword)) {
            keywordMap.set(keyword, {
              frequency: 0,
              sources: new Set(),
              files: new Set()
            })
          }
          
          const entry = keywordMap.get(keyword)!
          entry.frequency += 1
          entry.sources.add('directory')
          entry.files.add(file.path)
        }
      }
    }

    // 2. FILENAME-BASED EXTRACTION
    for (const file of files) {
      const fileName = file.path.split('/').pop()?.replace(/\.[^/.]+$/, '') || ''
      const keywords = extractKeywordsFromString(fileName)
      
      for (const keyword of keywords) {
        if (!keywordMap.has(keyword)) {
          keywordMap.set(keyword, {
            frequency: 0,
            sources: new Set(),
            files: new Set()
          })
        }
        
        const entry = keywordMap.get(keyword)!
        entry.frequency += 2 // Filename keywords are more important
        entry.sources.add('filename')
        entry.files.add(file.path)
      }
    }

    // 3. AST-BASED EXTRACTION (Classes, Functions, Imports, Exports)
    for (const file of files) {
      const codeInfo = codeInfoCache.value.get(file.path)
      if (!codeInfo) continue

      // Extract from class names
      for (const classInfo of codeInfo.classes) {
        const keywords = extractKeywordsFromString(classInfo.name)
        
        for (const keyword of keywords) {
          if (!keywordMap.has(keyword)) {
            keywordMap.set(keyword, {
              frequency: 0,
              sources: new Set(),
              files: new Set()
            })
          }
          
          const entry = keywordMap.get(keyword)!
          entry.frequency += 3 // Class names are very important
          entry.sources.add('class')
          entry.files.add(file.path)
        }
      }

      // Extract from function names
      for (const funcInfo of codeInfo.functions) {
        const keywords = extractKeywordsFromString(funcInfo.name)
        
        for (const keyword of keywords) {
          if (!keywordMap.has(keyword)) {
            keywordMap.set(keyword, {
              frequency: 0,
              sources: new Set(),
              files: new Set()
            })
          }
          
          const entry = keywordMap.get(keyword)!
          entry.frequency += 2 // Function names are important
          entry.sources.add('function')
          entry.files.add(file.path)
        }
      }

      // Extract from imports
      for (const importInfo of codeInfo.imports) {
        const keywords = extractKeywordsFromString(importInfo.module)
        
        for (const keyword of keywords) {
          if (!keywordMap.has(keyword)) {
            keywordMap.set(keyword, {
              frequency: 0,
              sources: new Set(),
              files: new Set()
            })
          }
          
          const entry = keywordMap.get(keyword)!
          entry.frequency += 1
          entry.sources.add('import')
          entry.files.add(file.path)
        }
      }

      // Extract from exports
      for (const exportInfo of codeInfo.exports) {
        const keywords = extractKeywordsFromString(exportInfo.name)
        
        for (const keyword of keywords) {
          if (!keywordMap.has(keyword)) {
            keywordMap.set(keyword, {
              frequency: 0,
              sources: new Set(),
              files: new Set()
            })
          }
          
          const entry = keywordMap.get(keyword)!
          entry.frequency += 2
          entry.sources.add('export')
          entry.files.add(file.path)
        }
      }
    }

    // 4. PROCESS AND RANK KEYWORDS
    const extractedKeywords: ExtractedKeyword[] = []

    for (const [keyword, data] of keywordMap.entries()) {
      // Filter out noise and very short keywords
      if (keyword.length < 3 || data.frequency < 2) continue
      
      // Skip common programming terms that aren't meaningful
      if (isCommonProgrammingTerm(keyword)) continue

      // Only extract domain keywords (business entities)
      if (!isDomainKeyword(keyword)) continue

      // Calculate confidence based on frequency and source diversity
      const sourceCount = data.sources.size
      const fileCount = data.files.size
      const confidence = Math.min(
        (data.frequency * 0.1) + (sourceCount * 0.2) + (fileCount * 0.05),
        1.0
      )

      extractedKeywords.push({
        keyword,
        frequency: data.frequency,
        sources: Array.from(data.sources),
        confidence,
        relatedFiles: Array.from(data.files).slice(0, 10) // Top 10 related files
      })
    }

    // Sort by confidence and frequency
    return extractedKeywords
      .sort((a, b) => (b.confidence * b.frequency) - (a.confidence * a.frequency))
      .slice(0, 15) // Return top 15 keywords
  }

  // Helper function to extract keywords from strings
  const extractKeywordsFromString = (str: string): string[] => {
    if (!str) return []
    
    // Split on common separators and filter meaningful parts
    return str
      .toLowerCase()
      // Split on camelCase, snake_case, kebab-case, and dots
      .split(/[_\-.\s]+|(?=[A-Z])/)
      .filter(part => part.length >= 3) // Minimum 3 characters
      .filter(part => !/^\d+$/.test(part)) // Not pure numbers
      .filter(part => !isCommonProgrammingTerm(part))
  }

  // Helper function to identify common programming terms to filter out
  const isCommonProgrammingTerm = (term: string): boolean => {
    const commonTerms = new Set([
      'the', 'and', 'for', 'are', 'but', 'not', 'you', 'all', 'can', 'had', 'her', 'was', 'one', 'our', 'out', 'day', 'get', 'has', 'him', 'his', 'how', 'man', 'new', 'now', 'old', 'see', 'two', 'way', 'who', 'boy', 'did', 'its', 'let', 'put', 'say', 'she', 'too', 'use',
      'var', 'let', 'const', 'function', 'class', 'return', 'import', 'export', 'from', 'as',
      'public', 'private', 'protected', 'static', 'void', 'string', 'number', 'boolean',
      'true', 'false', 'null', 'undefined', 'this', 'that', 'self', 'super',
      'if', 'else', 'for', 'while', 'do', 'switch', 'case', 'try', 'catch', 'finally',
      'with', 'without', 'within', 'between', 'among', 'through', 'during', 'before', 'after',
      'index', 'item', 'items', 'list', 'array', 'object', 'data', 'info', 'result', 'response',
      'component', 'service', 'controller', 'model', 'view', 'helper', 'util', 'lib', 'config'
    ])
    
    return commonTerms.has(term.toLowerCase())
  }

  // Helper function to identify domain keywords (business entities)
  const isDomainKeyword = (keyword: string): boolean => {
    // Domain patterns - business entities and concepts
    const domainPatterns = [
      // Core business entities
      /^(user|users)$/i,
      /^(customer|customers|client|clients)$/i,
      /^(admin|administrator|admins)$/i,
      /^(account|accounts)$/i,
      /^(profile|profiles)$/i,
      /^(company|companies|organization|organizations|org)$/i,
      /^(team|teams|group|groups)$/i,
      /^(member|members|membership)$/i,
      /^(role|roles|permission|permissions)$/i,
      /^(tenant|tenants|workspace|workspaces)$/i,
      
      // Commerce and products
      /^(product|products|item|items)$/i,
      /^(order|orders|purchase|purchases)$/i,
      /^(payment|payments|billing|invoice|invoices)$/i,
      /^(subscription|subscriptions|plan|plans)$/i,
      /^(cart|basket|checkout)$/i,
      /^(inventory|stock|catalog)$/i,
      /^(category|categories|tag|tags)$/i,
      /^(brand|brands|vendor|vendors|supplier|suppliers)$/i,
      
      // Content and media
      /^(post|posts|article|articles|blog|blogs)$/i,
      /^(comment|comments|review|reviews|rating|ratings)$/i,
      /^(file|files|document|documents|attachment|attachments)$/i,
      /^(image|images|photo|photos|media)$/i,
      /^(video|videos|audio)$/i,
      
      // Events and activities
      /^(event|events|activity|activities)$/i,
      /^(task|tasks|todo|todos)$/i,
      /^(project|projects|campaign|campaigns)$/i,
      /^(report|reports|analytics|metric|metrics)$/i,
      /^(log|logs|audit|audits)$/i,
      
      // Communication
      /^(message|messages|chat|chats)$/i,
      /^(notification|notifications|alert|alerts)$/i,
      /^(email|emails|mail)$/i,
      /^(contact|contacts)$/i,
      
      // Geography and location
      /^(address|addresses|location|locations)$/i,
      /^(country|countries|region|regions|city|cities)$/i,
      /^(timezone|timezones)$/i,
      
      // Business processes
      /^(transaction|transactions|transfer|transfers)$/i,
      /^(booking|bookings|reservation|reservations)$/i,
      /^(appointment|appointments|schedule|schedules)$/i,
      /^(ticket|tickets|issue|issues)$/i,
      /^(request|requests|application|applications)$/i
    ]
    
    return domainPatterns.some(pattern => pattern.test(keyword))
  }

  return {
    // State
    isAnalyzing: readonly(isAnalyzing),
    analysisProgress: readonly(analysisProgress),
    extractedKeywords: readonly(extractedKeywords),
    hasLoadedFromCache: readonly(hasLoadedFromCache),
    
    // Methods
    analyzeProject,
    generateSuggestions,
    performHybridKeywordSearch,
    loadCachedKeywords,
    clearCache,
    clearAnalysisState,
    
    // Expose for debugging
    codeInfoCache: readonly(codeInfoCache),
    dependencyGraph: readonly(dependencyGraph),
    fileEmbeddings: readonly(fileEmbeddings)
  }
} 