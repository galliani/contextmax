// @vitest-environment nuxt
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import FileContentModal from '~/components/FileContentModal.vue'

// Mock the project store
const mockProjectStore = {
  currentFileContent: ref(''),
  currentFileName: ref(''),
  isFileContentModalOpen: ref(false),
  closeFileContentModal: vi.fn()
}

vi.mock('~/composables/useProjectStore', () => ({
  useProjectStore: () => mockProjectStore
}))

// Helper function to find teleported dialog content
const findDialogInBody = () => {
  return document.body.querySelector('[data-slot="dialog-content"], [role="dialog"]')
}

const findDialogOverlayInBody = () => {
  return document.body.querySelector('[data-slot="dialog-overlay"]')
}

// Helper to get text content from body
const getDialogText = () => {
  const dialog = findDialogInBody()
  return dialog ? dialog.textContent : ''
}

// Helper to find elements within the dialog
const findInDialog = (selector: string) => {
  const dialog = findDialogInBody()
  return dialog ? dialog.querySelector(selector) : null
}

const findAllInDialog = (selector: string) => {
  const dialog = findDialogInBody()
  return dialog ? dialog.querySelectorAll(selector) : []
}

describe('FileContentModal', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Reset store values
    mockProjectStore.currentFileContent.value = ''
    mockProjectStore.currentFileName.value = ''
    mockProjectStore.isFileContentModalOpen.value = false
  })

  describe('Modal Visibility', () => {
    it('should not render modal when closed', async () => {
      mockProjectStore.isFileContentModalOpen.value = false
      
      const _component = await mountSuspended(FileContentModal)
      
      // Wait for potential teleportation
      await new Promise(resolve => setTimeout(resolve, 50))
      
      // Dialog should not be visible in body
      const dialogInBody = findDialogInBody()
      expect(dialogInBody).toBeNull()
    })

    it('should render modal when open', async () => {
      mockProjectStore.isFileContentModalOpen.value = true
      mockProjectStore.currentFileName.value = 'test.js'
      
      const _component = await mountSuspended(FileContentModal)
      
      // Wait for teleportation
      await new Promise(resolve => setTimeout(resolve, 50))
      
      // Dialog should be visible in body
      const dialogInBody = findDialogInBody()
      expect(dialogInBody).not.toBeNull()
      expect(dialogInBody?.getAttribute('role')).toBe('dialog')
    })
  })

  describe('File Name Display', () => {
    it('should display current file name in modal header', async () => {
      mockProjectStore.isFileContentModalOpen.value = true
      mockProjectStore.currentFileName.value = 'components/TestComponent.vue'
      
      const _component = await mountSuspended(FileContentModal)
      await new Promise(resolve => setTimeout(resolve, 50))
      
      const dialogText = getDialogText()
      expect(dialogText).toContain('components/TestComponent.vue')
    })

    it('should display "File Content" title', async () => {
      mockProjectStore.isFileContentModalOpen.value = true
      
      const _component = await mountSuspended(FileContentModal)
      await new Promise(resolve => setTimeout(resolve, 50))
      
      const dialogText = getDialogText()
      expect(dialogText).toContain('File Content')
    })
  })

  describe('File Content Display', () => {
    it('should show empty state when no content', async () => {
      mockProjectStore.isFileContentModalOpen.value = true
      mockProjectStore.currentFileContent.value = ''
      
      const _component = await mountSuspended(FileContentModal)
      await new Promise(resolve => setTimeout(resolve, 50))
      
      const dialogText = getDialogText()
      expect(dialogText).toContain('No file content available')
    })

    it('should display file content with line numbers', async () => {
      mockProjectStore.isFileContentModalOpen.value = true
      mockProjectStore.currentFileContent.value = 'line 1\nline 2\nline 3'
      
      const _component = await mountSuspended(FileContentModal)
      await new Promise(resolve => setTimeout(resolve, 50))
      
      const dialogText = getDialogText()
      // Should show line numbers
      expect(dialogText).toContain('1')
      expect(dialogText).toContain('2')
      expect(dialogText).toContain('3')
      
      // Should show content
      expect(dialogText).toContain('line 1')
      expect(dialogText).toContain('line 2')
      expect(dialogText).toContain('line 3')
    })

    it('should handle single line content', async () => {
      mockProjectStore.isFileContentModalOpen.value = true
      mockProjectStore.currentFileContent.value = 'single line'
      
      const _component = await mountSuspended(FileContentModal)
      await new Promise(resolve => setTimeout(resolve, 50))
      
      const dialogText = getDialogText()
      // Should show line number 1
      expect(dialogText).toContain('1')
      expect(dialogText).toContain('single line')
    })

    it('should handle empty lines correctly', async () => {
      mockProjectStore.isFileContentModalOpen.value = true
      mockProjectStore.currentFileContent.value = 'line 1\n\nline 3'
      
      const _component = await mountSuspended(FileContentModal)
      await new Promise(resolve => setTimeout(resolve, 50))
      
      const dialogText = getDialogText()
      // Should show 3 line numbers
      expect(dialogText).toContain('1')
      expect(dialogText).toContain('2')
      expect(dialogText).toContain('3')
    })
  })

  describe('Modal Actions', () => {
    it('should render close button', async () => {
      mockProjectStore.isFileContentModalOpen.value = true
      
      const _component = await mountSuspended(FileContentModal)
      await new Promise(resolve => setTimeout(resolve, 50))
      
      const closeButton = findInDialog('button')
      expect(closeButton).not.toBeNull()
      expect(closeButton?.textContent).toContain('Close')
    })

    it('should call closeFileContentModal when close button clicked', async () => {
      mockProjectStore.isFileContentModalOpen.value = true
      
      const _component = await mountSuspended(FileContentModal)
      await new Promise(resolve => setTimeout(resolve, 50))
      
      const closeButton = findInDialog('button') as HTMLButtonElement
      expect(closeButton).not.toBeNull()
      
      closeButton.click()
      
      expect(mockProjectStore.closeFileContentModal).toHaveBeenCalledOnce()
    })
  })

  describe('Computed Properties', () => {
    it('should compute file lines correctly', async () => {
      mockProjectStore.isFileContentModalOpen.value = true
      mockProjectStore.currentFileContent.value = 'line 1\nline 2\nline 3'
      
      const _component = await mountSuspended(FileContentModal)
      await new Promise(resolve => setTimeout(resolve, 50))
      
      // Check that each line is rendered as a separate code element
      const codeElements = findAllInDialog('code')
      expect(codeElements.length).toBe(3)
    })

    it('should compute total lines correctly', async () => {
      mockProjectStore.isFileContentModalOpen.value = true
      mockProjectStore.currentFileContent.value = 'line 1\nline 2\nline 3\nline 4\nline 5'
      
      const _component = await mountSuspended(FileContentModal)
      await new Promise(resolve => setTimeout(resolve, 50))
      
      const dialogText = getDialogText()
      // Should show line numbers 1-5
      for (let i = 1; i <= 5; i++) {
        expect(dialogText).toContain(i.toString())
      }
    })
  })

  describe('Modal State Management', () => {
    it('should react to isFileContentModalOpen changes', async () => {
      mockProjectStore.isFileContentModalOpen.value = false
      
      const _component = await mountSuspended(FileContentModal)
      await new Promise(resolve => setTimeout(resolve, 50))
      
      // Modal should not be visible
      expect(findDialogInBody()).toBeNull()
      
      // Change the state
      mockProjectStore.isFileContentModalOpen.value = true
      await new Promise(resolve => setTimeout(resolve, 50))
      
      // Modal should now be visible
      expect(findDialogInBody()).not.toBeNull()
    })

    it('should react to currentFileName changes', async () => {
      mockProjectStore.isFileContentModalOpen.value = true
      mockProjectStore.currentFileName.value = 'initial.js'
      
      const _component = await mountSuspended(FileContentModal)
      await new Promise(resolve => setTimeout(resolve, 50))
      
      expect(getDialogText()).toContain('initial.js')
      
      // Change filename
      mockProjectStore.currentFileName.value = 'updated.vue'
      await new Promise(resolve => setTimeout(resolve, 50))
      
      expect(getDialogText()).toContain('updated.vue')
      expect(getDialogText()).not.toContain('initial.js')
    })

    it('should react to currentFileContent changes', async () => {
      mockProjectStore.isFileContentModalOpen.value = true
      mockProjectStore.currentFileContent.value = 'initial content'
      
      const _component = await mountSuspended(FileContentModal)
      await new Promise(resolve => setTimeout(resolve, 50))
      
      expect(getDialogText()).toContain('initial content')
      
      // Change content
      mockProjectStore.currentFileContent.value = 'updated content'
      await new Promise(resolve => setTimeout(resolve, 50))
      
      expect(getDialogText()).toContain('updated content')
      expect(getDialogText()).not.toContain('initial content')
    })
  })

  describe('Layout and Styling', () => {
    it('should have proper CSS classes for layout', async () => {
      mockProjectStore.isFileContentModalOpen.value = true
      mockProjectStore.currentFileContent.value = 'test content'
      
      const _component = await mountSuspended(FileContentModal)
      await new Promise(resolve => setTimeout(resolve, 50))
      
      const dialog = findDialogInBody()
      expect(dialog).not.toBeNull()
      
      // Check for essential layout classes
      const className = dialog?.className || ''
      expect(className).toContain('max-w-6xl')
      expect(className).toContain('max-h-[90vh]')
      expect(className).toContain('flex')
      expect(className).toContain('flex-col')
    })

    it('should render with monospace font for code', async () => {
      mockProjectStore.isFileContentModalOpen.value = true
      mockProjectStore.currentFileContent.value = 'code content'
      
      const _component = await mountSuspended(FileContentModal)
      await new Promise(resolve => setTimeout(resolve, 50))
      
      const dialog = findDialogInBody()
      expect(dialog).not.toBeNull()
      
      // Should have font-mono class for monospace
      expect(dialog?.innerHTML).toContain('font-mono')
    })

    it('should have scrollable content area', async () => {
      mockProjectStore.isFileContentModalOpen.value = true
      mockProjectStore.currentFileContent.value = 'content'
      
      const _component = await mountSuspended(FileContentModal)
      await new Promise(resolve => setTimeout(resolve, 50))
      
      const dialog = findDialogInBody()
      expect(dialog).not.toBeNull()
      
      // Should have overflow-auto for scrolling
      expect(dialog?.innerHTML).toContain('overflow-auto')
    })
  })

  describe('Icons', () => {
    it('should render file text icon in header', async () => {
      mockProjectStore.isFileContentModalOpen.value = true
      
      const _component = await mountSuspended(FileContentModal)
      await new Promise(resolve => setTimeout(resolve, 50))
      
      // Should have lucide:file-text icon
      const icon = findInDialog('[class*="i-lucide:file-text"], .iconify')
      expect(icon).not.toBeNull()
    })

    it('should render file-x icon when no content', async () => {
      mockProjectStore.isFileContentModalOpen.value = true
      mockProjectStore.currentFileContent.value = ''
      
      const _component = await mountSuspended(FileContentModal)
      await new Promise(resolve => setTimeout(resolve, 50))
      
      // Should have lucide:file-x icon for empty state
      const icon = findInDialog('[class*="i-lucide:file-x"], .iconify')
      expect(icon).not.toBeNull()
    })
  })

  describe('Edge Cases', () => {
    it('should handle very long lines', async () => {
      mockProjectStore.isFileContentModalOpen.value = true
      mockProjectStore.currentFileContent.value = 'a'.repeat(1000)
      
      const _component = await mountSuspended(FileContentModal)
      await new Promise(resolve => setTimeout(resolve, 50))
      
      const dialogText = getDialogText()
      expect(dialogText).toContain('a'.repeat(100)) // Check at least part of it
    })

    it('should handle special characters', async () => {
      mockProjectStore.isFileContentModalOpen.value = true
      mockProjectStore.currentFileContent.value = '<script>alert("xss")</script>'
      
      const _component = await mountSuspended(FileContentModal)
      await new Promise(resolve => setTimeout(resolve, 50))
      
      // Content should be properly escaped/displayed
      const preElement = findInDialog('pre')
      expect(preElement).not.toBeNull()
    })

    it('should handle files with many lines', async () => {
      mockProjectStore.isFileContentModalOpen.value = true
      const manyLines = Array.from({ length: 100 }, (_, i) => `Line ${i + 1}`).join('\n')
      mockProjectStore.currentFileContent.value = manyLines
      
      const _component = await mountSuspended(FileContentModal)
      await new Promise(resolve => setTimeout(resolve, 50))
      
      const dialogText = getDialogText()
      // Should show line numbers up to 100
      expect(dialogText).toContain('1')
      expect(dialogText).toContain('50')
      expect(dialogText).toContain('100')
    })
  })
}) 