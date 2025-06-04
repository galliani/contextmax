import { ref, inject, onMounted, onUnmounted } from 'vue'

export interface AccessibilityOptions {
  announcePageChanges?: boolean
  manageFocus?: boolean
  trapFocus?: boolean
  enableKeyboardShortcuts?: boolean
}

export interface FocusTrap {
  element: HTMLElement
  firstFocusable: HTMLElement | null
  lastFocusable: HTMLElement | null
  previouslyFocused: HTMLElement | null
}

export function useAccessibility(options: AccessibilityOptions = {}) {
  const statusAnnouncer = inject('announceStatus') as ((message: string) => void) || (() => {})
  const errorAnnouncer = inject('announceError') as ((message: string) => void) || (() => {})
  
  const currentFocusTrap = ref<FocusTrap | null>(null)
  const skipLinks = ref<HTMLElement[]>([])
  const landmarks = ref<HTMLElement[]>([])
  
  // Announcement helpers
  const announceStatus = (message: string) => {
    statusAnnouncer(message)
  }
  
  const announceError = (message: string) => {
    errorAnnouncer(message)
  }
  
  const announcePageChange = (title: string, description?: string) => {
    if (options.announcePageChanges !== false) {
      const message = description ? `${title}. ${description}` : title
      announceStatus(`Navigated to ${message}`)
    }
  }
  
  // Focus management
  const getFocusableElements = (container: HTMLElement = document.body): HTMLElement[] => {
    const focusableSelectors = [
      'a[href]',
      'button:not([disabled])',
      'input:not([disabled])',
      'select:not([disabled])',
      'textarea:not([disabled])',
      '[tabindex]:not([tabindex="-1"])',
      '[contenteditable="true"]'
    ].join(',')
    
    return Array.from(container.querySelectorAll(focusableSelectors)) as HTMLElement[]
  }
  
  const focusElement = (element: HTMLElement | null, options: { preventScroll?: boolean } = {}) => {
    if (element) {
      element.focus({ preventScroll: options.preventScroll })
      return true
    }
    return false
  }
  
  const focusFirstElement = (container: HTMLElement = document.body) => {
    const focusableElements = getFocusableElements(container)
    return focusElement(focusableElements[0])
  }
  
  const focusLastElement = (container: HTMLElement = document.body) => {
    const focusableElements = getFocusableElements(container)
    return focusElement(focusableElements[focusableElements.length - 1])
  }
  
  // Focus trap implementation
  const createFocusTrap = (element: HTMLElement): FocusTrap => {
    const focusableElements = getFocusableElements(element)
    const firstFocusable = focusableElements[0] || null
    const lastFocusable = focusableElements[focusableElements.length - 1] || null
    const previouslyFocused = document.activeElement as HTMLElement
    
    return {
      element,
      firstFocusable,
      lastFocusable,
      previouslyFocused
    }
  }
  
  const trapFocus = (element: HTMLElement) => {
    if (currentFocusTrap.value) {
      releaseFocusTrap()
    }
    
    const trap = createFocusTrap(element)
    currentFocusTrap.value = trap
    
    const handleFocusTrap = (event: KeyboardEvent) => {
      if (event.key !== 'Tab') return
      
      const { firstFocusable, lastFocusable } = trap
      
      if (!firstFocusable || !lastFocusable) return
      
      if (event.shiftKey) {
        // Shift + Tab
        if (document.activeElement === firstFocusable) {
          event.preventDefault()
          lastFocusable.focus()
        }
      } else {
        // Tab
        if (document.activeElement === lastFocusable) {
          event.preventDefault()
          firstFocusable.focus()
        }
      }
    }
    
    element.addEventListener('keydown', handleFocusTrap)
    
    // Focus first element
    if (trap.firstFocusable) {
      trap.firstFocusable.focus()
    }
    
    return () => {
      element.removeEventListener('keydown', handleFocusTrap)
    }
  }
  
  const releaseFocusTrap = () => {
    if (currentFocusTrap.value) {
      const { previouslyFocused } = currentFocusTrap.value
      if (previouslyFocused) {
        previouslyFocused.focus()
      }
      currentFocusTrap.value = null
    }
  }
  
  // Skip link management
  const createSkipLink = (target: string, label: string): HTMLElement => {
    const skipLink = document.createElement('a')
    skipLink.href = `#${target}`
    skipLink.textContent = label
    skipLink.className = 'skip-to-content'
    skipLink.setAttribute('data-skip-link', 'true')
    
    skipLink.addEventListener('click', (event) => {
      event.preventDefault()
      const targetElement = document.getElementById(target)
      if (targetElement) {
        targetElement.focus()
        announceStatus(`Skipped to ${label}`)
      }
    })
    
    return skipLink
  }
  
  const addSkipLinks = (links: Array<{ target: string; label: string }>) => {
    const container = document.createElement('div')
    container.className = 'skip-links-container'
    container.setAttribute('aria-label', 'Skip navigation links')
    
    links.forEach(({ target, label }) => {
      const skipLink = createSkipLink(target, label)
      container.appendChild(skipLink)
      skipLinks.value.push(skipLink)
    })
    
    document.body.insertBefore(container, document.body.firstChild)
  }
  
  // Landmark detection and navigation
  const detectLandmarks = () => {
    const landmarkSelectors = [
      'main',
      'nav',
      'header',
      'footer',
      'aside',
      'section',
      '[role="main"]',
      '[role="navigation"]',
      '[role="banner"]',
      '[role="contentinfo"]',
      '[role="complementary"]',
      '[role="region"]'
    ]
    
    landmarks.value = Array.from(
      document.querySelectorAll(landmarkSelectors.join(','))
    ) as HTMLElement[]
  }
  
  const navigateToLandmark = (index: number) => {
    if (landmarks.value[index]) {
      landmarks.value[index].focus()
      const landmarkName = landmarks.value[index].getAttribute('aria-label') ||
                           landmarks.value[index].tagName.toLowerCase()
      announceStatus(`Navigated to ${landmarkName} landmark`)
    }
  }
  
  // ARIA attribute helpers
  const updateAriaLabel = (element: HTMLElement, label: string) => {
    element.setAttribute('aria-label', label)
  }
  
  const updateAriaDescription = (element: HTMLElement, description: string) => {
    element.setAttribute('aria-describedby', description)
  }
  
  const setAriaExpanded = (element: HTMLElement, expanded: boolean) => {
    element.setAttribute('aria-expanded', expanded.toString())
  }
  
  const setAriaSelected = (element: HTMLElement, selected: boolean) => {
    element.setAttribute('aria-selected', selected.toString())
  }
  
  const setAriaPressed = (element: HTMLElement, pressed: boolean) => {
    element.setAttribute('aria-pressed', pressed.toString())
  }
  
  const setAriaDisabled = (element: HTMLElement, disabled: boolean) => {
    element.setAttribute('aria-disabled', disabled.toString())
    if (disabled) {
      element.setAttribute('tabindex', '-1')
    } else {
      element.removeAttribute('tabindex')
    }
  }
  
  const setAriaHidden = (element: HTMLElement, hidden: boolean) => {
    if (hidden) {
      element.setAttribute('aria-hidden', 'true')
      element.setAttribute('tabindex', '-1')
    } else {
      element.removeAttribute('aria-hidden')
      element.removeAttribute('tabindex')
    }
  }
  
  // Keyboard navigation helpers
  const handleArrowNavigation = (
    event: KeyboardEvent,
    items: HTMLElement[],
    currentIndex: number,
    options: {
      orientation?: 'horizontal' | 'vertical' | 'both'
      wrap?: boolean
      onSelect?: (index: number) => void
    } = {}
  ): number => {
    const { orientation = 'both', wrap = true, onSelect } = options
    
    let newIndex = currentIndex
    
    switch (event.key) {
      case 'ArrowDown':
        if (orientation === 'vertical' || orientation === 'both') {
          event.preventDefault()
          newIndex = wrap && currentIndex === items.length - 1 ? 0 : Math.min(currentIndex + 1, items.length - 1)
        }
        break
      case 'ArrowUp':
        if (orientation === 'vertical' || orientation === 'both') {
          event.preventDefault()
          newIndex = wrap && currentIndex === 0 ? items.length - 1 : Math.max(currentIndex - 1, 0)
        }
        break
      case 'ArrowRight':
        if (orientation === 'horizontal' || orientation === 'both') {
          event.preventDefault()
          newIndex = wrap && currentIndex === items.length - 1 ? 0 : Math.min(currentIndex + 1, items.length - 1)
        }
        break
      case 'ArrowLeft':
        if (orientation === 'horizontal' || orientation === 'both') {
          event.preventDefault()
          newIndex = wrap && currentIndex === 0 ? items.length - 1 : Math.max(currentIndex - 1, 0)
        }
        break
      case 'Home':
        event.preventDefault()
        newIndex = 0
        break
      case 'End':
        event.preventDefault()
        newIndex = items.length - 1
        break
      case 'Enter':
      case ' ':
        event.preventDefault()
        onSelect?.(currentIndex)
        return currentIndex
    }
    
    if (newIndex !== currentIndex && items[newIndex]) {
      items[newIndex].focus()
      onSelect?.(newIndex)
    }
    
    return newIndex
  }
  
  // Initialize accessibility features
  onMounted(() => {
    detectLandmarks()
    
    // Add default skip links
    if (options.enableKeyboardShortcuts !== false) {
      addSkipLinks([
        { target: 'main-content', label: 'Skip to main content' },
        { target: 'navigation', label: 'Skip to navigation' }
      ])
    }
  })
  
  // Cleanup
  onUnmounted(() => {
    releaseFocusTrap()
    skipLinks.value.forEach(link => link.remove())
    skipLinks.value = []
  })
  
  return {
    // Announcements
    announceStatus,
    announceError,
    announcePageChange,
    
    // Focus management
    getFocusableElements,
    focusElement,
    focusFirstElement,
    focusLastElement,
    trapFocus,
    releaseFocusTrap,
    
    // Skip links
    addSkipLinks,
    createSkipLink,
    
    // Landmarks
    detectLandmarks,
    navigateToLandmark,
    landmarks: readonly(landmarks),
    
    // ARIA helpers
    updateAriaLabel,
    updateAriaDescription,
    setAriaExpanded,
    setAriaSelected,
    setAriaPressed,
    setAriaDisabled,
    setAriaHidden,
    
    // Keyboard navigation
    handleArrowNavigation,
    
    // State
    currentFocusTrap: readonly(currentFocusTrap)
  }
} 