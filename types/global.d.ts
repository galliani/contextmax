// Global type declarations for File System Access API
interface FileSystemHandle {
  readonly kind: 'file' | 'directory';
  readonly name: string;
}

interface FileSystemFileHandle extends FileSystemHandle {
  readonly kind: 'file';
  getFile(): Promise<File>;
}

interface FileSystemDirectoryHandle extends FileSystemHandle {
  readonly kind: 'directory';
  entries(): AsyncIterable<[string, FileSystemHandle]>;
  getDirectoryHandle(name: string, options?: { create?: boolean }): Promise<FileSystemDirectoryHandle>;
  getFileHandle(name: string, options?: { create?: boolean }): Promise<FileSystemFileHandle>;
}

interface Window {
  showDirectoryPicker(options?: { mode?: 'read' | 'readwrite' }): Promise<FileSystemDirectoryHandle>;
  showOpenFilePicker(options?: { multiple?: boolean; types?: Array<{ description: string; accept: Record<string, string[]> }> }): Promise<FileSystemFileHandle[]>;
  showSaveFilePicker(options?: { suggestedName?: string; types?: Array<{ description: string; accept: Record<string, string[]> }> }): Promise<FileSystemFileHandle>;
} 