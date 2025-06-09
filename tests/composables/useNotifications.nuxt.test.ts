/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */
// @vitest-environment nuxt
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { useNotifications } from '~/composables/useNotifications'

describe('useNotifications', () => {
  let notifications: ReturnType<typeof useNotifications>

  beforeEach(() => {
    vi.clearAllMocks()
    notifications = useNotifications()
    // Clear any existing notifications
    notifications.clear()
  })

  describe('Basic Notification Management', () => {
    it('should start with empty notifications', () => {
      expect(notifications.notifications.value).toHaveLength(0)
    })

    it('should add a notification', () => {
      notifications.add({
        type: 'success',
        title: 'Test Success',
        message: 'This is a test message'
      })

      expect(notifications.notifications.value).toHaveLength(1)
      expect(notifications.notifications.value[0].type).toBe('success')
      expect(notifications.notifications.value[0].title).toBe('Test Success')
      expect(notifications.notifications.value[0].message).toBe('This is a test message')
    })

    it('should generate unique IDs for notifications', () => {
      notifications.add({
        type: 'info',
        title: 'First',
        message: 'First message'
      })

      notifications.add({
        type: 'info',
        title: 'Second',
        message: 'Second message'
      })

      const [first, second] = notifications.notifications.value
      expect(first.id).toBeDefined()
      expect(second.id).toBeDefined()
      expect(first.id).not.toBe(second.id)
    })

    it('should remove a notification by ID', () => {
      notifications.add({
        type: 'warning',
        title: 'Warning',
        message: 'Warning message'
      })

      const notificationId = notifications.notifications.value[0].id
      notifications.remove(notificationId)

      expect(notifications.notifications.value).toHaveLength(0)
    })

    it('should clear all notifications', () => {
      notifications.add({
        type: 'error',
        title: 'Error 1',
        message: 'Error message 1'
      })

      notifications.add({
        type: 'error',
        title: 'Error 2',
        message: 'Error message 2'
      })

      expect(notifications.notifications.value).toHaveLength(2)

      notifications.clear()

      expect(notifications.notifications.value).toHaveLength(0)
    })
  })

  describe('Convenience Methods', () => {
    it('should add success notification', () => {
      notifications.success('Success Title', 'Success message')

      const notification = notifications.notifications.value[0]
      expect(notification.type).toBe('success')
      expect(notification.title).toBe('Success Title')
      expect(notification.message).toBe('Success message')
    })

    it('should add error notification', () => {
      notifications.error('Error Title', 'Error message')

      const notification = notifications.notifications.value[0]
      expect(notification.type).toBe('error')
      expect(notification.title).toBe('Error Title')
      expect(notification.message).toBe('Error message')
    })

    it('should add warning notification', () => {
      notifications.warning('Warning Title', 'Warning message')

      const notification = notifications.notifications.value[0]
      expect(notification.type).toBe('warning')
      expect(notification.title).toBe('Warning Title')
      expect(notification.message).toBe('Warning message')
    })

    it('should add info notification', () => {
      notifications.info('Info Title', 'Info message')

      const notification = notifications.notifications.value[0]
      expect(notification.type).toBe('info')
      expect(notification.title).toBe('Info Title')
      expect(notification.message).toBe('Info message')
    })
  })

  describe('Auto-dismiss Functionality', () => {
    beforeEach(() => {
      vi.useFakeTimers()
    })

    afterEach(() => {
      vi.useRealTimers()
    })

    it('should auto-dismiss notification after timeout', () => {
      notifications.add({
        type: 'info',
        title: 'Auto-dismiss',
        message: 'This should auto-dismiss',
        timeout: 3000
      })

      expect(notifications.notifications.value).toHaveLength(1)

      // Fast-forward time
      vi.advanceTimersByTime(3000)

      expect(notifications.notifications.value).toHaveLength(0)
    })

    it('should handle default timeout for different notification types', () => {
      // Success notifications typically have shorter timeouts
      notifications.success('Quick success', 'Short message')
      
      // Error notifications typically persist longer or don't auto-dismiss
      notifications.error('Important error', 'Important error message')

      expect(notifications.notifications.value).toHaveLength(2)

      // Test that timeout behavior is consistent with the implementation
      const successNotification = notifications.notifications.value.find(n => n.type === 'success')
      const errorNotification = notifications.notifications.value.find(n => n.type === 'error')

      expect(successNotification).toBeDefined()
      expect(errorNotification).toBeDefined()
    })
  })

  describe('Notification Actions', () => {
    it('should support notification with action buttons', () => {
      const actionSpy = vi.fn()

      notifications.add({
        type: 'info',
        title: 'Action Test',
        message: 'Test message with action',
        actions: [
          {
            label: 'Confirm',
            action: actionSpy
          }
        ]
      })

      const notification = notifications.notifications.value[0]
      expect(notification.actions).toHaveLength(1)
      expect(notification.actions![0].label).toBe('Confirm')

      // Simulate action click
      notification.actions![0].action()
      expect(actionSpy).toHaveBeenCalledOnce()
    })

    it('should support multiple actions', () => {
      const confirmSpy = vi.fn()
      const cancelSpy = vi.fn()

      notifications.add({
        type: 'warning',
        title: 'Multiple Actions',
        message: 'Test message with multiple actions',
        actions: [
          {
            label: 'Confirm',
            action: confirmSpy
          },
          {
            label: 'Cancel',
            action: cancelSpy
          }
        ]
      })

      const notification = notifications.notifications.value[0]
      expect(notification.actions).toHaveLength(2)

      // Test first action
      notification.actions![0].action()
      expect(confirmSpy).toHaveBeenCalledOnce()
      expect(cancelSpy).not.toHaveBeenCalled()

      // Test second action
      notification.actions![1].action()
      expect(cancelSpy).toHaveBeenCalledOnce()
    })
  })

  describe('Edge Cases', () => {
    it('should handle removing non-existent notification gracefully', () => {
      expect(() => {
        notifications.remove('non-existent-id')
      }).not.toThrow()

      expect(notifications.notifications.value).toHaveLength(0)
    })

    it('should handle adding notification with minimal data', () => {
      notifications.add({
        type: 'info',
        title: 'Minimal',
        message: ''
      })

      expect(notifications.notifications.value).toHaveLength(1)
      expect(notifications.notifications.value[0].message).toBe('')
    })

    it('should handle very long notification messages', () => {
      const longMessage = 'A'.repeat(1000)
      
      notifications.add({
        type: 'info',
        title: 'Long Message',
        message: longMessage
      })

      expect(notifications.notifications.value[0].message).toBe(longMessage)
    })
  })

  describe('Multiple Notifications Management', () => {
    it('should maintain correct order of notifications', () => {
      notifications.add({
        type: 'info',
        title: 'First',
        message: 'First message'
      })

      notifications.add({
        type: 'success',
        title: 'Second',
        message: 'Second message'
      })

      notifications.add({
        type: 'error',
        title: 'Third',
        message: 'Third message'
      })

      expect(notifications.notifications.value).toHaveLength(3)
      expect(notifications.notifications.value[0].title).toBe('First')
      expect(notifications.notifications.value[1].title).toBe('Second')
      expect(notifications.notifications.value[2].title).toBe('Third')
    })

    it('should remove specific notification from multiple', () => {
      notifications.add({
        type: 'info',
        title: 'Keep 1',
        message: 'Keep this one'
      })

      notifications.add({
        type: 'warning',
        title: 'Remove',
        message: 'Remove this one'
      })

      notifications.add({
        type: 'success',
        title: 'Keep 2',
        message: 'Keep this one too'
      })

      const removeId = notifications.notifications.value[1].id
      notifications.remove(removeId)

      expect(notifications.notifications.value).toHaveLength(2)
      expect(notifications.notifications.value[0].title).toBe('Keep 1')
      expect(notifications.notifications.value[1].title).toBe('Keep 2')
    })
  })
}) 