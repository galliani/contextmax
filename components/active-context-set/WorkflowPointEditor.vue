<!--
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 -->
<template>
  <!-- Workflow Point Configuration Form (Accordion) -->
  <div v-if="isExpanded" class="mt-4 p-4 bg-muted/20 rounded-lg border border-primary/20">
    <h5 class="text-sm font-medium text-foreground mb-2 flex items-center">
      <Icon 
        :name="workflowPointType === 'start' ? 'lucide:play' : 'lucide:square'" 
        class="w-4 h-4 mr-2"
        :class="workflowPointType === 'start' ? 'text-green-600' : 'text-red-600'"
      />
      {{ workflowPointType === 'start' ? 'Start Point' : 'End Point' }} Configuration
    </h5>
    
    <!-- Workflow Point Description -->
    <div class="mb-4 p-3 bg-background/50 rounded border border-border/50">
      <p class="text-sm text-muted-foreground leading-relaxed mb-2">
        <template v-if="workflowPointType === 'start'">
          <strong>Start Point:</strong> Mark this file as the entry point for your entire context set's workflow. This is where the process begins across all files in this context set - like a button click, API call, or command that triggers the whole feature.
        </template>
        <template v-else>
          <strong>End Point:</strong> Mark this file as where your context set's workflow completes. This is the final step across all files that produces the result - like saving data, sending a response, or displaying the final output.
        </template>
      </p>
      
      <!-- Collapsible Guide -->
      <button
        @click="showExplanation = !showExplanation"
        class="flex items-center justify-between w-full text-left hover:text-primary transition-colors"
      >
        <h4 class="text-sm font-medium text-foreground">Why specify workflow steps?</h4>
        <Icon 
          :name="showExplanation ? 'lucide:chevron-down' : 'lucide:chevron-right'" 
          class="w-4 h-4 text-muted-foreground transition-transform"
        />
      </button>
      
      <!-- Collapsible Content -->
      <div v-show="showExplanation" class="space-y-2 mt-2">
        <p class="text-sm text-muted-foreground leading-relaxed">
          The workflow describes the step-by-step data flow through your entire context set (all files included). When you ask "add salary extraction to job clipping", 
          AI assistants can see exactly which step handles data processing and needs modification across all the files.
        </p>
        <p class="text-sm text-muted-foreground leading-relaxed">
          This helps AI assistants <strong>understand the big picture</strong> of how all files in your context set work together, 
          <strong>make smarter changes</strong> by knowing which files to modify, <strong>avoid breaking changes</strong> 
          by understanding dependencies between files, and <strong>debug issues faster</strong> by following the data flow across your entire codebase.
        </p>
        <div class="bg-background/50 rounded p-3 mt-3">
          <p class="text-xs text-muted-foreground">
            <strong>Example workflow across your context set:</strong> User clicks button (frontend file) → API receives request (backend file) → Background job starts (worker file) → AI processes data (service file) → User gets notified (notification file)
          </p>
        </div>
      </div>
    </div>

    <div class="space-y-4">
      <!-- Workflow Point Configuration -->
      <div 
        class="p-4 rounded-lg border"
        :class="workflowPointType === 'start' 
          ? 'border-green-300 bg-green-50 dark:bg-green-950/20 dark:border-green-800' 
          : 'border-red-300 bg-red-50 dark:bg-red-950/20 dark:border-red-800'"
      >
        <div class="space-y-4">
          <!-- Hidden File Reference (auto-set) -->
          <input type="hidden" v-model="workflowPointData.fileRef" />

          <!-- Function Name -->
          <div :key="`function-selector-${specifiedFunctions.length}`">
            <label class="text-xs font-medium text-foreground block mb-2">
              Function Name
              <span v-if="workflowPointType === 'end'" class="text-muted-foreground text-xs ml-1">(optional)</span>
            </label>
            
            <!-- Show button if no functions are specified -->
            <div v-if="!hasSpecifiedFunctions">
              <div v-if="workflowPointType === 'end'" class="space-y-2">
                <Input
                  v-model="workflowPointData.function"
                  type="text"
                  placeholder="Enter function name (optional)"
                  class="w-full"
                />
                <p class="text-xs text-muted-foreground">
                  Manually enter the function name or leave blank for file-level end point
                </p>
              </div>
              <div v-else>
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
            </div>
            
            <!-- Show select dropdown if functions are specified -->
            <div v-else>
              <select
                v-model="workflowPointData.function"
                class="w-full px-3 py-2 text-sm border border-input rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
              >
                <option value="" :disabled="workflowPointType === 'start'">
                  {{ workflowPointType === 'start' ? 'Select a function' : 'No specific function (optional)' }}
                </option>
                <option
                  v-for="func in specifiedFunctions"
                  :key="func.name"
                  :value="func.name"
                >
                  {{ func.name }}{{ func.comment ? ` • ${func.comment}` : '' }}
                </option>
              </select>
              <p class="text-xs text-muted-foreground mt-1">
                The function that {{ workflowPointType === 'start' ? 'starts' : 'ends' }} this workflow
              </p>
            </div>
          </div>

          <!-- Protocol and Method (only for start points) -->
          <div v-if="workflowPointType === 'start'" class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label class="text-xs font-medium text-foreground block mb-2">
                Protocol
              </label>
              <select
                v-model="workflowPointData.protocol"
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
                v-model="workflowPointData.method"
                class="w-full px-3 py-2 text-sm border border-input rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
              >
                <option
                  v-for="method in availableMethods[workflowPointData.protocol || 'function']"
                  :key="method"
                  :value="method"
                >
                  {{ method.toUpperCase() }}
                </option>
              </select>
              <p class="text-xs text-muted-foreground mt-1">The specific action or operation type</p>
            </div>
          </div>

          <!-- Dynamic Identifier Field (only for start points) -->
          <div v-if="workflowPointType === 'start' && needsIdentifier(workflowPointData.protocol)">
            <label class="text-xs font-medium text-foreground block mb-2">
              {{ getIdentifierLabel(workflowPointData.protocol) }}
              <span class="text-muted-foreground text-xs ml-1">(optional)</span>
            </label>
            <Input
              v-model="workflowPointData.identifier"
              type="text"
              :placeholder="getIdentifierPlaceholder(workflowPointData.protocol)"
              class="w-full"
            />
            <p class="text-xs text-muted-foreground mt-1">{{ getIdentifierDescription(workflowPointData.protocol) }}</p>
          </div>
        </div>
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
            Save {{ workflowPointType === 'start' ? 'Start' : 'End' }} Point
          </Button>
        </div>
        
        <!-- Remove Workflow Point (if exists) -->
        <Button
          v-if="hasExistingWorkflowPoint"
          @click="remove"
          variant="ghost"
          size="sm"
          class="text-destructive hover:text-destructive hover:bg-destructive/10"
        >
          <Icon name="lucide:trash-2" class="w-4 h-4 mr-2" />
          Remove {{ workflowPointType === 'start' ? 'Start' : 'End' }} Point
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
import { logger } from '~/utils/logger'
import type { WorkflowPoint, Workflow, FunctionRef, FileRef } from '~/composables/useContextSets'
import FunctionSelectorModal from './FunctionSelectorModal.vue'

interface Props {
  isExpanded: boolean
  fileId: string
  workflowPointType: 'start' | 'end'
  existingWorkflowPoint?: WorkflowPoint
  hasExistingWorkflowPoint?: boolean
}

interface Emits {
  (e: 'cancel'): void
  (e: 'save', workflowPoint: WorkflowPoint): void
  (e: 'remove', fileId: string): void
}

const props = withDefaults(defineProps<Props>(), {
  hasExistingWorkflowPoint: false,
  workflowPointType: 'start'
})

const emit = defineEmits<Emits>()

const { announceError } = useAccessibility()
const { activeContextSet, saveWorkingCopyToOPFS, selectedFolder } = useProjectStore()

// Modal state
const isFunctionModalOpen = ref(false)

// Guide state
const showExplanation = ref(false)

// Form data for the workflow point
const workflowPointData = ref<WorkflowPoint>({
  fileRef: '',
  function: '',
  protocol: 'function',
  method: 'call',
  identifier: ''
})

// Computed to check if this file has specified functions
const specifiedFunctions = computed(() => {
  if (!activeContextSet.value) {
    return []
  }
  
  const fileEntry = activeContextSet.value.files.find(file => {
    const fileId = typeof file === 'string' ? file : file.fileRef
    return fileId === props.fileId
  })
  
  if (typeof fileEntry === 'object' && fileEntry.functionRefs?.length) {
    return fileEntry.functionRefs
  }
  
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
  // Validate required fields - function name is only required for start points
  if (props.workflowPointType === 'start' && !workflowPointData.value.function) {
    announceError('Start point function name is required')
    return
  }
  
  // For end points, function name is optional
  if (props.workflowPointType === 'end' && !workflowPointData.value.function) {
    // Allow empty function name for end points - will be filled later or left as placeholder
  }
  
  emit('save', { ...workflowPointData.value })
}

const remove = () => {
  emit('remove', props.fileId)
}

const updateMethodOptions = () => {
  // Reset method when protocol changes
  workflowPointData.value.method = availableMethods[workflowPointData.value.protocol || 'function'][0]
}

// Initialize form data when component mounts or props change
const initializeFormData = () => {
  if (props.existingWorkflowPoint) {
    workflowPointData.value = { ...props.existingWorkflowPoint }
  } else {
    workflowPointData.value = {
      fileRef: props.fileId,
      function: '',
      protocol: props.workflowPointType === 'start' ? 'function' : undefined,
      method: props.workflowPointType === 'start' ? 'call' : undefined,
      identifier: props.workflowPointType === 'start' ? '' : undefined
    }
  }
}

// Watch for changes in props to reinitialize form data
watch([() => props.fileId, () => props.existingWorkflowPoint, () => props.workflowPointType], () => {
  initializeFormData()
}, { immediate: true })

// Watch for function selection to auto-populate identifier with comment
watch(() => workflowPointData.value.function, (newFunction) => {
  if (newFunction && hasSpecifiedFunctions.value && props.workflowPointType === 'start') {
    const selectedFunc = specifiedFunctions.value.find(f => f.name === newFunction)
    if (selectedFunc?.comment && !workflowPointData.value.identifier) {
      // Auto-populate identifier with function comment if it's empty
      workflowPointData.value.identifier = selectedFunc.comment
    }
  }
})


// Functions
const openFunctionSelector = () => {
  isFunctionModalOpen.value = true
}

const handleFunctionsUpdated = async (functions: FunctionRef[]) => {
  // We need to actually update the context set here!
  if (!activeContextSet.value || !props.fileId) {
    logger.error('[WorkflowPointEditor] No active context set or fileId')
    return
  }
  
  // Find the file entry in the active context set
  const fileIndex = activeContextSet.value.files.findIndex(fileEntry => {
    const entryId = typeof fileEntry === 'string' ? fileEntry : fileEntry.fileRef
    return entryId === props.fileId
  })
  
  if (fileIndex === -1) {
    logger.error('[WorkflowPointEditor] File not found in context set')
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
  
  // Save to OPFS
  if (selectedFolder.value) {
    await saveWorkingCopyToOPFS(selectedFolder.value.name)
  }
  
  // Force a re-render by triggering reactivity
  await nextTick()
  
  // If we now have functions and a function name was passed, set it
  if (functions.length > 0 && !workflowPointData.value.function) {
    workflowPointData.value.function = functions[0].name
  }
}

const handleEntryPointSelected = (functionName: string) => {
  // Wait a bit for the functions to be saved and the computed to update
  setTimeout(() => {
    // Directly set the selected function as the workflow point function
    workflowPointData.value.function = functionName
    isFunctionModalOpen.value = false
  }, 300) // Increased timeout
}
</script>