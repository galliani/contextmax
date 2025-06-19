/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import type { RegexParsedCodeInfo } from './useRegexCodeParser'

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