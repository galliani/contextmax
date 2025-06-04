import { ref, reactive, nextTick } from 'vue'

export interface Notification {
  id: string
  type: 'success' | 'error' | 'warning' | 'info'
  title: string
  message?: string
  duration?: number
  timeout?: number
  persistent?: boolean
  actions?: Array<{
    label: string
    action: () => void
    style?: 'primary' | 'secondary'
  }>
  onClose?: () => void
}

interface NotificationState {
  notifications: Notification[]
  maxNotifications: number
  defaultDuration: number
}

const state = reactive<NotificationState>({
  notifications: [],
  maxNotifications: 5,
  defaultDuration: 5000
})

let notificationId = 0

export function useNotifications() {
  const notifications = ref(state.notifications)

  const createNotification = (notification: Omit<Notification, 'id'>): string => {
    const id = `notification-${++notificationId}`
    
    // Handle timeout logic: 
    // - If timeout is explicitly 0, don't auto-dismiss
    // - If timeout is provided and > 0, use it
    // - If duration is provided and > 0, use it
    // - Otherwise use default
    let timeout: number
    if (notification.timeout === 0) {
      timeout = 0 // Explicitly no timeout
    } else if (notification.timeout && notification.timeout > 0) {
      timeout = notification.timeout
    } else if (notification.duration && notification.duration > 0) {
      timeout = notification.duration
    } else {
      timeout = state.defaultDuration
    }
    
    const newNotification: Notification = {
      id,
      duration: timeout,
      timeout,
      ...notification
    }

    // Add notification to the end for chronological order
    state.notifications.push(newNotification)

    // Limit max notifications - remove oldest ones
    if (state.notifications.length > state.maxNotifications) {
      state.notifications.splice(0, state.notifications.length - state.maxNotifications)
    }

    // Auto-remove if not persistent and timeout > 0
    if (!newNotification.persistent && timeout > 0) {
      setTimeout(() => {
        removeNotification(id)
      }, timeout)
    }

    return id
  }

  const removeNotification = (id: string) => {
    const index = state.notifications.findIndex(n => n.id === id)
    if (index > -1) {
      const notification = state.notifications[index]
      notification.onClose?.()
      state.notifications.splice(index, 1)
    }
  }

  const clearAll = () => {
    state.notifications.forEach(n => n.onClose?.())
    state.notifications.length = 0
  }

  // Add aliases to match test expectations
  const add = createNotification
  const remove = removeNotification
  const clear = clearAll

  // Convenience methods
  const success = (title: string, message?: string, options?: Partial<Notification>) => {
    return createNotification({
      type: 'success',
      title,
      message,
      ...options
    })
  }

  const error = (title: string, message?: string, options?: Partial<Notification>) => {
    return createNotification({
      type: 'error',
      title,
      message,
      persistent: true, // Errors should be persistent by default
      ...options
    })
  }

  const warning = (title: string, message?: string, options?: Partial<Notification>) => {
    return createNotification({
      type: 'warning',
      title,
      message,
      duration: 8000, // Warnings last longer
      ...options
    })
  }

  const info = (title: string, message?: string, options?: Partial<Notification>) => {
    return createNotification({
      type: 'info',
      title,
      message,
      ...options
    })
  }

  // Advanced notification patterns
  const errorWithRetry = (
    title: string, 
    message: string, 
    retryAction: () => void,
    options?: Partial<Notification>
  ) => {
    return error(title, message, {
      actions: [
        {
          label: 'Retry',
          action: retryAction,
          style: 'primary'
        },
        {
          label: 'Dismiss',
          action: () => {},
          style: 'secondary'
        }
      ],
      ...options
    })
  }

  const successWithAction = (
    title: string,
    message: string,
    actionLabel: string,
    action: () => void,
    options?: Partial<Notification>
  ) => {
    return success(title, message, {
      actions: [
        {
          label: actionLabel,
          action,
          style: 'primary'
        }
      ],
      duration: 8000, // Give user time to act
      ...options
    })
  }

  const progressNotification = (title: string, message?: string) => {
    const id = createNotification({
      type: 'info',
      title,
      message,
      persistent: true
    })

    return {
      id,
      update: (newTitle?: string, newMessage?: string) => {
        const notification = state.notifications.find(n => n.id === id)
        if (notification) {
          if (newTitle) notification.title = newTitle
          if (newMessage) notification.message = newMessage
        }
      },
      complete: (successTitle?: string, successMessage?: string) => {
        removeNotification(id)
        if (successTitle) {
          success(successTitle, successMessage)
        }
      },
      error: (errorTitle?: string, errorMessage?: string) => {
        removeNotification(id)
        if (errorTitle) {
          error(errorTitle, errorMessage)
        }
      },
      remove: () => removeNotification(id)
    }
  }

  return {
    notifications,
    add,
    remove,
    clear,
    createNotification,
    removeNotification,
    clearAll,
    success,
    error,
    warning,
    info,
    errorWithRetry,
    successWithAction,
    progressNotification
  }
} 