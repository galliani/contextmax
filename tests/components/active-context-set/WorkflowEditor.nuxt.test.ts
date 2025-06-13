/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */
import { describe, test, expect, vi, beforeEach } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import WorkflowEditor from '~/components/active-context-set/WorkflowEditor.vue'
import type { WorkflowStep, FileManifestEntry } from '~/composables/useProjectStore'

// Mock the project store
const mockProjectStore = {
  filesManifest: ref<Record<string, FileManifestEntry>>({})
}

vi.mock('~/composables/useProjectStore', () => ({
  useProjectStore: () => mockProjectStore
}))

describe('WorkflowEditor', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockProjectStore.filesManifest.value = {}
  })

  const mockFilesManifest: Record<string, FileManifestEntry> = {
    'file1': { path: '/src/components/Button.vue', comment: '' },
    'file2': { path: '/src/utils/helpers.ts', comment: '' },
    'file3': { path: '/package.json', comment: '' }
  }

  const mockWorkflow: WorkflowStep[] = [
    {
      description: 'First step of the workflow',
      fileRefs: ['file1', 'file2']
    },
    {
      description: 'Second step with different files',
      fileRefs: ['file3']
    }
  ]

  describe('Basic Rendering', () => {
    test('renders without crashing with empty workflow', async () => {
      const component = await mountSuspended(WorkflowEditor, {
        props: {
          workflow: []
        }
      })

      expect(component.exists()).toBe(true)
      expect(component.text()).toContain('0 workflow steps')
    })

    test('renders without crashing with workflow data', async () => {
      mockProjectStore.filesManifest.value = mockFilesManifest
      
      const component = await mountSuspended(WorkflowEditor, {
        props: {
          workflow: mockWorkflow
        }
      })

      expect(component.exists()).toBe(true)
      expect(component.text()).toContain('2 workflow steps')
    })

    test('shows empty state text', async () => {
      const component = await mountSuspended(WorkflowEditor, {
        props: {
          workflow: []
        }
      })

      expect(component.text()).toContain('No workflow steps defined')
      expect(component.text()).toContain('Add steps to guide LLMs through your development process')
    })

    test('shows add step button', async () => {
      const component = await mountSuspended(WorkflowEditor, {
        props: {
          workflow: []
        }
      })

      expect(component.text()).toContain('Add Step')
    })
  })

  describe('Workflow Display', () => {
    beforeEach(() => {
      mockProjectStore.filesManifest.value = mockFilesManifest
    })

    test('displays step numbers correctly', async () => {
      const component = await mountSuspended(WorkflowEditor, {
        props: {
          workflow: mockWorkflow
        }
      })

      expect(component.text()).toContain('Step 1')
      expect(component.text()).toContain('Step 2')
    })

    test('shows step description textareas', async () => {
      const component = await mountSuspended(WorkflowEditor, {
        props: {
          workflow: mockWorkflow
        }
      })

      const textareas = component.findAll('textarea')
      expect(textareas.length).toBe(2)
    })

    test('displays file references for each step', async () => {
      const component = await mountSuspended(WorkflowEditor, {
        props: {
          workflow: mockWorkflow
        }
      })

      expect(component.text()).toContain('/src/components/Button.vue')
      expect(component.text()).toContain('/src/utils/helpers.ts')
      expect(component.text()).toContain('/package.json')
    })
  })

  describe('Step Description Editing', () => {
    test('can edit step description', async () => {
      const component = await mountSuspended(WorkflowEditor, {
        props: {
          workflow: mockWorkflow
        }
      })

      const textarea = component.find('textarea')
      await textarea.setValue('Updated step description')
      await textarea.trigger('input')

      const emitted = component.emitted('update:workflow')
      expect(emitted).toBeTruthy()
      
      const updatedWorkflow = emitted?.[0]?.[0] as WorkflowStep[]
      expect(updatedWorkflow[0].description).toBe('Updated step description')
    })

    test('textarea has proper placeholder', async () => {
      const component = await mountSuspended(WorkflowEditor, {
        props: {
          workflow: [{ description: '', fileRefs: [] }]
        }
      })

      const textarea = component.find('textarea')
      expect(textarea.attributes('placeholder')).toBe('Describe what happens in this step...')
    })

    test('textarea has proper label', async () => {
      const component = await mountSuspended(WorkflowEditor, {
        props: {
          workflow: mockWorkflow
        }
      })

      expect(component.text()).toContain('Description')
    })
  })

  describe('File References Management', () => {
    beforeEach(() => {
      mockProjectStore.filesManifest.value = mockFilesManifest
    })

    test('displays current file references', async () => {
      const component = await mountSuspended(WorkflowEditor, {
        props: {
          workflow: mockWorkflow
        }
      })

      expect(component.text()).toContain('/src/components/Button.vue')
      expect(component.text()).toContain('/src/utils/helpers.ts')
      expect(component.text()).toContain('/package.json')
    })

    test('shows file selection dropdown', async () => {
      const component = await mountSuspended(WorkflowEditor, {
        props: {
          workflow: mockWorkflow
        }
      })

      const selects = component.findAll('select')
      expect(selects.length).toBe(2)
      
      expect(selects[0].text()).toContain('Select file to reference...')
    })

    test('can add file reference to step', async () => {
      const workflowWithAvailableFile: WorkflowStep[] = [
        { description: 'Test step', fileRefs: [] }
      ]

      const component = await mountSuspended(WorkflowEditor, {
        props: {
          workflow: workflowWithAvailableFile
        }
      })

      const select = component.find('select')
      await select.setValue('file1')
      await select.trigger('change')

      const emitted = component.emitted('update:workflow')
      expect(emitted).toBeTruthy()
      
      const updatedWorkflow = emitted?.[0]?.[0] as WorkflowStep[]
      expect(updatedWorkflow[0].fileRefs).toContain('file1')
    })

    test('shows only available files in dropdown', async () => {
      const workflowWithSomeUsedFiles: WorkflowStep[] = [
        { description: 'Test step', fileRefs: ['file1'] }
      ]

      const component = await mountSuspended(WorkflowEditor, {
        props: {
          workflow: workflowWithSomeUsedFiles
        }
      })

      const select = component.find('select')
      const options = select.findAll('option')
      
      const optionTexts = options.map(opt => opt.text())
      expect(optionTexts.some(text => text.includes('/src/components/Button.vue'))).toBe(false)
      expect(optionTexts.some(text => text.includes('/src/utils/helpers.ts'))).toBe(true)
      expect(optionTexts.some(text => text.includes('/package.json'))).toBe(true)
    })
  })

  describe('Props and Events', () => {
    test('accepts workflow prop', async () => {
      const component = await mountSuspended(WorkflowEditor, {
        props: {
          workflow: mockWorkflow
        }
      })

      expect(component.props('workflow')).toEqual(mockWorkflow)
    })

    test('emits update:workflow when workflow changes', async () => {
      const component = await mountSuspended(WorkflowEditor, {
        props: {
          workflow: []
        }
      })

      // Find the "Add Step" button by its text content
      const buttons = component.findAll('button')
      const addButton = buttons.find(button => button.text().includes('Add Step'))
      expect(addButton).toBeTruthy()
      await addButton!.trigger('click')

      expect(component.emitted('update:workflow')).toBeTruthy()
    })

    test('maintains two-way binding with v-model pattern', async () => {
      const component = await mountSuspended(WorkflowEditor, {
        props: {
          workflow: mockWorkflow
        }
      })

      expect(component.props('workflow')).toEqual(mockWorkflow)
    })
  })

  describe('Error Handling', () => {
    test('handles empty files manifest gracefully', async () => {
      mockProjectStore.filesManifest.value = {}
      
      const component = await mountSuspended(WorkflowEditor, {
        props: {
          workflow: mockWorkflow
        }
      })

      expect(component.text()).toContain('Unknown file')
    })

    test('handles workflow with empty fileRefs', async () => {
      const validWorkflow = [
        { description: 'Test step', fileRefs: [] }
      ]

      const component = await mountSuspended(WorkflowEditor, {
        props: {
          workflow: validWorkflow
        }
      })

      expect(component.exists()).toBe(true)
    })

    test('handles UI interactions gracefully', async () => {
      const component = await mountSuspended(WorkflowEditor, {
        props: {
          workflow: mockWorkflow
        }
      })

      const textareas = component.findAll('textarea')
      if (textareas.length > 0) {
        await textareas[0].setValue('New description')
        await textareas[0].trigger('input')
      }

      expect(component.exists()).toBe(true)
    })
  })

  describe('User Interface', () => {
    test('has proper section labels', async () => {
      const component = await mountSuspended(WorkflowEditor, {
        props: {
          workflow: mockWorkflow
        }
      })

      expect(component.text()).toContain('Description')
      expect(component.text()).toContain('Referenced Files')
    })

    test('step numbers are displayed prominently', async () => {
      const component = await mountSuspended(WorkflowEditor, {
        props: {
          workflow: mockWorkflow
        }
      })

      const stepNumbers = component.findAll('.w-6.h-6')
      expect(stepNumbers.length).toBe(2)
      expect(stepNumbers[0].text()).toBe('1')
      expect(stepNumbers[1].text()).toBe('2')
    })

    test('file references have proper styling', async () => {
      const component = await mountSuspended(WorkflowEditor, {
        props: {
          workflow: mockWorkflow
        }
      })

      const fileRefs = component.findAll('.bg-muted')
      expect(fileRefs.length).toBeGreaterThan(0)
    })

    test('action buttons have proper structure', async () => {
      const component = await mountSuspended(WorkflowEditor, {
        props: {
          workflow: mockWorkflow
        }
      })

      const buttons = component.findAll('button')
      expect(buttons.length).toBeGreaterThan(0)
      
      expect(component.findAll('textarea').length).toBe(2)
      expect(component.findAll('select').length).toBe(2)
    })
  })

  describe('State Management', () => {
    test('updates when workflow prop changes', async () => {
      const component = await mountSuspended(WorkflowEditor, {
        props: {
          workflow: []
        }
      })

      expect(component.text()).toContain('0 workflow steps')

      await component.setProps({ workflow: mockWorkflow })
      expect(component.text()).toContain('2 workflow steps')
    })

    test('clears file selection after adding file reference', async () => {
      const workflowWithAvailableFile: WorkflowStep[] = [
        { description: 'Test step', fileRefs: [] }
      ]

      const component = await mountSuspended(WorkflowEditor, {
        props: {
          workflow: workflowWithAvailableFile
        }
      })

      const select = component.find('select')
      await select.setValue('file1')
      await select.trigger('change')

      expect((select.element as HTMLSelectElement).value).toBe('')
    })

    test('maintains state when files manifest updates', async () => {
      const component = await mountSuspended(WorkflowEditor, {
        props: {
          workflow: mockWorkflow
        }
      })

      mockProjectStore.filesManifest.value = {
        ...mockFilesManifest,
        'file4': { path: '/src/new-file.js', comment: '' }
      }
      await component.vm.$nextTick()

      expect(component.text()).toContain('2 workflow steps')
    })
  })
}) 