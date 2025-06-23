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
import { logger } from '~/utils/logger'
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
const ideRuleContent = `# Context Sets Tool Selection

When a user prompt references a named context (e.g., 'using @setName'), locate the \`context-sets.json\` file in the project root, parse its \`contextSets\` object to find the definition for the specified \`setName\`, resolved all listed files and workflow, and use that as the primary context for your answer.

## Schema Processing:
1. **File Resolution**: For each item in \`files\` array:
   - If string (e.g., \`"1"\`): Resolve via \`fileIndex["1"]\` to get path and comment
   - If object (e.g., \`{"fileRef": "3", "lineRanges": [...]}\`): Resolve via \`fileIndex["3"]\` and apply additional properties
2. **Workflow Processing**: Use \`workflow\` array to understand data flow sequence when making changes
3. **Line Range Updates**: When modifying code, update \`lineRanges\` in context sets and maintain \`fileIndex\` consistency

## Tool Selection Rules:
- **Files with \`lineRanges\`**: Use \`grep_search\` for precise targeting (avoids 200-line minimum)
- **Files without \`lineRanges\`**: Use \`read_file\` for complete context
- **Override**: Respect explicit \`preferredTool\` when specified in file objects
- **Workflow Analysis**: When understanding data flow, read workflow files in sequence order

## Performance Optimizations:
- Process \`workflow\` files first when making changes to understand impact
- Use \`fileIndex\` comments to understand file purpose before reading
- Batch similar file operations to reduce tool calls

## Memory-Based Context Tracking:
When a named context set is referenced and code changes are made:
1. **Load context set into memory** at the start of the session
2. **Track line range changes in memory** during code modifications (do NOT update the JSON file immediately)
3. **Use the updated memory version** for subsequent requests in the same session
4. **Update context-sets.json file only when explicitly requested** (e.g., "update the context sets file now") or when preparing for commit/PR
5. **Maintain accuracy** by ensuring memory-tracked changes reflect actual line number shifts from code edits

This approach optimizes performance by avoiding frequent file writes while maintaining context accuracy throughout the session.`

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
    logger.error('Failed to copy to clipboard:', error)
    errorWithRetry('Copy Failed', 'Failed to copy to clipboard', () => copyToClipboard(text))
  }
}

// Close modal
const closeModal = () => {
  isOpen.value = false
}
</script>
