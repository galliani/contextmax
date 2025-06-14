/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */
<template>
  <div class="space-y-6">
    <!-- Explanation Section -->
    <div class="bg-muted/30 rounded-lg p-4 space-y-3">
      <div class="flex items-start space-x-3">
        <Icon name="lucide:lightbulb" class="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
        <div class="flex-1 space-y-2">
          <!-- Collapsible Toggle -->
          <button
            @click="showExplanation = !showExplanation"
            class="flex items-center justify-between w-full text-left hover:text-primary transition-colors"
          >
            <h4 class="text-sm font-medium text-foreground">Why specify entry points?</h4>
            <Icon 
              :name="showExplanation ? 'lucide:chevron-down' : 'lucide:chevron-right'" 
              class="w-4 h-4 text-muted-foreground transition-transform"
            />
          </button>
          
          <!-- Collapsible Content -->
          <div v-show="showExplanation" class="space-y-2">
            <p class="text-sm text-muted-foreground leading-relaxed">
              Entry points help AI assistants understand exactly how users and systems can access your functionality. 
              When you say "improve the user registration flow", the AI needs to know: Is this triggered by a web form? 
              A CLI command? An API call? A button click?
            </p>
            <p class="text-sm text-muted-foreground leading-relaxed">
              Having all entry points listed helps AI assistants <strong>test comprehensively</strong>, 
              <strong>maintain consistency</strong> across all access methods, <strong>understand scope</strong> 
              of changes, and <strong>debug effectively</strong> by knowing where problems might originate.
            </p>
          </div>
        </div>
      </div>
    </div>

    <!-- Header with Add Entry Point Button -->
    <div class="flex items-center justify-between">
      <p class="text-sm text-muted-foreground">
        {{ entryPoints.length }} entry points
      </p>
      <Button @click="addEntryPoint" size="sm" variant="outline">
        <Icon name="lucide:plus" class="w-4 h-4 mr-2" />
        Add Entry Point
      </Button>
    </div>

    <!-- Empty State -->
    <div v-if="entryPoints.length === 0" class="text-center py-8 text-muted-foreground border border-dashed rounded-lg">
      <Icon name="lucide:zap" class="w-8 h-8 mx-auto mb-2" />
      <p class="text-sm">No entry points defined</p>
      <p class="text-xs">Add entry points to specify how users and systems can access your functionality</p>
    </div>

    <!-- Entry Points List -->
    <div v-else class="space-y-4">
      <div
        v-for="(entryPoint, index) in entryPoints"
        :key="index"
        class="border rounded-lg p-4 space-y-4"
      >
        <!-- Entry Point Header -->
        <div class="flex items-center justify-between">
          <div class="flex items-center space-x-2">
            <div class="w-6 h-6 bg-primary/10 text-primary rounded-full flex items-center justify-center text-xs font-medium">
              {{ index + 1 }}
            </div>
            <span class="text-sm font-medium text-foreground">Entry Point {{ index + 1 }}</span>
          </div>
          
          <div class="flex items-center space-x-1">
            <!-- Move up button -->
            <Button
              @click="moveEntryPointUp(index)"
              variant="ghost"
              size="sm"
              :disabled="index === 0"
            >
              <Icon name="lucide:chevron-up" class="w-4 h-4" />
            </Button>
            
            <!-- Move down button -->
            <Button
              @click="moveEntryPointDown(index)"
              variant="ghost"
              size="sm"
              :disabled="index === entryPoints.length - 1"
            >
              <Icon name="lucide:chevron-down" class="w-4 h-4" />
            </Button>
            
            <!-- Remove entry point button -->
            <Button
              @click="removeEntryPoint(index)"
              variant="ghost"
              size="sm"
              class="text-destructive hover:text-destructive"
            >
              <Icon name="lucide:trash-2" class="w-4 h-4" />
            </Button>
          </div>
        </div>

        <!-- File Reference (Full Width) -->
        <div>
          <label class="text-xs font-medium text-foreground block mb-2">
            File Reference
          </label>
          <select
            v-model="entryPoint.fileRef"
            class="w-full px-3 py-2 text-sm border border-input rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
            @change="emitUpdate"
          >
            <option value="">Select file...</option>
            <option
              v-for="[fileId, entry] in Object.entries(filesManifest)"
              :key="fileId"
              :value="fileId"
            >
              {{ entry.path }}
            </option>
          </select>
          <p class="text-xs text-muted-foreground mt-1">Choose the file that contains the entry point logic</p>
        </div>

        <!-- Function Name -->
        <div>
          <label class="text-xs font-medium text-foreground block mb-2">
            Function Name
          </label>
          <Input
            v-model="entryPoint.function"
            type="text"
            placeholder="e.g., handleRequest, processData, main"
            class="w-full"
            @input="emitUpdate"
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
              v-model="entryPoint.protocol"
              @change="updateMethodOptions(entryPoint); emitUpdate()"
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
              v-model="entryPoint.method"
              class="w-full px-3 py-2 text-sm border border-input rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
              @change="emitUpdate"
            >
              <option
                v-for="method in availableMethods[entryPoint.protocol]"
                :key="method"
                :value="method"
              >
                {{ method.toUpperCase() }}
              </option>
            </select>
            <p class="text-xs text-muted-foreground mt-1">The specific action or operation type</p>
          </div>
        </div>

        <!-- Dynamic Identifier Field (only for relevant protocols) -->
        <div v-if="needsIdentifier(entryPoint.protocol)">
          <label class="text-xs font-medium text-foreground block mb-2">
            {{ getIdentifierLabel(entryPoint.protocol) }}
            <span class="text-muted-foreground text-xs ml-1">(optional)</span>
          </label>
          <Input
            v-model="entryPoint.identifier"
            type="text"
            :placeholder="getIdentifierPlaceholder(entryPoint.protocol)"
            class="w-full"
            @input="emitUpdate"
          />
          <p class="text-xs text-muted-foreground mt-1">{{ getIdentifierDescription(entryPoint.protocol) }}</p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { EntryPoint } from '~/composables/useProjectStore'

interface Props {
  entryPoints: EntryPoint[]
}

const props = defineProps<Props>()

const emit = defineEmits<{
  'update:entry-points': [entryPoints: EntryPoint[]]
}>()

const { filesManifest } = useProjectStore()

// Local state
const showExplanation = ref(false)

// Computed
const entryPoints = computed({
  get: () => props.entryPoints,
  set: (value) => emit('update:entry-points', value)
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
function needsIdentifier(protocol: string): boolean {
  // Only show identifier field for protocols where it's really needed
  return ['http', 'ui', 'cli', 'queue', 'file', 'hook', 'websocket', 'sse'].includes(protocol)
}

function getIdentifierLabel(protocol: string): string {
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

function getIdentifierPlaceholder(protocol: string): string {
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

function getIdentifierDescription(protocol: string): string {
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

// Entry point management functions
function addEntryPoint() {
  const newEntryPoints = [...entryPoints.value]
  newEntryPoints.push({
    fileRef: '',
    function: '',
    protocol: 'http',
    method: 'GET',
    identifier: ''
  })
  entryPoints.value = newEntryPoints
}

function removeEntryPoint(index: number) {
  const newEntryPoints = [...entryPoints.value]
  newEntryPoints.splice(index, 1)
  entryPoints.value = newEntryPoints
}

function moveEntryPointUp(index: number) {
  if (index === 0) return
  const newEntryPoints = [...entryPoints.value]
  const temp = newEntryPoints[index]
  newEntryPoints[index] = newEntryPoints[index - 1]
  newEntryPoints[index - 1] = temp
  entryPoints.value = newEntryPoints
}

function moveEntryPointDown(index: number) {
  if (index === entryPoints.value.length - 1) return
  const newEntryPoints = [...entryPoints.value]
  const temp = newEntryPoints[index]
  newEntryPoints[index] = newEntryPoints[index + 1]
  newEntryPoints[index + 1] = temp
  entryPoints.value = newEntryPoints
}

function updateMethodOptions(entryPoint: EntryPoint) {
  // Reset method when protocol changes
  entryPoint.method = availableMethods[entryPoint.protocol][0]
}

function emitUpdate() {
  // This will trigger reactivity when fields are updated
  emit('update:entry-points', [...entryPoints.value])
}
</script> 