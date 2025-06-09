/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */
import { describe, test, expect, vi, beforeEach } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import Editor from '~/components/active-context-set/Editor.vue'
import type { ContextSet, WorkflowStep } from '~/composables/useProjectStore'

// Mock the project store
const mockProjectStore = {
  activeContextSet: ref<ContextSet | null>(null),
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

// Mock child components to prevent rendering issues
vi.mock('~/components/active-context-set/FilesList.vue', () => ({
  default: {
    name: 'FilesList',
    template: '<div>Mocked FilesList</div>'
  }
}))

vi.mock('~/components/active-context-set/WorkflowEditor.vue', () => ({
  default: {
    name: 'WorkflowEditor',
    props: ['workflow'],
    emits: ['update:workflow'],
    template: '<div>Mocked WorkflowEditor</div>'
  }
}))

describe('Editor', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockProjectStore.activeContextSet.value = null
  })

  const mockContextSet: ContextSet = {
    name: 'Test Context Set',
    description: 'Test description',
    files: ['file1', 'file2', 'file3'],
    workflow: [
      { description: 'Step 1', fileRefs: ['file1'] },
      { description: 'Step 2', fileRefs: ['file2'] }
    ]
  }

  describe('Basic Component Rendering', () => {
    test('renders without crashing when no context set', async () => {
      const component = await mountSuspended(Editor)
      expect(component.exists()).toBe(true)
    })

    test('renders without crashing with context set', async () => {
      mockProjectStore.activeContextSet.value = mockContextSet
      const component = await mountSuspended(Editor)
      expect(component.exists()).toBe(true)
    })

    test('shows some content when context set is active', async () => {
      mockProjectStore.activeContextSet.value = mockContextSet
      const component = await mountSuspended(Editor)
      
      // Should show the mocked child components
      expect(component.text()).toContain('Mocked FilesList')
    })
  })

  describe('Workflow Updates', () => {
    test('handles workflow update successfully', async () => {
      mockProjectStore.activeContextSet.value = mockContextSet
      const component = await mountSuspended(Editor)

      const newWorkflow: WorkflowStep[] = [
        { description: 'Updated Step 1', fileRefs: ['file1'] }
      ]

      // Simulate workflow update from WorkflowEditor
      await component.vm.updateWorkflow(newWorkflow)

      expect(mockProjectStore.updateActiveContextSet).toHaveBeenCalledWith({
        workflow: newWorkflow
      })
      expect(mockAccessibility.announceStatus).toHaveBeenCalledWith('Workflow updated')
    })

    test('handles workflow update error', async () => {
      mockProjectStore.activeContextSet.value = mockContextSet
      const component = await mountSuspended(Editor)
      
      // Make updateActiveContextSet throw an error
      const error = new Error('Update failed')
      mockProjectStore.updateActiveContextSet.mockImplementation(() => {
        throw error
      })

      const newWorkflow: WorkflowStep[] = []
      await component.vm.updateWorkflow(newWorkflow)

      expect(mockAccessibility.announceError).toHaveBeenCalledWith('Update failed')
    })

    test('does not update workflow when no active context set', async () => {
      mockProjectStore.activeContextSet.value = null
      const component = await mountSuspended(Editor)

      const newWorkflow: WorkflowStep[] = []
      await component.vm.updateWorkflow(newWorkflow)

      expect(mockProjectStore.updateActiveContextSet).not.toHaveBeenCalled()
    })
  })

  describe('Component Structure', () => {
    test('has proper CSS classes for styling', async () => {
      const component = await mountSuspended(Editor)

      const container = component.find('.bg-gradient-surface')
      expect(container.exists()).toBe(true)
    })

    test('maintains basic layout structure', async () => {
      mockProjectStore.activeContextSet.value = mockContextSet
      const component = await mountSuspended(Editor)

      // Check that component has some structure
      expect(component.find('.flex-1').exists()).toBe(true)
    })
  })

  describe('State Management', () => {
    test('maintains component reactivity', async () => {
      mockProjectStore.activeContextSet.value = mockContextSet
      const component = await mountSuspended(Editor)

      // Update context set
      mockProjectStore.activeContextSet.value = {
        ...mockContextSet,
        name: 'Updated Context Set'
      }
      await component.vm.$nextTick()

      // Component should still exist and function
      expect(component.exists()).toBe(true)
    })
  })
}) 