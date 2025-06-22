<!--
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
-->
<template>
  <div class="bg-gradient-surface rounded-lg border shadow-sophisticated overflow-hidden backdrop-blur-sm h-full">
    <!-- Content -->
    <div class="content-spacing bg-surface-1 h-full flex flex-col">
      <!-- No Project State -->
      <div v-if="!selectedFolder" class="flex-1 flex items-center justify-center py-8">
        <div class="text-center max-w-sm mx-auto">
          <!-- Different states based on whether we have metadata without handles -->
          <div v-if="fileTree.length > 0 && !hasActiveHandles">
            <Icon name="lucide:folder-open" class="w-12 h-12 mx-auto mb-4 text-amber-500 opacity-75" aria-hidden="true" />
            <p class="visual-hierarchy-body mb-2 text-mobile-body sm:text-base">Project Cached</p>
            <p class="visual-hierarchy-caption opacity-75 text-mobile-caption sm:text-sm mb-3">
              Your project structure is saved, but file browsing is unavailable
            </p>
            <p class="visual-hierarchy-caption opacity-60 text-mobile-caption sm:text-sm">
              Select the project folder again to enable file browsing
            </p>
          </div>
          <div v-else>
            <Icon name="lucide:folder-x" class="w-12 h-12 mx-auto mb-4 text-muted-foreground opacity-50" aria-hidden="true" />
            <p class="visual-hierarchy-body mb-2 text-mobile-body sm:text-base">No Project Loaded</p>
            <p class="visual-hierarchy-caption opacity-75 text-mobile-caption sm:text-sm">
              Select a project folder to browse files
            </p>
          </div>
        </div>
      </div>

      <!-- File Browser -->
      <div v-else class="flex-1 flex flex-col min-h-0">
        <!-- File Tree -->
        <div class="flex-1 min-h-0 overflow-y-auto" role="tree" aria-label="Project file tree">
          <ProjectFileTree
            v-if="fileTree.length > 0"
            :files="fileTree as FileTreeItem[]"
            :search-term="searchTerm"
            @file-selected="handleFileSelected"
          />
          
          <!-- Loading State -->
          <div v-else-if="isLoadingFiles" class="text-center py-8 sm:py-12" role="status" aria-live="polite">
            <Icon name="lucide:loader-2" class="w-8 h-8 animate-spin mx-auto mb-4 text-muted-foreground" aria-hidden="true" />
            <p class="visual-hierarchy-caption text-mobile-caption sm:text-sm">Loading project files...</p>
          </div>

          <!-- Empty State -->
          <div v-else class="text-center py-8 sm:py-12 text-muted-foreground" role="status">
            <Icon name="lucide:folder-x" class="w-12 h-12 mx-auto mb-4 opacity-50" aria-hidden="true" />
            <p class="visual-hierarchy-body mb-2 text-mobile-body sm:text-base">No files found</p>
            <p class="visual-hierarchy-caption opacity-75 text-mobile-caption sm:text-sm">
              Check if the project folder contains files
            </p>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { FileTreeItem } from '~/composables/useProjectStore'
import ProjectFileTree from './project-file-browser/Tree.vue'


const {
  selectedFolder,
  fileTree,
  isLoadingFiles,
  hasActiveHandles,
  activeContextSetName,
  addFileToActiveContextSet
} = useProjectStore()

const { announceStatus, announceError } = useAccessibility()

// Search functionality
const searchTerm = ref('')

// Handle single file selection
const handleFileSelected = (file: FileTreeItem) => {
  if (!activeContextSetName.value) {
    announceError('No active context set selected')
    return
  }

  if (file.type !== 'file') {
    announceError('Only files can be added to context sets')
    return
  }

  try {
    const success = addFileToActiveContextSet(file)
    if (success) {
      announceStatus(`Added ${file.name} to ${activeContextSetName.value}`)
    } else {
      announceStatus(`${file.name} is already in ${activeContextSetName.value}`)
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to add file'
    announceError(message)
  }
}
</script> 