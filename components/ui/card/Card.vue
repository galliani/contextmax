<script setup lang="ts">
import type { HTMLAttributes } from 'vue'
import { cn } from '@/lib/utils'

const props = defineProps<{
  class?: HTMLAttributes['class']
  variant?: 'default' | 'sophisticated' | 'elevated' | 'subtle' | 'interactive'
  elevation?: 'none' | 'sm' | 'md' | 'lg' | 'xl'
}>()

const getCardClasses = () => {
  const baseClasses = 'bg-card text-card-foreground flex flex-col gap-6 rounded-xl transition-all duration-200'
  
  const variantClasses = {
    default: 'border shadow-sm',
    sophisticated: 'card-sophisticated border-subtle elevation-2',
    elevated: 'bg-surface-elevated border-emphasis elevation-3 backdrop-blur-sm',
    subtle: 'bg-surface-2 border-hairline elevation-1',
    interactive: 'card-sophisticated hover:cursor-pointer hover:border-primary/30'
  }
  
  const elevationClasses = {
    none: '',
    sm: 'elevation-1',
    md: 'elevation-2', 
    lg: 'elevation-3',
    xl: 'elevation-4'
  }
  
  const variant = props.variant || 'default'
  const elevation = props.elevation ? elevationClasses[props.elevation] : ''
  
  return cn(
    baseClasses,
    variantClasses[variant],
    elevation,
    'py-6',
    props.class
  )
}
</script>

<template>
  <div
    data-slot="card"
    :class="getCardClasses()"
  >
    <slot />
  </div>
</template>
