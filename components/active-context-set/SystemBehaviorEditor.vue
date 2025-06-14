/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */
<template>
  <div class="space-y-6">
    <!-- Header -->
    <div class="flex items-center justify-between">
      <div>
        <h3 class="text-lg font-medium text-foreground">System Behavior Configuration</h3>
        <p class="text-sm text-muted-foreground">Configure how the system should process requests and handle data</p>
      </div>
    </div>

    <!-- Processing Mode Section -->
    <div class="space-y-4">
      <div>
        <h4 class="text-base font-medium text-foreground mb-4">Processing Configuration</h4>
        
        <div class="space-y-4">
          <!-- Processing Mode -->
          <div>
            <label class="text-sm font-medium text-foreground block mb-2">
              Processing Mode
            </label>
            <select
              v-model="processingMode"
              @change="updateSystemBehavior"
              class="w-full px-3 py-2 text-sm border border-input rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
            >
              <option value="">Not specified</option>
              <option value="synchronous">Synchronous - Returns result immediately</option>
              <option value="asynchronous">Asynchronous - Processes in background</option>
              <option value="streaming">Streaming - Returns data progressively</option>
              <option value="batch">Batch - Processes multiple items together</option>
            </select>
            <p class="text-xs text-muted-foreground mt-1">
              Defines how the system should handle processing requests
            </p>
          </div>

          <!-- Processing Mode Details -->
          <div v-if="processingMode" class="bg-muted/30 rounded-lg p-4">
            <div class="space-y-2">
              <h5 class="text-sm font-medium text-foreground">{{ processingModeDetails[processingMode].title }}</h5>
              <p class="text-xs text-muted-foreground">{{ processingModeDetails[processingMode].description }}</p>
              
              <!-- Use Cases -->
              <div class="mt-3">
                <p class="text-xs font-medium text-foreground mb-1">Typical use cases:</p>
                <ul class="text-xs text-muted-foreground space-y-1">
                  <li v-for="useCase in processingModeDetails[processingMode].useCases" :key="useCase" class="flex items-start">
                    <Icon name="lucide:check" class="w-3 h-3 mt-0.5 mr-2 text-primary flex-shrink-0" />
                    {{ useCase }}
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Future Expansion Areas (Placeholders) -->
    <div class="space-y-4 pt-6 border-t">
      <div class="text-center py-8 text-muted-foreground border border-dashed rounded-lg">
        <Icon name="lucide:settings" class="w-8 h-8 mx-auto mb-2 opacity-50" />
        <p class="text-sm">Additional system behavior configurations</p>
        <p class="text-xs">More options will be available in future updates</p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
interface Props {
  systemBehavior: {
    processing?: {
      mode?: 'synchronous' | 'asynchronous' | 'streaming' | 'batch'
    }
  }
}

const props = defineProps<Props>()

const emit = defineEmits<{
  'update:system-behavior': [systemBehavior: {
    processing?: {
      mode?: 'synchronous' | 'asynchronous' | 'streaming' | 'batch'
    }
  }]
}>()

// Computed for processing mode
const processingMode = computed({
  get: () => props.systemBehavior?.processing?.mode || '',
  set: (value: string) => {
    updateSystemBehavior(value)
  }
})

// Processing mode details and documentation
const processingModeDetails = {
  'synchronous': {
    title: 'Synchronous Processing',
    description: 'The system waits for each operation to complete before returning a response. Best for operations that need immediate results.',
    useCases: [
      'API endpoints that return computed data',
      'Form submissions with immediate validation',
      'Real-time queries and lookups',
      'Operations that must complete before user continues'
    ]
  },
  'asynchronous': {
    title: 'Asynchronous Processing',
    description: 'The system starts processing in the background and returns immediately. Results are delivered later via callbacks or polling.',
    useCases: [
      'File uploads and processing',
      'Email sending and notifications',
      'Data imports and exports',
      'Long-running computations'
    ]
  },
  'streaming': {
    title: 'Streaming Processing',
    description: 'The system returns data progressively as it becomes available, allowing for real-time updates.',
    useCases: [
      'Live chat and messaging',
      'Real-time analytics dashboards',
      'Progressive data loading',
      'Server-sent events and WebSocket connections'
    ]
  },
  'batch': {
    title: 'Batch Processing',
    description: 'The system collects multiple items and processes them together for efficiency.',
    useCases: [
      'Bulk data operations',
      'Scheduled report generation',
      'Mass email campaigns',
      'Database maintenance tasks'
    ]
  }
}

// Update system behavior
function updateSystemBehavior(mode?: string) {
  const newSystemBehavior = mode ? {
    processing: {
      mode: mode as 'synchronous' | 'asynchronous' | 'streaming' | 'batch'
    }
  } : {}
  
  emit('update:system-behavior', newSystemBehavior)
}
</script> 