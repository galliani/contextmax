<!--
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
-->
<template>
  <!-- Delete Confirmation Modal -->
  <Dialog v-model:open="isOpen">
    <DialogContent class="sm:max-w-md">
      <DialogHeader>
        <DialogTitle>Delete Context Set</DialogTitle>
        <DialogDescription>
          Are you sure you want to delete "{{ contextSetName }}"? This action cannot be undone.
        </DialogDescription>
      </DialogHeader>
      
      <div class="flex justify-end space-x-3">
        <Button variant="outline" @click="cancelDelete">
          Cancel
        </Button>
        <Button variant="destructive" @click="handleDeleteContextSet" :disabled="isDeleting">
          <Icon v-if="isDeleting" name="lucide:loader-2" class="w-4 h-4 mr-2 animate-spin" />
          Delete
        </Button>
      </div>
    </DialogContent>
  </Dialog>
</template>

<script setup lang="ts">
import { logger } from '~/utils/logger'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'

interface Props {
  open: boolean
  contextSetName: string
}

interface Emits {
  (e: 'update:open', value: boolean): void
  (e: 'deleted', contextSetName: string): void
  (e: 'error', error: string): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

const { deleteContextSet } = useProjectStore()
const { announceStatus, announceError } = useAccessibility()

// Local state
const isDeleting = ref(false)

// Computed properties
const isOpen = computed({
  get: () => props.open,
  set: (value: boolean) => emit('update:open', value)
})

// Actions
const handleDeleteContextSet = async () => {
  if (!props.contextSetName || isDeleting.value) return
  
  isDeleting.value = true
  
  try {
    const success = await deleteContextSet(props.contextSetName)
    
    if (success) {
      announceStatus(`Deleted context set: ${props.contextSetName}`)
      emit('deleted', props.contextSetName)
      isOpen.value = false
    } else {
      const errorMessage = `Failed to delete context set: ${props.contextSetName}`
      announceError(errorMessage)
      emit('error', errorMessage)
    }
  } catch (error) {
    logger.error('Error deleting context set:', error)
    const errorMessage = `Failed to delete context set: ${props.contextSetName}`
    announceError(errorMessage)
    emit('error', errorMessage)
  } finally {
    isDeleting.value = false
  }
}

const cancelDelete = () => {
  if (isDeleting.value) return // Prevent canceling during deletion
  isOpen.value = false
}
</script> 