import ignore from 'ignore';
import type { Ignore } from 'ignore';

/**
 * This composable creates a matcher instance based on all .gitignore files
 * found in a project, supplemented with our own custom exclusion rules.
 */
export const useGitignore = () => {
  
  const createMatcher = async (
    allProjectFiles: Array<{ path: string; handle?: FileSystemHandle }>
  ): Promise<Ignore> => {

    const ig = ignore();

    // Find all .gitignore files in the project
    const gitignoreFiles = allProjectFiles.filter(f => f.path.endsWith('.gitignore'));

    // Read the content of all found .gitignore files in parallel for performance
    const gitignorePromises = gitignoreFiles.map(async (file) => {
      try {
        const handle = file.handle as FileSystemFileHandle;
        const fileObj = await handle.getFile();
        return await fileObj.text();
      } catch (e) {
        console.warn(`Could not read .gitignore file: ${file.path}`, e);
        return ''; // Return empty string on failure
      }
    });

    const gitignoreContents = await Promise.all(gitignorePromises);
    
    // Add rules from all .gitignore files found in the project
    if (gitignoreContents.length > 0) {
      ig.add(gitignoreContents.join('\n'));
      console.log(`📋 Loaded rules from ${gitignoreFiles.length} .gitignore files`);
    }

    // Add our own custom, non-negotiable exclusion rules for common asset types
    // and directories that are almost never relevant for source code analysis.
    const customExclusions = [
      '# Custom Exclusions from Smart Context Snippet Manager',
      '*.log',
      '*.jpg',
      '*.jpeg',
      '*.png',
      '*.ico',
      '*.svg',
      '*.gif',
      '*.pdf',
      '*.txt',
      '*.wasm',
      '*.css',
      '*.scss',
      '*.json',
      '*.md',
      '*.yaml',
      '*.yml',
      '*.xml',
      '*.lock',
      // Explicitly ignore common binary/asset directories.
      // The leading slash is often optional but good for clarity.
      '/dist',
      '/build',
      '/coverage',
      '/.next',
      '/.nuxt',
      '/.git',
      '/node_modules',
      '/.vscode',
      '/.idea',
      '/logs',
      '/log',
      '/tmp',
      '/temp',
      '/.cache',
      '/public',
      '/static',
      '/assets/css',
      '/assets/images',
      '/assets/fonts'
    ];
    
    ig.add(customExclusions.join('\n'));
    console.log(`🔧 Applied ${customExclusions.length - 1} custom exclusion rules`);
    
    return ig;
  };

  return { createMatcher };
}; 