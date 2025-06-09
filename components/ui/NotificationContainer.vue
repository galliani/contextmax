/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */
<template>
  <Teleport to="body">
    <div 
      class="fixed top-4 right-4 z-[1000] flex flex-col gap-2 max-w-sm w-full pointer-events-none"
      role="region"
      aria-label="Notifications"
      aria-live="polite"
    >
      <TransitionGroup
        name="notification"
        tag="div"
        class="flex flex-col gap-2"
      >
        <div
          v-for="notification in notifications"
          :key="notification.id"
          :class="[
            'notification pointer-events-auto',
            `notification-${notification.type}`,
            'show'
          ]"
          role="alert"
          :aria-labelledby="`notification-title-${notification.id}`"
          :aria-describedby="notification.message ? `notification-message-${notification.id}` : undefined"
        >
          <div class="flex items-start gap-3">
            <!-- Icon -->
            <div class="flex-shrink-0 w-5 h-5 mt-0.5">
              <Icon 
                :name="getNotificationIcon(notification.type)" 
                :class="getNotificationIconClass(notification.type)"
                aria-hidden="true"
              />
            </div>
            
            <!-- Content -->
            <div class="flex-1 min-w-0">
              <div 
                :id="`notification-title-${notification.id}`"
                class="font-semibold text-sm mb-1"
              >
                {{ notification.title }}
              </div>
              <div 
                v-if="notification.message"
                :id="`notification-message-${notification.id}`"
                class="text-sm opacity-90 leading-relaxed"
              >
                {{ notification.message }}
              </div>
              
              <!-- Actions -->
              <div 
                v-if="notification.actions && notification.actions.length > 0"
                class="flex gap-2 mt-3"
                role="group"
                :aria-label="`Actions for ${notification.title}`"
              >
                <Button
                  v-for="(action, index) in notification.actions"
                  :key="index"
                  :variant="action.style === 'primary' ? 'default' : 'outline'"
                  size="sm"
                  class="text-xs px-3 py-1 h-auto"
                  @click="handleActionClick(action, notification.id)"
                >
                  {{ action.label }}
                </Button>
              </div>
            </div>
            
            <!-- Close Button -->
            <Button
              variant="ghost"
              size="sm"
              class="flex-shrink-0 w-6 h-6 p-0 hover:bg-black/10 dark:hover:bg-white/10"
              @click="removeNotification(notification.id)"
              :aria-label="`Close ${notification.title} notification`"
            >
              <Icon name="lucide:x" class="w-4 h-4" aria-hidden="true" />
            </Button>
          </div>
          
          <!-- Progress Bar for non-persistent notifications -->
          <div 
            v-if="!notification.persistent && notification.duration && notification.duration > 0"
            class="absolute bottom-0 left-0 h-1 bg-current opacity-20 rounded-b-lg transition-all duration-100 ease-linear"
            :style="{ width: getProgressWidth(notification) + '%' }"
            aria-hidden="true"
          />
        </div>
      </TransitionGroup>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { useNotifications } from '~/composables/useNotifications'

const { notifications, removeNotification } = useNotifications()

// Progress tracking for auto-dismissing notifications
const progressMap = ref<Map<string, number>>(new Map())

const getNotificationIcon = (type: string) => {
  const icons = {
    success: 'lucide:check-circle',
    error: 'lucide:alert-circle',
    warning: 'lucide:alert-triangle',
    info: 'lucide:info'
  }
  return icons[type as keyof typeof icons] || icons.info
}

const getNotificationIconClass = (type: string) => {
  const classes = {
    success: 'text-green-600',
    error: 'text-red-600',
    warning: 'text-amber-600',
    info: 'text-blue-600'
  }
  return classes[type as keyof typeof classes] || classes.info
}

const handleActionClick = (action: any, notificationId: string) => {
  action.action()
  removeNotification(notificationId)
}

const getProgressWidth = (notification: any) => {
  return progressMap.value.get(notification.id) || 100
}

// Track progress for auto-dismissing notifications
watch(notifications, (newNotifications) => {
  newNotifications.forEach(notification => {
    if (!notification.persistent && notification.duration && notification.duration > 0) {
      if (!progressMap.value.has(notification.id)) {
        // Start progress animation
        const startTime = Date.now()
        const animate = () => {
          const elapsed = Date.now() - startTime
          const progress = Math.max(0, 100 - (elapsed / notification.duration) * 100)
          
          progressMap.value.set(notification.id, progress)
          
          if (progress > 0) {
            requestAnimationFrame(animate)
          } else {
            progressMap.value.delete(notification.id)
          }
        }
        requestAnimationFrame(animate)
      }
    }
  })
  
  // Clean up progress for removed notifications
  const currentIds = new Set(newNotifications.map(n => n.id))
  for (const [id] of progressMap.value) {
    if (!currentIds.has(id)) {
      progressMap.value.delete(id)
    }
  }
})
</script>

<style scoped>
/* Enhanced notification styling */
.notification {
  position: relative;
  border-radius: 0.5rem;
  padding: 1rem;
  box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05);
  backdrop-filter: blur(4px);
  transform: translateX(100%);
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  max-width: 100%;
}

.notification.show {
  transform: translateX(0);
}

/* Light mode colors */
.notification-success {
  background-color: rgb(240 253 244);
  border: 1px solid rgb(134 239 172);
}

.notification-error {
  background-color: rgb(254 242 242);
  border: 1px solid rgb(252 165 165);
}

.notification-warning {
  background-color: rgb(255 251 235);
  border: 1px solid rgb(252 211 77);
}

.notification-info {
  background-color: rgb(239 246 255);
  border: 1px solid rgb(147 197 253);
}

/* Dark mode colors */
@media (prefers-color-scheme: dark) {
  .notification-success {
    background-color: rgba(5, 46, 22, 0.2);
    border-color: rgb(21 128 61);
  }

  .notification-error {
    background-color: rgba(69, 10, 10, 0.2);
    border-color: rgb(185 28 28);
  }

  .notification-warning {
    background-color: rgba(69, 39, 5, 0.2);
    border-color: rgb(217 119 6);
  }

  .notification-info {
    background-color: rgba(7, 25, 82, 0.2);
    border-color: rgb(59 130 246);
  }
}

/* Transition animations */
.notification-enter-active {
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.notification-leave-active {
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}

.notification-enter-from {
  opacity: 0;
  transform: translateX(100%) scale(0.95);
}

.notification-leave-to {
  opacity: 0;
  transform: translateX(100%) scale(0.95);
}

.notification-move {
  transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

/* Responsive adjustments */
@media (max-width: 640px) {
  .notification {
    margin-left: 0.5rem;
    margin-right: 0.5rem;
    max-width: none;
  }
}

/* High contrast mode adjustments */
@media (prefers-contrast: high) {
  .notification {
    border-width: 2px;
  }
  
  .notification-success {
    background-color: rgb(220 252 231);
    border-color: rgb(22 163 74);
  }
  
  .notification-error {
    background-color: rgb(254 226 226);
    border-color: rgb(220 38 38);
  }
  
  .notification-warning {
    background-color: rgb(254 243 199);
    border-color: rgb(245 158 11);
  }
  
  .notification-info {
    background-color: rgb(219 234 254);
    border-color: rgb(59 130 246);
  }
}

/* Reduced motion support */
@media (prefers-reduced-motion: reduce) {
  .notification,
  .notification-enter-active,
  .notification-leave-active,
  .notification-move {
    transition: opacity 0.2s ease !important;
  }
  
  .notification-enter-from,
  .notification-leave-to {
    transform: none !important;
    opacity: 0;
  }
}
</style> 