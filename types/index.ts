/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

// Centralized type definitions to avoid duplicate imports
export interface FileTreeItem {
  name: string
  path: string
  type: 'file' | 'directory'
  handle?: FileSystemHandle
  children?: FileTreeItem[]
}

export interface FileManifestEntry {
  path: string
  comment?: string
}

export interface FunctionRef {
  name: string
  comment?: string
  startLine?: number
  endLine?: number
}

export interface WorkflowPoint {
  fileRef: string
  function?: string
  startLine?: number
  endLine?: number
}

export interface Workflow {
  start: WorkflowPoint
  end: WorkflowPoint
}

export interface FileRef {
  fileRef: string
  functionRefs?: FunctionRef[]
  comment?: string
  classification?: string
}

export interface ContextSet {
  name?: string
  description: string
  files: (string | FileRef)[]
  workflows: Workflow[]
  systemBehavior?: {
    processing?: {
      mode?: string
    }
  }
}

export interface ContextSetsData {
  [contextSetName: string]: ContextSet
}

export interface SerializableProjectState {
  filesManifest: Record<string, FileManifestEntry>
  contextSets: ContextSetsData
  fileContextsIndex: Record<string, string[]>
  schemaVersion: string
}