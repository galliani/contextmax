<template>
  <div class="fixed inset-0 bg-background/95 backdrop-blur-sm z-50 flex items-center justify-center">
    <div class="max-w-md w-full mx-4">
      <!-- Main Loading Card -->
      <div class="bg-card rounded-lg border shadow-lg p-8 text-center space-y-6">
        <!-- App Title/Logo -->
        <div class="space-y-2">
          <div class="w-16 h-16 mx-auto bg-primary/10 rounded-lg flex items-center justify-center">
            <Icon name="lucide:cpu" class="w-8 h-8 text-primary" />
          </div>
          <h1 class="text-xl font-semibold">PromptSong</h1>
        </div>

        <!-- Loading State -->
        <div class="space-y-4">
          <!-- Spinner -->
          <div class="relative">
            <div class="w-12 h-12 mx-auto">
              <div class="animate-spin rounded-full h-12 w-12 border-4 border-muted border-t-primary"></div>
            </div>
          </div>

          <!-- Status Message -->
          <div class="space-y-2">
            <p class="text-sm font-medium text-foreground">
              {{ displayState.message }}
            </p>
            
            <!-- Progress Bar -->
            <div v-if="displayState.progress > 0" class="w-full bg-muted rounded-full h-2">
              <div 
                class="bg-primary h-2 rounded-full transition-all duration-300 ease-out"
                :style="{ width: `${displayState.progress}%` }"
              ></div>
            </div>
            
            <!-- Progress Percentage -->
            <p v-if="displayState.progress > 0" class="text-xs text-muted-foreground">
              {{ displayState.progress }}%
            </p>
          </div>
        </div>

        <!-- Error State -->
        <div v-if="hasError" class="space-y-4">
          <div class="p-4 bg-destructive/10 border border-destructive/20 rounded-lg">
            <div class="flex items-start gap-3">
              <Icon name="lucide:alert-triangle" class="w-5 h-5 mt-0.5 flex-shrink-0 text-destructive" />
              <div class="min-w-0 flex-1 text-left">
                <p class="text-sm font-medium mb-1 text-destructive">Initialization Failed</p>
                <p class="text-xs text-destructive/80">
                  {{ displayState.error }}
                </p>
              </div>
            </div>
          </div>
          
          <!-- Retry Button -->
          <button
            @click="retryInitialization"
            class="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors text-sm font-medium"
          >
            <Icon name="lucide:refresh-cw" class="w-4 h-4" />
            Retry Initialization
          </button>
        </div>

        <!-- Information Text -->
        <div class="text-xs text-muted-foreground space-y-1">
          <p>Initializing local AI models for enhanced features</p>
          <p>Setting up cached models - this will be quick</p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
const { 
  loadingState, 
  hasError, 
  retryInitialization,
  getModelState,
  areAllModelsReady 
} = useLLMLoader()

// Use embeddings model as the primary state for the loading screen
// This screen now only shows when models are cached but need initialization
const primaryModelState = computed(() => getModelState('embeddings').value)

// Override loadingState with primary model state for display
const displayState = computed(() => {
  if (areAllModelsReady.value) {
    return {
      message: 'All models ready!',
      progress: 100,
      error: null
    }
  }
  
  return {
    message: primaryModelState.value.message,
    progress: primaryModelState.value.progress,
    error: primaryModelState.value.error
  }
})
</script>

<style scoped>
/* Ensure smooth animations */
.animate-spin {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

/* Progress bar animation */
.transition-all {
  transition-property: all;
  transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
}
</style> 