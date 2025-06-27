<template>
  <div v-if="showHealthCheck" class="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm">
    <div class="fixed left-[50%] top-[50%] z-50 grid w-full max-w-lg translate-x-[-50%] translate-y-[-50%] gap-4 border bg-background p-6 shadow-lg sm:rounded-lg">
      <div class="flex flex-col space-y-1.5 text-center sm:text-left">
        <h2 class="text-lg font-semibold leading-none tracking-tight">
          Browser Compatibility Check
        </h2>
        <p class="text-sm text-muted-foreground">
          Checking if your browser supports all required features...
        </p>
      </div>

      <div v-if="loading" class="flex items-center justify-center py-8">
        <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>

      <div v-else class="space-y-4">
        <div v-for="result in results" :key="result.feature" class="flex items-center justify-between">
          <span class="text-sm">{{ result.feature }}</span>
          <span v-if="result.available" class="text-green-600">✓</span>
          <span v-else class="text-red-600">✗</span>
        </div>

        <div v-if="summary" class="pt-4 border-t">
          <div v-if="summary.errors.length > 0" class="space-y-2">
            <h3 class="text-sm font-medium text-red-600">Critical Issues:</h3>
            <ul class="list-disc list-inside space-y-1">
              <li v-for="error in summary.errors" :key="error" class="text-sm text-red-600">
                {{ error }}
              </li>
            </ul>
          </div>

          <div v-if="summary.warnings.length > 0" class="space-y-2 mt-4">
            <h3 class="text-sm font-medium text-yellow-600">Warnings:</h3>
            <ul class="list-disc list-inside space-y-1">
              <li v-for="warning in summary.warnings" :key="warning" class="text-sm text-yellow-600">
                {{ warning }}
              </li>
            </ul>
          </div>
        </div>
      </div>

      <div class="flex justify-end space-x-2 pt-4">
        <button
          v-if="summary?.criticalPassed"
          @click="proceed"
          class="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 py-2"
        >
          Continue Anyway
        </button>
        <button
          v-else
          @click="close"
          class="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-10 px-4 py-2"
        >
          Close
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { checkBrowserAPIs, getHealthCheckSummary, type HealthCheckResult } from '~/utils/healthCheck'

const showHealthCheck = ref(false)
const loading = ref(true)
const results = ref<HealthCheckResult[]>([])
const summary = ref<ReturnType<typeof getHealthCheckSummary> | null>(null)

const emit = defineEmits<{
  'proceed': []
  'close': []
}>()

onMounted(async () => {
  // Check if we've already done a health check this session
  const hasChecked = sessionStorage.getItem('contextmax-health-checked')
  if (hasChecked === 'true') {
    return
  }

  showHealthCheck.value = true
  results.value = await checkBrowserAPIs()
  summary.value = getHealthCheckSummary(results.value)
  loading.value = false

  // Auto-proceed if everything is fine
  if (summary.value.allPassed) {
    setTimeout(() => {
      proceed()
    }, 1000)
  }
})

function proceed() {
  sessionStorage.setItem('contextmax-health-checked', 'true')
  showHealthCheck.value = false
  emit('proceed')
}

function close() {
  showHealthCheck.value = false
  emit('close')
}
</script>