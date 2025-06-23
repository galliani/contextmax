/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */
<template>
  <Dialog v-model:open="isOpen">
    <DialogContent class="max-w-4xl max-h-[80vh] overflow-y-auto">
      <DialogHeader>
        <DialogTitle class="flex items-center gap-3 text-2xl">
          <div v-if="showSuccessIcon" class="flex items-center justify-center w-12 h-12 bg-success/10 rounded-full">
            <Icon name="lucide:check-circle" class="w-6 h-6 text-success" />
          </div>
          {{ title }}
        </DialogTitle>
        <DialogDescription class="text-lg">
          {{ description }}
        </DialogDescription>
      </DialogHeader>

      <div class="space-y-6 mt-6">
        <!-- Quick Setup -->
        <div class="bg-primary/5 border border-primary/20 rounded-lg p-4">
          <h3 class="font-semibold mb-2 flex items-center gap-2">
            <Icon name="lucide:zap" class="w-4 h-4" />
            Quick Setup
          </h3>
          <p class="text-sm text-muted-foreground mb-3">
            Add this rule to your IDE's configuration (e.g., .cursorrules, .copilot-rules, or similar) to enable named context switching:
          </p>
          <div class="bg-muted rounded-md p-3 text-sm font-mono relative">
            <Button
              @click="copyToClipboard(ideRuleContent)"
              variant="ghost"
              size="sm"
              class="absolute top-2 right-2 h-6 w-6 p-0"
              title="Copy to clipboard"
            >
              <Icon :name="copySuccess ? 'lucide:check' : 'lucide:copy'" class="w-3 h-3" />
            </Button>
            <pre class="whitespace-pre-wrap pr-8">{{ ideRuleContent }}</pre>
          </div>
        </div>

        <!-- Usage Example -->
        <div class="bg-muted/50 rounded-lg p-4">
          <h3 class="font-semibold mb-2 flex items-center gap-2">
            <Icon name="lucide:lightbulb" class="w-4 h-4" />
            How to Use
          </h3>
          <p class="text-sm text-muted-foreground mb-3">
            Once configured, you can reference your context sets in prompts like this:
          </p>
          <div class="bg-background border rounded-md p-3 text-sm">
            <p class="font-mono text-primary">"Using @{{ exampleContextSetName }}, please explain the data flow"</p>
            <p class="text-xs text-muted-foreground mt-2">
              Your IDE will automatically load the associated files and provide contextual assistance.
            </p>
          </div>
        </div>

        <!-- File Location -->
        <div class="bg-info/5 border border-info/20 rounded-lg p-4">
          <h3 class="font-semibold mb-2 flex items-center gap-2">
            <Icon name="lucide:folder" class="w-4 h-4" />
            File Location
          </h3>
          <p class="text-sm text-muted-foreground">
            Your <code class="bg-muted px-2 py-1 rounded text-xs font-mono">context-sets.json</code> file has been downloaded. 
            Place it in your project root directory alongside your configuration file.
          </p>
        </div>
      </div>

      <DialogFooter class="mt-6">
        <Button @click="closeModal" variant="outline">
          Close
        </Button>
        <Button @click="copyToClipboard(ideRuleContent)" variant="default">
          <Icon :name="copySuccess ? 'lucide:check' : 'lucide:copy'" class="w-4 h-4 mr-2" />
          {{ copySuccess ? 'Copied!' : 'Copy Setup Rule' }}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>

<script setup lang="ts">
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

interface Props {
  open?: boolean
  title?: string
  description?: string
  exampleContextSetName?: string
  showSuccessIcon?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  open: false,
  title: '🎉 Export Successful!',
  description: 'Your context sets have been exported successfully. Follow the setup below to enable intelligent context switching in your IDE.',
  exampleContextSetName: 'myContextSet',
  showSuccessIcon: true
})

const emit = defineEmits<{
  (e: 'update:open', value: boolean): void
}>()

// Advanced UX Systems
const { success, errorWithRetry } = useNotifications()

// Modal state
const isOpen = computed({
  get: () => props.open,
  set: (value) => emit('update:open', value)
})

const copySuccess = ref(false)

// IDE Rule Content
const ideRuleContent = `## Context Sets Tool Selection

When a user references \`@context:Name\`, resolve it via \`context-sets.json\` → \`sets["context:Name"]\`.

### Processing Order

1. **Check workflows first**

- If workflows exist: Start from \`workflow.start.function\` and trace to \`end\`
- If workflows empty: Read all files in the context, prioritizing those with \`functionRefs\`

2. **File Resolution**

- String → filesIndex[fileId].path → read entire file
- Object → filesIndex[fileId].path → locate specific functionRefs

3. **Impact Analysis**
- Direct: Check context's \`uses\` array
- Indirect: Check \`filesIndex[fileId].contexts\` for shared files
- When modifying file_X in ContextA, also consider ContextB if both use file_X

### Quick Example

User: "Fix the download button in @context:PhotoGallery"
→ Load PhotoGallery context
→ See it uses ["DownloadPhoto"]
→ Find download button via workflow start point or grep functions
→ Check if changes affect DownloadPhoto via shared files

### Key Rules

- Track changes in memory during session
- Update context-sets.json only when explicitly requested  
- Use functionRefs for surgical precision when available
- No warnings for files outside contexts`

// Copy to clipboard functionality
const copyToClipboard = async (text: string) => {
  try {
    await navigator.clipboard.writeText(text)
    copySuccess.value = true
    success('Copied!', 'IDE rule copied to clipboard')
    setTimeout(() => {
      copySuccess.value = false
    }, 2000)
  } catch (error) {
    console.error('Failed to copy to clipboard:', error)
    errorWithRetry('Copy Failed', 'Failed to copy to clipboard', () => copyToClipboard(text))
  }
}

// Close modal
const closeModal = () => {
  isOpen.value = false
}
</script>
