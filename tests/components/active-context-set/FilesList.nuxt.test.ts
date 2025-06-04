import { describe, test, expect, vi, beforeEach } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import FilesList from '~/components/active-context-set/FilesList.vue'
import type { ContextSet, FileRef, LineRange, FileManifest, FileTreeItem } from '~/composables/useProjectStore'

// Mock the project store
const mockProjectStore = {
  activeContextSet: ref<ContextSet | null>(null),
  filesManifest: ref<FileManifest>({}),
  fileTree: ref<FileTreeItem[]>([]),
  removeFileFromActiveContextSet: vi.fn(),
  loadFileContent: vi.fn()
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
    workflow: []
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
    workflow: []
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
        workflow: []
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

      const viewButtons = component.findAll('button[title="View file content"]')
      expect(viewButtons.length).toBeGreaterThan(0)

      const specifyButtons = component.findAll('button[title="Specify line ranges"]')
      expect(specifyButtons.length).toBeGreaterThan(0)

      const removeButtons = component.findAll('button[title="Remove from context set"]')
      expect(removeButtons.length).toBeGreaterThan(0)
    })
  })

  describe('File Actions', () => {
    beforeEach(() => {
      mockProjectStore.activeContextSet.value = mockContextSetWithFiles
      mockProjectStore.filesManifest.value = mockFilesManifest
      mockProjectStore.fileTree.value = mockFileTree
    })

    test('view file action calls loadFileContent', async () => {
      const component = await mountSuspended(FilesList)

      const viewButton = component.find('button[title="View file content"]')
      await viewButton.trigger('click')

      expect(mockProjectStore.loadFileContent).toHaveBeenCalled()
    })

    test('remove file action calls removeFileFromActiveContextSet', async () => {
      mockProjectStore.removeFileFromActiveContextSet.mockReturnValue(true)
      const component = await mountSuspended(FilesList)

      const removeButton = component.find('button[title="Remove from context set"]')
      await removeButton.trigger('click')

      expect(mockProjectStore.removeFileFromActiveContextSet).toHaveBeenCalled()
    })

    test('specify lines action triggers accessibility announcement', async () => {
      const component = await mountSuspended(FilesList)

      const specifyButton = component.find('button[title="Specify line ranges"]')
      await specifyButton.trigger('click')

      expect(mockAccessibility.announceStatus).toHaveBeenCalled()
    })
  })

  describe('Modal Integration', () => {
    test('includes LineRangeSelectionModal component', async () => {
      const component = await mountSuspended(FilesList)

      const modal = component.findComponent({ name: 'LineRangeSelectionModal' })
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
}) 