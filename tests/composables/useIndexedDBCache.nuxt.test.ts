/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */
// @vitest-environment nuxt
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { useIndexedDBCache } from '~/composables/useIndexedDBCache'
import type { CachedFileEmbedding, CachedProjectEmbeddings } from '~/composables/useIndexedDBCache'

// Mock IndexedDB with proper async behavior
interface MockIDBRequest {
  result: unknown
  error: unknown
  onsuccess: ((event: Event) => void) | null
  onerror: ((event: Event) => void) | null
}

interface MockIDBTransaction {
  objectStore: ReturnType<typeof vi.fn>
  oncomplete: ((event: Event) => void) | null
  onerror: ((event: Event) => void) | null
}

interface MockIDBObjectStore {
  add: ReturnType<typeof vi.fn>
  get: ReturnType<typeof vi.fn>
  put: ReturnType<typeof vi.fn>
  delete: ReturnType<typeof vi.fn>
  clear: ReturnType<typeof vi.fn>
  count: ReturnType<typeof vi.fn>
  openCursor: ReturnType<typeof vi.fn>
  createIndex: ReturnType<typeof vi.fn>
  index: ReturnType<typeof vi.fn>
}

interface MockIDBDatabase {
  transaction: ReturnType<typeof vi.fn>
  close: ReturnType<typeof vi.fn>
  objectStoreNames: {
    contains: ReturnType<typeof vi.fn>
  }
  createObjectStore: ReturnType<typeof vi.fn>
}

const createMockRequest = (result?: unknown, error?: unknown): MockIDBRequest => ({
  result,
  error,
  onsuccess: null,
  onerror: null
})

const createMockObjectStore = (): MockIDBObjectStore => ({
  add: vi.fn().mockReturnValue(createMockRequest(true)),
  get: vi.fn().mockReturnValue(createMockRequest(null)),
  put: vi.fn().mockReturnValue(createMockRequest(true)),
  delete: vi.fn().mockReturnValue(createMockRequest(true)),
  clear: vi.fn().mockReturnValue(createMockRequest(true)),
  count: vi.fn().mockReturnValue(createMockRequest(0)),
  openCursor: vi.fn().mockReturnValue(createMockRequest(null)),
  createIndex: vi.fn(),
  index: vi.fn().mockReturnValue({
    openCursor: vi.fn().mockReturnValue(createMockRequest(null))
  })
})

const createMockTransaction = (objectStore: MockIDBObjectStore): MockIDBTransaction => ({
  objectStore: vi.fn().mockReturnValue(objectStore),
  oncomplete: null,
  onerror: null
})

const createMockDatabase = (objectStore: MockIDBObjectStore): MockIDBDatabase => ({
  transaction: vi.fn().mockReturnValue(createMockTransaction(objectStore)),
  close: vi.fn(),
  objectStoreNames: {
    contains: vi.fn().mockReturnValue(false)
  },
  createObjectStore: vi.fn().mockReturnValue(objectStore)
})

describe('useIndexedDBCache', () => {
  let cacheComposable: ReturnType<typeof useIndexedDBCache>
  let mockObjectStore: MockIDBObjectStore
  let mockDatabase: MockIDBDatabase
  let _mockTransaction: MockIDBTransaction

  // Mock globalThis.indexedDB
  const mockIndexedDB = {
    open: vi.fn()
  }

  // Mock crypto.subtle for hash calculation
  const mockCrypto = {
    subtle: {
      digest: vi.fn()
    }
  }

  beforeEach(() => {
    vi.clearAllMocks()

    // Setup mocks
    mockObjectStore = createMockObjectStore()
    mockDatabase = createMockDatabase(mockObjectStore)
    _mockTransaction = createMockTransaction(mockObjectStore)

    // Mock globalThis.indexedDB
    vi.stubGlobal('indexedDB', mockIndexedDB)

    // Mock IDBKeyRange
    vi.stubGlobal('IDBKeyRange', {
      upperBound: vi.fn().mockReturnValue({}),
      lowerBound: vi.fn().mockReturnValue({}),
      bound: vi.fn().mockReturnValue({}),
      only: vi.fn().mockReturnValue({})
    })

    // Mock crypto.subtle
    vi.stubGlobal('crypto', mockCrypto)
    mockCrypto.subtle.digest.mockResolvedValue(new ArrayBuffer(32))

    // Initialize the composable
    cacheComposable = useIndexedDBCache()
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  describe('Database Initialization', () => {
    it('should initialize database successfully', async () => {
      const mockOpenRequest = createMockRequest(mockDatabase)
      mockIndexedDB.open.mockReturnValue(mockOpenRequest)

      const initPromise = cacheComposable.initDB()

      // Simulate successful open
      setTimeout(() => {
        if (mockOpenRequest.onsuccess) {
          mockOpenRequest.onsuccess(new Event('success'))
        }
      }, 0)

      const result = await initPromise
      expect(result).toBe(true)
      expect(mockIndexedDB.open).toHaveBeenCalledWith('ContextMaxCache', 1)
    })

    it('should handle database initialization errors', async () => {
      const mockOpenRequest = createMockRequest(null, new Error('DB Error'))
      mockIndexedDB.open.mockReturnValue(mockOpenRequest)

      const initPromise = cacheComposable.initDB()

      // Simulate error
      setTimeout(() => {
        if (mockOpenRequest.onerror) {
          mockOpenRequest.onerror(new Event('error'))
        }
      }, 0)

      const result = await initPromise
      expect(result).toBe(false)
    })

    it('should create object stores on upgrade', async () => {
      const mockCreateObjectStore = vi.fn().mockReturnValue(mockObjectStore)
      const mockOpenRequest = {
        ...createMockRequest(mockDatabase),
        onupgradeneeded: null as ((event: Event) => void) | null
      }
      mockIndexedDB.open.mockReturnValue(mockOpenRequest)

      const initPromise = cacheComposable.initDB()

      // Simulate upgrade needed
      setTimeout(() => {
        if (mockOpenRequest.onupgradeneeded) {
          const mockEvent = {
            target: { result: { 
              createObjectStore: mockCreateObjectStore,
              objectStoreNames: { contains: vi.fn().mockReturnValue(false) }
            } }
          } as unknown as Event
          mockOpenRequest.onupgradeneeded(mockEvent)
        }

        if (mockOpenRequest.onsuccess) {
          mockOpenRequest.onsuccess(new Event('success'))
        }
      }, 0)

      const result = await initPromise
      expect(result).toBe(true)
      expect(mockCreateObjectStore).toHaveBeenCalledWith('file_embeddings', { keyPath: 'path' })
      expect(mockCreateObjectStore).toHaveBeenCalledWith('project_embeddings', { keyPath: 'projectHash' })
    })

    it('should return false when IndexedDB is not supported', async () => {
      // Create a new composable instance without indexedDB
      vi.stubGlobal('indexedDB', undefined)
      const tempComposable = useIndexedDBCache()

      const result = await tempComposable.initDB()
      expect(result).toBe(false)

      // Restore indexedDB
      vi.stubGlobal('indexedDB', mockIndexedDB)
    })
  })

  describe('Hash Calculation', () => {
    it('should calculate SHA-256 hash for content', async () => {
      const content = 'test content'
      const mockHashBuffer = new Uint8Array([1, 2, 3, 4]).buffer
      mockCrypto.subtle.digest.mockResolvedValue(mockHashBuffer)

      const hash = await cacheComposable.calculateHash(content)

      expect(hash).toBe('01020304')
      expect(mockCrypto.subtle.digest).toHaveBeenCalledWith('SHA-256', expect.any(Uint8Array))
    })

    it('should calculate project hash from multiple files', async () => {
      const files = [
        { path: 'file1.ts', content: 'content1' },
        { path: 'file2.ts', content: 'content2' }
      ]
      const mockHashBuffer = new Uint8Array([1, 2, 3, 4]).buffer
      mockCrypto.subtle.digest.mockResolvedValue(mockHashBuffer)

      const hash = await cacheComposable.calculateProjectHash(files)

      expect(hash).toBe('01020304')
      expect(mockCrypto.subtle.digest).toHaveBeenCalled()
    })

    it('should handle crypto API errors gracefully', async () => {
      mockCrypto.subtle.digest.mockRejectedValue(new Error('Crypto error'))

      await expect(cacheComposable.calculateHash('test')).rejects.toThrow('Crypto error')
    })
  })

  describe('Embedding Cache Operations', () => {
    beforeEach(async () => {
      // Initialize DB for these tests
      const mockOpenRequest = createMockRequest(mockDatabase)
      mockIndexedDB.open.mockReturnValue(mockOpenRequest)
      
      const initPromise = cacheComposable.initDB()
      setTimeout(() => {
        if (mockOpenRequest.onsuccess) {
          mockOpenRequest.onsuccess(new Event('success'))
        }
      }, 0)
      await initPromise
    })

    it('should store file embedding successfully', async () => {
      const filePath = 'test.ts'
      const contentHash = 'hash123'
      const embedding = [0.1, 0.2, 0.3]

      const mockPutRequest = createMockRequest(true)
      mockObjectStore.put.mockReturnValue(mockPutRequest)

      const storePromise = cacheComposable.storeCachedEmbedding(filePath, contentHash, embedding)

      // Simulate successful storage
      setTimeout(() => {
        if (mockPutRequest.onsuccess) {
          mockPutRequest.onsuccess(new Event('success'))
        }
      }, 0)

      const result = await storePromise

      expect(result).toBe(true)
      expect(mockDatabase.transaction).toHaveBeenCalledWith(['file_embeddings'], 'readwrite')
      expect(mockObjectStore.put).toHaveBeenCalledWith({
        path: filePath,
        hash: contentHash,
        embedding,
        timestamp: expect.any(Number)
      })
    })

    it('should retrieve cached embedding successfully', async () => {
      const filePath = 'test.ts'
      const contentHash = 'hash123'
      const cachedEmbedding: CachedFileEmbedding = {
        path: filePath,
        hash: contentHash,
        embedding: [0.1, 0.2, 0.3],
        timestamp: Date.now()
      }

      const mockGetRequest = createMockRequest(cachedEmbedding)
      mockObjectStore.get.mockReturnValue(mockGetRequest)

      const getPromise = cacheComposable.getCachedEmbedding(filePath, contentHash)

      // Simulate successful retrieval
      setTimeout(() => {
        if (mockGetRequest.onsuccess) {
          mockGetRequest.onsuccess(new Event('success'))
        }
      }, 0)

      const result = await getPromise

      expect(result).toEqual(cachedEmbedding.embedding)
      expect(mockDatabase.transaction).toHaveBeenCalledWith(['file_embeddings'], 'readonly')
      expect(mockObjectStore.get).toHaveBeenCalledWith(filePath)
    })

    it('should return null for non-existent cached embedding', async () => {
      const mockGetRequest = createMockRequest(undefined)
      mockObjectStore.get.mockReturnValue(mockGetRequest)

      const getPromise = cacheComposable.getCachedEmbedding('nonexistent.ts', 'hash')

      setTimeout(() => {
        if (mockGetRequest.onsuccess) {
          mockGetRequest.onsuccess(new Event('success'))
        }
      }, 0)

      const result = await getPromise
      expect(result).toBeNull()
    })

    it('should return null for cached embedding with different hash', async () => {
      const cachedEmbedding: CachedFileEmbedding = {
        path: 'test.ts',
        hash: 'different-hash',
        embedding: [0.1, 0.2, 0.3],
        timestamp: Date.now()
      }

      const mockGetRequest = createMockRequest(cachedEmbedding)
      mockObjectStore.get.mockReturnValue(mockGetRequest)

      const getPromise = cacheComposable.getCachedEmbedding('test.ts', 'expected-hash')

      setTimeout(() => {
        if (mockGetRequest.onsuccess) {
          mockGetRequest.onsuccess(new Event('success'))
        }
      }, 0)

      const result = await getPromise
      expect(result).toBeNull()
    })

    it('should handle embedding storage errors gracefully', async () => {
      const mockPutRequest = createMockRequest(null, new Error('Storage error'))
      mockObjectStore.put.mockReturnValue(mockPutRequest)

      const storePromise = cacheComposable.storeCachedEmbedding('test.ts', 'hash', [0.1])

      setTimeout(() => {
        if (mockPutRequest.onerror) {
          mockPutRequest.onerror(new Event('error'))
        }
      }, 0)

      const result = await storePromise
      expect(result).toBe(false)
    })
  })

  describe('Project Embeddings Cache Operations', () => {
    beforeEach(async () => {
      // Initialize DB for these tests
      const mockOpenRequest = createMockRequest(mockDatabase)
      mockIndexedDB.open.mockReturnValue(mockOpenRequest)
      
      const initPromise = cacheComposable.initDB()
      setTimeout(() => {
        if (mockOpenRequest.onsuccess) {
          mockOpenRequest.onsuccess(new Event('success'))
        }
      }, 0)
      await initPromise
    })

    it('should store project embeddings successfully', async () => {
      const projectHash = 'project-abc123'
      const fileEmbeddings = { 'file1.ts': [0.1, 0.2] }

      const mockPutRequest = createMockRequest(true)
      mockObjectStore.put.mockReturnValue(mockPutRequest)

      const storePromise = cacheComposable.storeCachedProjectEmbeddings(
        projectHash,
        fileEmbeddings
      )

      setTimeout(() => {
        if (mockPutRequest.onsuccess) {
          mockPutRequest.onsuccess(new Event('success'))
        }
      }, 0)

      const result = await storePromise

      expect(result).toBe(true)
      expect(mockDatabase.transaction).toHaveBeenCalledWith(['project_embeddings'], 'readwrite')
      expect(mockObjectStore.put).toHaveBeenCalledWith({
        projectHash,
        fileEmbeddings,
        timestamp: expect.any(Number)
      })
    })

    it('should retrieve cached project embeddings successfully', async () => {
      const projectHash = 'project-abc123'
      const cachedEmbeddings: CachedProjectEmbeddings = {
        projectHash,
        fileEmbeddings: { 'file1.ts': [0.1, 0.2] },
        timestamp: Date.now()
      }

      const mockGetRequest = createMockRequest(cachedEmbeddings)
      mockObjectStore.get.mockReturnValue(mockGetRequest)

      const getPromise = cacheComposable.getCachedProjectEmbeddings(projectHash)

      setTimeout(() => {
        if (mockGetRequest.onsuccess) {
          mockGetRequest.onsuccess(new Event('success'))
        }
      }, 0)

      const result = await getPromise

      expect(result).toEqual(cachedEmbeddings)
      expect(mockDatabase.transaction).toHaveBeenCalledWith(['project_embeddings'], 'readonly')
      expect(mockObjectStore.get).toHaveBeenCalledWith(projectHash)
    })

    it('should return null for non-existent project embeddings', async () => {
      const mockGetRequest = createMockRequest(undefined)
      mockObjectStore.get.mockReturnValue(mockGetRequest)

      const getPromise = cacheComposable.getCachedProjectEmbeddings('nonexistent')

      setTimeout(() => {
        if (mockGetRequest.onsuccess) {
          mockGetRequest.onsuccess(new Event('success'))
        }
      }, 0)

      const result = await getPromise
      expect(result).toBeNull()
    })

    it('should handle project embeddings storage errors gracefully', async () => {
      const mockPutRequest = createMockRequest(null, new Error('Storage error'))
      mockObjectStore.put.mockReturnValue(mockPutRequest)

      const storePromise = cacheComposable.storeCachedProjectEmbeddings('hash', {})

      setTimeout(() => {
        if (mockPutRequest.onerror) {
          mockPutRequest.onerror(new Event('error'))
        }
      }, 0)

      const result = await storePromise
      expect(result).toBe(false)
    })
  })

  describe('Cache Cleanup Operations', () => {
    beforeEach(async () => {
      // Initialize DB for these tests
      const mockOpenRequest = createMockRequest(mockDatabase)
      mockIndexedDB.open.mockReturnValue(mockOpenRequest)
      
      const initPromise = cacheComposable.initDB()
      setTimeout(() => {
        if (mockOpenRequest.onsuccess) {
          mockOpenRequest.onsuccess(new Event('success'))
        }
      }, 0)
      await initPromise
    })

    it('should clean old cache entries', async () => {
      await cacheComposable.cleanOldCache()

      expect(mockDatabase.transaction).toHaveBeenCalledWith(['file_embeddings'], 'readwrite')
      expect(mockDatabase.transaction).toHaveBeenCalledWith(['project_embeddings'], 'readwrite')
    })

    it('should handle cleanup errors gracefully', async () => {
      mockDatabase.transaction.mockImplementation(() => {
        throw new Error('Transaction error')
      })

      await expect(cacheComposable.cleanOldCache()).resolves.not.toThrow()
    })
  })

  describe('Cache Statistics', () => {
    beforeEach(async () => {
      // Initialize DB for these tests
      const mockOpenRequest = createMockRequest(mockDatabase)
      mockIndexedDB.open.mockReturnValue(mockOpenRequest)
      
      const initPromise = cacheComposable.initDB()
      setTimeout(() => {
        if (mockOpenRequest.onsuccess) {
          mockOpenRequest.onsuccess(new Event('success'))
        }
      }, 0)
      await initPromise
    })

    it('should return cache statistics', async () => {
      const mockCountRequest1 = createMockRequest(5)
      const mockCountRequest2 = createMockRequest(3)
      mockObjectStore.count.mockReturnValueOnce(mockCountRequest1).mockReturnValueOnce(mockCountRequest2)

      const statsPromise = cacheComposable.getCacheStats()

      // Trigger callbacks immediately
      setImmediate(() => {
        if (mockCountRequest1.onsuccess) {
          mockCountRequest1.onsuccess(new Event('success'))
        }
      })
      
      setImmediate(() => {
        if (mockCountRequest2.onsuccess) {
          mockCountRequest2.onsuccess(new Event('success'))
        }
      })

      const stats = await statsPromise

      expect(stats).toEqual({
        embeddingsCount: 5,
        projectEmbeddingsCount: 3
      })
    })

    it('should handle statistics errors gracefully', async () => {
      const mockCountRequest1 = createMockRequest(null, new Error('Count error'))
      const mockCountRequest2 = createMockRequest(null, new Error('Count error'))
      mockObjectStore.count.mockReturnValueOnce(mockCountRequest1).mockReturnValueOnce(mockCountRequest2)

      const statsPromise = cacheComposable.getCacheStats()

      setImmediate(() => {
        if (mockCountRequest1.onerror) {
          mockCountRequest1.onerror(new Event('error'))
        }
      })
      
      setImmediate(() => {
        if (mockCountRequest2.onerror) {
          mockCountRequest2.onerror(new Event('error'))
        }
      })

      const stats = await statsPromise
      expect(stats).toEqual({
        embeddingsCount: 0,
        projectEmbeddingsCount: 0
      })
    })
  })

  describe('Error Handling and Edge Cases', () => {
    it('should handle database connection failures', async () => {
      const mockOpenRequest = createMockRequest(null, new Error('Connection failed'))
      mockIndexedDB.open.mockReturnValue(mockOpenRequest)

      const initPromise = cacheComposable.initDB()

      setTimeout(() => {
        if (mockOpenRequest.onerror) {
          mockOpenRequest.onerror(new Event('error'))
        }
      }, 0)

      const result = await initPromise
      expect(result).toBe(false)
    })

    it('should handle transaction failures', async () => {
      // Don't initialize DB to test null db case
      const result = await cacheComposable.storeCachedEmbedding('test.ts', 'hash', [0.1])
      expect(result).toBe(false)
    })

    it('should handle malformed cached data', async () => {
      // Initialize DB first
      const mockOpenRequest = createMockRequest(mockDatabase)
      mockIndexedDB.open.mockReturnValue(mockOpenRequest)
      
      const initPromise = cacheComposable.initDB()
      setTimeout(() => {
        if (mockOpenRequest.onsuccess) {
          mockOpenRequest.onsuccess(new Event('success'))
        }
      }, 0)
      await initPromise

      // Return malformed data
      const mockGetRequest = createMockRequest({ invalid: 'data' })
      mockObjectStore.get.mockReturnValue(mockGetRequest)

      const getPromise = cacheComposable.getCachedEmbedding('test.ts', 'hash')

      setTimeout(() => {
        if (mockGetRequest.onsuccess) {
          mockGetRequest.onsuccess(new Event('success'))
        }
      }, 0)

      const result = await getPromise
      expect(result).toBeNull()
    })

    it('should handle empty file arrays in project hash calculation', async () => {
      const hash = await cacheComposable.calculateProjectHash([])
      expect(typeof hash).toBe('string')
      expect(hash.length).toBeGreaterThan(0)
    })

    it('should handle very large embeddings', async () => {
      const largeEmbedding = new Array(10000).fill(0.1)
      
      // Initialize DB first
      const mockOpenRequest = createMockRequest(mockDatabase)
      mockIndexedDB.open.mockReturnValue(mockOpenRequest)
      
      const initPromise = cacheComposable.initDB()
      setTimeout(() => {
        if (mockOpenRequest.onsuccess) {
          mockOpenRequest.onsuccess(new Event('success'))
        }
      }, 0)
      await initPromise

      const mockPutRequest = createMockRequest(true)
      mockObjectStore.put.mockReturnValue(mockPutRequest)

      const storePromise = cacheComposable.storeCachedEmbedding('large.ts', 'hash', largeEmbedding)

      setTimeout(() => {
        if (mockPutRequest.onsuccess) {
          mockPutRequest.onsuccess(new Event('success'))
        }
      }, 0)

      const result = await storePromise
      expect(result).toBe(true)
    })

    it('should handle concurrent access gracefully', async () => {
      // Initialize DB first
      const mockOpenRequest = createMockRequest(mockDatabase)
      mockIndexedDB.open.mockReturnValue(mockOpenRequest)
      
      const initPromise = cacheComposable.initDB()
      setImmediate(() => {
        if (mockOpenRequest.onsuccess) {
          mockOpenRequest.onsuccess(new Event('success'))
        }
      })
      await initPromise

      // Simulate concurrent operations
      const promises = Array.from({ length: 5 }, (_, i) => {
        const mockPutRequest = createMockRequest(true)
        mockObjectStore.put.mockReturnValue(mockPutRequest)
        
        const storePromise = cacheComposable.storeCachedEmbedding(`file${i}.ts`, `hash${i}`, [i])
        
        setImmediate(() => {
          if (mockPutRequest.onsuccess) {
            mockPutRequest.onsuccess(new Event('success'))
          }
        })
        
        return storePromise
      })

      const results = await Promise.all(promises)
      expect(results.every(r => r === true)).toBe(true)
    })
  })

  describe('Performance Considerations', () => {
    it('should handle large project analysis data', async () => {
      // Initialize DB first
      const mockOpenRequest = createMockRequest(mockDatabase)
      mockIndexedDB.open.mockReturnValue(mockOpenRequest)
      
      const initPromise = cacheComposable.initDB()
      setTimeout(() => {
        if (mockOpenRequest.onsuccess) {
          mockOpenRequest.onsuccess(new Event('success'))
        }
      }, 0)
      await initPromise

      const largeEmbeddings = Object.fromEntries(
        Array.from({ length: 100 }, (_, i) => [`file${i}.ts`, new Array(1536).fill(i)])
      )

      const mockPutRequest = createMockRequest(true)
      mockObjectStore.put.mockReturnValue(mockPutRequest)

      const storePromise = cacheComposable.storeCachedProjectEmbeddings(
        'large-project-hash',
        largeEmbeddings
      )

      setTimeout(() => {
        if (mockPutRequest.onsuccess) {
          mockPutRequest.onsuccess(new Event('success'))
        }
      }, 0)

      const result = await storePromise
      expect(result).toBe(true)
    })

    it('should batch cleanup operations efficiently', async () => {
      // Initialize DB first
      const mockOpenRequest = createMockRequest(mockDatabase)
      mockIndexedDB.open.mockReturnValue(mockOpenRequest)
      
      const initPromise = cacheComposable.initDB()
      setTimeout(() => {
        if (mockOpenRequest.onsuccess) {
          mockOpenRequest.onsuccess(new Event('success'))
        }
      }, 0)
      await initPromise

      // Mock multiple old entries
      const _mockEntries = Array.from({ length: 100 }, (_, i) => ({
        value: {
          timestamp: Date.now() - (8 * 24 * 60 * 60 * 1000), // Old timestamp
          path: `old-file-${i}.ts`
        }
      }))

      await cacheComposable.cleanOldCache()

      // Should handle batch operations efficiently
      expect(mockDatabase.transaction).toHaveBeenCalled()
    })
  })
}) 