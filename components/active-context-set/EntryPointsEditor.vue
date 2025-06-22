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
      <div :key="`function-selector-${specifiedFunctions.length}`">
        <label class="text-xs font-medium text-foreground block mb-2">
          Function Name
        </label>
        
        <!-- Show button if no functions are specified -->
        <div v-if="!hasSpecifiedFunctions">
          <Button
            @click="openFunctionSelector"
            variant="outline"
            class="w-full justify-start"
          >
            <Icon name="lucide:function-square" class="w-4 h-4 mr-2" />
            Specify function name
          </Button>
          <p class="text-xs text-muted-foreground mt-1">Click to select a function from this file</p>
        </div>
        
        <!-- Show select dropdown if functions are specified -->
        <div v-else>
          <select
            v-model="formData.function"
            class="w-full px-3 py-2 text-sm border border-input rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
          >
            <option value="" disabled>Select a function</option>
            <option
              v-for="func in specifiedFunctions"
              :key="func.name"
              :value="func.name"
            >
              {{ func.name }}{{ func.comment ? ` • ${func.comment}` : '' }}
            </option>
          </select>
          <p class="text-xs text-muted-foreground mt-1">The specific function, method, or handler that processes this entry point</p>
        </div>
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
  <!-- Function Selection Modal -->
  <FunctionSelectorModal
    v-model:open="isFunctionModalOpen"
    :file-id="fileId"
    :existing-functions="specifiedFunctions"
    :entry-point-mode="true"
    @functions-updated="handleFunctionsUpdated"
    @entry-point-selected="handleEntryPointSelected"
  />
</template>

<script setup lang="ts">
import type { EntryPoint, FunctionRef, FileRef } from '~/composables/useProjectStore'
import FunctionSelectorModal from './FunctionSelectorModal.vue'

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
const { activeContextSet, saveWorkingCopyToOPFS, selectedFolder } = useProjectStore()

// Modal state
const isFunctionModalOpen = ref(false)

// Form data
const formData = ref<EntryPoint>({
  fileRef: '',
  function: '',
  protocol: 'function',
  method: 'call',
  identifier: ''
})

// Computed to check if this file has specified functions
const specifiedFunctions = computed(() => {
  if (!activeContextSet.value) {
    console.log('[EntryPointsEditor] No active context set')
    return []
  }
  
  const fileEntry = activeContextSet.value.files.find(file => {
    const fileId = typeof file === 'string' ? file : file.fileRef
    return fileId === props.fileId
  })
  
  console.log('[EntryPointsEditor] File entry for', props.fileId, ':', fileEntry)
  
  if (typeof fileEntry === 'object' && fileEntry.functionRefs?.length) {
    console.log('[EntryPointsEditor] Found function refs:', fileEntry.functionRefs)
    return fileEntry.functionRefs
  }
  
  console.log('[EntryPointsEditor] No function refs found')
  return []
})

const hasSpecifiedFunctions = computed(() => specifiedFunctions.value.length > 0)

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
  console.log('[EntryPointsEditor] Remove button clicked for fileId:', props.fileId)
  console.log('[EntryPointsEditor] Emitting remove event with fileId:', props.fileId)
  emit('remove', props.fileId)
  console.log('[EntryPointsEditor] Remove event emitted successfully')
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

// Watch for function selection to auto-populate identifier with comment
watch(() => formData.value.function, (newFunction) => {
  if (newFunction && hasSpecifiedFunctions.value) {
    const selectedFunc = specifiedFunctions.value.find(f => f.name === newFunction)
    if (selectedFunc?.comment && !formData.value.identifier) {
      // Auto-populate identifier with function comment if it's empty
      formData.value.identifier = selectedFunc.comment
    }
  }
})

// Watch for changes in specified functions
watch(specifiedFunctions, (newFunctions, oldFunctions) => {
  console.log('[EntryPointsEditor] specifiedFunctions changed from', oldFunctions, 'to', newFunctions)
  console.log('[EntryPointsEditor] hasSpecifiedFunctions:', hasSpecifiedFunctions.value)
}, { deep: true })

// Functions
const openFunctionSelector = () => {
  isFunctionModalOpen.value = true
}

const handleFunctionsUpdated = async (functions: FunctionRef[]) => {
  console.log('[EntryPointsEditor] handleFunctionsUpdated called with:', functions)
  
  // We need to actually update the context set here!
  if (!activeContextSet.value || !props.fileId) {
    console.error('[EntryPointsEditor] No active context set or fileId')
    return
  }
  
  // Find the file entry in the active context set
  const fileIndex = activeContextSet.value.files.findIndex(fileEntry => {
    const entryId = typeof fileEntry === 'string' ? fileEntry : fileEntry.fileRef
    return entryId === props.fileId
  })
  
  console.log('[EntryPointsEditor] Found file at index:', fileIndex)
  
  if (fileIndex === -1) {
    console.error('[EntryPointsEditor] File not found in context set')
    return
  }
  
  // Update the file entry with new function refs
  if (functions.length === 0) {
    // Convert back to simple string reference (whole file)
    activeContextSet.value.files[fileIndex] = props.fileId
  } else {
    // Create or update FileRef object with function refs
    const existingFileRef = activeContextSet.value.files[fileIndex]
    const fileRef: FileRef = {
      fileRef: props.fileId,
      functionRefs: [...functions],
      comment: typeof existingFileRef === 'object' ? existingFileRef.comment : ''
    }
    activeContextSet.value.files[fileIndex] = fileRef
  }
  
  console.log('[EntryPointsEditor] Updated context set files:', activeContextSet.value.files)
  
  // Save to OPFS
  if (selectedFolder.value) {
    await saveWorkingCopyToOPFS(selectedFolder.value.name)
    console.log('[EntryPointsEditor] Saved to OPFS')
  }
  
  // Force a re-render by triggering reactivity
  await nextTick()
  
  // If we now have functions and a function name was passed, set it
  if (functions.length > 0 && !formData.value.function) {
    formData.value.function = functions[0].name
    console.log('[EntryPointsEditor] Set default function:', functions[0].name)
  }
}

const handleEntryPointSelected = (functionName: string) => {
  console.log('[EntryPointsEditor] handleEntryPointSelected called with:', functionName)
  // Wait a bit for the functions to be saved and the computed to update
  setTimeout(() => {
    console.log('[EntryPointsEditor] Setting entry point function:', functionName)
    console.log('[EntryPointsEditor] Current specified functions:', specifiedFunctions.value)
    // Directly set the selected function as the entry point function
    formData.value.function = functionName
    isFunctionModalOpen.value = false
  }, 300) // Increased timeout
}
</script>
