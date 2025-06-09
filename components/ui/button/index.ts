/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */
import { cva, type VariantProps } from 'class-variance-authority'

export { default as Button } from './Button.vue'

export const buttonVariants = cva(
  'interactive-element btn-sophisticated inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-all duration-200 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*=\'size-\'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive',
  {
    variants: {
      variant: {
        default:
          'bg-primary text-primary-foreground elevation-2 hover:elevation-3 hover:bg-primary/90 active:elevation-1',
        destructive:
          'bg-destructive text-white elevation-2 hover:elevation-3 hover:bg-destructive/90 focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40 dark:bg-destructive/60 btn-error',
        outline:
          'border border-subtle bg-background elevation-1 hover:elevation-2 hover:bg-accent hover:text-accent-foreground dark:bg-input/30 dark:border-input dark:hover:bg-input/50',
        secondary:
          'bg-secondary text-secondary-foreground elevation-2 hover:elevation-3 hover:bg-secondary/80',
        ghost:
          'hover:bg-accent hover:text-accent-foreground dark:hover:bg-accent/50 hover:elevation-1',
        link: 'text-primary underline-offset-4 hover:underline',
        success:
          'bg-success text-success-foreground elevation-2 hover:elevation-3 btn-success',
        warning:
          'bg-warning text-warning-foreground elevation-2 hover:elevation-3 btn-warning',
        info:
          'bg-info text-info-foreground elevation-2 hover:elevation-3 btn-info',
        sophisticated:
          'bg-gradient-primary text-primary-foreground elevation-3 hover:elevation-4 border border-primary/20 backdrop-blur-sm',
        elevated:
          'bg-surface-elevated text-foreground border border-emphasis elevation-3 hover:elevation-4 hover:bg-surface-overlay',
      },
      size: {
        default: 'h-9 px-4 py-2 has-[>svg]:px-3',
        sm: 'h-8 rounded-md gap-1.5 px-3 has-[>svg]:px-2.5',
        lg: 'h-10 rounded-md px-6 has-[>svg]:px-4',
        xl: 'h-12 rounded-lg px-8 has-[>svg]:px-6 text-base',
        icon: 'size-9',
        'icon-sm': 'size-8',
        'icon-lg': 'size-10',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
)

export type ButtonVariants = VariantProps<typeof buttonVariants>
