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
        <Icon name="lucide:workflow" class="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
        <div class="flex-1 space-y-2">
          <!-- Collapsible Toggle -->
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
          <div v-show="showExplanation" class="space-y-2">
            <p class="text-sm text-muted-foreground leading-relaxed">
              The workflow describes the step-by-step data flow through your feature. When you ask "add salary extraction to job clipping", 
              AI assistants can see exactly which step handles data processing and needs modification.
            </p>
            <p class="text-sm text-muted-foreground leading-relaxed">
              This helps AI assistants <strong>understand the big picture</strong> of how files work together, 
              <strong>make smarter changes</strong> by knowing which files to modify, <strong>avoid breaking changes</strong> 
              by understanding dependencies, and <strong>debug issues faster</strong> by following the data flow.
            </p>
            <div class="bg-background/50 rounded p-3 mt-3">
              <p class="text-xs text-muted-foreground">
                <strong>Example:</strong> User clicks button → API receives request → Background job starts → AI processes data → User gets notified
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Header with Add Step Button -->
    <div class="flex items-center justify-between">
      <p class="text-sm text-muted-foreground">
        {{ workflow.length }} workflow steps
      </p>
      <Button @click="addWorkflowStep" size="sm" variant="outline">
        <Icon name="lucide:plus" class="w-4 h-4 mr-2" />
        Add Step
      </Button>
    </div>

    <!-- Empty State -->
    <div v-if="workflow.length === 0" class="text-center py-8 text-muted-foreground border border-dashed rounded-lg">
      <Icon name="lucide:workflow" class="w-8 h-8 mx-auto mb-2" />
      <p class="text-sm">No workflow steps defined</p>
      <p class="text-xs">Add steps to guide LLMs through your development process</p>
    </div>

    <!-- Workflow Steps List -->
    <div v-else class="space-y-3">
      <div
        v-for="(step, index) in workflow"
        :key="index"
        class="border rounded-lg p-4 space-y-3"
      >
        <!-- Step Header -->
        <div class="flex items-center justify-between">
          <div class="flex items-center space-x-2">
            <div class="w-6 h-6 bg-primary/10 text-primary rounded-full flex items-center justify-center text-xs font-medium">
              {{ index + 1 }}
            </div>
            <span class="text-sm font-medium text-foreground">Step {{ index + 1 }}</span>
          </div>
          
          <div class="flex items-center space-x-1">
            <!-- Move up button -->
            <Button
              @click="moveStepUp(index)"
              variant="ghost"
              size="sm"
              :disabled="index === 0"
            >
              <Icon name="lucide:chevron-up" class="w-4 h-4" />
            </Button>
            
            <!-- Move down button -->
            <Button
              @click="moveStepDown(index)"
              variant="ghost"
              size="sm"
              :disabled="index === workflow.length - 1"
            >
              <Icon name="lucide:chevron-down" class="w-4 h-4" />
            </Button>
            
            <!-- Remove step button -->
            <Button
              @click="removeWorkflowStep(index)"
              variant="ghost"
              size="sm"
              class="text-destructive hover:text-destructive"
            >
              <Icon name="lucide:trash-2" class="w-4 h-4" />
            </Button>
          </div>
        </div>

        <!-- Step Description -->
        <div>
          <label class="text-xs font-medium text-foreground block mb-2">
            Description
          </label>
          <Textarea
            v-model="step.description"
            placeholder="Describe what happens in this step..."
            rows="2"
            class="w-full"
            @input="emitUpdate"
          />
        </div>

        <!-- File References -->
        <div>
          <label class="text-xs font-medium text-foreground block mb-2">
            Referenced Files
          </label>
          <div class="space-y-2">
            <!-- Current file refs -->
            <div v-if="step.fileRefs.length > 0" class="flex flex-wrap gap-2">
              <span
                v-for="(fileRef, fileIndex) in step.fileRefs"
                :key="fileRef"
                class="inline-flex items-center text-xs bg-muted px-2 py-1 rounded"
              >
                <span class="truncate">{{ getFilePath(fileRef) }}</span>
                <Button
                  @click="removeFileRef(index, fileIndex)"
                  variant="ghost"
                  size="sm"
                  class="ml-1 h-auto p-0 w-4 h-4 text-muted-foreground hover:text-destructive"
                >
                  <Icon name="lucide:x" class="w-3 h-3" />
                </Button>
              </span>
            </div>
            
            <!-- Add file refs -->
            <div class="flex items-center space-x-2">
              <select
                v-model="selectedFileForStep[index]"
                class="text-xs border rounded px-2 py-1 bg-background"
                @change="addFileRef(index)"
              >
                <option value="">Select file to reference...</option>
                <option
                  v-for="[fileId, entry] in availableFilesForStep(index)"
                  :key="fileId"
                  :value="fileId"
                >
                  {{ entry.path }}
                </option>
              </select>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { WorkflowStep } from '~/composables/useProjectStore'

interface Props {
  workflow: WorkflowStep[]
}

const props = defineProps<Props>()

const emit = defineEmits<{
  'update:workflow': [workflow: WorkflowStep[]]
}>()

const { filesManifest } = useProjectStore()

// Local state
const showExplanation = ref(false)
const selectedFileForStep = ref<Record<number, string>>({})

// Computed
const workflow = computed({
  get: () => props.workflow,
  set: (value) => emit('update:workflow', value)
})

// Helper functions
function getFilePath(fileId: string): string {
  return filesManifest.value[fileId]?.path || 'Unknown file'
}

function availableFilesForStep(stepIndex: number) {
  const usedFileRefs = new Set(workflow.value[stepIndex].fileRefs)
  return Object.entries(filesManifest.value).filter(([fileId]) => !usedFileRefs.has(fileId))
}

// Workflow management functions
function addWorkflowStep() {
  const newWorkflow = [...workflow.value]
  newWorkflow.push({
    description: '',
    fileRefs: []
  })
  console.log('new workflow after adding step:', newWorkflow)
  workflow.value = newWorkflow
}

function removeWorkflowStep(index: number) {
  const newWorkflow = [...workflow.value]
  newWorkflow.splice(index, 1)
  workflow.value = newWorkflow
}

function moveStepUp(index: number) {
  if (index === 0) return
  const newWorkflow = [...workflow.value]
  const temp = newWorkflow[index]
  newWorkflow[index] = newWorkflow[index - 1]
  newWorkflow[index - 1] = temp
  workflow.value = newWorkflow
}

function moveStepDown(index: number) {
  if (index === workflow.value.length - 1) return
  const newWorkflow = [...workflow.value]
  const temp = newWorkflow[index]
  newWorkflow[index] = newWorkflow[index + 1]
  newWorkflow[index + 1] = temp
  workflow.value = newWorkflow
}

function addFileRef(stepIndex: number) {
  const fileId = selectedFileForStep.value[stepIndex]
  if (!fileId) return
  
  const newWorkflow = [...workflow.value]
  if (!newWorkflow[stepIndex].fileRefs.includes(fileId)) {
    newWorkflow[stepIndex].fileRefs.push(fileId)
    workflow.value = newWorkflow
  }
  
  // Clear selection
  selectedFileForStep.value[stepIndex] = ''
}

function removeFileRef(stepIndex: number, fileIndex: number) {
  const newWorkflow = [...workflow.value]
  newWorkflow[stepIndex].fileRefs.splice(fileIndex, 1)
  workflow.value = newWorkflow
}

function emitUpdate() {
  // This will trigger reactivity when descriptions are updated
  emit('update:workflow', [...workflow.value])
}
</script> 