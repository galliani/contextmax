<template>
  <div class="bg-muted/30 rounded-lg border border-muted/50 p-4 space-y-3">
    <!-- Header -->
    <div class="flex items-center justify-between">
      <div class="flex items-center gap-2">
        <Icon name="lucide:cpu" class="w-4 h-4 text-primary" />
        <span class="text-sm font-medium">AI Models Status</span>
      </div>
      <div class="text-xs text-muted-foreground">
        {{ readyModels }}/{{ totalModels }} ready
      </div>
    </div>

    <!-- Model Status List -->
    <div class="space-y-2">
      <div v-for="modelKey in availableModels" :key="modelKey" class="flex items-center justify-between">
        <div class="flex items-center gap-3">
          <!-- Status Dot with Animation -->
          <div 
            :class="[
              'w-3 h-3 rounded-full transition-all duration-300',
              getStatusColor(modelKey),
              shouldPulsate(modelKey) ? 'animate-pulse' : ''
            ]"
          ></div>
          
          <!-- Model Name -->
          <span class="text-sm font-medium">{{ getModelDisplayName(modelKey) }}</span>
        </div>
        
        <!-- Status Text -->
        <div class="text-xs text-muted-foreground">
          {{ getStatusText(modelKey) }}
        </div>
      </div>
    </div>

    <!-- Helpful Message -->
    <div v-if="!areAllReady" class="text-xs text-muted-foreground">
      <p>{{ getHelpfulMessage() }}</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { LLMService } from '~/plugins/llm.client'

const { 
  getModelState,
  getAvailableModels,
  areAllModelsReady
} = useLLMLoader()

const availableModels = getAvailableModels()

const readyModels = computed(() => {
  return availableModels.filter(modelKey => {
    return LLMService.getStatus(modelKey) === 'ready'
  }).length
})

const totalModels = computed(() => availableModels.length)

const areAllReady = computed(() => areAllModelsReady.value)

const getModelDisplayName = (modelKey: string) => {
  const displayNames: Record<string, string> = {
    embeddings: 'Embeddings',
    textGeneration: 'Text Generation'
  }
  return displayNames[modelKey] || modelKey
}

const getStatusColor = (modelKey: string) => {
  const serviceStatus = LLMService.getStatus(modelKey)
  const modelState = getModelState(modelKey).value
  
  // Determine if we're downloading (progress callback active) vs initializing (cached model loading)
  const isDownloading = modelState.progress > 0 && modelState.progress < 100 && 
                       (modelState.message.includes('Downloading') || modelState.message.includes('Loading model'))
  
  switch (serviceStatus) {
    case 'ready':
      return 'bg-green-500'
    case 'error':
      return 'bg-red-500'
    case 'loading':
      return isDownloading ? 'bg-yellow-500' : 'bg-blue-500'
    default:
      return 'bg-gray-400'
  }
}

const shouldPulsate = (modelKey: string) => {
  const serviceStatus = LLMService.getStatus(modelKey)
  return serviceStatus === 'loading' // Pulsate during any loading state
}

const getStatusText = (modelKey: string) => {
  const serviceStatus = LLMService.getStatus(modelKey)
  const modelState = getModelState(modelKey).value
  
  switch (serviceStatus) {
    case 'ready':
      return 'Ready'
    case 'error':
      return 'Error'
    case 'loading':
      // Show progress if available
      if (modelState.progress > 0) {
        return `${modelState.progress}%`
      }
      // Determine if downloading vs initializing based on message
      if (modelState.message.includes('Downloading')) {
        return 'Downloading'
      }
      return 'Initializing'
    default:
      return 'Unknown'
  }
}

const getHelpfulMessage = () => {
  const downloadingCount = availableModels.filter(modelKey => {
    const serviceStatus = LLMService.getStatus(modelKey)
    const modelState = getModelState(modelKey).value
    return serviceStatus === 'loading' && modelState.message.includes('Downloading')
  }).length
  
  const initializingCount = availableModels.filter(modelKey => {
    const serviceStatus = LLMService.getStatus(modelKey)
    const modelState = getModelState(modelKey).value
    return serviceStatus === 'loading' && !modelState.message.includes('Downloading')
  }).length
  
  if (downloadingCount > 0) {
    return 'Models are downloading in the background. You can continue using the app while this completes.'
  } else if (initializingCount > 0) {
    return 'Cached models are being initialized. This will be quick.'
  } else {
    return 'AI models are being prepared for enhanced features.'
  }
}
</script>

<style scoped>
.animate-pulse {
  animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
}

@keyframes pulse {
  0%, 100% {
    opacity: 1;
  }
  50% {
    opacity: 0.5;
  }
}
</style>