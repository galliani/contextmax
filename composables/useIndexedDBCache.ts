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

export interface CachedProjectAnalysis {
  projectHash: string
  extractedKeywords: Array<{
    keyword: string
    frequency: number
    sources: Array<'directory' | 'filename' | 'class' | 'function' | 'import' | 'export'>
    confidence: number
    relatedFiles: string[]
  }>
  fileEmbeddings: Record<string, number[]>
  timestamp: number
}

export const useIndexedDBCache = () => {
  const DB_NAME = 'ContextMaxCache'
  const DB_VERSION = 1
  const EMBEDDINGS_STORE = 'file_embeddings'
  const ANALYSIS_STORE = 'project_analysis'
  
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
        
        // Create project analysis store  
        if (!database.objectStoreNames.contains(ANALYSIS_STORE)) {
          const analysisStore = database.createObjectStore(ANALYSIS_STORE, { keyPath: 'projectHash' })
          analysisStore.createIndex('timestamp', 'timestamp')
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

  // Get cached project analysis
  const getCachedProjectAnalysis = async (projectHash: string): Promise<CachedProjectAnalysis | null> => {
    if (!db) return null

    return new Promise((resolve) => {
      const transaction = db!.transaction([ANALYSIS_STORE], 'readonly')
      const store = transaction.objectStore(ANALYSIS_STORE)
      const request = store.get(projectHash)
      
      request.onsuccess = () => {
        const result: CachedProjectAnalysis | undefined = request.result
        resolve(result || null)
      }
      
      request.onerror = () => {
        console.warn(`Failed to get cached analysis for project ${projectHash}:`, request.error)
        resolve(null)
      }
    })
  }

  // Store project analysis
  const storeCachedProjectAnalysis = async (
    projectHash: string,
    extractedKeywords: CachedProjectAnalysis['extractedKeywords'],
    fileEmbeddings: Record<string, number[]>
  ): Promise<boolean> => {
    if (!db) return false

    return new Promise((resolve) => {
      const transaction = db!.transaction([ANALYSIS_STORE], 'readwrite')
      const store = transaction.objectStore(ANALYSIS_STORE)
      
      const cachedAnalysis: CachedProjectAnalysis = {
        projectHash,
        extractedKeywords,
        fileEmbeddings,
        timestamp: Date.now()
      }
      
      const request = store.put(cachedAnalysis)
      
      request.onsuccess = () => {
        resolve(true)
      }
      
      request.onerror = () => {
        console.warn(`Failed to store project analysis:`, request.error)
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

    // Clean analysis
    try {
      const analysisTransaction = db.transaction([ANALYSIS_STORE], 'readwrite')
      const analysisStore = analysisTransaction.objectStore(ANALYSIS_STORE)
      const analysisIndex = analysisStore.index('timestamp')
      const analysisRange = IDBKeyRange.upperBound(thirtyDaysAgo)
      analysisIndex.openCursor(analysisRange).onsuccess = (event) => {
        const cursor = (event.target as IDBRequest).result
        if (cursor) {
          cursor.delete()
          cursor.continue()
        }
      }
    } catch (error) {
      console.warn('Failed to clean old analysis cache:', error)
    }
  }

  // Get cache statistics
  const getCacheStats = async (): Promise<{ embeddingsCount: number; analysisCount: number }> => {
    if (!db) return { embeddingsCount: 0, analysisCount: 0 }

    const embeddingsCount = await new Promise<number>((resolve) => {
      const transaction = db!.transaction([EMBEDDINGS_STORE], 'readonly')
      const request = transaction.objectStore(EMBEDDINGS_STORE).count()
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => resolve(0)
    })

    const analysisCount = await new Promise<number>((resolve) => {
      const transaction = db!.transaction([ANALYSIS_STORE], 'readonly')
      const request = transaction.objectStore(ANALYSIS_STORE).count()
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => resolve(0)
    })

    return { embeddingsCount, analysisCount }
  }

  return {
    initDB,
    calculateHash,
    calculateProjectHash,
    getCachedEmbedding,
    storeCachedEmbedding,
    getCachedProjectAnalysis,
    storeCachedProjectAnalysis,
    cleanOldCache,
    getCacheStats
  }
} 