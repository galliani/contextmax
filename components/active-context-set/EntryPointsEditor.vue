<!--
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 -->
<template>
  <!-- Entry Point Configuration Form (Accordion) -->
  <div v-if="isExpanded" class="mt-4 p-4 bg-muted/20 rounded-lg border border-primary/20">
    <h5 class="text-sm font-medium text-foreground mb-4 flex items-center">
      <Icon name="lucide:door-open" class="w-4 h-4 mr-2 text-primary" />
      Entry Point Configuration
    </h5>

    <div class="space-y-4">
      <!-- Hidden File Reference (auto-set) -->
      <input type="hidden" v-model="formData.fileRef" />

      <!-- Function Name -->
      <div>
        <label class="text-xs font-medium text-foreground block mb-2">
          Function Name
        </label>
        <Input
          v-model="formData.function"
          type="text"
          placeholder="e.g., handleRequest, processData, main"
          class="w-full"
        />
        <p class="text-xs text-muted-foreground mt-1">The specific function, method, or handler that processes this entry point</p>
      </div>

      <!-- Protocol and Method -->
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label class="text-xs font-medium text-foreground block mb-2">
            Protocol
          </label>
          <select
            v-model="formData.protocol"
            @change="updateMethodOptions"
            class="w-full px-3 py-2 text-sm border border-input rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
          >
            <option value="http">HTTP API</option>
            <option value="ui">User Interface</option>
            <option value="cli">Command Line</option>
            <option value="function">Function Call</option>
            <option value="queue">Message Queue</option>
            <option value="file">File Operation</option>
            <option value="hook">Hook/Webhook</option>
            <option value="websocket">WebSocket</option>
            <option value="sse">Server-Sent Events</option>
          </select>
          <p class="text-xs text-muted-foreground mt-1">How users or systems access this entry point</p>
        </div>

        <div>
          <label class="text-xs font-medium text-foreground block mb-2">
            Method
          </label>
          <select
            v-model="formData.method"
            class="w-full px-3 py-2 text-sm border border-input rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
          >
            <option
              v-for="method in availableMethods[formData.protocol]"
              :key="method"
              :value="method"
            >
              {{ method.toUpperCase() }}
            </option>
          </select>
          <p class="text-xs text-muted-foreground mt-1">The specific action or operation type</p>
        </div>
      </div>

      <!-- Dynamic Identifier Field -->
      <div v-if="needsIdentifier(formData.protocol)">
        <label class="text-xs font-medium text-foreground block mb-2">
          {{ getIdentifierLabel(formData.protocol) }}
          <span class="text-muted-foreground text-xs ml-1">(optional)</span>
        </label>
        <Input
          v-model="formData.identifier"
          type="text"
          :placeholder="getIdentifierPlaceholder(formData.protocol)"
          class="w-full"
        />
        <p class="text-xs text-muted-foreground mt-1">{{ getIdentifierDescription(formData.protocol) }}</p>
      </div>

      <!-- Action Buttons -->
      <div class="flex items-center justify-between pt-4 border-t border-border">
        <div class="flex items-center space-x-2">
          <Button
            @click="cancel"
            variant="ghost"
            size="sm"
          >
            Cancel
          </Button>
          <Button
            @click="save"
            variant="default"
            size="sm"
          >
            Save Entry Point
          </Button>
        </div>
        
        <!-- Remove Entry Point (if exists) -->
        <Button
          v-if="hasExistingEntryPoint"
          @click="remove"
          variant="ghost"
          size="sm"
          class="text-destructive hover:text-destructive hover:bg-destructive/10"
        >
          <Icon name="lucide:trash-2" class="w-4 h-4 mr-2" />
          Remove Entry Point
        </Button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { EntryPoint } from '~/composables/useProjectStore'

interface Props {
  isExpanded: boolean
  fileId: string
  existingEntryPoint?: EntryPoint
  hasExistingEntryPoint?: boolean
}

interface Emits {
  (e: 'cancel'): void
  (e: 'save', entryPoint: EntryPoint): void
  (e: 'remove', fileId: string): void
}

const props = withDefaults(defineProps<Props>(), {
  hasExistingEntryPoint: false
})

const emit = defineEmits<Emits>()

const { announceError } = useAccessibility()

// Form data
const formData = ref<EntryPoint>({
  fileRef: '',
  function: '',
  protocol: 'function',
  method: 'call',
  identifier: ''
})

// Available methods for each protocol
const availableMethods = {
  'http': ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  'ui': ['click', 'submit', 'change', 'select', 'drag', 'drop'],
  'cli': ['command', 'subcommand', 'flag'],
  'function': ['call', 'invoke', 'execute'],
  'queue': ['publish', 'consume', 'subscribe'],
  'file': ['read', 'write', 'create', 'delete'],
  'hook': ['trigger', 'receive', 'process'],
  'websocket': ['connect', 'message', 'close'],
  'sse': ['subscribe', 'stream', 'event']
}

// Dynamic identifier field logic
const needsIdentifier = (protocol: string): boolean => {
  return ['http', 'ui', 'cli', 'queue', 'file', 'hook', 'websocket', 'sse'].includes(protocol)
}

const getIdentifierLabel = (protocol: string): string => {
  const labels = {
    'http': 'API Endpoint',
    'ui': 'Component/Element Name',
    'cli': 'Command',
    'function': 'Function Call',
    'queue': 'Queue/Topic Name',
    'file': 'File Path',
    'hook': 'Webhook Endpoint',
    'websocket': 'WebSocket URL',
    'sse': 'Event Stream Path'
  }
  return labels[protocol as keyof typeof labels] || 'Identifier'
}

const getIdentifierPlaceholder = (protocol: string): string => {
  const placeholders = {
    'http': '/api/v1/job_ads/:id/clip',
    'ui': '"Clip Job" or #clip-button or .action-btn',
    'cli': 'myapp deploy --env=prod',
    'function': 'processPayment(amount, currency)',
    'queue': 'job.processing.queue',
    'file': 'config/settings.yml',
    'hook': '/webhooks/github/push',
    'websocket': 'ws://localhost:3000/socket',
    'sse': '/events/notifications'
  }
  return placeholders[protocol as keyof typeof placeholders] || ''
}

const getIdentifierDescription = (protocol: string): string => {
  const descriptions = {
    'http': 'The specific API endpoint path with parameters',
    'ui': 'Button text, link text, or CSS selector to help identify the UI element',
    'cli': 'The complete command with flags and arguments',
    'function': 'The function signature with parameter types',
    'queue': 'The queue or topic name for message routing',
    'file': 'The file path relative to project root',
    'hook': 'The webhook endpoint URL path',
    'websocket': 'The WebSocket connection URL',
    'sse': 'The server-sent events endpoint path'
  }
  return descriptions[protocol as keyof typeof descriptions] || ''
}

// Actions
const cancel = () => {
  emit('cancel')
}

const save = () => {
  // Validate required fields
  if (!formData.value.function) {
    announceError('Function name is required')
    return
  }
  
  emit('save', { ...formData.value })
}

const remove = () => {
  emit('remove', props.fileId)
}

const updateMethodOptions = () => {
  // Reset method when protocol changes
  formData.value.method = availableMethods[formData.value.protocol][0]
}

// Initialize form data when component mounts or props change
const initializeFormData = () => {
  if (props.existingEntryPoint) {
    formData.value = { ...props.existingEntryPoint }
  } else {
    formData.value = {
      fileRef: props.fileId,
      function: '',
      protocol: 'function',
      method: 'call',
      identifier: ''
    }
  }
}

// Watch for changes in props to reinitialize form data
watch([() => props.fileId, () => props.existingEntryPoint], () => {
  initializeFormData()
}, { immediate: true })
</script>
