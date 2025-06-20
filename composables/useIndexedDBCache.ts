/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

export interface CachedFileEmbedding {
  path: string
  hash: string
  embedding: number[]
  timestamp: number
}

export interface CachedProjectEmbeddings {
  projectHash: string
  fileEmbeddings: Record<string, number[]>
  timestamp: number
}

export interface SearchResult {
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
}

export interface CachedSearchResults {
  id: string // Generated ID for the search
  keyword: string
  projectName: string
  results: SearchResult[]
  timestamp: number
  entryPointFile?: string
}

export const useIndexedDBCache = () => {
  const DB_NAME = 'ContextMaxCache'
  const DB_VERSION = 2
  const EMBEDDINGS_STORE = 'file_embeddings'
  const EMBEDDINGS_STORE_PROJECT = 'project_embeddings'
  const SEARCH_RESULTS_STORE = 'search_results'
  
  let db: IDBDatabase | null = null

  // Initialize IndexedDB
  const initDB = async (): Promise<boolean> => {
    if (db) return true
    
    // Check if IndexedDB is available
    if (typeof indexedDB === 'undefined') {
      return false
    }

    return new Promise((resolve, _reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION)
      
      request.onerror = () => {
        console.error('Failed to open IndexedDB:', request.error)
        resolve(false)
      }
      
      request.onsuccess = () => {
        db = request.result
        resolve(true)
      }
      
      request.onupgradeneeded = (event) => {
        const database = (event.target as IDBOpenDBRequest).result
        
        // Create file embeddings store
        if (!database.objectStoreNames.contains(EMBEDDINGS_STORE)) {
          const embeddingsStore = database.createObjectStore(EMBEDDINGS_STORE, { keyPath: 'path' })
          embeddingsStore.createIndex('timestamp', 'timestamp')
        }
        
        // Create project embeddings store  
        if (!database.objectStoreNames.contains(EMBEDDINGS_STORE_PROJECT)) {
          const embeddingsStore = database.createObjectStore(EMBEDDINGS_STORE_PROJECT, { keyPath: 'projectHash' })
          embeddingsStore.createIndex('timestamp', 'timestamp')
        }
        
        // Create search results store
        if (!database.objectStoreNames.contains(SEARCH_RESULTS_STORE)) {
          const searchStore = database.createObjectStore(SEARCH_RESULTS_STORE, { keyPath: 'id' })
          searchStore.createIndex('timestamp', 'timestamp')
          searchStore.createIndex('projectName', 'projectName')
          searchStore.createIndex('keyword', 'keyword')
        }
      }
    })
  }

  // Calculate SHA-256 hash of content
  const calculateHash = async (content: string): Promise<string> => {
    const encoder = new TextEncoder()
    const data = encoder.encode(content)
    const hashBuffer = await crypto.subtle.digest('SHA-256', data)
    const hashArray = Array.from(new Uint8Array(hashBuffer))
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
  }

  // Calculate project hash based on all file paths and their hashes
  const calculateProjectHash = async (files: Array<{ path: string; content: string }>): Promise<string> => {
    const fileHashes = await Promise.all(
      files.map(async (file) => {
        const contentHash = await calculateHash(file.content)
        return `${file.path}:${contentHash}`
      })
    )
    
    // Extract project directory name from the first file path for additional scoping
    const projectPath = files.length > 0 ? files[0].path : ''
    const pathParts = projectPath.split('/')
    const projectDir = pathParts.length > 1 ? pathParts[1] : 'unknown'
    
    // Include project directory name and file count in the descriptor for better uniqueness
    const projectDescriptor = `project:${projectDir}|files:${files.length}|${fileHashes.sort().join('|')}`
    const finalHash = await calculateHash(projectDescriptor)
    
    console.log(`📍 Project: "${projectDir}" (${files.length} files) → Hash: ${finalHash.substring(0, 8)}...`)
    
    return finalHash
  }

  // Get cached file embedding
  const getCachedEmbedding = async (filePath: string, contentHash: string): Promise<number[] | null> => {
    if (!db) return null

    return new Promise((resolve) => {
      const transaction = db!.transaction([EMBEDDINGS_STORE], 'readonly')
      const store = transaction.objectStore(EMBEDDINGS_STORE)
      const request = store.get(filePath)
      
      request.onsuccess = () => {
        const result: CachedFileEmbedding | undefined = request.result
        if (result && result.hash === contentHash) {
          resolve(result.embedding)
        } else {
          resolve(null)
        }
      }
      
      request.onerror = () => {
        console.warn(`Failed to get cached embedding for ${filePath}:`, request.error)
        resolve(null)
      }
    })
  }

  // Store file embedding
  const storeCachedEmbedding = async (filePath: string, contentHash: string, embedding: number[]): Promise<boolean> => {
    if (!db) return false

    return new Promise((resolve) => {
      const transaction = db!.transaction([EMBEDDINGS_STORE], 'readwrite')
      const store = transaction.objectStore(EMBEDDINGS_STORE)
      
      const cachedEmbedding: CachedFileEmbedding = {
        path: filePath,
        hash: contentHash,
        embedding,
        timestamp: Date.now()
      }
      
      const request = store.put(cachedEmbedding)
      
      request.onsuccess = () => {
        resolve(true)
      }
      
      request.onerror = () => {
        console.warn(`Failed to store embedding for ${filePath}:`, request.error)
        resolve(false)
      }
    })
  }

  // Get cached project embeddings
  const getCachedProjectEmbeddings = async (projectHash: string): Promise<CachedProjectEmbeddings | null> => {
    if (!db) return null

    return new Promise((resolve) => {
      const transaction = db!.transaction([EMBEDDINGS_STORE_PROJECT], 'readonly')
      const store = transaction.objectStore(EMBEDDINGS_STORE_PROJECT)
      const request = store.get(projectHash)
      
      request.onsuccess = () => {
        const result: CachedProjectEmbeddings | undefined = request.result
        resolve(result || null)
      }
      
      request.onerror = () => {
        console.warn(`Failed to get cached embeddings for project ${projectHash}:`, request.error)
        resolve(null)
      }
    })
  }

  // Store project embeddings
  const storeCachedProjectEmbeddings = async (
    projectHash: string,
    fileEmbeddings: Record<string, number[]>
  ): Promise<boolean> => {
    if (!db) return false

    return new Promise((resolve) => {
      const transaction = db!.transaction([EMBEDDINGS_STORE_PROJECT], 'readwrite')
      const store = transaction.objectStore(EMBEDDINGS_STORE_PROJECT)
      
      const cachedEmbeddings: CachedProjectEmbeddings = {
        projectHash,
        fileEmbeddings,
        timestamp: Date.now()
      }
      
      const request = store.put(cachedEmbeddings)
      
      request.onsuccess = () => {
        resolve(true)
      }
      
      request.onerror = () => {
        console.warn(`Failed to store project embeddings:`, request.error)
        resolve(false)
      }
    })
  }

  // Clean old cache entries (older than 30 days)
  const cleanOldCache = async (): Promise<void> => {
    if (!db) return

    const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000)

    // Clean embeddings
    try {
      const embeddingsTransaction = db.transaction([EMBEDDINGS_STORE], 'readwrite')
      const embeddingsStore = embeddingsTransaction.objectStore(EMBEDDINGS_STORE)
      const embeddingsIndex = embeddingsStore.index('timestamp')
      const embeddingsRange = IDBKeyRange.upperBound(thirtyDaysAgo)
      embeddingsIndex.openCursor(embeddingsRange).onsuccess = (event) => {
        const cursor = (event.target as IDBRequest).result
        if (cursor) {
          cursor.delete()
          cursor.continue()
        }
      }
    } catch (error) {
      console.warn('Failed to clean old embeddings cache:', error)
    }

    // Clean project embeddings
    try {
      const embeddingsProjectTransaction = db.transaction([EMBEDDINGS_STORE_PROJECT], 'readwrite')
      const embeddingsProjectStore = embeddingsProjectTransaction.objectStore(EMBEDDINGS_STORE_PROJECT)
      const embeddingsProjectIndex = embeddingsProjectStore.index('timestamp')
      const embeddingsProjectRange = IDBKeyRange.upperBound(thirtyDaysAgo)
      embeddingsProjectIndex.openCursor(embeddingsProjectRange).onsuccess = (event) => {
        const cursor = (event.target as IDBRequest).result
        if (cursor) {
          cursor.delete()
          cursor.continue()
        }
      }
    } catch (error) {
      console.warn('Failed to clean old project embeddings cache:', error)
    }

    // Clean search results
    try {
      const searchTransaction = db.transaction([SEARCH_RESULTS_STORE], 'readwrite')
      const searchStore = searchTransaction.objectStore(SEARCH_RESULTS_STORE)
      const searchIndex = searchStore.index('timestamp')
      const searchRange = IDBKeyRange.upperBound(thirtyDaysAgo)
      searchIndex.openCursor(searchRange).onsuccess = (event) => {
        const cursor = (event.target as IDBRequest).result
        if (cursor) {
          cursor.delete()
          cursor.continue()
        }
      }
    } catch (error) {
      console.warn('Failed to clean old search results cache:', error)
    }
  }

  // Store search results
  const storeSearchResults = async (searchData: CachedSearchResults): Promise<boolean> => {
    if (!db) return false

    return new Promise((resolve) => {
      const transaction = db!.transaction([SEARCH_RESULTS_STORE], 'readwrite')
      const store = transaction.objectStore(SEARCH_RESULTS_STORE)
      
      const request = store.put(searchData)
      
      request.onsuccess = () => {
        resolve(true)
      }
      
      request.onerror = () => {
        console.warn(`Failed to store search results:`, request.error)
        resolve(false)
      }
    })
  }

  // Get search results by project
  const getSearchResultsByProject = async (projectName: string): Promise<CachedSearchResults[]> => {
    if (!db) return []

    return new Promise((resolve) => {
      const transaction = db!.transaction([SEARCH_RESULTS_STORE], 'readonly')
      const store = transaction.objectStore(SEARCH_RESULTS_STORE)
      const index = store.index('projectName')
      const request = index.getAll(projectName)
      
      request.onsuccess = () => {
        const results: CachedSearchResults[] = request.result || []
        // Sort by timestamp (newest first)
        results.sort((a, b) => b.timestamp - a.timestamp)
        resolve(results)
      }
      
      request.onerror = () => {
        console.warn(`Failed to get search results for project ${projectName}:`, request.error)
        resolve([])
      }
    })
  }

  // Get specific search results by ID
  const getSearchResultsById = async (id: string): Promise<CachedSearchResults | null> => {
    if (!db) return null

    return new Promise((resolve) => {
      const transaction = db!.transaction([SEARCH_RESULTS_STORE], 'readonly')
      const store = transaction.objectStore(SEARCH_RESULTS_STORE)
      const request = store.get(id)
      
      request.onsuccess = () => {
        const result: CachedSearchResults | undefined = request.result
        resolve(result || null)
      }
      
      request.onerror = () => {
        console.warn(`Failed to get search results ${id}:`, request.error)
        resolve(null)
      }
    })
  }

  // Delete search results by ID
  const deleteSearchResults = async (id: string): Promise<boolean> => {
    if (!db) return false

    return new Promise((resolve) => {
      const transaction = db!.transaction([SEARCH_RESULTS_STORE], 'readwrite')
      const store = transaction.objectStore(SEARCH_RESULTS_STORE)
      const request = store.delete(id)
      
      request.onsuccess = () => {
        resolve(true)
      }
      
      request.onerror = () => {
        console.warn(`Failed to delete search results ${id}:`, request.error)
        resolve(false)
      }
    })
  }

  // Generate unique ID for search results (keyword + project as unique key)
  const generateSearchId = (keyword: string, projectName: string): string => {
    // Use keyword + project as unique key (no timestamp/random to allow overwriting)
    return `search_${keyword.replace(/[^a-zA-Z0-9]/g, '_')}_${projectName.replace(/[^a-zA-Z0-9]/g, '_')}`
  }

  // Get cache statistics
  const getCacheStats = async (): Promise<{ embeddingsCount: number; projectEmbeddingsCount: number; searchResultsCount: number }> => {
    if (!db) return { embeddingsCount: 0, projectEmbeddingsCount: 0, searchResultsCount: 0 }

    const embeddingsCount = await new Promise<number>((resolve) => {
      const transaction = db!.transaction([EMBEDDINGS_STORE], 'readonly')
      const request = transaction.objectStore(EMBEDDINGS_STORE).count()
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => resolve(0)
    })

    const projectEmbeddingsCount = await new Promise<number>((resolve) => {
      const transaction = db!.transaction([EMBEDDINGS_STORE_PROJECT], 'readonly')
      const request = transaction.objectStore(EMBEDDINGS_STORE_PROJECT).count()
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => resolve(0)
    })

    const searchResultsCount = await new Promise<number>((resolve) => {
      const transaction = db!.transaction([SEARCH_RESULTS_STORE], 'readonly')
      const request = transaction.objectStore(SEARCH_RESULTS_STORE).count()
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => resolve(0)
    })

    return { embeddingsCount, projectEmbeddingsCount, searchResultsCount }
  }

  return {
    initDB,
    calculateHash,
    calculateProjectHash,
    getCachedEmbedding,
    storeCachedEmbedding,
    getCachedProjectEmbeddings,
    storeCachedProjectEmbeddings,
    storeSearchResults,
    getSearchResultsByProject,
    getSearchResultsById,
    deleteSearchResults,
    generateSearchId,
    cleanOldCache,
    getCacheStats
  }
} 