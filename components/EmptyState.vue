<!--
 This Source Code Form is subject to the terms of the Mozilla Public
 License, v. 2.0. If a copy of the MPL was not distributed with this
 file, You can obtain one at https://mozilla.org/MPL/2.0/.
-->
<template>
  <div class="min-h-screen-dynamic relative">
    <!-- Mock Interface (similar to MainInterface) -->
    <div class="mx-auto px-4 sm:px-6 lg:px-8 mt-12 max-w-full lg:max-w-screen-3xl xl:max-w-screen-4xl space-y-6 lg:space-y-8 py-4 lg:py-6">
      
      <!-- Project Header Mock -->
      <section class="bg-gradient-surface rounded-t-lg p-4 lg:p-6 border border-b-0 shadow-sophisticated backdrop-blur-sm opacity-30">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-4">
            <div class="w-12 h-12 bg-gradient-to-br from-primary to-secondary rounded-xl flex items-center justify-center">
              <span class="text-white font-black text-xl">C</span>
            </div>
            <div>
              <div class="h-6 w-48 bg-muted-foreground/20 rounded animate-pulse"></div>
              <div class="h-4 w-32 bg-muted-foreground/10 rounded mt-2 animate-pulse"></div>
            </div>
          </div>
          <div class="h-10 w-32 bg-muted-foreground/20 rounded animate-pulse"></div>
        </div>
      </section>

      <!-- Three-Column Content Area Mock -->
      <div class="grid grid-cols-1 xl:grid-cols-4 gap-0 min-h-[600px] opacity-30">
        
        <!-- Left Column Mock: Context Sets -->
        <div class="xl:col-span-1 bg-gradient-surface rounded-bl-lg border border-t-0 border-r-0 shadow-sophisticated backdrop-blur-sm">
          <div class="p-4 lg:p-6 space-y-4">
            <div class="h-6 w-32 bg-muted-foreground/20 rounded animate-pulse"></div>
            <div class="space-y-3">
              <div class="h-8 w-full bg-muted-foreground/10 rounded animate-pulse"></div>
              <div class="h-8 w-full bg-muted-foreground/10 rounded animate-pulse"></div>
              <div class="h-8 w-full bg-muted-foreground/10 rounded animate-pulse"></div>
            </div>
          </div>
        </div>

        <!-- Middle Column Mock: Context Composer -->
        <div class="xl:col-span-2 bg-card border border-t-0 border-r-0 shadow-lg">
          <div class="p-4 lg:p-6 space-y-6">
            <div class="h-6 w-48 bg-muted-foreground/20 rounded animate-pulse"></div>
            <div class="space-y-4">
              <div class="h-32 w-full bg-muted-foreground/10 rounded animate-pulse"></div>
              <div class="h-24 w-full bg-muted-foreground/10 rounded animate-pulse"></div>
              <div class="h-16 w-full bg-muted-foreground/10 rounded animate-pulse"></div>
            </div>
          </div>
        </div>

        <!-- Right Column Mock: AI Tools -->
        <div class="xl:col-span-1 bg-gradient-surface rounded-br-lg border border-t-0 shadow-sophisticated backdrop-blur-sm">
          <div class="p-4 lg:p-6 space-y-4">
            <div class="h-6 w-24 bg-muted-foreground/20 rounded animate-pulse"></div>
            <div class="space-y-3">
              <div class="h-10 w-full bg-muted-foreground/10 rounded animate-pulse"></div>
              <div class="h-10 w-full bg-muted-foreground/10 rounded animate-pulse"></div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Onboarding Overlay -->
    <div class="absolute inset-0 bg-background/95 backdrop-blur-sm flex items-center justify-center p-6 z-50">
      <div class="max-w-lg w-full text-center space-y-8 bg-card p-8 rounded-3xl border shadow-2xl">
        <!-- Logo -->
        <div class="mx-auto w-20 h-20 bg-gradient-to-br from-primary to-secondary rounded-2xl flex items-center justify-center shadow-xl">
          <span class="text-white font-black text-2xl">C</span>
        </div>

        <!-- Headline -->
        <div class="space-y-4">
          <h1 class="text-3xl font-black text-foreground">Welcome to contextMax</h1>
          <p class="text-lg text-muted-foreground leading-relaxed">
            Ready to give your AI precise context? Start by selecting your project folder.
          </p>
        </div>

        <!-- Main CTA -->
        <div class="space-y-6">
          <Button
            @click="onSelectProject"
            :disabled="!isFileSystemSupported"
            class="group relative text-lg px-10 py-4 bg-primary hover:bg-primary/90 text-primary-foreground shadow-xl hover:shadow-2xl transform hover:scale-[1.02] transition-all duration-300 font-bold rounded-xl w-full"
            size="lg"
          >
            <div class="absolute inset-0 bg-gradient-to-r from-primary to-secondary opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-xl"></div>
            <div class="relative flex items-center justify-center gap-3">
              <Icon name="lucide:folder-open" class="w-6 h-6 group-hover:animate-pulse" />
              Select Your Project Folder
            </div>
          </Button>

          <!-- Browser Support Warning -->
          <div v-if="!isFileSystemSupported" class="p-4 bg-destructive/10 text-destructive rounded-xl border border-destructive/20">
            <div class="flex items-start gap-3">
              <Icon name="lucide:alert-triangle" class="w-5 h-5 flex-shrink-0 mt-0.5" />
              <div class="text-left text-sm">
                <p class="font-semibold mb-1">Browser Not Supported</p>
                <p class="opacity-90">
                  Please use Chrome, Edge, or another Chromium-based browser.
                </p>
              </div>
            </div>
          </div>
        </div>

        <!-- Quick Features -->
        <div class="grid grid-cols-3 gap-4 pt-6 border-t border-muted">
          <div class="text-center space-y-2">
            <div class="w-8 h-8 bg-green-100 dark:bg-green-900/20 rounded-lg flex items-center justify-center mx-auto">
              <Icon name="lucide:shield-check" class="w-4 h-4 text-green-600 dark:text-green-400" />
            </div>
            <p class="text-xs text-muted-foreground font-medium">Privacy First</p>
          </div>
          
          <div class="text-center space-y-2">
            <div class="w-8 h-8 bg-blue-100 dark:bg-blue-900/20 rounded-lg flex items-center justify-center mx-auto">
              <Icon name="lucide:zap" class="w-4 h-4 text-blue-600 dark:text-blue-400" />
            </div>
            <p class="text-xs text-muted-foreground font-medium">Instant Setup</p>
          </div>
          
          <div class="text-center space-y-2">
            <div class="w-8 h-8 bg-purple-100 dark:bg-purple-900/20 rounded-lg flex items-center justify-center mx-auto">
              <Icon name="lucide:users" class="w-4 h-4 text-purple-600 dark:text-purple-400" />
            </div>
            <p class="text-xs text-muted-foreground font-medium">Team Ready</p>
          </div>
        </div>

        <!-- Help Link -->
        <div class="pt-2">
          <p class="text-sm text-muted-foreground">
            New to contextMax? 
            <a href="https://contextmax.ai" target="_blank" rel="noopener noreferrer" class="text-primary hover:underline font-medium">
              Learn more
            </a>
          </p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
interface Props {
  isFileSystemSupported: boolean
}

interface Emits {
  (e: 'select-project'): void
}

defineProps<Props>()
const emit = defineEmits<Emits>()

function onSelectProject() {
  emit('select-project')
}
</script>