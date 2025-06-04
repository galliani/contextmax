// @vitest-environment nuxt
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import GlobalFilesManifestViewer from '~/components/GlobalFilesManifestViewer.vue'

// Mock the project store
const mockProjectStore = {
  filesManifest: ref({}),
  contextSets: ref({}),
  updateFileManifestComment: vi.fn()
}

// Mock the accessibility composable
const mockAccessibility = {
  announceStatus: vi.fn(),
  announceError: vi.fn()
}

vi.mock('~/composables/useProjectStore', () => ({
  useProjectStore: () => mockProjectStore
}))

vi.mock('~/composables/useAccessibility', () => ({
  useAccessibility: () => mockAccessibility
}))

describe('GlobalFilesManifestViewer', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Reset store values
    mockProjectStore.filesManifest.value = {}
    mockProjectStore.contextSets.value = {}
  })

  describe('Empty State', () => {
    it('should render empty state when no files in manifest', async () => {
      mockProjectStore.filesManifest.value = {}
      
      const wrapper = await mountSuspended(GlobalFilesManifestViewer)
      
      expect(wrapper.text()).toContain('No Files in Manifest')
      expect(wrapper.text()).toContain('Files will appear here automatically when you add them to context sets')
    })

    it('should show empty state icon', async () => {
      mockProjectStore.filesManifest.value = {}
      
      const wrapper = await mountSuspended(GlobalFilesManifestViewer)
      
      const emptyIcon = wrapper.find('[class*="i-lucide:file-x"]')
      expect(emptyIcon.exists()).toBe(true)
    })

    it('should have proper styling for empty state', async () => {
      mockProjectStore.filesManifest.value = {}
      
      const wrapper = await mountSuspended(GlobalFilesManifestViewer)
      
      const emptyState = wrapper.find('.border-2.border-dashed.border-muted')
      expect(emptyState.exists()).toBe(true)
    })
  })

  describe('Files List', () => {
    beforeEach(() => {
      mockProjectStore.filesManifest.value = {
        'file1': {
          path: 'src/components/Button.vue',
          comment: 'Reusable button component'
        },
        'file2': {
          path: 'src/utils/helpers.js',
          comment: ''
        },
        'file3': {
          path: 'src/styles/main.css',
          comment: 'Main stylesheet'
        }
      }
      mockProjectStore.contextSets.value = {
        'ui': {
          files: [{ fileRef: 'file1', comment: 'UI component' }]
        },
        'utils': {
          files: [{ fileRef: 'file2', comment: 'Helper functions' }, { fileRef: 'file1', comment: 'Shared button' }]
        }
      }
    })

    it('should render files when manifest has files', async () => {
      const wrapper = await mountSuspended(GlobalFilesManifestViewer)
      
      expect(wrapper.text()).toContain('Button.vue')
      expect(wrapper.text()).toContain('helpers.js')
      expect(wrapper.text()).toContain('main.css')
    })

    it('should display file paths correctly', async () => {
      const wrapper = await mountSuspended(GlobalFilesManifestViewer)
      
      expect(wrapper.text()).toContain('src/components/Button.vue')
      expect(wrapper.text()).toContain('src/utils/helpers.js')
      expect(wrapper.text()).toContain('src/styles/main.css')
    })

    it('should show file extension badges', async () => {
      const wrapper = await mountSuspended(GlobalFilesManifestViewer)
      
      expect(wrapper.text()).toContain('vue')
      expect(wrapper.text()).toContain('js')
      expect(wrapper.text()).toContain('css')
    })

    it('should display appropriate file icons', async () => {
      const wrapper = await mountSuspended(GlobalFilesManifestViewer)
      
      // Should have file icons (exact icon depends on extension)
      const fileIcons = wrapper.findAll('[class*="i-lucide:file"], [class*="i-lucide:globe"], [class*="i-lucide:palette"]')
      expect(fileIcons.length).toBeGreaterThan(0)
    })

    it('should show global comments in textareas', async () => {
      const wrapper = await mountSuspended(GlobalFilesManifestViewer)
      
      const textareas = wrapper.findAll('textarea')
      expect(textareas.length).toBe(3)
      
      expect(textareas[0].element.value).toBe('Reusable button component')
      expect(textareas[1].element.value).toBe('')
      expect(textareas[2].element.value).toBe('Main stylesheet')
    })

    it('should calculate context set usage correctly', async () => {
      const wrapper = await mountSuspended(GlobalFilesManifestViewer)
      
      // file1 is used in 2 context sets (ui and utils)
      expect(wrapper.text()).toContain('Used in 2 context sets')
      
      // file2 is used in 1 context set (utils)
      expect(wrapper.text()).toContain('Used in 1 context set')
    })
  })

  describe('Comment Editing', () => {
    beforeEach(() => {
      mockProjectStore.filesManifest.value = {
        'file1': {
          path: 'src/test.js',
          comment: 'Original comment'
        }
      }
    })

    it('should update comment when textarea loses focus', async () => {
      const wrapper = await mountSuspended(GlobalFilesManifestViewer)
      
      const textarea = wrapper.find('textarea')
      await textarea.setValue('Updated comment')
      await textarea.trigger('blur')
      
      expect(mockProjectStore.updateFileManifestComment).toHaveBeenCalledWith('file1', 'Updated comment')
      expect(mockAccessibility.announceStatus).toHaveBeenCalledWith('Global comment updated')
    })

    it('should update comment when Ctrl+Enter is pressed', async () => {
      const wrapper = await mountSuspended(GlobalFilesManifestViewer)
      
      const textarea = wrapper.find('textarea')
      await textarea.setValue('Updated comment')
      await textarea.trigger('keydown.enter', { ctrlKey: true })
      
      expect(mockProjectStore.updateFileManifestComment).toHaveBeenCalledWith('file1', 'Updated comment')
    })

    it('should not update if comment is unchanged', async () => {
      const wrapper = await mountSuspended(GlobalFilesManifestViewer)
      
      const textarea = wrapper.find('textarea')
      await textarea.trigger('blur')
      
      expect(mockProjectStore.updateFileManifestComment).not.toHaveBeenCalled()
    })

    it('should handle empty comments', async () => {
      const wrapper = await mountSuspended(GlobalFilesManifestViewer)
      
      const textarea = wrapper.find('textarea')
      await textarea.setValue('')
      await textarea.trigger('blur')
      
      expect(mockProjectStore.updateFileManifestComment).toHaveBeenCalledWith('file1', '')
    })

    it('should trim whitespace from comments', async () => {
      const wrapper = await mountSuspended(GlobalFilesManifestViewer)
      
      const textarea = wrapper.find('textarea')
      await textarea.setValue('  Updated comment  ')
      await textarea.trigger('blur')
      
      expect(mockProjectStore.updateFileManifestComment).toHaveBeenCalledWith('file1', 'Updated comment')
    })
  })

  describe('Error Handling', () => {
    beforeEach(() => {
      mockProjectStore.filesManifest.value = {
        'file1': {
          path: 'src/test.js',
          comment: 'Original comment'
        }
      }
    })

    it('should handle updateFileManifestComment throwing error', async () => {
      mockProjectStore.updateFileManifestComment.mockImplementation(() => {
        throw new Error('Update failed')
      })
      
      const wrapper = await mountSuspended(GlobalFilesManifestViewer)
      
      const textarea = wrapper.find('textarea')
      await textarea.setValue('New comment')
      await textarea.trigger('blur')
      
      expect(mockAccessibility.announceError).toHaveBeenCalledWith('Update failed')
    })

    it('should revert editing state on error', async () => {
      mockProjectStore.updateFileManifestComment.mockImplementation(() => {
        throw new Error('Update failed')
      })
      
      const wrapper = await mountSuspended(GlobalFilesManifestViewer)
      
      const textarea = wrapper.find('textarea')
      await textarea.setValue('New comment')
      await textarea.trigger('blur')
      
      // Should revert to original value
      expect(textarea.element.value).toBe('Original comment')
    })
  })

  describe('File Actions', () => {
    beforeEach(() => {
      mockProjectStore.filesManifest.value = {
        'file1': {
          path: 'src/components/Button.vue',
          comment: 'Test comment'
        }
      }
      mockProjectStore.contextSets.value = {
        'ui': {
          files: [{ fileRef: 'file1', comment: 'UI component' }]
        }
      }
    })

    it('should have view usage button', async () => {
      const wrapper = await mountSuspended(GlobalFilesManifestViewer)
      
      const viewUsageButton = wrapper.find('button[title="View usage in context sets"]')
      expect(viewUsageButton.exists()).toBe(true)
    })

    it('should have view file content button', async () => {
      const wrapper = await mountSuspended(GlobalFilesManifestViewer)
      
      const viewFileButton = wrapper.find('button[title="View file content"]')
      expect(viewFileButton.exists()).toBe(true)
    })

    it('should announce usage when view usage is clicked', async () => {
      const wrapper = await mountSuspended(GlobalFilesManifestViewer)
      
      const viewUsageButton = wrapper.find('button[title="View usage in context sets"]')
      await viewUsageButton.trigger('click')
      
      expect(mockAccessibility.announceStatus).toHaveBeenCalledWith('Button.vue is used in 1 context set')
    })

    it('should announce file viewing when view file is clicked', async () => {
      const wrapper = await mountSuspended(GlobalFilesManifestViewer)
      
      const viewFileButton = wrapper.find('button[title="View file content"]')
      await viewFileButton.trigger('click')
      
      expect(mockAccessibility.announceStatus).toHaveBeenCalledWith('Viewing file: Button.vue')
    })

    it('should have proper ARIA labels', async () => {
      const wrapper = await mountSuspended(GlobalFilesManifestViewer)
      
      const viewUsageButton = wrapper.find('button[aria-label*="View context sets using Button.vue"]')
      expect(viewUsageButton.exists()).toBe(true)
      
      const viewFileButton = wrapper.find('button[aria-label*="View content of Button.vue"]')
      expect(viewFileButton.exists()).toBe(true)
    })
  })

  describe('File Type Handling', () => {
    beforeEach(() => {
      mockProjectStore.filesManifest.value = {
        'vue-file': { path: 'Component.vue', comment: '' },
        'js-file': { path: 'script.js', comment: '' },
        'ts-file': { path: 'types.ts', comment: '' },
        'css-file': { path: 'styles.css', comment: '' },
        'html-file': { path: 'index.html', comment: '' },
        'json-file': { path: 'package.json', comment: '' },
        'md-file': { path: 'README.md', comment: '' },
        'unknown-file': { path: 'unknown', comment: '' }
      }
    })

    it('should display correct extension badges for different file types', async () => {
      const wrapper = await mountSuspended(GlobalFilesManifestViewer)
      
      expect(wrapper.text()).toContain('vue')
      expect(wrapper.text()).toContain('js')
      expect(wrapper.text()).toContain('ts')
      expect(wrapper.text()).toContain('css')
      expect(wrapper.text()).toContain('html')
      expect(wrapper.text()).toContain('json')
      expect(wrapper.text()).toContain('md')
    })

    it('should handle files without extensions', async () => {
      const wrapper = await mountSuspended(GlobalFilesManifestViewer)
      
      // Should not crash and should show the filename
      expect(wrapper.text()).toContain('unknown')
    })

    it('should apply correct color classes to extension badges', async () => {
      const wrapper = await mountSuspended(GlobalFilesManifestViewer)
      
      // Vue files should have green styling
      const vueBadge = wrapper.find('.bg-green-50')
      expect(vueBadge.exists()).toBe(true)
    })
  })

  describe('Summary Information', () => {
    beforeEach(() => {
      mockProjectStore.filesManifest.value = {
        'file1': { path: 'test1.js', comment: '' },
        'file2': { path: 'test2.js', comment: '' }
      }
    })

    it('should show summary info when files exist', async () => {
      const wrapper = await mountSuspended(GlobalFilesManifestViewer)
      
      expect(wrapper.text()).toContain('Global Manifest Information')
      expect(wrapper.text()).toContain('Files are automatically added here when included in any context set')
      expect(wrapper.text()).toContain('Global comments apply to the file across all context sets')
    })

    it('should not show summary info when no files exist', async () => {
      mockProjectStore.filesManifest.value = {}
      
      const wrapper = await mountSuspended(GlobalFilesManifestViewer)
      
      expect(wrapper.text()).not.toContain('Global Manifest Information')
    })

    it('should have info icon in summary', async () => {
      const wrapper = await mountSuspended(GlobalFilesManifestViewer)
      
      const infoIcon = wrapper.find('[class*="i-lucide:info"]')
      expect(infoIcon.exists()).toBe(true)
    })
  })

  describe('Header and Layout', () => {
    it('should have proper header with title and description', async () => {
      const wrapper = await mountSuspended(GlobalFilesManifestViewer)
      
      expect(wrapper.text()).toContain('All Files in Manifest')
      expect(wrapper.text()).toContain('Files automatically added when included in any context set')
    })

    it('should use proper heading hierarchy', async () => {
      const wrapper = await mountSuspended(GlobalFilesManifestViewer)
      
      const mainHeading = wrapper.findAll('h3').find(h => h.text().includes('All Files in Manifest'))
      expect(mainHeading?.exists()).toBe(true)
    })

    it('should have proper spacing and layout classes', async () => {
      const wrapper = await mountSuspended(GlobalFilesManifestViewer)
      
      const container = wrapper.find('.space-y-4')
      expect(container.exists()).toBe(true)
    })
  })

  describe('Edge Cases', () => {
    it('should handle files with very long paths', async () => {
      mockProjectStore.filesManifest.value = {
        'file1': {
          path: 'src/very/deep/nested/folder/structure/with/a/very/long/path/file.js',
          comment: ''
        }
      }
      
      const wrapper = await mountSuspended(GlobalFilesManifestViewer)
      
      // Should not crash and should display the path
      expect(wrapper.text()).toContain('file.js')
      expect(wrapper.text()).toContain('src/very/deep/nested/folder/structure/with/a/very/long/path/file.js')
    })

    it('should handle files with special characters in names', async () => {
      mockProjectStore.filesManifest.value = {
        'file1': {
          path: 'src/file-with-special@chars#.vue',
          comment: ''
        }
      }
      
      const wrapper = await mountSuspended(GlobalFilesManifestViewer)
      
      expect(wrapper.text()).toContain('file-with-special@chars#.vue')
    })

    it('should handle missing comment property', async () => {
      mockProjectStore.filesManifest.value = {
        'file1': {
          path: 'src/test.js'
          // missing comment property
        }
      }
      
      const wrapper = await mountSuspended(GlobalFilesManifestViewer)
      
      const textarea = wrapper.find('textarea')
      expect(textarea.element.value).toBe('')
    })

    it('should handle context sets with mixed file reference formats', async () => {
      mockProjectStore.filesManifest.value = {
        'file1': { path: 'test1.js', comment: '' },
        'file2': { path: 'test2.js', comment: '' }
      }
      mockProjectStore.contextSets.value = {
        'mixed': {
          files: [
            'file1', // string reference
            { fileRef: 'file2', comment: 'Object reference' }, // object reference
            { fileRef: 'nonexistent', comment: 'Non-existent file' }
          ]
        }
      }
      
      const wrapper = await mountSuspended(GlobalFilesManifestViewer)
      
      // Should handle both reference types without crashing
      expect(wrapper.text()).toContain('Used in 1 context set')
    })

    it('should handle empty context sets object', async () => {
      mockProjectStore.filesManifest.value = {
        'file1': { path: 'test.js', comment: '' }
      }
      mockProjectStore.contextSets.value = {}
      
      const wrapper = await mountSuspended(GlobalFilesManifestViewer)
      
      expect(wrapper.text()).toContain('Used in 0 context sets')
    })
  })

  describe('Reactive Updates', () => {
    it('should react to filesManifest changes', async () => {
      mockProjectStore.filesManifest.value = {}
      
      const wrapper = await mountSuspended(GlobalFilesManifestViewer)
      
      expect(wrapper.text()).toContain('No Files in Manifest')
      
      // Add files to manifest
      mockProjectStore.filesManifest.value = {
        'file1': { path: 'newfile.js', comment: 'New file' }
      }
      
      await wrapper.vm.$nextTick()
      
      expect(wrapper.text()).toContain('newfile.js')
    })

    it('should initialize editing comments when manifest changes', async () => {
      mockProjectStore.filesManifest.value = {}
      
      const wrapper = await mountSuspended(GlobalFilesManifestViewer)
      
      // Add files to manifest
      mockProjectStore.filesManifest.value = {
        'file1': { path: 'test.js', comment: 'Test comment' }
      }
      
      await wrapper.vm.$nextTick()
      
      const textarea = wrapper.find('textarea')
      expect(textarea.element.value).toBe('Test comment')
    })
  })
}) 