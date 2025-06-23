/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */
<template>
  <div class="space-y-4">
    <!-- Header -->
    <div class="flex items-center justify-between">
      <div>
        <h4 class="text-md font-semibold text-foreground">Files in This Context Set</h4>
        <p class="text-sm text-muted-foreground">
          {{ fileList.length }} file{{ fileList.length !== 1 ? 's' : '' }} included
        </p>
      </div>
    </div>

    <!-- Empty State -->
    <div v-if="fileList.length === 0" class="text-center py-12 border-2 border-dashed border-muted rounded-lg">
      <Icon name="lucide:file-plus" class="w-12 h-12 mx-auto mb-4 text-muted-foreground opacity-50" aria-hidden="true" />
      <h4 class="text-lg font-medium text-foreground mb-2">No Files Added Yet</h4>
      <p class="text-muted-foreground mb-4 max-w-sm mx-auto">
        Add files from the file browser in the middle column to include them in this context set.
      </p>
      <div class="space-y-2 text-sm text-muted-foreground">
        <p>💡 <strong>Tip:</strong> Use Hardcore mode for manual browsing or Assisted mode for AI-curated suggestions</p>
        <p>📝 You can specify functions for each file after adding them</p>
      </div>
    </div>

    <!-- Files List -->
    <div v-else class="space-y-3">
      <div
        v-for="fileEntry in fileList"
        :key="getFileId(fileEntry)"
        class="group relative bg-card rounded-lg border p-4 transition-all duration-200 hover:shadow-elegant"
      >
        <!-- File Info -->
        <div class="flex items-start justify-between">
          <div class="flex-1 min-w-0">
            <!-- File Path -->
            <div class="flex items-center space-x-2 mb-2">
              <Icon 
                :name="getFileIcon(fileEntry)" 
                class="w-4 h-4 flex-shrink-0"
                :class="getFileIconColor(fileEntry)"
                aria-hidden="true"
              />
              <h4 
                class="text-sm font-medium text-foreground truncate cursor-pointer hover:text-primary transition-colors duration-200"
                @click="viewFile(fileEntry)"
                :title="`Click to view ${getFileName(fileEntry)}`"
              >
                {{ getFileName(fileEntry) }}
              </h4>
              <!-- Workflow Indicator -->
              <Icon 
                v-if="isFileInWorkflow(fileEntry)"
                name="lucide:workflow"
                class="w-4 h-4 text-primary flex-shrink-0"
                aria-hidden="true"
                title="Part of Workflow"
              />
              <span 
                v-if="getFileExtension(fileEntry)"
                class="px-2 py-0.5 text-xs font-mono rounded-full border"
                :class="getExtensionBadgeClasses(getFileExtension(fileEntry))"
              >
                {{ getFileExtension(fileEntry) }}
              </span>
            </div>

            <!-- File Path -->
            <p class="text-xs text-muted-foreground font-mono mb-3 truncate">
              {{ getFilePath(fileEntry) }}
            </p>
            
            <!-- AI Search Score and Classification (if available) -->
            <div v-if="getFileSearchInfo(fileEntry)" class="mb-3 p-2 bg-primary/5 rounded border border-primary/20">
              <div class="flex items-center justify-between mb-2">
                <div class="flex items-center space-x-3">
                  <div class="flex items-center space-x-2">
                    <span class="font-mono text-sm font-semibold text-primary">{{ getFileSearchInfo(fileEntry)?.scorePercentage }}%</span>
                    <div class="text-xs text-muted-foreground">
                      AI Score
                    </div>
                  </div>
                  <div v-if="getFileClassification(fileEntry)" class="flex items-center space-x-1">
                    <span class="text-xs px-2 py-1 rounded-full font-medium"
                          :class="{
                            'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300': getFileClassification(fileEntry) === 'entry-point',
                            'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300': getFileClassification(fileEntry) === 'core-logic',
                            'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300': getFileClassification(fileEntry) === 'helper',
                            'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300': getFileClassification(fileEntry) === 'config',
                            'bg-gray-100 text-gray-700 dark:bg-gray-900 dark:text-gray-300': getFileClassification(fileEntry) === 'unrelated' || getFileClassification(fileEntry) === 'unknown'
                          }">
                      {{ getFileClassification(fileEntry) }}
                    </span>
                  </div>
                </div>
                <div v-if="getFileSearchInfo(fileEntry)?.workflowPosition && getFileSearchInfo(fileEntry)?.workflowPosition !== 'unknown' && getFileSearchInfo(fileEntry)?.workflowPosition !== 'unrelated'" 
                     class="text-xs text-muted-foreground">
                  {{ getFileSearchInfo(fileEntry)?.workflowPosition }}
                </div>
              </div>
              
              <!-- Detailed Score Breakdown -->
              <div class="grid grid-cols-4 gap-2 text-xs">
                <div class="text-center">
                  <div class="font-medium text-muted-foreground">Structure</div>
                  <div class="font-mono text-sm">{{ Math.round((getFileSearchInfo(fileEntry)?.astScore || 0) * 100) }}%</div>
                </div>
                <div class="text-center">
                  <div class="font-medium text-muted-foreground">Semantic</div>
                  <div class="font-mono text-sm">{{ Math.round((getFileSearchInfo(fileEntry)?.llmScore || 0) * 100) }}%</div>
                </div>
                <div class="text-center">
                  <div class="font-medium text-muted-foreground">Syntax</div>
                  <div class="font-mono text-sm">{{ Math.round((getFileSearchInfo(fileEntry)?.syntaxScore || 0) * 100) }}%</div>
                </div>
                <div class="text-center">
                  <div class="font-medium text-muted-foreground">AI Class</div>
                  <div class="font-mono text-sm">{{ Math.round((getFileSearchInfo(fileEntry)?.flanScore || 0) * 100) }}%</div>
                </div>
              </div>
              
              <!-- Synergy Indicator -->
              <div v-if="getFileSearchInfo(fileEntry)?.hasSynergy" class="mt-2 flex items-center text-xs text-emerald-600 dark:text-emerald-400">
                <Icon name="lucide:zap" class="w-3 h-3 mr-1" />
                Multi-model synergy detected
              </div>
            </div>

            <!-- File Comment -->
            <div v-if="getFileComment(fileEntry)" class="mb-3">
              <p class="text-xs font-medium text-foreground mb-1">Comment for this context:</p>
              <p class="text-xs text-muted-foreground italic bg-muted/50 p-2 rounded">
                {{ getFileComment(fileEntry) }}
              </p>
            </div>

            <!-- Inclusion Type -->
            <div class="mb-3">
              <p class="text-xs font-medium text-muted-foreground mb-1">
                <Icon 
                  :name="hasFunctionRefs(fileEntry) ? 'lucide:function-square' : 'lucide:file'" 
                  class="w-3 h-3 mr-1" 
                  aria-hidden="true" 
                />
                {{ hasFunctionRefs(fileEntry) ? 'Specific functions' : 'Whole file' }}                
              </p>
              <div v-if="hasFunctionRefs(fileEntry)" class="flex flex-wrap gap-1">
                <!-- Function Refs Display -->
                <span
                  v-for="(func, funcIndex) in getFunctionRefs(fileEntry)"
                  :key="funcIndex"
                  class="px-2 py-1 text-xs bg-primary/10 text-primary rounded border border-primary/20"
                >
                  {{ func.name }}
                  <span v-if="func.comment" class="text-primary/70">
                    • {{ func.comment }}
                  </span>
                </span>
              </div>
            </div> 
          </div>

          <!-- Actions -->
          <div class="flex items-center space-x-1 ml-4">
            <!-- Specify Functions -->
            <Button
              @click="selectFunctions(fileEntry)"
              variant="ghost"
              class="text-muted-foreground hover:text-foreground transition-colors duration-200 p-2"
              :aria-label="`Specify functions for ${getFileName(fileEntry)}`"
              title="Select specific functions from this file"
            >
              <Icon name="lucide:function-square" size="21px" class="animate-pulse" aria-hidden="true" />
            </Button>

            <!-- Workflow Actions -->
            <Button
              @click="setAsWorkflowStart(fileEntry)"
              variant="ghost"
              class="text-muted-foreground hover:text-foreground transition-colors duration-200 p-2"
              :aria-label="`Set ${getFileName(fileEntry)} as workflow start point`"
              title="Set this file as the start point of a workflow"
              :class="{ 'text-green-600': isFileWorkflowStart(fileEntry) }"
            >
              <Icon name="lucide:play" size="18px" aria-hidden="true" />
            </Button>
            <Button
              @click="setAsWorkflowEnd(fileEntry)"
              variant="ghost"
              class="text-muted-foreground hover:text-foreground transition-colors duration-200 p-2"
              :aria-label="`Set ${getFileName(fileEntry)} as workflow end point`"
              title="Set this file as the end point of a workflow"
              :class="{ 'text-red-600': isFileWorkflowEnd(fileEntry) }"
            >
              <Icon name="lucide:square" size="18px" aria-hidden="true" />
            </Button>

            <!-- Remove from Context Set -->
            <Button
              @click="removeFile(fileEntry)"
              variant="ghost"
              class="text-destructive hover:text-destructive hover:bg-destructive/10 transition-all duration-200 p-2"
              :aria-label="`Remove ${getFileName(fileEntry)} from context set`"
              title="Remove file from this context set"
            >
              <Icon name="lucide:x" size="21px" aria-hidden="true" />
            </Button>
          </div>
        </div>

        <!-- Workflow Point Configuration Form -->
        <WorkflowPointEditor
          :is-expanded="isWorkflowFormExpanded(fileEntry)"
          :file-id="getFileId(fileEntry)"
          :workflow-point-type="expandedWorkflowPointType"
          :existing-workflow-point="getFileWorkflowPoint(fileEntry)"
          :has-existing-workflow-point="isFileInWorkflow(fileEntry)"
          @cancel="cancelWorkflowConfig"
          @save="handleWorkflowPointSave"
          @remove="handleWorkflowPointRemove"
        />
      </div>
    </div>

    <!-- Add Files Help -->
    <div v-if="fileList.length > 0" class="mt-6 p-4 bg-info/5 border border-info/20 rounded-lg">
      <div class="flex items-start space-x-3">
        <Icon name="lucide:info" class="w-5 h-5 text-info flex-shrink-0 mt-0.5" aria-hidden="true" />
        <div class="text-sm">
          <p class="text-info font-medium mb-1">Adding More Files</p>
          <p class="text-info/80">
            Use the file browser in the middle column to add more files to this context set. 
            Switch between Hardcore (manual) and Assisted (AI-powered) modes for different curation approaches.
          </p>
        </div>
      </div>
    </div>

    <!-- Function Selection Modal -->
    <FunctionSelectorModal
      v-model:open="isFunctionModalOpen"
      :file-id="selectedFileId"
      :existing-functions="selectedFileFunctions"
      :entry-point-mode="false"
      @functions-updated="handleFunctionsUpdated"
    />
  </div>
</template>

<script setup lang="ts">
import type { FileRef, FunctionRef, Workflow, WorkflowPoint } from '~/composables/useContextSets'
import FunctionSelectorModal from './FunctionSelectorModal.vue'
import WorkflowPointEditor from './WorkflowPointEditor.vue'

const {
  activeContextSet,
  filesManifest,
  removeFileFromActiveContextSet,
  loadFileContent,
  fileTree,
  saveWorkingCopyToOPFS,
  selectedFolder,
  updateActiveContextSet
} = useProjectStore()

const { announceStatus, announceError } = useAccessibility()

// Store for file search info from tri-model search
const fileSearchInfoStore = ref<Map<string, {
  scorePercentage: number
  finalScore: number
  astScore: number
  llmScore: number
  flanScore: number
  syntaxScore: number
  hasSynergy: boolean
  classification?: string
  workflowPosition?: string
}>>(new Map())

// Provide a global way to set search info when files are added from search
if (typeof window !== 'undefined') {
  (window as any).setFileSearchInfo = (filePath: string, searchInfo: Record<string, any>) => {
    fileSearchInfoStore.value.set(filePath, searchInfo)
  }
  
  (window as any).clearFileSearchInfo = () => {
    fileSearchInfoStore.value.clear()
  }
}

// Reactive state for function selection modal
const isFunctionModalOpen = ref(false)
const selectedFileId = ref('')
const selectedFileFunctions = ref<FunctionRef[]>([])

// Reactive state for workflow configuration
const expandedWorkflowFileId = ref('')
const expandedWorkflowPointType = ref<'start' | 'end'>('start')

// Computed file list with resolved paths
const fileList = computed(() => {
  if (!activeContextSet.value) return []
  return activeContextSet.value.files
})

// Helper functions
const getFileId = (fileEntry: string | FileRef): string => {
  return typeof fileEntry === 'string' ? fileEntry : fileEntry.fileRef
}

const getFilePath = (fileEntry: string | FileRef): string => {
  const fileId = getFileId(fileEntry)
  return filesManifest.value[fileId]?.path || 'Unknown file'
}

const getFileName = (fileEntry: string | FileRef): string => {
  const path = getFilePath(fileEntry)
  return path.split('/').pop() || path
}

const getFileExtension = (fileEntry: string | FileRef): string => {
  const fileName = getFileName(fileEntry)
  const ext = fileName.split('.').pop()?.toLowerCase()
  return ext || ''
}

const hasFunctionRefs = (fileEntry: string | FileRef): boolean => {
  return typeof fileEntry === 'object' && !!fileEntry.functionRefs?.length
}

const getFunctionRefs = (fileEntry: string | FileRef): FunctionRef[] => {
  if (typeof fileEntry === 'object' && fileEntry.functionRefs) {
    return fileEntry.functionRefs
  }
  return []
}

const getFileComment = (fileEntry: string | FileRef): string => {
  if (typeof fileEntry === 'object' && fileEntry.comment) {
    return fileEntry.comment
  }
  return ''
}

const getFileSearchInfo = (fileEntry: string | FileRef) => {
  const filePath = getFilePath(fileEntry)
  return fileSearchInfoStore.value.get(filePath) || null
}

const getFileClassification = (fileEntry: string | FileRef): string | undefined => {
  // First check if the FileRef has a persisted classification
  if (typeof fileEntry === 'object' && fileEntry.classification) {
    return fileEntry.classification
  }
  
  // Fallback to search info if available
  const searchInfo = getFileSearchInfo(fileEntry)
  return searchInfo?.classification
}

// Workflow helper functions
const isFileInWorkflow = (fileEntry: string | FileRef): boolean => {
  if (!activeContextSet.value?.workflows) return false
  const fileId = getFileId(fileEntry)
  return activeContextSet.value.workflows.some(workflow => 
    workflow.start.fileRef === fileId || workflow.end.fileRef === fileId
  )
}

const isFileWorkflowStart = (fileEntry: string | FileRef): boolean => {
  if (!activeContextSet.value?.workflows) return false
  const fileId = getFileId(fileEntry)
  return activeContextSet.value.workflows.some(workflow => 
    workflow.start.fileRef === fileId
  )
}

const isFileWorkflowEnd = (fileEntry: string | FileRef): boolean => {
  if (!activeContextSet.value?.workflows) return false
  const fileId = getFileId(fileEntry)
  return activeContextSet.value.workflows.some(workflow => 
    workflow.end.fileRef === fileId
  )
}

const getFileWorkflowPoint = (fileEntry: string | FileRef): WorkflowPoint | undefined => {
  if (!activeContextSet.value?.workflows) return undefined
  const fileId = getFileId(fileEntry)
  
  // Find if this file is a start or end point
  for (const workflow of activeContextSet.value.workflows) {
    if (workflow.start.fileRef === fileId) {
      return workflow.start
    }
    if (workflow.end.fileRef === fileId) {
      return workflow.end
    }
  }
  return undefined
}

const isWorkflowFormExpanded = (fileEntry: string | FileRef): boolean => {
  const fileId = getFileId(fileEntry)
  return expandedWorkflowFileId.value === fileId
}



const getFileIcon = (fileEntry: string | FileRef): string => {
  const extension = getFileExtension(fileEntry)
  
  const iconMap: Record<string, string> = {
    'vue': 'lucide:file-code',
    'js': 'lucide:file-code',
    'ts': 'lucide:file-code',
    'jsx': 'lucide:file-code',
    'tsx': 'lucide:file-code',
    'html': 'lucide:globe',
    'css': 'lucide:palette',
    'json': 'lucide:braces',
    'md': 'lucide:file-text',
    'py': 'lucide:file-code',
    'rb': 'lucide:file-code',
    'php': 'lucide:file-code',
    'go': 'lucide:file-code'
  }
  
  return iconMap[extension] || 'lucide:file'
}

const getFileIconColor = (fileEntry: string | FileRef): string => {
  const extension = getFileExtension(fileEntry)
  
  const colorMap: Record<string, string> = {
    'vue': 'text-green-500',
    'js': 'text-yellow-500',
    'ts': 'text-blue-500',
    'jsx': 'text-cyan-500',
    'tsx': 'text-cyan-600',
    'html': 'text-orange-500',
    'css': 'text-blue-400',
    'json': 'text-amber-500',
    'md': 'text-gray-600 dark:text-gray-300',
    'py': 'text-yellow-600',
    'rb': 'text-red-600',
    'php': 'text-indigo-600',
    'go': 'text-cyan-600'
  }
  
  return colorMap[extension] || 'text-muted-foreground'
}

const getExtensionBadgeClasses = (extension: string): string => {
  const colorMap: Record<string, string> = {
    'vue': 'bg-green-50 text-green-700 border-green-200 dark:bg-green-950 dark:text-green-300 dark:border-green-800',
    'js': 'bg-yellow-50 text-yellow-700 border-yellow-200 dark:bg-yellow-950 dark:text-yellow-300 dark:border-yellow-800',
    'ts': 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-800',
    'css': 'bg-blue-50 text-blue-600 border-blue-200 dark:bg-blue-950 dark:text-blue-400 dark:border-blue-800',
    'json': 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-800'
  }
  
  return colorMap[extension] || 'bg-muted/50 text-muted-foreground border-muted'
}

// Helper function to find a FileTreeItem by path in the file tree
interface FileTreeItem {
  path: string
  type: string
  children?: FileTreeItem[]
}

const findFileInTree = (tree: FileTreeItem[], targetPath: string): FileTreeItem | null => {
  for (const item of tree) {
    if (item.path === targetPath && item.type === 'file') {
      return item
    }
    if (item.children) {
      const found = findFileInTree(item.children, targetPath)
      if (found) return found
    }
  }
  return null
}

// Actions
const viewFile = async (fileEntry: string | FileRef) => {
  const filePath = getFilePath(fileEntry)
  const fileName = getFileName(fileEntry)
  
  // Find the actual FileTreeItem in the file tree to get the handle
  const fileItem = findFileInTree(fileTree.value, filePath)
  
  if (!fileItem) {
    announceError(`Could not find file in project tree: ${fileName}`)
    console.error('File not found in tree:', filePath)
    return
  }
  
  try {
    // Use the store's loadFileContent function which opens the modal
    await loadFileContent(fileItem)
    announceStatus(`Opened file viewer for: ${fileName}`)
  } catch (error) {
    announceError(`Failed to load file content: ${fileName}`)
    console.error('Error loading file content:', error)
  }
}

const selectFunctions = (fileEntry: string | FileRef) => {
  const fileId = getFileId(fileEntry)
  const fileName = getFileName(fileEntry)
  
  // Set up modal state
  selectedFileId.value = fileId
  selectedFileFunctions.value = getFunctionRefs(fileEntry)
  isFunctionModalOpen.value = true
  
  announceStatus(`Opening function selector for: ${fileName}`)
}

const handleFunctionsUpdated = async (newFunctions: FunctionRef[]) => {
  if (!activeContextSet.value || !selectedFileId.value) return
  
  const fileId = selectedFileId.value
  const fileName = filesManifest.value[fileId]?.path.split('/').pop() || 'Unknown file'
  
  // Find the file entry in the active context set
  const fileIndex = activeContextSet.value.files.findIndex(fileEntry => {
    const entryId = typeof fileEntry === 'string' ? fileEntry : fileEntry.fileRef
    return entryId === fileId
  })
  
  if (fileIndex === -1) {
    announceError(`File not found in context set: ${fileName}`)
    return
  }
  
  // Update the file entry with new function refs (direct mutation)
  if (newFunctions.length === 0) {
    // Convert back to simple string reference (whole file)
    activeContextSet.value.files[fileIndex] = fileId
  } else {
    // Create or update FileRef object with function refs
    const fileRef: FileRef = {
      fileRef: fileId,
      functionRefs: [...newFunctions],
      comment: typeof activeContextSet.value.files[fileIndex] === 'object' 
        ? activeContextSet.value.files[fileIndex].comment 
        : ''
    }
    activeContextSet.value.files[fileIndex] = fileRef
  }
  
  // Explicitly save to OPFS
  if (selectedFolder.value) {
    await saveWorkingCopyToOPFS(selectedFolder.value.name)
  }
  
  // Close modal and announce success
  isFunctionModalOpen.value = false
  selectedFileId.value = ''
  selectedFileFunctions.value = []
  
  if (newFunctions.length === 0) {
    announceStatus(`Removed function selections for ${fileName} - now including whole file`)
  } else {
    announceStatus(`Updated functions for ${fileName}: ${newFunctions.length} function${newFunctions.length !== 1 ? 's' : ''} selected`)
  }
}

const removeFile = (fileEntry: string | FileRef) => {
  const fileId = getFileId(fileEntry)
  const fileName = getFileName(fileEntry)
  
  try {
    const success = removeFileFromActiveContextSet(fileId)
    if (success) {
      announceStatus(`Removed ${fileName} from context set`)
    } else {
      announceError(`Failed to remove ${fileName} from context set`)
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to remove file'
    announceError(message)
  }
}

// Workflow actions
const setAsWorkflowStart = (fileEntry: string | FileRef) => {
  if (!activeContextSet.value) return
  
  const fileId = getFileId(fileEntry)
  const fileName = getFileName(fileEntry)
  
  // Set as start point configuration
  expandedWorkflowFileId.value = fileId
  expandedWorkflowPointType.value = 'start'
  
  announceStatus(`Setting up workflow start point for ${fileName}`)
}

const setAsWorkflowEnd = (fileEntry: string | FileRef) => {
  if (!activeContextSet.value) return
  
  const fileId = getFileId(fileEntry)
  const fileName = getFileName(fileEntry)
  
  // Set as end point configuration
  expandedWorkflowFileId.value = fileId
  expandedWorkflowPointType.value = 'end'
  
  announceStatus(`Setting up workflow end point for ${fileName}`)
}

const cancelWorkflowConfig = () => {
  expandedWorkflowFileId.value = ''
  expandedWorkflowPointType.value = 'start'
}


// Event handlers for WorkflowPointEditor
const handleWorkflowPointSave = async (workflowPoint: WorkflowPoint) => {
  if (!activeContextSet.value) return
  
  const fileName = filesManifest.value[workflowPoint.fileRef]?.path.split('/').pop() || 'Unknown file'
  
  try {
    const workflows = activeContextSet.value.workflows || []
    const fileId = workflowPoint.fileRef
    
    if (expandedWorkflowPointType.value === 'start') {
      // Handle start point
      const existingIndex = workflows.findIndex(w => w.start.fileRef === fileId)
      
      if (existingIndex >= 0) {
        // Update existing workflow's start point
        workflows[existingIndex].start = { ...workflowPoint }
      } else {
        // Create new workflow with this start point and placeholder end
        const newWorkflow: Workflow = {
          start: { ...workflowPoint },
          end: {
            fileRef: '', // Will be filled when end point is set
            function: '',
            protocol: 'function',
            method: 'call',
            identifier: ''
          }
        }
        workflows.push(newWorkflow)
      }
    } else {
      // Handle end point
      // Find an incomplete workflow (one without an end point) or create new one
      let targetWorkflow = workflows.find(w => !w.end.fileRef || w.end.fileRef === '')
      
      if (targetWorkflow) {
        // Complete existing incomplete workflow
        targetWorkflow.end = { ...workflowPoint }
      } else {
        // Create new workflow with this end point and placeholder start
        const newWorkflow: Workflow = {
          start: {
            fileRef: '', // Will be filled when start point is set
            function: '',
            protocol: 'function',
            method: 'call',
            identifier: ''
          },
          end: { ...workflowPoint }
        }
        workflows.push(newWorkflow)
      }
    }
    
    // Update the context set (this will auto-save to OPFS)
    updateActiveContextSet({ workflows })
    
    // Close form
    cancelWorkflowConfig()
    
    announceStatus(`Workflow ${expandedWorkflowPointType.value} point saved for ${fileName}`)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to save workflow point'
    announceError(message)
  }
}

const handleWorkflowPointRemove = async (fileId: string, pointType: 'start' | 'end') => {
  console.log('[FilesList] handleWorkflowPointRemove called with fileId:', fileId, 'pointType:', pointType)
  
  if (!activeContextSet.value) {
    console.error('[FilesList] No active context set')
    return
  }
  
  console.log('[FilesList] Current workflows before removal:', activeContextSet.value.workflows)
  
  const fileName = filesManifest.value[fileId]?.path.split('/').pop() || 'Unknown file'
  console.log('[FilesList] Removing workflow point for file:', fileName, 'type:', pointType)
  
  try {
    const originalWorkflows = activeContextSet.value.workflows || []
    let workflows = [...originalWorkflows]
    
    if (pointType === 'start') {
      // Remove only workflows where this file is the start point
      workflows = workflows.filter(w => w.start.fileRef !== fileId)
      console.log('[FilesList] Removed start point workflows for file:', fileId)
    } else if (pointType === 'end') {
      // Remove only workflows where this file is the end point
      workflows = workflows.filter(w => w.end.fileRef !== fileId)
      console.log('[FilesList] Removed end point workflows for file:', fileId)
    }
    
    console.log('[FilesList] Original workflows count:', originalWorkflows.length)
    console.log('[FilesList] Filtered workflows count:', workflows.length)
    console.log('[FilesList] Workflows after filtering:', workflows)
    
    // Update the context set (this will auto-save to OPFS)
    updateActiveContextSet({ workflows })
    
    console.log('[FilesList] Context set updated, new workflows:', activeContextSet.value.workflows)
    
    // Close form if it was expanded
    if (expandedWorkflowFileId.value === fileId) {
      console.log('[FilesList] Closing expanded form for file:', fileId)
      cancelWorkflowConfig()
    }
    
    announceStatus(`Removed workflow ${pointType} point for ${fileName}`)
    console.log('[FilesList] Workflow point removal completed successfully')
  } catch (error) {
    console.error('[FilesList] Error during workflow point removal:', error)
    const message = error instanceof Error ? error.message : 'Failed to remove workflow point'
    announceError(message)
  }
}
</script> 