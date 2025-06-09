/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */
<template>
  <!-- Hero Section -->
  <header id="hero" class="relative pt-32 pb-24 overflow-hidden">
    <!-- Background decoration -->
    <div class="absolute inset-0 -z-10">
      <div class="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/3 rounded-full blur-3xl"></div>
      <div class="absolute bottom-1/3 right-1/4 w-[32rem] h-[32rem] bg-secondary/3 rounded-full blur-3xl"></div>
      <div class="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-[40rem] h-[40rem] bg-accent/2 rounded-full blur-3xl"></div>
    </div>
    
    <div class="container-smart relative z-10">
      <div class="grid lg:grid-cols-12 gap-16 items-center min-h-[80vh]">
        <!-- Left Column - Headlines and CTA -->
        <div class="lg:col-span-6 space-y-10">
          <!-- Main Headline -->
          <div class="space-y-8">
            <h1 class="text-5xl sm:text-5xl lg:text-6xl xl:text-7xl font-black tracking-tight leading-[1.2] text-foreground">
              Stop AI
              <span class="text-muted-foreground/80">Guesswork.</span>
              <br />
              Make Your LLM Finally 
              <span class="bg-gradient-to-r from-primary via-blue-500 to-secondary bg-clip-text text-transparent">
                Understand
              </span>
              <br />
              <span class="text-muted-foreground/70 text-5xl sm:text-5xl lg:text-6xl xl:text-7xl">
                Your Complex, Mature Codebase.
              </span>
            </h1>
          </div>
          
          <!-- Sub-headline/Intro -->
          <div class="space-y-6 max-w-2xl">
            <p class="text-xl sm:text-2xl lg:text-2xl text-muted-foreground leading-relaxed font-medium">
              Tired of generic AI advice for your intricate software? contextMax empowers your experts to give AI assistants the 
              <strong class="text-foreground font-semibold">precise, line-by-line context</strong> 
              they need to be truly helpful—securely in your browser, and completely free.
            </p>
          </div>

          <!-- Primary CTA - Enhanced -->
          <div class="space-y-8 pt-4">
            <div class="flex flex-col sm:flex-row gap-6">
              <Button
                @click="onSelectProject"
                :disabled="!isFileSystemSupported"
                class="group relative text-xl px-12 py-6 bg-primary hover:bg-primary/90 text-primary-foreground shadow-2xl hover:shadow-3xl transform hover:scale-[1.02] transition-all duration-300 font-bold rounded-2xl animate-bounce"
                size="lg"
              >
                <div class="absolute inset-0 bg-gradient-to-r from-primary to-secondary opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-2xl"></div>
                <div class="relative flex items-center">
                  <Icon name="lucide:rocket" class="w-7 h-7 mr-4 group-hover:animate-pulse" />
                  Guide Your AI Now - It's Free
                </div>
              </Button>
            </div>
            
            <!-- Trust indicators -->
            <div id="trust-indicators" class="flex flex-wrap gap-6 text-base">
              <div class="group flex items-center gap-3 bg-green-50 dark:bg-green-900/20 px-4 py-3 rounded-full border border-green-200 dark:border-green-800 hover:bg-green-100 dark:hover:bg-green-900/30 hover:scale-105 transition-all duration-300 animate-fadeInUp" style="animation-delay: 0.1s;">
                <div class="w-3 h-3 bg-green-500 rounded-full animate-pulse group-hover:animate-bounce"/>
                <span class="font-semibold text-green-700 dark:text-green-300 group-hover:text-green-800 dark:group-hover:text-green-200">No account needed</span>
              </div>
              <div class="group flex items-center gap-3 bg-blue-50 dark:bg-blue-900/20 px-4 py-3 rounded-full border border-blue-200 dark:border-blue-800 hover:bg-blue-100 dark:hover:bg-blue-900/30 hover:scale-105 transition-all duration-300 animate-fadeInUp" style="animation-delay: 0.2s;">
                <div class="w-3 h-3 bg-blue-500 rounded-full animate-pulse group-hover:animate-bounce"/>
                <span class="font-semibold text-blue-700 dark:text-blue-300 group-hover:text-blue-800 dark:group-hover:text-blue-200">Runs in your browser</span>
              </div>
              <div class="group flex items-center gap-3 bg-orange-50 dark:bg-orange-900/20 px-4 py-3 rounded-full border border-orange-200 dark:border-orange-800 hover:bg-orange-100 dark:hover:bg-orange-900/30 hover:scale-105 transition-all duration-300 animate-fadeInUp" style="animation-delay: 0.3s;">
                <div class="w-3 h-3 bg-orange-500 rounded-full animate-pulse group-hover:animate-bounce"/>
                <span class="font-semibold text-orange-700 dark:text-orange-300 group-hover:text-orange-800 dark:group-hover:text-orange-200">Your code stays local</span>
              </div>
            </div>
            
            <div v-if="!isFileSystemSupported" class="p-6 bg-destructive/10 text-destructive rounded-2xl border border-destructive/20 backdrop-blur-sm">
              <div class="flex items-start gap-4">
                <Icon name="lucide:alert-triangle" class="w-6 h-6 flex-shrink-0 mt-0.5" />
                <div>
                  <p class="font-semibold mb-2">Browser Not Supported</p>
                  <p class="opacity-90">
                    File System Access API is not supported. Please use Chrome, Edge, or another Chromium-based browser.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Right Column - Interactive Demo Frame -->
        <div class="lg:col-span-6 flex justify-center lg:justify-end">
          <div class="relative w-full max-w-4xl xl:max-w-5xl">
            <!-- Browser Frame -->
            <div class="bg-gradient-to-br from-card/90 to-muted/30 rounded-3xl border-2 border-muted-foreground/10 shadow-2xl overflow-hidden backdrop-blur-md transform hover:scale-[1.01] transition-all duration-500">
              <!-- Browser Header -->
              <div class="flex items-center gap-3 px-8 py-6 bg-muted/40 border-b border-muted-foreground/10">
                <div class="flex gap-2">
                  <div class="w-5 h-5 bg-red-400 rounded-full shadow-sm"></div>
                  <div class="w-5 h-5 bg-yellow-400 rounded-full shadow-sm"></div>
                  <div class="w-5 h-5 bg-green-400 rounded-full shadow-sm"></div>
                </div>
                <div class="flex-1 flex justify-center">
                  <div class="bg-background/60 rounded-xl px-8 py-3 text-base text-muted-foreground border border-muted-foreground/20 font-mono">
                    contextmax.ai
                  </div>
                </div>
              </div>
              
              <!-- Demo Video Content Area -->
              <div class="relative bg-black rounded-b-3xl overflow-hidden">
                <video
                  class="w-full h-auto min-h-[400px] lg:min-h-[500px] xl:min-h-[600px]"
                  autoplay
                  muted
                  loop
                  playsinline
                  poster="/contextSet-demo-cursor-claude-poster.png"
                >
                  <source src="/contextSet-demo-cursor-claude.mov" type="video/mp4">
                  <source src="/contextSet-demo-cursor-claude.mov" type="video/quicktime">
                  <!-- Fallback content -->
                  <div class="aspect-[5/4] bg-gradient-to-br from-background/40 to-muted/20 flex items-center justify-center p-16">
                    <div class="text-center space-y-6">
                      <Icon name="lucide:play-circle" class="w-24 h-24 mx-auto text-primary/80" />
                      <div class="space-y-3">
                        <p class="text-primary font-bold text-xl">Demo Video</p>
                        <p class="text-sm text-muted-foreground max-w-sm mx-auto">
                          Your browser doesn't support video playback
                        </p>
                      </div>
                    </div>
                  </div>
                </video>
              </div>
            </div>
            
            <!-- Floating badges -->
            <div class="absolute -bottom-4 -left-4 bg-gradient-to-r from-secondary to-accent text-white px-5 py-3 rounded-full text-base font-bold shadow-lg">
              See the 'Aha!' Moment: Watch contextMax Give Claude Crystal-Clear Code Understanding.
            </div>
            
            <!-- Optional: Click to pause overlay -->
            <div class="absolute inset-0 bg-transparent cursor-pointer group" @click="toggleVideoPlayback" title="Click to play/pause">
              <div class="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors duration-300 rounded-3xl" />
            </div>
          </div>
        </div>
      </div>
    </div>
  </header>
</template>

<script setup lang="ts">
// Remove the incorrect import - Nuxt auto-imports composables
// import { useAnalyticsHelpers } from '@/composables/useAnalyticsHelpers'

interface Props {
  isFileSystemSupported: boolean
}

interface Emits {
  (e: 'select-project' | 'scroll-to-features'): void
}

defineProps<Props>()
const emit = defineEmits<Emits>()

// Analytics helpers - use the composable directly (auto-imported by Nuxt)
const { trackCTAClick, trackLandingPageSection, trackEvent } = useAnalyticsHelpers()

function onSelectProject() {
  // Track the main CTA click
  trackCTAClick('hero_primary_cta')
  emit('select-project')
}

function toggleVideoPlayback() {
  if (import.meta.client) {
    const video = document.querySelector('#hero video') as HTMLVideoElement
    if (video) {
      if (video.paused) {
        video.play()
        // Track video play
        trackEvent({
          name: 'demo_video_played',
          properties: {
            category: 'engagement',
            action: 'video_play',
            location: 'hero_section'
          }
        })
      } else {
        video.pause()
        // Track video pause
        trackEvent({
          name: 'demo_video_paused',
          properties: {
            category: 'engagement', 
            action: 'video_pause',
            location: 'hero_section'
          }
        })
      }
    }
  }
}

// Track when hero section comes into view
onMounted(() => {
  if (import.meta.client) {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            trackLandingPageSection('hero')
            observer.disconnect() // Only track once
          }
        })
      },
      { threshold: 0.5 }
    )

    const heroElement = document.querySelector('#hero')
    if (heroElement) {
      observer.observe(heroElement)
    }
  }
})
</script> 