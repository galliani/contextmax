/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { JS, Unicode } from 'refa';

export interface RegexParsedCodeInfo {
  classes: Array<{ name: string; startLine: number; endLine: number }>;
  functions: Array<{ name: string; startLine: number; endLine: number }>;
  imports: Array<{ module: string; startLine: number }>;
  exports: Array<{ name: string; startLine: number }>;
}

export const useRegexCodeParser = () => {
  const parseCode = (content: string, filePath: string): RegexParsedCodeInfo => {
    const lines = content.split('\n');
    const info: RegexParsedCodeInfo = {
      classes: [],
      functions: [],
      imports: [],
      exports: [],
    };

    // Enhanced regex patterns using refa for better accuracy
    const createRefaPattern = (pattern: string) => {
      try {
        const ast = JS.parse(pattern);
        return JS.toRegExp(ast);
      } catch {
        return new RegExp(pattern);
      }
    };

    const classRegex = createRefaPattern('(?:^|\\s)(?:export\\s+)?(?:abstract\\s+)?class\\s+([a-zA-Z0-9_$]+)');
    
    // Universal function pattern for better multi-language detection
    const functionPattern = /^\s*(?:(?:public|private|static|internal|protected|async|virtual|override|inline|tailrec|extern|pure|impure|elemental|recursive|module)\s+)*?(?:(?:function|def|fun|fn|sub|subroutine|procedure|declare|create(?:\s+or\s+replace)?\s+function|perform|defun)\b\s*)?(?:[\w\.\:\<\>\[\]\*\&\s]+\s+)?([a-zA-Z_@$][\w\-$]*[?!]?)\s*(?:<[^>]*>)?\s*\(/mi;
    
    const importRegex = createRefaPattern('^(?:\\s*)import\\s+.*?from\\s+[\'\"](.*?)[\'\"]+|^(?:\\s*)import\\s+[\'\"](.*?)[\'\"]+|^(?:\\s*)from\\s+(.*?)\\s+import');
    const exportRegex = createRefaPattern('^(?:\\s*)export\\s+(?:default\\s+)?(?:function|class|const|let|var)\\s+([a-zA-Z0-9_$]+)|^(?:\\s*)export\\s*\\{\\s*([^}]+)\\s*\\}');

    // Block boundary detection helpers
    const findBraceBlockEnd = (startLine: number): number => {
      let braceCount = 0;
      let inBlock = false;
      for (let i = startLine; i < lines.length; i++) {
        const line = lines[i];
        for (const char of line) {
          if (char === '{') {
            braceCount++;
            inBlock = true;
          } else if (char === '}') {
            braceCount--;
          }
        }
        if (inBlock && braceCount === 0) {
          return i;
        }
      }
      return lines.length - 1;
    };

    // Main parsing loop with refa-enhanced patterns
    lines.forEach((line, index) => {
      const lineNum = index;

      // Import matching with refa-enhanced regex
      const importMatch = line.match(importRegex);
      if (importMatch) {
        const module = importMatch[1] || importMatch[2] || importMatch[3];
        if (module) {
          info.imports.push({ module: module.trim(), startLine: lineNum });
        }
      }

      // Export matching with refa-enhanced regex
      const exportMatch = line.match(exportRegex);
      if (exportMatch) {
        const name = exportMatch[1] || exportMatch[2];
        if (name) {
          // Handle multiple exports in braces
          if (exportMatch[2]) {
            const exports = exportMatch[2].split(',').map(e => e.trim()).filter(e => e);
            exports.forEach(exportName => {
              info.exports.push({ name: exportName, startLine: lineNum });
            });
          } else {
            info.exports.push({ name: name, startLine: lineNum });
          }
        }
      }

      // Class matching with refa-enhanced regex
      const classMatch = line.match(classRegex);
      if (classMatch) {
        const name = classMatch[1];
        if (name) {
          const endLine = findBraceBlockEnd(lineNum);
          info.classes.push({ name, startLine: lineNum, endLine });
        }
      }

      // Function matching with universal pattern
      const funcMatch = line.match(functionPattern);
      if (funcMatch) {
        const name = funcMatch[1];
        if (name && !['if', 'for', 'while', 'with', 'try', 'catch', 'switch', 'case'].includes(name)) {
          // Check if we already found this function (avoid duplicates)
          const alreadyExists = info.functions.some(f => f.name === name && Math.abs(f.startLine - lineNum) <= 2);
          if (!alreadyExists) {
            const endLine = findBraceBlockEnd(lineNum);
            info.functions.push({ name, startLine: lineNum, endLine });
          }
        }
      }
    });

    return info;
  };

  const isLanguageSupported = (filePath: string): boolean => {
    const unsupportedExtensions = [
      '.png', '.jpg', '.jpeg', '.gif', '.svg', '.lock', '.ico', '.woff', '.woff2',
      '.pdf', '.zip', '.tar', '.gz', '.exe', '.dll', '.so', '.dylib',
      '.mp3', '.mp4', '.avi', '.mov', '.wav', '.flac'
    ];
    const path = filePath.toLowerCase();
    
    // Skip if it's an unsupported binary file
    if (unsupportedExtensions.some(ext => path.endsWith(ext))) {
      return false;
    }

    // Skip common directories that don't contain source code
    const skipPaths = ['/node_modules/', '/.git/', '/dist/', '/build/', '/.nuxt/', '/.output/', '/coverage/', '/public/'];
    if (skipPaths.some(skipPath => path.includes(skipPath))) {
      return false;
    }

    return true;
  };

  return { parseCode, isLanguageSupported };
};