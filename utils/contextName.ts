/**
 * Utility functions for handling context set names and display formatting
 */

/**
 * Removes the "context:" prefix from a context set name for display purposes
 * @param contextName - The full context set name (may or may not have "context:" prefix)
 * @returns The display name without the "context:" prefix
 */
export function getContextDisplayName(contextName: string): string {
  return contextName.startsWith('context:') ? contextName.replace('context:', '') : contextName
}

/**
 * Ensures a context set name has the "context:" prefix for internal storage/export
 * @param contextName - The context set name (may or may not have "context:" prefix)
 * @returns The context name with "context:" prefix
 */
export function getContextInternalName(contextName: string): string {
  return contextName.startsWith('context:') ? contextName : `context:${contextName}`
}