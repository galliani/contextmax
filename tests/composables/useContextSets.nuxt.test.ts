/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */
// @vitest-environment nuxt
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useContextSets } from '~/composables/useContextSets'
import type { ContextSetsData, Workflow, WorkflowPoint } from '~/composables/useContextSets'

describe('useContextSets', () => {
  let contextSets: ReturnType<typeof useContextSets>

  beforeEach(() => {
    vi.clearAllMocks()
    contextSets = useContextSets()
    contextSets.clearAll() // Start with clean state
  })

  describe('File ID Management', () => {
    it('should generate unique file IDs', () => {
      const id1 = contextSets.generateFileId()
      const id2 = contextSets.generateFileId()
      
      expect(id1).toMatch(/^file_[a-z0-9]{8}$/)
      expect(id2).toMatch(/^file_[a-z0-9]{8}$/)
      expect(id1).not.toBe(id2)
    })

    it('should find existing file ID by path', () => {
      const filePath = '/src/test.js'
      const fileId = contextSets.getOrCreateFileId(filePath)
      
      const foundId = contextSets.findFileIdByPath(filePath)
      
      expect(foundId).toBe(fileId)
    })

    it('should return null when file path not found', () => {
      const foundId = contextSets.findFileIdByPath('/nonexistent/file.js')
      
      expect(foundId).toBeNull()
    })

    it('should create new file ID when path does not exist', () => {
      const filePath = '/src/new-file.js'
      
      const fileId = contextSets.getOrCreateFileId(filePath)
      
      expect(fileId).toMatch(/^file_[a-z0-9]{8}$/)
      expect(contextSets.filesManifest.value[fileId]).toEqual({
        path: filePath
      })
    })

    it('should return existing file ID when path already exists', () => {
      const filePath = '/src/existing.js'
      const firstId = contextSets.getOrCreateFileId(filePath)
      const secondId = contextSets.getOrCreateFileId(filePath)
      
      expect(firstId).toBe(secondId)
      expect(Object.keys(contextSets.filesManifest.value)).toHaveLength(1)
    })
  })

  describe('Context Set Management', () => {
    it('should create new context set', () => {
      contextSets.createContextSet('test-set', 'Test description')
      
      expect(contextSets.contextSets.value['test-set']).toEqual({
        description: 'Test description',
        files: [],
        workflows: [],
        uses: []
      })
    })

    it('should handle duplicate context set names gracefully', () => {
      contextSets.createContextSet('duplicate', 'First')
      contextSets.createContextSet('duplicate', 'Second')
      
      expect(contextSets.contextSets.value['duplicate'].description).toBe('First')
      expect(Object.keys(contextSets.contextSets.value)).toHaveLength(1)
    })

    it('should set active context set', () => {
      contextSets.createContextSet('test-set')
      
      const result = contextSets.setActiveContextSet('test-set')
      
      expect(result).toBe(true)
      expect(contextSets.activeContextSetName.value).toBe('test-set')
    })

    it('should not set non-existent context set as active', () => {
      const result = contextSets.setActiveContextSet('nonexistent')
      
      expect(result).toBe(false)
      expect(contextSets.activeContextSetName.value).toBeNull()
    })

    it('should clear active context set', () => {
      contextSets.createContextSet('test-set')
      contextSets.setActiveContextSet('test-set')
      
      contextSets.setActiveContextSet(null)
      
      expect(contextSets.activeContextSetName.value).toBeNull()
    })

    it('should delete context set', async () => {
      contextSets.createContextSet('to-delete')
      contextSets.setActiveContextSet('to-delete')
      
      const result = await contextSets.deleteContextSet('to-delete')
      
      expect(result).toBe(true)
      expect(contextSets.contextSets.value['to-delete']).toBeUndefined()
      expect(contextSets.activeContextSetName.value).toBeNull()
    })

    it('should handle deleting non-existent context set', async () => {
      const result = await contextSets.deleteContextSet('nonexistent')
      
      expect(result).toBe(false)
    })
  })

  describe('File Management in Context Sets', () => {
    beforeEach(() => {
      contextSets.createContextSet('test-set')
      contextSets.setActiveContextSet('test-set')
    })

    it('should add file to active context set', () => {
      const filePath = '/src/test.js'
      
      const result = contextSets.addFileToActiveContextSet(filePath)
      
      expect(result).toBe(true)
      const activeSet = contextSets.contextSets.value['test-set']
      expect(activeSet.files).toHaveLength(1)
      
      const fileId = activeSet.files[0] as string
      expect(contextSets.filesManifest.value[fileId]).toEqual({
        path: filePath
      })
    })

    it('should not add duplicate files to context set', () => {
      const filePath = '/src/test.js'
      
      contextSets.addFileToActiveContextSet(filePath)
      const result = contextSets.addFileToActiveContextSet(filePath)
      
      expect(result).toBe(false)
      expect(contextSets.contextSets.value['test-set'].files).toHaveLength(1)
    })

    it('should throw error when no active context set', () => {
      contextSets.setActiveContextSet(null)
      
      expect(() => {
        contextSets.addFileToActiveContextSet('/src/test.js')
      }).toThrow('No active context set selected')
    })

    it('should remove file from active context set', () => {
      const filePath = '/src/test.js'
      contextSets.addFileToActiveContextSet(filePath)
      const fileId = contextSets.findFileIdByPath(filePath)!
      
      const result = contextSets.removeFileFromActiveContextSet(fileId)
      
      expect(result).toBe(true)
      expect(contextSets.contextSets.value['test-set'].files).toHaveLength(0)
    })

    it('should clean up orphaned files when removing', () => {
      const filePath = '/src/orphan.js'
      contextSets.addFileToActiveContextSet(filePath)
      const fileId = contextSets.findFileIdByPath(filePath)!
      
      // Remove file from context set
      contextSets.removeFileFromActiveContextSet(fileId)
      
      // File should be removed from manifest as it's orphaned
      expect(contextSets.filesManifest.value[fileId]).toBeUndefined()
    })

    it('should not remove files referenced by other context sets', () => {
      const filePath = '/src/shared.js'
      
      // Add file to first context set
      contextSets.addFileToActiveContextSet(filePath)
      const fileId = contextSets.findFileIdByPath(filePath)!
      
      // Create second context set and add same file
      contextSets.createContextSet('second-set')
      contextSets.setActiveContextSet('second-set')
      contextSets.addFileToActiveContextSet(filePath)
      
      // Remove from second set
      contextSets.removeFileFromActiveContextSet(fileId)
      
      // File should still exist in manifest as it's in first set
      expect(contextSets.filesManifest.value[fileId]).toBeDefined()
    })
  })

  describe('Context Set Updates', () => {
    beforeEach(() => {
      contextSets.createContextSet('test-set', 'Original description')
      contextSets.setActiveContextSet('test-set')
    })

    it('should update context set description', () => {
      contextSets.updateActiveContextSet({
        description: 'Updated description'
      })
      
      expect(contextSets.contextSets.value['test-set'].description).toBe('Updated description')
    })

    it('should update context set workflows', () => {
      const workflows: Workflow[] = [
        { fileRefs: ['file1'], description: 'Step 1' },
        { fileRefs: ['file2'], description: 'Step 2' }
      ]
      
      contextSets.updateActiveContextSet({ workflows })
      
      expect(contextSets.contextSets.value['test-set'].workflows).toEqual(workflows)
    })

    it('should handle updating non-existent properties gracefully', () => {
      // Test that updating with legacy properties doesn't break the system
      const legacyUpdate = { entryPoints: [] }
      
      // Should not throw an error
      expect(() => {
        contextSets.updateActiveContextSet(legacyUpdate)
      }).not.toThrow()
    })

    it('should rename context set', () => {
      contextSets.updateActiveContextSet({ name: 'renamed-set' })
      
      expect(contextSets.contextSets.value['renamed-set']).toBeDefined()
      expect(contextSets.contextSets.value['test-set']).toBeUndefined()
      expect(contextSets.activeContextSetName.value).toBe('renamed-set')
    })

    it('should throw error when renaming to existing name', () => {
      contextSets.createContextSet('existing-set')
      
      expect(() => {
        contextSets.updateActiveContextSet({ name: 'existing-set' })
      }).toThrow('Context set "existing-set" already exists')
    })

    it('should throw error when no active context set', () => {
      contextSets.setActiveContextSet(null)
      
      expect(() => {
        contextSets.updateActiveContextSet({ description: 'Test' })
      }).toThrow('No active context set selected')
    })
  })

  describe('File Comment Management', () => {
    it('should update file comment', () => {
      const filePath = '/src/test.js'
      const fileId = contextSets.getOrCreateFileId(filePath)
      
      const result = contextSets.updateFileComment(fileId, 'Updated comment')
      
      expect(result).toBe(true)
      expect(contextSets.filesManifest.value[fileId].comment).toBe('Updated comment')
    })

    it('should return false for non-existent file', () => {
      const result = contextSets.updateFileComment('nonexistent', 'Comment')
      
      expect(result).toBe(false)
    })
  })

  describe('JSON Generation and Loading', () => {
    beforeEach(() => {
      contextSets.createContextSet('test-set', 'Test description')
      contextSets.setActiveContextSet('test-set')
      contextSets.addFileToActiveContextSet('/src/test.js')
    })

    it('should generate complete context sets JSON', () => {
      const json = contextSets.generateContextSetsJSON('test-project')
      
      expect(json.schemaVersion).toBe('1.0')
      expect(json.projectName).toBe('test-project')
      expect(json.sets['test-set']).toBeDefined()
      expect(Object.keys(json.filesIndex)).toHaveLength(1)
    })

    it('should generate files index', () => {
      const index = contextSets.generateFilesIndex()
      
      const fileId = Object.keys(contextSets.filesManifest.value)[0]
      expect(index[fileId]).toEqual({
        path: contextSets.filesManifest.value[fileId].path,
        contexts: ['test-set']
      })
    })

    it('should load context sets data', () => {
      const data: ContextSetsData = {
        schemaVersion: '1.0',
        projectName: 'test-project',
        filesIndex: {
          'file_abc123': {
            path: '/src/loaded.js',
            contexts: ['loaded-set']
          }
        },
        sets: {
          'loaded-set': {
            description: 'Loaded set',
            files: ['file_abc123'],
            workflows: [],
            uses: []
          }
        }
      }
      
      contextSets.loadContextSetsData(data)
      
      expect(contextSets.contextSets.value['loaded-set']).toBeDefined()
      expect(contextSets.filesManifest.value['file_abc123']).toBeDefined()
      expect(contextSets.activeContextSetName.value).toBe('loaded-set')
    })

    it('should filter out unreferenced files when loading', () => {
      const data: ContextSetsData = {
        schemaVersion: '1.0',
        filesManifest: {
          'referenced_file': { path: '/src/used.js', comment: '' },
          'orphaned_file': { path: '/src/unused.js', comment: '' }
        },
        contextSets: {
          'test-set': {
            description: 'Test',
            files: ['referenced_file'], // Only references one file
            workflows: []
          }
        },
        fileContextsIndex: {}
      }
      
      contextSets.loadContextSetsData(data)
      
      expect(contextSets.filesManifest.value['referenced_file']).toBeDefined()
      expect(contextSets.filesManifest.value['orphaned_file']).toBeUndefined()
    })
  })

  describe('Computed Properties', () => {
    it('should provide active context set computed', () => {
      contextSets.createContextSet('test-set', 'Test description')
      contextSets.setActiveContextSet('test-set')
      
      expect(contextSets.activeContextSet.value).toEqual({
        name: 'test-set',
        description: 'Test description',
        files: [],
        workflows: [],
        uses: []
      })
    })

    it('should return null when no active context set', () => {
      expect(contextSets.activeContextSet.value).toBeNull()
    })

    it('should provide context set names', () => {
      contextSets.createContextSet('set1')
      contextSets.createContextSet('set2')
      
      expect(contextSets.contextSetNames.value).toEqual(['set1', 'set2'])
    })

    it('should indicate when context sets exist', () => {
      expect(contextSets.hasContextSets.value).toBe(false)
      
      contextSets.createContextSet('test-set')
      
      expect(contextSets.hasContextSets.value).toBe(true)
    })
  })

  describe('Utility Functions', () => {
    it('should check if file is referenced by any context set', () => {
      contextSets.createContextSet('test-set')
      contextSets.setActiveContextSet('test-set')
      contextSets.addFileToActiveContextSet('/src/test.js')
      
      const fileId = contextSets.findFileIdByPath('/src/test.js')!
      
      expect(contextSets.isFileReferencedByAnyContextSet(fileId)).toBe(true)
      expect(contextSets.isFileReferencedByAnyContextSet('nonexistent')).toBe(false)
    })

    it('should clean up orphaned files', () => {
      // Create file and add to context set
      const fileId = contextSets.getOrCreateFileId('/src/test.js')
      contextSets.createContextSet('test-set')
      contextSets.setActiveContextSet('test-set')
      
      // Manually remove from context set without cleanup
      contextSets.contextSets.value['test-set'].files = []
      
      // File should be orphaned now
      const cleaned = contextSets.cleanupOrphanedFiles()
      
      expect(cleaned).toBe(1)
      expect(contextSets.filesManifest.value[fileId]).toBeUndefined()
    })

    it('should clear all data', () => {
      contextSets.createContextSet('test-set')
      contextSets.setActiveContextSet('test-set')
      contextSets.addFileToActiveContextSet('/src/test.js')
      
      contextSets.clearAll()
      
      expect(contextSets.contextSets.value).toEqual({})
      expect(contextSets.activeContextSetName.value).toBeNull()
      expect(contextSets.filesManifest.value).toEqual({})
    })
  })

  describe('Testing Helpers', () => {
    it('should allow setting files manifest for testing', () => {
      const testManifest = {
        'test_id': { path: '/test/file.js', comment: 'Test file' }
      }
      
      contextSets.setFilesManifestForTesting(testManifest)
      
      expect(contextSets.filesManifest.value).toEqual(testManifest)
    })

    it('should allow adding file to manifest for testing', () => {
      const testEntry = { path: '/test/new.js', comment: 'New test file' }
      
      contextSets.addFileToManifestForTesting('new_id', testEntry)
      
      expect(contextSets.filesManifest.value['new_id']).toEqual(testEntry)
    })
  })

  describe('Blank Property Filtering', () => {
    beforeEach(() => {
      contextSets.clearAll()
    })

    describe('Context Set Creation', () => {
      it('should not include description when empty string is provided', () => {
        contextSets.createContextSet('test-set', '')
        
        const contextSet = contextSets.contextSets.value['test-set']
        expect(contextSet).toEqual({
          files: [],
          workflows: [],
          uses: []
        })
        expect(contextSet).not.toHaveProperty('description')
      })

      it('should not include description when only whitespace is provided', () => {
        contextSets.createContextSet('test-set', '   ')
        
        const contextSet = contextSets.contextSets.value['test-set']
        expect(contextSet).toEqual({
          files: [],
          workflows: [],
          uses: []
        })
        expect(contextSet).not.toHaveProperty('description')
      })

      it('should include description when meaningful content is provided', () => {
        contextSets.createContextSet('test-set', 'Meaningful description')
        
        const contextSet = contextSets.contextSets.value['test-set']
        expect(contextSet.description).toBe('Meaningful description')
      })
    })

    describe('File Manifest Creation', () => {
      it('should not include comment property in file manifest when created', () => {
        const filePath = '/src/test.js'
        const fileId = contextSets.getOrCreateFileId(filePath)
        
        expect(contextSets.filesManifest.value[fileId]).toEqual({
          path: filePath
        })
        expect(contextSets.filesManifest.value[fileId]).not.toHaveProperty('comment')
      })
    })

    describe('File Addition to Context Sets', () => {
      beforeEach(() => {
        contextSets.createContextSet('test-set')
        contextSets.setActiveContextSet('test-set')
      })

      it('should not include comment when empty string is provided', () => {
        const filePath = '/src/test.js'
        
        contextSets.addFileToActiveContextSet(filePath, {
          comment: '',
          classification: 'core-logic'
        })
        
        const activeSet = contextSets.contextSets.value['test-set']
        const fileRef = activeSet.files[0] as any
        
        expect(fileRef).toEqual({
          fileRef: expect.any(String),
          classification: 'core-logic'
        })
        expect(fileRef).not.toHaveProperty('comment')
      })

      it('should not include comment when only whitespace is provided', () => {
        const filePath = '/src/test.js'
        
        contextSets.addFileToActiveContextSet(filePath, {
          comment: '   ',
          classification: 'helper'
        })
        
        const activeSet = contextSets.contextSets.value['test-set']
        const fileRef = activeSet.files[0] as any
        
        expect(fileRef).toEqual({
          fileRef: expect.any(String),
          classification: 'helper'
        })
        expect(fileRef).not.toHaveProperty('comment')
      })

      it('should include comment when meaningful content is provided', () => {
        const filePath = '/src/test.js'
        
        contextSets.addFileToActiveContextSet(filePath, {
          comment: 'This is a meaningful comment',
          classification: 'core-logic'
        })
        
        const activeSet = contextSets.contextSets.value['test-set']
        const fileRef = activeSet.files[0] as any
        
        expect(fileRef).toEqual({
          fileRef: expect.any(String),
          comment: 'This is a meaningful comment',
          classification: 'core-logic'
        })
      })

      it('should use simple string reference when no meaningful metadata is provided', () => {
        const filePath = '/src/test.js'
        
        contextSets.addFileToActiveContextSet(filePath, {
          comment: '',
          // no classification or functionRefs
        })
        
        const activeSet = contextSets.contextSets.value['test-set']
        expect(typeof activeSet.files[0]).toBe('string')
      })

      it('should include functionRefs with cleaned up comments', () => {
        const filePath = '/src/test.js'
        
        contextSets.addFileToActiveContextSet(filePath, {
          functionRefs: [
            { name: 'func1', comment: '' },
            { name: 'func2', comment: 'Meaningful comment' },
            { name: 'func3' } // no comment property
          ]
        })
        
        const activeSet = contextSets.contextSets.value['test-set']
        const fileRef = activeSet.files[0] as any
        
        expect(fileRef.functionRefs).toHaveLength(3)
        expect(fileRef.functionRefs[0]).toEqual({ name: 'func1' })
        expect(fileRef.functionRefs[1]).toEqual({ name: 'func2', comment: 'Meaningful comment' })
        expect(fileRef.functionRefs[2]).toEqual({ name: 'func3' })
      })
    })

    describe('JSON Generation', () => {
      beforeEach(() => {
        contextSets.createContextSet('test-set', 'Test description')
        contextSets.setActiveContextSet('test-set')
      })

      it('should clean up empty properties in generated JSON', () => {
        // Add file with mixed empty and meaningful properties
        contextSets.addFileToActiveContextSet('/src/test.js', {
          comment: '',
          classification: 'core-logic',
          functionRefs: [
            { name: 'func1', comment: '' },
            { name: 'func2', comment: 'Real comment' }
          ]
        })

        const json = contextSets.generateContextSetsJSON()
        
        expect(json.sets['test-set']).toEqual({
          description: 'Test description',
          files: [{
            fileRef: expect.any(String),
            classification: 'core-logic',
            functionRefs: [
              { name: 'func1' },
              { name: 'func2', comment: 'Real comment' }
            ]
          }],
          workflows: [],
          uses: []
        })
      })

      it('should clean up empty properties in prefixed JSON generation', () => {
        // Create context set with empty description
        contextSets.createContextSet('empty-desc', '')
        contextSets.setActiveContextSet('empty-desc')
        contextSets.addFileToActiveContextSet('/src/empty.js')

        const json = contextSets.generateContextSetsJSONWithPrefix()
        
        const contextSet = json.sets['context:empty-desc']
        expect(contextSet.files).toHaveLength(1)
        expect(typeof contextSet.files[0]).toBe('string')
        expect(contextSet.workflows).toEqual([])
        expect(contextSet.uses).toEqual([])
        expect(contextSet).not.toHaveProperty('description')
      })

      it('should preserve meaningful properties while removing empty ones', () => {
        // Create a complex scenario with mixed properties
        contextSets.addFileToActiveContextSet('/src/complex.js', {
          comment: 'File comment',
          classification: 'entry-point',
          functionRefs: [
            { name: 'emptyFunc', comment: '' },
            { name: 'goodFunc', comment: 'Good comment' },
            { name: 'noCommentFunc' }
          ]
        })

        // Add another file with no metadata
        contextSets.addFileToActiveContextSet('/src/simple.js')

        const json = contextSets.generateContextSetsJSON()
        const testSet = json.sets['test-set']
        
        expect(testSet.files).toHaveLength(2)
        
        // First file should have cleaned properties
        expect(testSet.files[0]).toEqual({
          fileRef: expect.any(String),
          comment: 'File comment',
          classification: 'entry-point',
          functionRefs: [
            { name: 'emptyFunc' },
            { name: 'goodFunc', comment: 'Good comment' },
            { name: 'noCommentFunc' }
          ]
        })
        
        // Second file should be simple string reference
        expect(typeof testSet.files[1]).toBe('string')
      })
    })

    describe('Edge Cases', () => {
      it('should handle null and undefined values', () => {
        contextSets.createContextSet('test-set')
        contextSets.setActiveContextSet('test-set')
        
        // Add file using the normal API, then manually create a context set with null/undefined properties for testing
        contextSets.addFileToActiveContextSet('/src/test.js', {
          functionRefs: [
            { name: 'func1', comment: null as any },
            { name: 'func2', comment: undefined as any }
          ]
        })

        const json = contextSets.generateContextSetsJSON()
        const testSet = json.sets['test-set']
        
        expect(testSet.files).toHaveLength(1)
        const fileRef = testSet.files[0] as any
        
        expect(fileRef).toEqual({
          fileRef: expect.any(String),
          functionRefs: [
            { name: 'func1' },
            { name: 'func2' }
          ]
        })
      })

      it('should handle empty arrays and objects', () => {
        contextSets.createContextSet('test-set')
        contextSets.setActiveContextSet('test-set')
        
        // Add file with empty arrays
        contextSets.addFileToActiveContextSet('/src/test.js', {
          functionRefs: []
        })

        const json = contextSets.generateContextSetsJSON()
        const fileRef = json.sets['test-set'].files[0]
        
        // Should be simple string reference since functionRefs is empty
        expect(typeof fileRef).toBe('string')
      })
    })
  })

  describe('LastUpdated Timestamp', () => {
    beforeEach(() => {
      contextSets.clearAll()
    })

    it('should not include lastUpdated by default', () => {
      contextSets.createContextSet('test-set', 'Test description')
      
      const json = contextSets.generateContextSetsJSON('test-project')
      
      expect(json).not.toHaveProperty('lastUpdated')
    })

    it('should include lastUpdated when explicitly requested', () => {
      contextSets.createContextSet('test-set', 'Test description')
      
      const json = contextSets.generateContextSetsJSON('test-project', true)
      
      expect(json).toHaveProperty('lastUpdated')
      expect(json.lastUpdated).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/) // ISO format
    })

    it('should include current timestamp when requested', () => {
      contextSets.createContextSet('test-set', 'Test description')
      
      const beforeTime = new Date()
      const json = contextSets.generateContextSetsJSON('test-project', true)
      const afterTime = new Date()
      
      expect(json.lastUpdated).toBeDefined()
      const timestamp = new Date(json.lastUpdated!)
      expect(timestamp.getTime()).toBeGreaterThanOrEqual(beforeTime.getTime())
      expect(timestamp.getTime()).toBeLessThanOrEqual(afterTime.getTime())
    })

    it('should not include lastUpdated in prefixed JSON by default', () => {
      contextSets.createContextSet('test-set', 'Test description')
      
      const json = contextSets.generateContextSetsJSONWithPrefix('test-project')
      
      expect(json).not.toHaveProperty('lastUpdated')
    })

    it('should include lastUpdated in prefixed JSON when requested', () => {
      contextSets.createContextSet('test-set', 'Test description')
      
      const json = contextSets.generateContextSetsJSONWithPrefix('test-project', true)
      
      expect(json).toHaveProperty('lastUpdated')
      expect(json.lastUpdated).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/) // ISO format
    })

    it('should generate different timestamps for sequential calls', async () => {
      contextSets.createContextSet('test-set', 'Test description')
      
      const json1 = contextSets.generateContextSetsJSON('test-project', true)
      
      // Wait a tiny bit to ensure different timestamps
      await new Promise(resolve => setTimeout(resolve, 1))
      
      const json2 = contextSets.generateContextSetsJSON('test-project', true)
      
      expect(json1.lastUpdated).toBeDefined()
      expect(json2.lastUpdated).toBeDefined()
      expect(json1.lastUpdated).not.toBe(json2.lastUpdated)
    })

    it('should maintain other properties when including timestamp', () => {
      contextSets.createContextSet('test-set', 'Test description')
      contextSets.setActiveContextSet('test-set')
      contextSets.addFileToActiveContextSet('/src/test.js')
      
      const json = contextSets.generateContextSetsJSON('test-project', true)
      
      expect(json).toEqual({
        schemaVersion: '1.0',
        projectName: 'test-project',
        lastUpdated: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/),
        filesIndex: expect.any(Object),
        sets: expect.any(Object)
      })
    })
  })
})