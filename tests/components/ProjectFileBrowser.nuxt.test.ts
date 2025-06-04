// @vitest-environment nuxt
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'

// Create a simple test component to verify our testing setup works
const TestComponent = defineComponent({
  template: `
    <div data-testid="test-component">
      <h1>{{ title }}</h1>
      <button @click="increment">Count: {{ count }}</button>
    </div>
  `,
  setup() {
    const title = ref('Test Component')
    const count = ref(0)
    
    const increment = () => {
      count.value++
    }
    
    return {
      title,
      count,
      increment
    }
  }
})

describe('Component Testing Setup', () => {
  it('should mount and test a simple component', async () => {
    const component = await mountSuspended(TestComponent)
    
    expect(component.text()).toContain('Test Component')
    expect(component.text()).toContain('Count: 0')
    
    const button = component.find('button')
    await button.trigger('click')
    
    expect(component.text()).toContain('Count: 1')
  })

  it('should handle reactive data correctly', async () => {
    const component = await mountSuspended(TestComponent)
    
    // Initial state
    expect(component.find('[data-testid="test-component"]').exists()).toBe(true)
    expect(component.find('h1').text()).toBe('Test Component')
    
    // Simulate user interaction
    const button = component.find('button')
    expect(button.exists()).toBe(true)
    
    await button.trigger('click')
    await button.trigger('click')
    
    expect(component.text()).toContain('Count: 2')
  })
})

// Test component with props
const PropsTestComponent = defineComponent({
  props: {
    message: {
      type: String,
      required: true
    },
    items: {
      type: Array as PropType<string[]>,
      default: () => []
    }
  },
  template: `
    <div data-testid="props-component">
      <p>{{ message }}</p>
      <ul v-if="items.length">
        <li v-for="item in items" :key="item">{{ item }}</li>
      </ul>
      <p v-else>No items</p>
    </div>
  `
})

describe('Component Props Testing', () => {
  it('should handle props correctly', async () => {
    const component = await mountSuspended(PropsTestComponent, {
      props: {
        message: 'Hello World',
        items: ['item1', 'item2', 'item3']
      }
    })
    
    expect(component.text()).toContain('Hello World')
    expect(component.text()).toContain('item1')
    expect(component.text()).toContain('item2')
    expect(component.text()).toContain('item3')
    expect(component.findAll('li')).toHaveLength(3)
  })

  it('should handle empty props', async () => {
    const component = await mountSuspended(PropsTestComponent, {
      props: {
        message: 'Test Message'
      }
    })
    
    expect(component.text()).toContain('Test Message')
    expect(component.text()).toContain('No items')
    expect(component.findAll('li')).toHaveLength(0)
  })
})

// Test component with emit events
const EmitTestComponent = defineComponent({
  emits: ['custom-event', 'data-changed'],
  template: `
    <div data-testid="emit-component">
      <button @click="handleClick" data-testid="emit-button">Click me</button>
      <input @input="handleInput" data-testid="emit-input" />
    </div>
  `,
  setup(props, { emit }) {
    const handleClick = () => {
      emit('custom-event', { action: 'clicked' })
    }
    
    const handleInput = (event: Event) => {
      const target = event.target as HTMLInputElement
      emit('data-changed', target.value)
    }
    
    return {
      handleClick,
      handleInput
    }
  }
})

describe('Component Events Testing', () => {
  it('should emit events correctly', async () => {
    const component = await mountSuspended(EmitTestComponent)
    
    const button = component.find('[data-testid="emit-button"]')
    await button.trigger('click')
    
    const emittedEvents = component.emitted('custom-event')
    expect(emittedEvents).toHaveLength(1)
    expect(emittedEvents![0]).toEqual([{ action: 'clicked' }])
  })

  it('should emit input events', async () => {
    const component = await mountSuspended(EmitTestComponent)
    
    const input = component.find('[data-testid="emit-input"]')
    await input.setValue('test value')
    
    const emittedEvents = component.emitted('data-changed')
    expect(emittedEvents).toHaveLength(1)
    expect(emittedEvents![0]).toEqual(['test value'])
  })
})

// Test component with slots
const SlotTestComponent = defineComponent({
  template: `
    <div data-testid="slot-component">
      <header>
        <slot name="header">Default Header</slot>
      </header>
      <main>
        <slot>Default Content</slot>
      </main>
      <footer>
        <slot name="footer">Default Footer</slot>
      </footer>
    </div>
  `
})

describe('Component Slots Testing', () => {
  it('should render default slots', async () => {
    const component = await mountSuspended(SlotTestComponent)
    
    expect(component.text()).toContain('Default Header')
    expect(component.text()).toContain('Default Content')
    expect(component.text()).toContain('Default Footer')
  })

  it('should render custom slots', async () => {
    const component = await mountSuspended(SlotTestComponent, {
      slots: {
        header: '<h1>Custom Header</h1>',
        default: '<p>Custom Content</p>',
        footer: '<span>Custom Footer</span>'
      }
    })
    
    expect(component.text()).toContain('Custom Header')
    expect(component.text()).toContain('Custom Content')
    expect(component.text()).toContain('Custom Footer')
    expect(component.text()).not.toContain('Default Header')
    expect(component.text()).not.toContain('Default Content')
    expect(component.text()).not.toContain('Default Footer')
  })
}) 