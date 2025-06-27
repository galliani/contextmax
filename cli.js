#!/usr/bin/env node

import http from 'http';
import path from 'path';
import fs from 'fs';
import url from 'url';
import { fileURLToPath } from 'url';
import { exec } from 'child_process';
import os from 'os';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || 'localhost';

function checkPort(port, callback) {
  const server = http.createServer();
  server.once('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      callback(false);
    } else {
      callback(true);
    }
  });
  server.once('listening', () => {
    server.close();
    callback(true);
  });
  server.listen(port);
}

function findAvailablePort(startPort, callback) {
  checkPort(startPort, (isAvailable) => {
    if (isAvailable) {
      callback(startPort);
    } else {
      findAvailablePort(startPort + 1, callback);
    }
  });
}

function getMimeType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const mimeTypes = {
    '.html': 'text/html',
    '.js': 'application/javascript',
    '.mjs': 'application/javascript',
    '.css': 'text/css',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon',
    '.webp': 'image/webp',
    '.woff': 'font/woff',
    '.woff2': 'font/woff2',
    '.ttf': 'font/ttf',
    '.otf': 'font/otf',
    '.wasm': 'application/wasm'
  };
  return mimeTypes[ext] || 'application/octet-stream';
}

function openBrowser(url) {
  const platform = os.platform();
  let command;
  
  switch (platform) {
    case 'darwin':
      command = `open "${url}"`;
      break;
    case 'win32':
      command = `start "${url}"`;
      break;
    default:
      // Linux and others
      command = `xdg-open "${url}" || sensible-browser "${url}" || x-www-browser "${url}" || gnome-open "${url}"`;
  }
  
  exec(command, (err) => {
    if (err) {
      console.log('📌 Could not open browser automatically. Please open the URL manually.');
    }
  });
}

function startServer() {
  const distPath = path.join(__dirname, 'dist');
  
  if (!fs.existsSync(distPath)) {
    console.error('Error: Built files not found. Please ensure the package was installed correctly.');
    console.error('Expected path:', distPath);
    process.exit(1);
  }

  console.log('🚀 Starting ContextMax...');
  console.log(`📁 Serving from: ${distPath}`);
  
  findAvailablePort(PORT, (availablePort) => {
    const server = http.createServer((req, res) => {
      const parsedUrl = url.parse(req.url);
      let pathname = parsedUrl.pathname;
      
      // Default to index.html for root path
      if (pathname === '/') {
        pathname = '/index.html';
      }
      
      // Security: prevent directory traversal
      pathname = pathname.replace(/\.\./g, '');
      
      let filePath = path.join(distPath, pathname);
      
      // Try to serve the file
      fs.readFile(filePath, (err, data) => {
        if (err) {
          // If file not found, try with .html extension
          if (!pathname.endsWith('.html')) {
            filePath = path.join(distPath, pathname + '.html');
            fs.readFile(filePath, (err2, data2) => {
              if (err2) {
                // For client-side routing, serve index.html
                fs.readFile(path.join(distPath, 'index.html'), (err3, data3) => {
                  if (err3) {
                    res.writeHead(404, { 'Content-Type': 'text/plain' });
                    res.end('404 Not Found');
                  } else {
                    res.writeHead(200, { 'Content-Type': 'text/html' });
                    res.end(data3);
                  }
                });
              } else {
                res.writeHead(200, { 'Content-Type': 'text/html' });
                res.end(data2);
              }
            });
          } else {
            // Serve 404
            res.writeHead(404, { 'Content-Type': 'text/plain' });
            res.end('404 Not Found');
          }
        } else {
          // Success - serve the file with appropriate content type
          const mimeType = getMimeType(filePath);
          res.writeHead(200, { 'Content-Type': mimeType });
          res.end(data);
        }
      });
    });

    server.listen(availablePort, HOST, () => {
      const serverUrl = `http://${HOST}:${availablePort}`;
      console.log(`\n✨ ContextMax is running at: ${serverUrl}`);
      console.log('📋 Press Ctrl+C to stop the server\n');
      
      // Open browser
      openBrowser(serverUrl);
    });

    process.on('SIGINT', () => {
      console.log('\n👋 Shutting down ContextMax...');
      server.close();
      process.exit(0);
    });
  });
}

function showHelp() {
  console.log(`
ContextMax - Privacy-first context sets for LLMs

Usage:
  npx contextmax [command]

Commands:
  run, start    Start the ContextMax server (default)
  help          Show this help message

Environment Variables:
  PORT          Server port (default: 3000)
  HOST          Server host (default: localhost)

Examples:
  npx contextmax
  npx contextmax run
  PORT=8080 npx contextmax
`);
}

const command = process.argv[2];

switch (command) {
  case undefined:
  case 'run':
  case 'start':
    startServer();
    break;
  case 'help':
  case '--help':
  case '-h':
    showHelp();
    break;
  default:
    console.error(`Unknown command: ${command}`);
    showHelp();
    process.exit(1);
}