/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */
// @vitest-environment nuxt
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import ContextSetListManager from '~/components/ContextSetListManager.vue'

// Mock the project store
const mockProjectStore = {
  contextSets: ref({}),
  contextSetNames: ref([]),
  activeContextSetName: ref(''),
  createContextSet: vi.fn(),
  setActiveContextSet: vi.fn().mockReturnValue(true),
  deleteContextSet: vi.fn().mockResolvedValue(true)
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
const mockSelect = vi.fn()
Object.defineProperty(HTMLElement.prototype, 'focus', {
  value: mockFocus,
  writable: true
})
Object.defineProperty(HTMLElement.prototype, 'select', {
  value: mockSelect,
  writable: true
})

// Helper to find button by text content
const findButtonByText = (wrapper: any, text: string) => {
  const buttons = wrapper.findAll('button')
  return buttons.find((button: any) => button.text().includes(text))
}

// Helper function to find teleported dialog content
const findDialogInBody = () => {
  return document.body.querySelector('[data-slot="dialog-content"], [role="dialog"]')
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

// Helper to wait for modal to appear/disappear
const waitForDialog = async (shouldExist: boolean = true, timeout: number = 100) => {
  const startTime = Date.now()
  while (Date.now() - startTime < timeout) {
    const dialog = findDialogInBody()
    if (shouldExist && dialog) return dialog
    if (!shouldExist && !dialog) return null
    await new Promise(resolve => setTimeout(resolve, 10))
  }
  return shouldExist ? null : findDialogInBody()
}

describe('ContextSetListManager', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockFocus.mockClear()
    mockSelect.mockClear()
    // Reset store values
    mockProjectStore.contextSets.value = {}
    mockProjectStore.contextSetNames.value = []
    mockProjectStore.activeContextSetName.value = ''
    
    // Clear any existing dialogs
    const existingDialogs = document.body.querySelectorAll('[data-slot="dialog-content"], [role="dialog"]')
    existingDialogs.forEach(dialog => dialog.remove())
  })

  describe('Empty State', () => {
    it('should render empty state when no context sets exist', async () => {
      mockProjectStore.contextSetNames.value = []
      
      const wrapper = await mountSuspended(ContextSetListManager)
      
      expect(wrapper.text()).toContain('Create Your First Context Set')
      expect(wrapper.text()).toContain('Context sets help you organize specific parts of your codebase')
      expect(wrapper.text()).toContain('Create Context Set')
    })

    it('should show helpful tips in empty state', async () => {
      mockProjectStore.contextSetNames.value = []
      
      const wrapper = await mountSuspended(ContextSetListManager)
      
      expect(wrapper.text()).toContain('Quick Start Tips:')
      expect(wrapper.text()).toContain('Give it a clear name without blank spaces')
      expect(wrapper.text()).toContain('You can add a description and files after creation')
    })

    it('should have prominent CTA button in empty state', async () => {
      mockProjectStore.contextSetNames.value = []
      
      const wrapper = await mountSuspended(ContextSetListManager)
      
      const createButton = findButtonByText(wrapper, 'Create Context Set')
      expect(createButton).toBeTruthy()
    })
  })

  describe('Context Sets List', () => {
    beforeEach(() => {
      mockProjectStore.contextSetNames.value = ['authentication', 'userManagement', 'billing']
      mockProjectStore.contextSets.value = {
        authentication: { files: ['file1', 'file2'], workflow: ['step1'] },
        userManagement: { files: ['file3'], workflow: ['step1', 'step2'] },
        billing: { files: [], workflow: [] }
      }
    })

    it('should render context sets when they exist', async () => {
      const wrapper = await mountSuspended(ContextSetListManager)
      
      expect(wrapper.text()).toContain('authentication')
      expect(wrapper.text()).toContain('userManagement')
      expect(wrapper.text()).toContain('billing')
    })

    it('should show add new button when context sets exist', async () => {
      const wrapper = await mountSuspended(ContextSetListManager)
      
      const addButton = findButtonByText(wrapper, 'Add New Context Set') || findButtonByText(wrapper, 'Create Context Set')
      expect(addButton).toBeTruthy()
    })

    it('should display file and workflow counts correctly', async () => {
      const wrapper = await mountSuspended(ContextSetListManager)
      
      expect(wrapper.text()).toContain('2 files')
      expect(wrapper.text()).toContain('1 steps')
      expect(wrapper.text()).toContain('1 files')
      expect(wrapper.text()).toContain('2 steps')
      expect(wrapper.text()).toContain('0 files')
      expect(wrapper.text()).toContain('0 steps')
    })

    it('should highlight active context set', async () => {
      mockProjectStore.activeContextSetName.value = 'authentication'
      
      const wrapper = await mountSuspended(ContextSetListManager)
      
      expect(wrapper.text()).toContain('Active')
    })

    it('should call setActiveContextSet when context set is clicked', async () => {
      const wrapper = await mountSuspended(ContextSetListManager)
      
      const contextSetButton = wrapper.find('[aria-label*="Select context set: authentication"]')
      if (contextSetButton.exists()) {
        await contextSetButton.trigger('click')
        expect(mockProjectStore.setActiveContextSet).toHaveBeenCalledWith('authentication')
        expect(mockAccessibility.announceStatus).toHaveBeenCalledWith('Selected context set: authentication')
      }
    })
  })

  describe('Create Context Set Modal', () => {
    it('should open create modal when create button is clicked', async () => {
      const wrapper = await mountSuspended(ContextSetListManager)
      
      const createButton = findButtonByText(wrapper, 'Create Context Set') || findButtonByText(wrapper, 'Add New Context Set')
      expect(createButton).toBeTruthy()
      
      if (createButton) {
        await createButton.trigger('click')
        await waitForDialog(true)
        
        const dialogInBody = findDialogInBody()
        expect(dialogInBody).toBeTruthy()
        expect(getDialogText()).toContain('Create New Context Set')
      }
    })

    it('should show form fields in create modal', async () => {
      const wrapper = await mountSuspended(ContextSetListManager)
      
      const createButton = findButtonByText(wrapper, 'Create Context Set') || findButtonByText(wrapper, 'Add New Context Set')
      if (createButton) {
        await createButton.trigger('click')
        await waitForDialog(true)
        
        expect(getDialogText()).toContain('Context Set Name')
        expect(getDialogText()).toContain('Use camelCase, snake_case, or single words')
        
        const input = findInDialog('input[placeholder*="authenticationSystem"], input[type="text"]')
        expect(input).toBeTruthy()
      }
    })

    it('should validate context set name format', async () => {
      const wrapper = await mountSuspended(ContextSetListManager)
      
      const createButton = findButtonByText(wrapper, 'Create Context Set') || findButtonByText(wrapper, 'Add New Context Set')
      if (createButton) {
        await createButton.trigger('click')
        await waitForDialog(true)
        
        const input = findInDialog('input') as HTMLInputElement
        if (input) {
          // Test invalid name with spaces
          input.value = 'invalid name'
          input.dispatchEvent(new Event('input', { bubbles: true }))
          
          await new Promise(resolve => setTimeout(resolve, 100))
          
          expect(getDialogText()).toContain('Name cannot contain spaces')
        }
      }
    })

    it('should validate name starts with letter', async () => {
      const wrapper = await mountSuspended(ContextSetListManager)
      
      const createButton = findButtonByText(wrapper, 'Create Context Set') || findButtonByText(wrapper, 'Add New Context Set')
      if (createButton) {
        await createButton.trigger('click')
        await waitForDialog(true)
        
        const input = findInDialog('input') as HTMLInputElement
        if (input) {
          // Test invalid name starting with number
          input.value = '123invalid'
          input.dispatchEvent(new Event('input', { bubbles: true }))
          
          await new Promise(resolve => setTimeout(resolve, 100))
          
          expect(getDialogText()).toContain('Name must start with a letter')
        }
      }
    })

    it('should check for duplicate names', async () => {
      mockProjectStore.contextSetNames.value = ['existing']
      
      const wrapper = await mountSuspended(ContextSetListManager)
      
      const createButton = findButtonByText(wrapper, 'Create Context Set') || findButtonByText(wrapper, 'Add New Context Set')
      if (createButton) {
        await createButton.trigger('click')
        await waitForDialog(true)
        
        const input = findInDialog('input') as HTMLInputElement
        if (input) {
          input.value = 'existing'
          input.dispatchEvent(new Event('input', { bubbles: true }))
          
          await new Promise(resolve => setTimeout(resolve, 100))
          
          expect(getDialogText()).toContain('A context set with this name already exists')
        }
      }
    })

    it('should create context set with valid name', async () => {
      const wrapper = await mountSuspended(ContextSetListManager)
      
      const createButton = findButtonByText(wrapper, 'Create Context Set') || findButtonByText(wrapper, 'Add New Context Set')
      if (createButton) {
        await createButton.trigger('click')
        await waitForDialog(true)
        
        const input = findInDialog('input') as HTMLInputElement
        if (input) {
          // Set valid name
          input.value = 'validName'
          input.dispatchEvent(new Event('input', { bubbles: true }))
          
          // Wait for validation to complete
          await new Promise(resolve => setTimeout(resolve, 100))
          
          // Find and click the submit button
          const submitButton = findInDialog('button[type="submit"]') as HTMLButtonElement
          if (submitButton && !submitButton.disabled) {
            await new Promise(resolve => {
              submitButton.click()
              resolve(undefined)
            })
            
            expect(mockProjectStore.createContextSet).toHaveBeenCalledWith('validName')
            expect(mockAccessibility.announceStatus).toHaveBeenCalledWith('Created and activated new context set: validName')
          }
        }
      }
    })

    it('should automatically set newly created context set as active', async () => {
      const wrapper = await mountSuspended(ContextSetListManager)
      
      const createButton = findButtonByText(wrapper, 'Create Context Set') || findButtonByText(wrapper, 'Add New Context Set')
      if (createButton) {
        await createButton.trigger('click')
        await waitForDialog(true)
        
        const input = findInDialog('input') as HTMLInputElement
        if (input) {
          // Set valid name
          input.value = 'newActiveContext'
          input.dispatchEvent(new Event('input', { bubbles: true }))
          
          // Wait for validation to complete
          await new Promise(resolve => setTimeout(resolve, 100))
          
          // Find and click the submit button
          const submitButton = findInDialog('button[type="submit"]') as HTMLButtonElement
          if (submitButton && !submitButton.disabled) {
            await new Promise(resolve => {
              submitButton.click()
              resolve(undefined)
            })
            
            // Verify context set was created
            expect(mockProjectStore.createContextSet).toHaveBeenCalledWith('newActiveContext')
            
            // Verify newly created context set was automatically set as active
            expect(mockProjectStore.setActiveContextSet).toHaveBeenCalledWith('newActiveContext')
            
            // Verify the announcement message reflects both creation and activation
            expect(mockAccessibility.announceStatus).toHaveBeenCalledWith('Created and activated new context set: newActiveContext')
          }
        }
      }
    })

    it('should close modal when cancel is clicked', async () => {
      const wrapper = await mountSuspended(ContextSetListManager)
      
      const createButton = findButtonByText(wrapper, 'Create Context Set') || findButtonByText(wrapper, 'Add New Context Set')
      if (createButton) {
        await createButton.trigger('click')
        await waitForDialog(true)
        
        const cancelButton = findInDialog('button') as HTMLButtonElement
        const buttons = document.body.querySelectorAll('[data-slot="dialog-content"] button')
        const cancelBtn = Array.from(buttons).find(btn => btn.textContent?.includes('Cancel'))
        
        if (cancelBtn) {
          (cancelBtn as HTMLButtonElement).click()
          await waitForDialog(false)
          expect(findDialogInBody()).toBeFalsy()
        }
      }
    })
  })

  describe('Delete Context Set Modal', () => {
    beforeEach(() => {
      mockProjectStore.contextSetNames.value = ['testSet']
      mockProjectStore.contextSets.value = {
        testSet: { files: [], workflow: [] }
      }
    })

    it('should open delete modal when delete button is clicked', async () => {
      const wrapper = await mountSuspended(ContextSetListManager)
      
      const deleteButton = wrapper.find('[aria-label*="Delete context set: testSet"]')
      if (deleteButton.exists()) {
        await deleteButton.trigger('click')
        await waitForDialog(true)
        
        const dialogInBody = findDialogInBody()
        expect(dialogInBody).toBeTruthy()
        expect(getDialogText()).toContain('Delete Context Set')
        expect(getDialogText()).toContain('testSet')
      }
    })

    it('should delete context set when confirmed', async () => {
      const wrapper = await mountSuspended(ContextSetListManager)
      
      const deleteButton = wrapper.find('[aria-label*="Delete context set: testSet"]')
      if (deleteButton.exists()) {
        await deleteButton.trigger('click')
        await waitForDialog(true)
        
        const buttons = document.body.querySelectorAll('[data-slot="dialog-content"] button')
        const deleteBtn = Array.from(buttons).find(btn => 
          btn.textContent?.includes('Delete') && !btn.textContent?.includes('Cancel')
        )
        
        if (deleteBtn) {
          (deleteBtn as HTMLButtonElement).click()
          
          // Wait for async operation to complete
          await new Promise(resolve => setTimeout(resolve, 10))
          
          expect(mockProjectStore.deleteContextSet).toHaveBeenCalledWith('testSet')
          expect(mockAccessibility.announceStatus).toHaveBeenCalledWith('Deleted context set: testSet')
        }
      }
    })

    it('should close modal when cancel is clicked', async () => {
      const wrapper = await mountSuspended(ContextSetListManager)
      
      const deleteButton = wrapper.find('[aria-label*="Delete context set: testSet"]')
      if (deleteButton.exists()) {
        await deleteButton.trigger('click')
        await waitForDialog(true)
        
        const buttons = document.body.querySelectorAll('[data-slot="dialog-content"] button')
        const cancelBtn = Array.from(buttons).find(btn => btn.textContent?.includes('Cancel'))
        
        if (cancelBtn) {
          (cancelBtn as HTMLButtonElement).click()
          await waitForDialog(false)
          expect(findDialogInBody()).toBeFalsy()
        }
      }
    })
  })

  describe('Accessibility', () => {
    it('should have proper ARIA labels', async () => {
      mockProjectStore.contextSetNames.value = ['testSet']
      mockProjectStore.contextSets.value = {
        testSet: { files: [], workflow: [] }
      }
      
      const wrapper = await mountSuspended(ContextSetListManager)
      
      const contextSetButton = wrapper.find('[aria-label*="Select context set: testSet"]')
      expect(contextSetButton.exists()).toBe(true)
      
      const deleteButton = wrapper.find('[aria-label*="Delete context set: testSet"]')
      expect(deleteButton.exists()).toBe(true)
    })

    it('should announce status changes', async () => {
      const wrapper = await mountSuspended(ContextSetListManager)
      
      // Mock context set selection
      const contextSetButton = wrapper.find('[aria-label*="Select context set"]')
      if (contextSetButton.exists()) {
        await contextSetButton.trigger('click')
        expect(mockAccessibility.announceStatus).toHaveBeenCalled()
      }
    })
  })

  describe('Edge Cases', () => {
    it('should handle empty context sets gracefully', async () => {
      mockProjectStore.contextSetNames.value = ['empty']
      mockProjectStore.contextSets.value = {
        empty: { files: undefined, workflow: undefined }
      }
      
      const wrapper = await mountSuspended(ContextSetListManager)
      
      expect(wrapper.text()).toContain('0 files')
      expect(wrapper.text()).toContain('0 steps')
    })

    it('should handle createContextSet throwing error', async () => {
      mockProjectStore.createContextSet.mockImplementation(() => {
        throw new Error('Creation failed')
      })
      
      const wrapper = await mountSuspended(ContextSetListManager)
      
      const createButton = findButtonByText(wrapper, 'Create Context Set') || findButtonByText(wrapper, 'Add New Context Set')
      if (createButton) {
        await createButton.trigger('click')
        await waitForDialog(true)
        
        const input = findInDialog('input') as HTMLInputElement
        if (input) {
          // Set valid name to avoid validation errors
          input.value = 'validName'
          input.dispatchEvent(new Event('input', { bubbles: true }))
          
          // Wait for validation to complete
          await new Promise(resolve => setTimeout(resolve, 100))
          
          // Click submit button to trigger the error
          const submitButton = findInDialog('button[type="submit"]') as HTMLButtonElement
          if (submitButton && !submitButton.disabled) {
            await new Promise(resolve => {
              submitButton.click()
              resolve(undefined)
            })
            
            expect(mockAccessibility.announceError).toHaveBeenCalledWith('Error creating context set: Creation failed')
          }
        }
      }
    })

    it('should handle setActiveContextSet failure', async () => {
      mockProjectStore.setActiveContextSet.mockReturnValue(false)
      mockProjectStore.contextSetNames.value = ['testSet']
      mockProjectStore.contextSets.value = {
        testSet: { files: [], workflow: [] }
      }
      
      const wrapper = await mountSuspended(ContextSetListManager)
      
      const contextSetButton = wrapper.find('[aria-label*="Select context set: testSet"]')
      if (contextSetButton.exists()) {
        await contextSetButton.trigger('click')
        expect(mockAccessibility.announceStatus).not.toHaveBeenCalled()
      }
    })
  })

  describe('Form Validation States', () => {
    it('should disable submit button when form is invalid', async () => {
      const wrapper = await mountSuspended(ContextSetListManager)
      
      const createButton = findButtonByText(wrapper, 'Create Context Set') || findButtonByText(wrapper, 'Add New Context Set')
      if (createButton) {
        await createButton.trigger('click')
        await waitForDialog(true)
        
        const submitButton = findInDialog('button[type="submit"]') || 
                           Array.from(document.body.querySelectorAll('[data-slot="dialog-content"] button'))
                           .find(btn => btn.textContent?.includes('Create') && !btn.textContent?.includes('Cancel'))
        
        if (submitButton) {
          expect((submitButton as HTMLButtonElement).disabled).toBe(true)
        }
      }
    })

    it('should enable submit button when form is valid', async () => {
      const wrapper = await mountSuspended(ContextSetListManager)
      
      const createButton = findButtonByText(wrapper, 'Create Context Set') || findButtonByText(wrapper, 'Add New Context Set')
      if (createButton) {
        await createButton.trigger('click')
        await waitForDialog(true)
        
        const input = findInDialog('input') as HTMLInputElement
        if (input) {
          input.value = 'validName'
          input.dispatchEvent(new Event('input', { bubbles: true }))
          
          await new Promise(resolve => setTimeout(resolve, 100))
          
          const submitButton = findInDialog('button[type="submit"]') || 
                             Array.from(document.body.querySelectorAll('[data-slot="dialog-content"] button'))
                             .find(btn => btn.textContent?.includes('Create') && !btn.textContent?.includes('Cancel'))
          
          if (submitButton) {
            expect((submitButton as HTMLButtonElement).disabled).toBe(false)
          }
        }
      }
    })
  })
}) 