/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */
<template>
  <div id="app" class="app-container">
    <!-- Skip to Content Link -->
    <a href="#main-content" class="skip-to-content">
      Skip to main content
    </a>
    
    <!-- Page Header with Site Navigation -->
    <header role="banner" class="app-header sr-only">
      <div class="container mx-auto px-4">
        <h1 class="text-2xl font-bold text-foreground">
          contextMax
        </h1>
        <p class="text-muted-foreground">
          Create curated context sets for Large Language Models from your codebase
        </p>
      </div>
    </header>
    
    <!-- Main Application Content -->
    <main id="main-content" role="main" class="app-main" tabindex="-1">
      <div class="min-h-screen bg-background text-foreground">
        <NuxtPage />
      </div>
    </main>
    
    <!-- ARIA Live Regions for Dynamic Content -->
    <div aria-live="polite" aria-atomic="true" class="live-region" id="status-announcements">
      {{ statusMessage }}
    </div>
    
    <div aria-live="assertive" aria-atomic="true" class="live-region" id="error-announcements">
      {{ errorMessage }}
    </div>
    
    <!-- Application Footer -->
    <footer role="contentinfo" class="app-footer bg-background/90 backdrop-blur-sm py-8">
      <div class="container mx-auto px-4 py-3">
        <div class="flex items-center justify-center gap-3">
          <img src="/logo-transparent.png" alt="ContextMax Logo" class="w-5 h-5" />
          <p class="text-sm text-muted-foreground text-center">
            contextMax 2025, created by 
            <a href="https://github.com/galliani" target="_blank" rel="noopener noreferrer" class="text-primary hover:text-primary/80 transition-colors duration-200">Galih</a> 
            of 
            <a href="https://51newyork.com" target="_blank" rel="noopener noreferrer" class="text-primary hover:text-primary/80 transition-colors duration-200">51NewYork</a>            
          </p>
        </div>
      </div>
    </footer>
    
    <!-- Global UX Systems -->
    <NotificationContainer />
    <HealthCheck />
  </div>
</template>

<script setup lang="ts">
// Import the NotificationContainer component
import NotificationContainer from './components/ui/NotificationContainer.vue'
import HealthCheck from './components/HealthCheck.vue'

// Global state for accessibility announcements
const statusMessage = ref('')
const errorMessage = ref('')

// Meta tags for SEO and accessibility
useSeoMeta({
  titleTemplate: '%s - contextMax',
  description: 'Create curated context sets for Large Language Models from your codebase. Streamline your AI-assisted development workflow.',
  ogType: 'website',
  ogSiteName: 'contextMax',
  twitterCard: 'summary_large_image',
  viewport: 'width=device-width, initial-scale=1',
  charset: 'utf-8'
})

// Head configuration for accessibility and SEO
useHead({
  htmlAttrs: {
    lang: 'en',
    dir: 'ltr'
  },
  meta: [
    { charset: 'utf-8' },
    { name: 'viewport', content: 'width=device-width, initial-scale=1' },
    { name: 'color-scheme', content: 'light dark' }
  ],
  link: [
    { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
    { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: '' }
  ]
})

// Provide global accessibility helpers
provide('announceStatus', (message: string) => {
  statusMessage.value = message
  // Clear after announcement
  setTimeout(() => {
    statusMessage.value = ''
  }, 1000)
})

provide('announceError', (message: string) => {
  errorMessage.value = message
  // Clear after announcement
  setTimeout(() => {
    errorMessage.value = ''
  }, 1000)
})

// Keyboard navigation support
onMounted(() => {
  // Focus management for keyboard users
  const handleFocusManagement = (event: KeyboardEvent) => {
    // Alt + 1: Focus main content
    if (event.altKey && event.key === '1') {
      event.preventDefault()
      const mainContent = document.getElementById('main-content')
      if (mainContent) {
        mainContent.focus()
      }
    }
    
    // Alt + 2: Focus first interactive element
    if (event.altKey && event.key === '2') {
      event.preventDefault()
      const firstInteractive = document.querySelector('button, input, select, textarea, a[href]') as HTMLElement
      if (firstInteractive) {
        firstInteractive.focus()
      }
    }
  }
  
  document.addEventListener('keydown', handleFocusManagement)
  
  // Cleanup
  onUnmounted(() => {
    document.removeEventListener('keydown', handleFocusManagement)
  })
})

// Reduced motion preference handling
const prefersReducedMotion = ref(false)

onMounted(() => {
  const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
  prefersReducedMotion.value = mediaQuery.matches
  
  const handleChange = (e: MediaQueryListEvent) => {
    prefersReducedMotion.value = e.matches
  }
  
  mediaQuery.addEventListener('change', handleChange)
  
  // Apply reduced motion class to body
  if (prefersReducedMotion.value) {
    document.body.classList.add('reduce-motion')
  }
  
  onUnmounted(() => {
    mediaQuery.removeEventListener('change', handleChange)
  })
})

watch(prefersReducedMotion, (reducedMotion) => {
  if (reducedMotion) {
    document.body.classList.add('reduce-motion')
  } else {
    document.body.classList.remove('reduce-motion')
  }
})
</script>

<style>
/* Global accessibility styles */
.app-container {
  position: relative;
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}

.app-main {
  flex: 1;
}

/* Reduced motion support */
.reduce-motion *,
.reduce-motion *::before,
.reduce-motion *::after {
  animation-duration: 0.01ms !important;
  animation-iteration-count: 1 !important;
  transition-duration: 0.01ms !important;
  scroll-behavior: auto !important;
}

/* Focus trap styles */
.focus-trap {
  position: relative;
}

.focus-trap::before,
.focus-trap::after {
  content: '';
  position: absolute;
  width: 1px;
  height: 1px;
  opacity: 0;
  pointer-events: none;
  outline: none;
}

/* High contrast focus indicators */
@media (prefers-contrast: high) {
  *:focus-visible {
    outline: 3px solid !important;
    outline-offset: 2px !important;
  }
}

/* Print styles for accessibility */
@media print {
  .skip-to-content,
  .live-region {
    display: none !important;
  }
  
  .app-header,
  .app-footer {
    display: block !important;
    position: static !important;
    clip: auto !important;
    width: auto !important;
    height: auto !important;
    margin: 0 !important;
    padding: 1rem 0 !important;
    border-top: 1px solid #000;
    border-bottom: 1px solid #000;
  }
}

.page-enter-active,
.page-leave-active {
  transition: all 0.4s;
}
.page-enter-from,
.page-leave-to {
  opacity: 0;
  filter: blur(1rem);
}
</style>