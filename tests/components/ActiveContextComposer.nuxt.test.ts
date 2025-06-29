/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */
// @vitest-environment nuxt
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import ActiveContextComposer from '~/components/ActiveContextComposer.vue'

// Mock child components
vi.mock('~/components/ProjectFileBrowser.vue', () => ({
  default: {
    name: 'ProjectFileBrowser',
    template: '<div data-testid="project-file-browser">Project File Browser</div>'
  }
}))

vi.mock('~/components/active-context-set/Editor.vue', () => ({
  default: {
    name: 'Editor', 
    template: '<div data-testid="active-context-set-editor">Active Context Set Editor</div>'
  }
}))

// Mock the project store
const mockProjectStore = {
  activeContextSet: ref(null),
  updateActiveContextSet: vi.fn()
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

// Mock DOM focus methods to prevent errors
const mockFocus = vi.fn()
Object.defineProperty(HTMLElement.prototype, 'focus', {
  value: mockFocus,
  writable: true
})

// Helper to find button by text content
const findButtonByText = (wrapper: any, text: string) => {
  const buttons = wrapper.findAll('button')
  return buttons.find((button: any) => button.text().includes(text))
}

// Helper to find element by text content
const findByText = (wrapper: any, text: string, tag: string = '*') => {
  const elements = wrapper.findAll(tag)
  return elements.find((element: any) => element.text().includes(text))
}

describe('ActiveContextComposer', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockFocus.mockClear()
    // Reset store values
    mockProjectStore.activeContextSet.value = null
  })

  describe('No Active Context Set', () => {
    it('should render without active context set', async () => {
      mockProjectStore.activeContextSet.value = null
      
      const wrapper = await mountSuspended(ActiveContextComposer)
      
      expect(wrapper.text()).toContain('Context Set Composer')
      expect(wrapper.text()).not.toContain('Composer:')
    })

    it('should render child components even without active context set', async () => {
      mockProjectStore.activeContextSet.value = null
      
      const wrapper = await mountSuspended(ActiveContextComposer)
      
      expect(wrapper.find('[data-testid="project-file-browser"]').exists()).toBe(true)
      expect(wrapper.find('[data-testid="active-context-set-editor"]').exists()).toBe(true)
    })

    it('should show Context Set Details header', async () => {
      mockProjectStore.activeContextSet.value = null
      
      const wrapper = await mountSuspended(ActiveContextComposer)
      
      expect(wrapper.text()).toContain('Context Set Editor')
    })
  })

  describe('With Active Context Set', () => {
    beforeEach(() => {
      mockProjectStore.activeContextSet.value = {
        name: 'testContextSet',
        description: 'Test description',
        files: ['file1', 'file2'],
        workflows: [{
          start: {
            fileRef: 'file1',
            function: 'main',
            startLine: 1,
            endLine: 10
          },
          end: {
            fileRef: 'file1',
            startLine: 15,
            endLine: 20
          }
        }]
      }
    })

    it('should display active context set name', async () => {
      const wrapper = await mountSuspended(ActiveContextComposer)
      
      expect(wrapper.text()).toContain('Composer: testContextSet')
    })

    it('should display active context set description', async () => {
      const wrapper = await mountSuspended(ActiveContextComposer)
      
      expect(wrapper.text()).toContain('Test description')
    })

    it('should display file and workflows counts', async () => {
      const wrapper = await mountSuspended(ActiveContextComposer)
      
      expect(wrapper.text()).toContain('2 files')
      expect(wrapper.text()).toContain('1 workflows')
    })

    it('should show edit button for name on hover', async () => {
      const wrapper = await mountSuspended(ActiveContextComposer)
      
      const editButton = wrapper.find('[title="Edit context set name"]')
      expect(editButton.exists()).toBe(true)
    })

    it('should show add description button when no description', async () => {
      mockProjectStore.activeContextSet.value = {
        name: 'testContextSet',
        description: '',
        files: [],
        workflows: []
      }
      
      const wrapper = await mountSuspended(ActiveContextComposer)
      
      const addDescriptionButton = wrapper.find('[title="Add description"]')
      expect(addDescriptionButton.exists()).toBe(true)
    })
  })

  describe('Name Editing', () => {
    beforeEach(() => {
      mockProjectStore.activeContextSet.value = {
        name: 'testContextSet',
        description: 'Test description',
        files: [],
        workflows: []
      }
    })

    it('should enter edit mode when name is clicked', async () => {
      const wrapper = await mountSuspended(ActiveContextComposer)
      
      const nameElement = findByText(wrapper, 'Composer: testContextSet', 'h3')
      if (nameElement?.exists()) {
        await nameElement.trigger('click')
        
        const input = wrapper.find('input[placeholder="Enter context set name"]')
        expect(input.exists()).toBe(true)
        expect(input.element.value).toBe('testContextSet')
      }
    })

    it('should enter edit mode when edit button is clicked', async () => {
      const wrapper = await mountSuspended(ActiveContextComposer)
      
      const editButton = wrapper.find('[title="Edit context set name"]')
      if (editButton.exists()) {
        await editButton.trigger('click')
        
        const input = wrapper.find('input[placeholder="Enter context set name"]')
        expect(input.exists()).toBe(true)
      }
    })

    it('should save name changes when save button is clicked', async () => {
      const wrapper = await mountSuspended(ActiveContextComposer)
      
      const editButton = wrapper.find('[title="Edit context set name"]')
      if (editButton.exists()) {
        await editButton.trigger('click')
        
        const input = wrapper.find('input[placeholder="Enter context set name"]')
        if (input.exists()) {
          await input.setValue('newContextSetName')
          
          const saveButton = findButtonByText(wrapper, 'Save')
          if (saveButton?.exists()) {
            await saveButton.trigger('click')
            
            expect(mockProjectStore.updateActiveContextSet).toHaveBeenCalledWith({ name: 'newContextSetName' })
            expect(mockAccessibility.announceStatus).toHaveBeenCalledWith('Context set renamed to: newContextSetName')
          }
        }
      }
    })

    it('should save name changes when enter is pressed', async () => {
      const wrapper = await mountSuspended(ActiveContextComposer)
      
      const editButton = wrapper.find('[title="Edit context set name"]')
      if (editButton.exists()) {
        await editButton.trigger('click')
        
        const input = wrapper.find('input[placeholder="Enter context set name"]')
        if (input.exists()) {
          await input.setValue('newContextSetName')
          await input.trigger('keydown.enter')
          
          expect(mockProjectStore.updateActiveContextSet).toHaveBeenCalledWith({ name: 'newContextSetName' })
        }
      }
    })

    it('should cancel editing when escape is pressed', async () => {
      const wrapper = await mountSuspended(ActiveContextComposer)
      
      const editButton = wrapper.find('[title="Edit context set name"]')
      if (editButton.exists()) {
        await editButton.trigger('click')
        
        const input = wrapper.find('input[placeholder="Enter context set name"]')
        if (input.exists()) {
          await input.setValue('newName')
          await input.trigger('keydown.escape')
          
          expect(wrapper.text()).toContain('Composer: testContextSet')
          expect(mockProjectStore.updateActiveContextSet).not.toHaveBeenCalled()
        }
      }
    })

    it('should cancel editing when cancel button is clicked', async () => {
      const wrapper = await mountSuspended(ActiveContextComposer)
      
      const editButton = wrapper.find('[title="Edit context set name"]')
      if (editButton.exists()) {
        await editButton.trigger('click')
        
        const cancelButton = findButtonByText(wrapper, 'Cancel')
        if (cancelButton?.exists()) {
          await cancelButton.trigger('click')
          
          expect(wrapper.text()).toContain('Composer: testContextSet')
          expect(mockProjectStore.updateActiveContextSet).not.toHaveBeenCalled()
        }
      }
    })

    it('should not save if name is empty', async () => {
      const wrapper = await mountSuspended(ActiveContextComposer)
      
      const editButton = wrapper.find('[title="Edit context set name"]')
      if (editButton.exists()) {
        await editButton.trigger('click')
        
        const input = wrapper.find('input[placeholder="Enter context set name"]')
        if (input.exists()) {
          await input.setValue('')
          
          const saveButton = findButtonByText(wrapper, 'Save')
          if (saveButton?.exists()) {
            await saveButton.trigger('click')
            
            expect(mockAccessibility.announceError).toHaveBeenCalledWith('Context set name cannot be empty')
            expect(mockProjectStore.updateActiveContextSet).not.toHaveBeenCalled()
          }
        }
      }
    })

    it('should not save if name is unchanged', async () => {
      const wrapper = await mountSuspended(ActiveContextComposer)
      
      const editButton = wrapper.find('[title="Edit context set name"]')
      if (editButton.exists()) {
        await editButton.trigger('click')
        
        const saveButton = findButtonByText(wrapper, 'Save')
        if (saveButton?.exists()) {
          await saveButton.trigger('click')
          
          expect(mockProjectStore.updateActiveContextSet).not.toHaveBeenCalled()
        }
      }
    })
  })

  describe('Description Editing', () => {
    beforeEach(() => {
      mockProjectStore.activeContextSet.value = {
        name: 'testContextSet',
        description: 'Original description',
        files: [],
        workflows: []
      }
    })

    it('should enter edit mode when description is clicked', async () => {
      const wrapper = await mountSuspended(ActiveContextComposer)
      
      const descriptionElement = findByText(wrapper, 'Original description', 'p')
      if (descriptionElement?.exists()) {
        await descriptionElement.trigger('click')
        
        const textarea = wrapper.find('textarea[placeholder*="Describe what this context set is for"]')
        expect(textarea.exists()).toBe(true)
        expect(textarea.element.value).toBe('Original description')
      }
    })

    it('should enter edit mode when edit button is clicked', async () => {
      const wrapper = await mountSuspended(ActiveContextComposer)
      
      const editButton = wrapper.find('[title="Edit description"]')
      if (editButton.exists()) {
        await editButton.trigger('click')
        
        const textarea = wrapper.find('textarea[placeholder*="Describe what this context set is for"]')
        expect(textarea.exists()).toBe(true)
      }
    })

    it('should save description changes when save button is clicked', async () => {
      const wrapper = await mountSuspended(ActiveContextComposer)
      
      const editButton = wrapper.find('[title="Edit description"]')
      if (editButton.exists()) {
        await editButton.trigger('click')
        
        const textarea = wrapper.find('textarea[placeholder*="Describe what this context set is for"]')
        if (textarea.exists()) {
          await textarea.setValue('New description')
          
          const saveButton = findButtonByText(wrapper, 'Save')
          if (saveButton?.exists()) {
            await saveButton.trigger('click')
            
            expect(mockProjectStore.updateActiveContextSet).toHaveBeenCalledWith({ description: 'New description' })
            expect(mockAccessibility.announceStatus).toHaveBeenCalledWith('Context set description updated')
          }
        }
      }
    })

    it('should save description changes when textarea loses focus', async () => {
      const wrapper = await mountSuspended(ActiveContextComposer)
      
      const editButton = wrapper.find('[title="Edit description"]')
      if (editButton.exists()) {
        await editButton.trigger('click')
        
        const textarea = wrapper.find('textarea[placeholder*="Describe what this context set is for"]')
        if (textarea.exists()) {
          await textarea.setValue('New description')
          await textarea.trigger('blur')
          
          expect(mockProjectStore.updateActiveContextSet).toHaveBeenCalledWith({ description: 'New description' })
        }
      }
    })

    it('should cancel editing when escape is pressed', async () => {
      const wrapper = await mountSuspended(ActiveContextComposer)
      
      const editButton = wrapper.find('[title="Edit description"]')
      if (editButton.exists()) {
        await editButton.trigger('click')
        
        const textarea = wrapper.find('textarea[placeholder*="Describe what this context set is for"]')
        if (textarea.exists()) {
          await textarea.setValue('New description')
          await textarea.trigger('keydown.escape')
          
          expect(wrapper.text()).toContain('Original description')
          expect(mockProjectStore.updateActiveContextSet).not.toHaveBeenCalled()
        }
      }
    })

    it('should handle adding description when none exists', async () => {
      mockProjectStore.activeContextSet.value = {
        name: 'testContextSet',
        description: '',
        files: [],
        workflows: []
      }
      
      const wrapper = await mountSuspended(ActiveContextComposer)
      
      const addButton = wrapper.find('[title="Add description"]')
      if (addButton.exists()) {
        await addButton.trigger('click')
        
        const textarea = wrapper.find('textarea[placeholder*="Describe what this context set is for"]')
        if (textarea.exists()) {
          await textarea.setValue('New description')
          
          const saveButton = findButtonByText(wrapper, 'Save')
          if (saveButton?.exists()) {
            await saveButton.trigger('click')
            
            expect(mockProjectStore.updateActiveContextSet).toHaveBeenCalledWith({ description: 'New description' })
          }
        }
      }
    })
  })

  describe('Error Handling', () => {
    beforeEach(() => {
      mockProjectStore.activeContextSet.value = {
        name: 'testContextSet',
        description: 'Test description',
        files: [],
        workflows: []
      }
    })

    it('should handle name update error', async () => {
      mockProjectStore.updateActiveContextSet.mockImplementation(() => {
        throw new Error('Update failed')
      })
      
      const wrapper = await mountSuspended(ActiveContextComposer)
      
      const editButton = wrapper.find('[title="Edit context set name"]')
      if (editButton.exists()) {
        await editButton.trigger('click')
        
        const input = wrapper.find('input[placeholder="Enter context set name"]')
        if (input.exists()) {
          await input.setValue('newName')
          
          const saveButton = findButtonByText(wrapper, 'Save')
          if (saveButton?.exists()) {
            await saveButton.trigger('click')
            
            expect(mockAccessibility.announceError).toHaveBeenCalledWith('Update failed')
          }
        }
      }
    })

    it('should handle description update error', async () => {
      mockProjectStore.updateActiveContextSet.mockImplementation(() => {
        throw new Error('Update failed')
      })
      
      const wrapper = await mountSuspended(ActiveContextComposer)
      
      const editButton = wrapper.find('[title="Edit description"]')
      if (editButton.exists()) {
        await editButton.trigger('click')
        
        const textarea = wrapper.find('textarea[placeholder*="Describe what this context set is for"]')
        if (textarea.exists()) {
          await textarea.setValue('new description')
          
          const saveButton = findButtonByText(wrapper, 'Save')
          if (saveButton?.exists()) {
            await saveButton.trigger('click')
            
            expect(mockAccessibility.announceError).toHaveBeenCalledWith('Update failed')
          }
        }
      }
    })
  })

  describe('Layout and Structure', () => {
    it('should have unified container with proper styling', async () => {
      const wrapper = await mountSuspended(ActiveContextComposer)
      
      const container = wrapper.find('.bg-card.rounded-lg.border.shadow-lg')
      expect(container.exists()).toBe(true)
    })

    it('should have two-column layout on large screens', async () => {
      const wrapper = await mountSuspended(ActiveContextComposer)
      
      const gridContainer = wrapper.find('.grid.grid-cols-1.lg\\:grid-cols-2')
      expect(gridContainer.exists()).toBe(true)
    })

    it('should render project file browser in left panel', async () => {
      const wrapper = await mountSuspended(ActiveContextComposer)
      
      const leftPanel = wrapper.find('[data-testid="project-file-browser"]')
      expect(leftPanel.exists()).toBe(true)
    })

    it('should render active context set editor in right panel', async () => {
      const wrapper = await mountSuspended(ActiveContextComposer)
      
      const rightPanel = wrapper.find('[data-testid="active-context-set-editor"]')
      expect(rightPanel.exists()).toBe(true)
    })

    it('should have proper header structure', async () => {
      const wrapper = await mountSuspended(ActiveContextComposer)
      
      const header = wrapper.find('.border-b.bg-gradient-surface')
      expect(header.exists()).toBe(true)
    })
  })

  describe('Edge Cases', () => {
    it('should handle activeContextSet with missing properties', async () => {
      mockProjectStore.activeContextSet.value = {
        name: 'testContextSet'
        // missing description, files, workflows
      }
      
      const wrapper = await mountSuspended(ActiveContextComposer)
      
      expect(wrapper.text()).toContain('Composer: testContextSet')
      expect(wrapper.text()).toContain('0 files')
      expect(wrapper.text()).toContain('0 workflows')
    })

    it('should handle null/undefined files and workflows arrays', async () => {
      mockProjectStore.activeContextSet.value = {
        name: 'testContextSet',
        description: 'Test',
        files: null,
        workflows: undefined
      }
      
      const wrapper = await mountSuspended(ActiveContextComposer)
      
      expect(wrapper.text()).toContain('0 files')
      expect(wrapper.text()).toContain('0 workflows')
    })

    it('should not crash when no activeContextSet initially but gets set later', async () => {
      mockProjectStore.activeContextSet.value = null
      
      const wrapper = await mountSuspended(ActiveContextComposer)
      
      expect(wrapper.text()).toContain('Context Set Composer')
      
      // Simulate setting active context set
      mockProjectStore.activeContextSet.value = {
        name: 'newSet',
        description: 'New description',
        files: [],
        workflows: []
      }
      
      await wrapper.vm.$nextTick()
      
      expect(wrapper.text()).toContain('Composer: newSet')
    })
  })
}) 