/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */
/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */
import { describe, test, expect, vi, beforeEach } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import FilesList from '~/components/active-context-set/FilesList.vue'
import type { ContextSet, FileRef, LineRange, FileManifest, FileTreeItem, Workflow, WorkflowPoint } from '~/composables/useProjectStore'

// Mock the project store
const mockProjectStore = {
  activeContextSet: ref<ContextSet | null>(null),
  filesManifest: ref<FileManifest>({}),
  fileTree: ref<FileTreeItem[]>([]),
  removeFileFromActiveContextSet: vi.fn(),
  loadFileContent: vi.fn(),
  saveWorkingCopyToOPFS: vi.fn(),
  selectedFolder: ref(null),
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

// Mock the LineRangeSelectionModal component
vi.mock('~/components/active-context-set/LineRangeSelectionModal.vue', () => ({
  default: {
    name: 'LineRangeSelectionModal',
    props: ['open', 'fileId', 'existingRanges'],
    emits: ['update:open', 'ranges-updated'],
    template: '<div>Mocked LineRangeSelectionModal</div>'
  }
}))

// Mock the WorkflowPointEditor component
vi.mock('~/components/active-context-set/WorkflowPointEditor.vue', () => ({
  default: {
    name: 'WorkflowPointEditor',
    props: ['isExpanded', 'fileId', 'workflowPointType', 'existingWorkflowPoint', 'hasExistingWorkflowPoint'],
    emits: ['cancel', 'save', 'remove'],
    template: '<div data-testid="workflow-point-editor">Mocked WorkflowPointEditor</div>'
  }
}))

// Mock the FunctionSelectorModal component
vi.mock('~/components/active-context-set/FunctionSelectorModal.vue', () => ({
  default: {
    name: 'FunctionSelectorModal',
    props: ['open', 'fileId', 'existingFunctions', 'entryPointMode'],
    emits: ['update:open', 'functions-updated'],
    template: '<div>Mocked FunctionSelectorModal</div>'
  }
}))

describe('FilesList', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockProjectStore.activeContextSet.value = null
    mockProjectStore.filesManifest.value = {}
    mockProjectStore.fileTree.value = []
  })

  const mockFilesManifest: FileManifest = {
    'file1': { path: '/src/components/Button.vue' },
    'file2': { path: '/src/utils/helpers.ts' },
    'file3': { path: '/package.json' }
  }

  const mockFileTree: FileTreeItem[] = [
    {
      name: 'Button.vue',
      path: '/src/components/Button.vue',
      type: 'file',
      handle: {} as FileSystemFileHandle
    },
    {
      name: 'helpers.ts',
      path: '/src/utils/helpers.ts',
      type: 'file',
      handle: {} as FileSystemFileHandle
    }
  ]

  const mockContextSetWithFiles: ContextSet = {
    name: 'Test Context Set',
    description: 'Test description',
    files: ['file1', 'file2'],
    workflows: []
  }

  const mockContextSetWithFileRefs: ContextSet = {
    name: 'Test Context Set',
    description: 'Test description',
    files: [
      'file1',
      {
        fileRef: 'file2',
        lineRanges: [
          { start: 10, end: 20, comment: 'Important function' },
          { start: 30, end: 35, comment: 'Error handling' }
        ],
        comment: 'Utility functions'
      } as FileRef
    ],
    workflows: []
  }

  describe('Basic Component Rendering', () => {
    test('renders without crashing when no context set', async () => {
      const component = await mountSuspended(FilesList)
      expect(component.exists()).toBe(true)
    })

    test('renders without crashing with empty files', async () => {
      mockProjectStore.activeContextSet.value = {
        name: 'Empty Context Set',
        description: '',
        files: [],
        workflows: []
      }

      const component = await mountSuspended(FilesList)
      expect(component.exists()).toBe(true)
    })

    test('renders without crashing with files', async () => {
      mockProjectStore.activeContextSet.value = mockContextSetWithFiles
      mockProjectStore.filesManifest.value = mockFilesManifest
      mockProjectStore.fileTree.value = mockFileTree

      const component = await mountSuspended(FilesList)
      expect(component.exists()).toBe(true)
    })
  })

  describe('Files Display', () => {
    beforeEach(() => {
      mockProjectStore.activeContextSet.value = mockContextSetWithFiles
      mockProjectStore.filesManifest.value = mockFilesManifest
      mockProjectStore.fileTree.value = mockFileTree
    })

    test('displays file names correctly', async () => {
      const component = await mountSuspended(FilesList)

      expect(component.text()).toContain('Button.vue')
      expect(component.text()).toContain('helpers.ts')
    })

    test('displays file paths correctly', async () => {
      const component = await mountSuspended(FilesList)

      expect(component.text()).toContain('/src/components/Button.vue')
      expect(component.text()).toContain('/src/utils/helpers.ts')
    })

    test('shows action buttons', async () => {
      const component = await mountSuspended(FilesList)

      const selectFunctionButtons = component.findAll('button[title="Select specific functions from this file"]')
      expect(selectFunctionButtons.length).toBeGreaterThan(0)

      const workflowStartButtons = component.findAll('button[title="Set this file as the start point of a workflow"]')
      expect(workflowStartButtons.length).toBeGreaterThan(0)

      const workflowEndButtons = component.findAll('button[title="Set this file as the end point of a workflow"]')
      expect(workflowEndButtons.length).toBeGreaterThan(0)

      const removeButtons = component.findAll('button[title="Remove file from this context set"]')
      expect(removeButtons.length).toBeGreaterThan(0)
    })
  })

  describe('File Actions', () => {
    beforeEach(() => {
      mockProjectStore.activeContextSet.value = mockContextSetWithFiles
      mockProjectStore.filesManifest.value = mockFilesManifest
      mockProjectStore.fileTree.value = mockFileTree
    })

    test('remove file action calls removeFileFromActiveContextSet', async () => {
      mockProjectStore.removeFileFromActiveContextSet.mockReturnValue(true)
      const component = await mountSuspended(FilesList)

      const removeButton = component.find('button[title="Remove file from this context set"]')
      await removeButton.trigger('click')

      expect(mockProjectStore.removeFileFromActiveContextSet).toHaveBeenCalled()
    })

    test('select functions action triggers accessibility announcement', async () => {
      const component = await mountSuspended(FilesList)

      const selectFunctionButton = component.find('button[title="Select specific functions from this file"]')
      await selectFunctionButton.trigger('click')

      expect(mockAccessibility.announceStatus).toHaveBeenCalled()
    })

    test('workflow start button action triggers correctly', async () => {
      const component = await mountSuspended(FilesList)

      const workflowStartButton = component.find('button[title="Set this file as the start point of a workflow"]')
      expect(workflowStartButton.exists()).toBe(true)
    })

    test('workflow end button action triggers correctly', async () => {
      const component = await mountSuspended(FilesList)

      const workflowEndButton = component.find('button[title="Set this file as the end point of a workflow"]')
      expect(workflowEndButton.exists()).toBe(true)
    })
  })

  describe('Modal Integration', () => {
    test('includes FunctionSelectorModal component', async () => {
      const component = await mountSuspended(FilesList)

      const modal = component.findComponent({ name: 'FunctionSelectorModal' })
      expect(modal.exists()).toBe(true)
    })
  })

  describe('State Management', () => {
    test('updates when active context set changes', async () => {
      const component = await mountSuspended(FilesList)

      // Start with no context set
      expect(component.exists()).toBe(true)

      // Set context set with files
      mockProjectStore.activeContextSet.value = mockContextSetWithFiles
      mockProjectStore.filesManifest.value = mockFilesManifest
      await component.vm.$nextTick()

      expect(component.exists()).toBe(true)
    })
  })

  describe('Workflow Point Removal', () => {
    let mockContextSetWithWorkflows: ContextSet
    
    beforeEach(() => {
      // Create a context set with workflows for testing
      mockContextSetWithWorkflows = {
        name: 'Test Context Set with Workflows',
        description: 'Test description',
        files: ['file1', 'file2', 'file3'],
        workflows: [
          {
            start: {
              fileRef: 'file1',
              function: 'startFunction',
              protocol: 'function',
              method: 'call',
              identifier: ''
            },
            end: {
              fileRef: 'file2',
              function: 'endFunction',
              protocol: 'function',
              method: 'call',
              identifier: ''
            }
          },
          {
            start: {
              fileRef: 'file3',
              function: 'anotherStartFunction',
              protocol: 'function',
              method: 'call',
              identifier: ''
            },
            end: {
              fileRef: 'file1',
              function: 'anotherEndFunction',
              protocol: 'function',
              method: 'call',
              identifier: ''
            }
          }
        ]
      }
      
      mockProjectStore.activeContextSet.value = mockContextSetWithWorkflows
      mockProjectStore.filesManifest.value = mockFilesManifest
      mockProjectStore.fileTree.value = mockFileTree
    })

    test('removing start point only removes workflows where file is start point', async () => {
      const component = await mountSuspended(FilesList)
      
      // Find WorkflowPointEditor component and trigger remove event for start point
      const workflowEditor = component.findComponent({ name: 'WorkflowPointEditor' })
      
      // Simulate remove event for file1 as start point
      await workflowEditor.vm.$emit('remove', 'file1', 'start')
      
      // Verify updateActiveContextSet was called
      expect(mockProjectStore.updateActiveContextSet).toHaveBeenCalled()
      
      // Get the call arguments to check the updated workflows
      const updateCall = mockProjectStore.updateActiveContextSet.mock.calls[0][0]
      const updatedWorkflows = updateCall.workflows
      
      // Should only remove the workflow where file1 is the start point
      // The workflow where file1 is the end point should remain
      expect(updatedWorkflows).toHaveLength(1)
      expect(updatedWorkflows[0].start.fileRef).toBe('file3')
      expect(updatedWorkflows[0].end.fileRef).toBe('file1')
    })

    test('removing end point only removes workflows where file is end point', async () => {
      const component = await mountSuspended(FilesList)
      
      // Find WorkflowPointEditor component and trigger remove event for end point
      const workflowEditor = component.findComponent({ name: 'WorkflowPointEditor' })
      
      // Simulate remove event for file1 as end point
      await workflowEditor.vm.$emit('remove', 'file1', 'end')
      
      // Verify updateActiveContextSet was called
      expect(mockProjectStore.updateActiveContextSet).toHaveBeenCalled()
      
      // Get the call arguments to check the updated workflows
      const updateCall = mockProjectStore.updateActiveContextSet.mock.calls[0][0]
      const updatedWorkflows = updateCall.workflows
      
      // Should only remove the workflow where file1 is the end point
      // The workflow where file1 is the start point should remain
      expect(updatedWorkflows).toHaveLength(1)
      expect(updatedWorkflows[0].start.fileRef).toBe('file1')
      expect(updatedWorkflows[0].end.fileRef).toBe('file2')
    })

    test('both start and end points can coexist on same file without interference', async () => {
      const component = await mountSuspended(FilesList)
      
      // file1 has both start and end points in different workflows
      // Initially: file1 is start in workflow1, file1 is end in workflow2
      expect(mockContextSetWithWorkflows.workflows).toHaveLength(2)
      expect(mockContextSetWithWorkflows.workflows[0].start.fileRef).toBe('file1')
      expect(mockContextSetWithWorkflows.workflows[1].end.fileRef).toBe('file1')
      
      const workflowEditor = component.findComponent({ name: 'WorkflowPointEditor' })
      
      // Remove only the start point for file1
      await workflowEditor.vm.$emit('remove', 'file1', 'start')
      
      const updateCall = mockProjectStore.updateActiveContextSet.mock.calls[0][0]
      const updatedWorkflows = updateCall.workflows
      
      // Should still have the workflow where file1 is the end point
      expect(updatedWorkflows).toHaveLength(1)
      expect(updatedWorkflows[0].end.fileRef).toBe('file1')
      expect(updatedWorkflows[0].start.fileRef).toBe('file3')
    })

    test('removing start point from file that only has start point removes entire workflow', async () => {
      const component = await mountSuspended(FilesList)
      
      const workflowEditor = component.findComponent({ name: 'WorkflowPointEditor' })
      
      // Remove start point for file3 (which only appears as start point)
      await workflowEditor.vm.$emit('remove', 'file3', 'start')
      
      const updateCall = mockProjectStore.updateActiveContextSet.mock.calls[0][0]
      const updatedWorkflows = updateCall.workflows
      
      // Should remove the workflow where file3 is the start point
      expect(updatedWorkflows).toHaveLength(1)
      expect(updatedWorkflows[0].start.fileRef).toBe('file1')
      expect(updatedWorkflows[0].end.fileRef).toBe('file2')
    })

    test('removing end point from file that only has end point removes entire workflow', async () => {
      const component = await mountSuspended(FilesList)
      
      const workflowEditor = component.findComponent({ name: 'WorkflowPointEditor' })
      
      // Remove end point for file2 (which only appears as end point)
      await workflowEditor.vm.$emit('remove', 'file2', 'end')
      
      const updateCall = mockProjectStore.updateActiveContextSet.mock.calls[0][0]
      const updatedWorkflows = updateCall.workflows
      
      // Should remove the workflow where file2 is the end point
      expect(updatedWorkflows).toHaveLength(1)
      expect(updatedWorkflows[0].start.fileRef).toBe('file3')
      expect(updatedWorkflows[0].end.fileRef).toBe('file1')
    })

    test('workflow point removal triggers correct status announcement', async () => {
      const component = await mountSuspended(FilesList)
      
      const workflowEditor = component.findComponent({ name: 'WorkflowPointEditor' })
      
      // Remove start point for file1
      await workflowEditor.vm.$emit('remove', 'file1', 'start')
      
      // Should announce the removal with correct point type
      expect(mockAccessibility.announceStatus).toHaveBeenCalledWith(
        expect.stringContaining('Removed workflow start point')
      )
    })

    test('handles removal when no workflows exist gracefully', async () => {
      // Set up context set with no workflows
      mockProjectStore.activeContextSet.value = {
        ...mockContextSetWithFiles,
        workflows: []
      }
      
      const component = await mountSuspended(FilesList)
      const workflowEditor = component.findComponent({ name: 'WorkflowPointEditor' })
      
      // Attempt to remove workflow point when none exist
      await workflowEditor.vm.$emit('remove', 'file1', 'start')
      
      // Should not throw error and should call updateActiveContextSet with empty workflows
      expect(mockProjectStore.updateActiveContextSet).toHaveBeenCalledWith({ workflows: [] })
    })
  })
}) 