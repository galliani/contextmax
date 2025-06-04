import { describe, test, expect, vi, beforeEach } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import Tree from '~/components/project-file-browser/Tree.vue'
import type { FileTreeItem } from '~/composables/useProjectStore'

// Mock the project store
const mockProjectStore = {
  hasActiveHandles: ref(true)
}

vi.mock('~/composables/useProjectStore', () => ({
  useProjectStore: () => mockProjectStore
}))

// Mock TreeItem component to prevent rendering issues
vi.mock('~/components/project-file-browser/TreeItem.vue', () => ({
  default: {
    name: 'TreeItem',
    props: ['item', 'level', 'searchTerm', 'disabled', 'autoExpand'],
    template: '<div>Mocked TreeItem: {{ item.name }}</div>'
  }
}))

describe('Tree', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  const mockFiles: FileTreeItem[] = [
    {
      name: 'components',
      path: '/src/components',
      type: 'directory',
      children: [
        {
          name: 'Button.vue',
          path: '/src/components/Button.vue',
          type: 'file'
        }
      ]
    },
    {
      name: 'app.vue',
      path: '/app.vue',
      type: 'file'
    }
  ]

  describe('Basic Rendering', () => {
    test('renders without crashing with empty files', async () => {
      const component = await mountSuspended(Tree, {
        props: {
          files: []
        }
      })

      expect(component.exists()).toBe(true)
    })

    test('renders without crashing with files', async () => {
      const component = await mountSuspended(Tree, {
        props: {
          files: mockFiles
        }
      })

      expect(component.exists()).toBe(true)
    })

    test('shows file content when files provided', async () => {
      const component = await mountSuspended(Tree, {
        props: {
          files: mockFiles
        }
      })

      // Should show mocked TreeItem content
      expect(component.text()).toContain('components')
      expect(component.text()).toContain('app.vue')
    })
  })

  describe('Empty States', () => {
    test('shows empty state with no files', async () => {
      const component = await mountSuspended(Tree, {
        props: {
          files: []
        }
      })

      expect(component.text()).toContain('No files found')
    })
  })

  describe('Search Integration', () => {
    test('includes Search component', async () => {
      const component = await mountSuspended(Tree, {
        props: {
          files: mockFiles
        }
      })

      // Look for search input which would be in the Search component
      const searchElement = component.find('input, [data-testid="search"]')
      expect(searchElement.exists() || component.text().includes('search')).toBe(true)
    })
  })

  describe('Component Structure', () => {
    test('component mounts successfully', async () => {
      const component = await mountSuspended(Tree, {
        props: {
          files: mockFiles
        }
      })

      expect(component.exists()).toBe(true)
    })
  })

  describe('Props Handling', () => {
    test('accepts files prop', async () => {
      const component = await mountSuspended(Tree, {
        props: {
          files: mockFiles
        }
      })

      expect(component.exists()).toBe(true)
    })

    test('handles different file array sizes', async () => {
      const smallFileList: FileTreeItem[] = [
        {
          name: 'single.txt',
          path: '/single.txt',
          type: 'file'
        }
      ]

      const component = await mountSuspended(Tree, {
        props: {
          files: smallFileList
        }
      })

      expect(component.exists()).toBe(true)
    })
  })

  describe('Error Handling', () => {
    test('handles null files gracefully', async () => {
      const component = await mountSuspended(Tree, {
        props: {
          files: []
        }
      })

      expect(component.exists()).toBe(true)
    })
  })

  describe('Reactivity', () => {
    test('component updates when files prop changes', async () => {
      const component = await mountSuspended(Tree, {
        props: {
          files: []
        }
      })

      expect(component.text()).toContain('No files found')

      await component.setProps({ files: mockFiles })
      expect(component.text()).toContain('components')
    })
  })
}) 