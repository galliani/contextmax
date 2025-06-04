<template>
  <div
    v-if="isVisible"
    class="fixed inset-0 z-[9999] bg-background/95 backdrop-blur-lg flex items-center justify-center"
    role="dialog"
    aria-modal="true"
    :aria-label="ariaLabel"
  >
    <div class="text-center max-w-md mx-auto px-6">
      <!-- Main Loading Spinner -->
      <div class="relative mb-8">
        <div class="w-16 h-16 mx-auto border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
        <div class="absolute inset-0 flex items-center justify-center">
          <Icon :name="icon" class="w-6 h-6 text-primary opacity-75" aria-hidden="true" />
        </div>
      </div>

      <!-- Main Title -->
      <h2 class="text-2xl font-semibold mb-2 text-foreground animate-pulse">
        {{ title }}
      </h2>

      <!-- Description -->
      <p class="text-muted-foreground mb-6 leading-relaxed">
        {{ description }}
      </p>

      <!-- Progress Bar (if showProgress is true) -->
      <div v-if="showProgress" class="mb-6">
        <div class="w-full bg-muted/50 rounded-full h-2 overflow-hidden">
          <div 
            class="bg-primary h-full transition-all duration-300 ease-out"
            :style="{ width: `${progress}%` }"
          />
        </div>
        <p class="text-xs text-muted-foreground mt-2">
          {{ progress }}% complete
        </p>
      </div>

      <!-- Additional Info -->
      <div v-if="additionalInfo" class="space-y-2">
        <div class="flex items-center justify-center gap-2 text-sm text-muted-foreground">
          <Icon name="lucide:info" class="w-4 h-4" aria-hidden="true" />
          <span>{{ additionalInfo }}</span>
        </div>
      </div>

      <!-- Loading Dots Animation -->
      <div class="flex justify-center space-x-1 mt-4">
        <div 
          v-for="i in 3" 
          :key="i"
          class="w-2 h-2 bg-primary/60 rounded-full animate-bounce"
          :style="{ animationDelay: `${(i - 1) * 0.2}s` }"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
interface Props {
  isVisible: boolean
  title?: string
  description?: string
  icon?: string
  showProgress?: boolean
  progress?: number
  additionalInfo?: string
  ariaLabel?: string
}

const props = withDefaults(defineProps<Props>(), {
  title: 'Loading...',
  description: 'Please wait while we process your request.',
  icon: 'lucide:loader-2',
  showProgress: false,
  progress: 0,
  additionalInfo: '',
  ariaLabel: 'Loading in progress'
})

// Prevent body scroll when loader is visible
watch(() => props.isVisible, (visible) => {
  if (typeof document !== 'undefined') {
    if (visible) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
  }
})

// Cleanup on unmount
onUnmounted(() => {
  if (typeof document !== 'undefined') {
    document.body.style.overflow = ''
  }
})
</script>

<style scoped>
/* Enhanced backdrop blur with smooth transition */
.backdrop-blur-lg {
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
}

/* Smooth fade in animation */
.fixed {
  animation: fadeIn 0.3s ease-out;
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: scale(0.95);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}

/* Enhanced bounce animation */
@keyframes bounce {
  0%, 80%, 100% {
    transform: translateY(0);
  }
  40% {
    transform: translateY(-8px);
  }
}

/* Spinner animation with smooth rotation */
@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

.animate-spin {
  animation: spin 1s linear infinite;
}

.animate-bounce {
  animation: bounce 1.4s ease-in-out infinite;
}

.animate-pulse {
  animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
}

@keyframes pulse {
  0%, 100% {
    opacity: 1;
  }
  50% {
    opacity: 0.7;
  }
}
</style> 