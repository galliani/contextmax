<!--
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
-->
<template>
  <!-- Create Context Set Modal -->
  <Dialog v-model:open="isOpen">
    <DialogContent class="sm:max-w-md">
      <DialogHeader>
        <DialogTitle>Create New Context Set</DialogTitle>
        <DialogDescription>
          Enter a name for your new context set. You can add a description later.
        </DialogDescription>
      </DialogHeader>
      
      <form @submit.prevent="handleCreateContextSet" class="space-y-4">
        <div class="space-y-2">
          <label for="context-set-name" class="text-sm font-medium text-foreground">
            Context Set Name *
          </label>
          <Input
            id="context-set-name"
            v-model="newContextSetName"
            placeholder="e.g., authenticationSystem, userManagement, billing_api"
            required
            :aria-invalid="!!(createError || nameValidationError)"
            :aria-describedby="(createError || nameValidationError) ? 'validation-error' : 'validation-help'"
            class="w-full"
            :class="{
              'border-destructive focus:ring-destructive': !!(createError || nameValidationError),
              'border-success focus:ring-success': newContextSetName && !nameValidationError && !createError
            }"
            ref="nameInput"
          />
          
          <!-- Validation Help Text -->
          <p id="validation-help" class="text-xs text-muted-foreground">
            Use camelCase, snake_case, or single words. Must start with a letter.
          </p>
          
          <!-- Real-time Validation Error -->
          <p v-if="nameValidationError" id="validation-error" class="text-sm text-destructive flex items-start gap-2" role="alert">
            <Icon name="lucide:alert-circle" class="w-4 h-4 flex-shrink-0 mt-0.5" />
            {{ nameValidationError }}
          </p>
          
          <!-- Form Submission Error -->
          <p v-else-if="createError" id="validation-error" class="text-sm text-destructive flex items-start gap-2" role="alert">
            <Icon name="lucide:alert-circle" class="w-4 h-4 flex-shrink-0 mt-0.5" />
            {{ createError }}
          </p>
        </div>

        <div class="flex justify-end space-x-3">
          <Button type="button" variant="outline" @click="cancelCreate">
            Cancel
          </Button>
          <Button 
            type="submit" 
            :disabled="!isFormValid"
            :class="{ 'opacity-50 cursor-not-allowed': !isFormValid }"
          >
            <Icon name="lucide:plus" class="w-4 h-4 mr-2" />
            Create Context Set
          </Button>
        </div>
      </form>
    </DialogContent>
  </Dialog>
</template>

<script setup lang="ts">
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

interface Props {
  open: boolean
}

interface Emits {
  (e: 'update:open', value: boolean): void
  (e: 'created', contextSetName: string): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

const {
  contextSetNames,
  createContextSet,
  setActiveContextSet
} = useProjectStore()

const { announceStatus, announceError } = useAccessibility()

// Local state
const newContextSetName = ref('')
const createError = ref('')
const nameInput = ref<HTMLInputElement>()

// Computed properties
const isOpen = computed({
  get: () => props.open,
  set: (value: boolean) => emit('update:open', value)
})

// Validation functions
const validateContextSetName = (name: string): string | null => {
  const trimmedName = name.trim()
  
  // Check if empty
  if (!trimmedName) {
    return 'Context set name is required'
  }
  
  // Check for spaces anywhere in the name
  if (/\s/.test(trimmedName)) {
    return 'Name cannot contain spaces. Use camelCase or snake_case instead'
  }
  
  // Check if starts with alphabetic character
  if (!/^[a-zA-Z]/.test(trimmedName)) {
    return 'Name must start with a letter (a-z or A-Z)'
  }
  
  // Check if name already exists
  if (contextSetNames.value.includes(trimmedName)) {
    return 'A context set with this name already exists'
  }
  
  return null
}

// Real-time validation
const nameValidationError = computed(() => {
  if (!newContextSetName.value) return null
  return validateContextSetName(newContextSetName.value)
})

const isFormValid = computed(() => {
  return newContextSetName.value.trim() && !nameValidationError.value
})

// Actions
const handleCreateContextSet = async () => {
  const name = newContextSetName.value.trim()
  
  // Final validation
  const validationError = validateContextSetName(name)
  if (validationError) {
    createError.value = validationError
    announceError(`Validation error: ${validationError}`)
    return
  }

  try {
    createError.value = ''
    createContextSet(name)
    
    // Automatically set the newly created context set as active
    setActiveContextSet(name)
    
    // Close modal and reset form
    isOpen.value = false
    resetForm()
    
    // Emit created event
    emit('created', name)
    
    announceStatus(`Created and activated new context set: ${name}`)
  } catch (error) {
    createError.value = error instanceof Error ? error.message : 'Failed to create context set'
    announceError(`Error creating context set: ${createError.value}`)
  }
}

const cancelCreate = () => {
  isOpen.value = false
  resetForm()
}

const resetForm = () => {
  newContextSetName.value = ''
  createError.value = ''
}

// Focus management
const safeFocus = (element: HTMLElement | undefined) => {
  try {
    element?.focus?.()
  } catch {
    // Silently ignore focus errors in test environment
  }
}

watch(isOpen, (open) => {
  if (open) {
    resetForm()
    nextTick(() => {
      safeFocus(nameInput.value)
    })
  }
})
</script> 