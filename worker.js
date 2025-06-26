export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    let pathname = url.pathname;
    
    try {
      // Handle Hugging Face proxy requests
      if (pathname.startsWith('/curator/_hf/')) {
        // Remove the /curator/_hf/ prefix to get the actual HF path
        const hfPath = pathname.replace('/curator/_hf/', '');
        const hfUrl = `https://huggingface.co/${hfPath}${url.search}`;
        
        // Proxy the request to Hugging Face
        const hfResponse = await fetch(hfUrl, {
          method: request.method,
          headers: {
            'User-Agent': 'ContextMax/1.0',
            'Accept': '*/*',
            'Accept-Encoding': 'gzip, deflate, br',
          },
        });
        
        // Create response with proper CORS headers
        const contentType = hfResponse.headers.get('Content-Type') || 'application/octet-stream';
        const response = new Response(hfResponse.body, {
          status: hfResponse.status,
          statusText: hfResponse.statusText,
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
            'Access-Control-Allow-Headers': '*',
            'Content-Type': contentType,
            'Cache-Control': 'public, max-age=31536000',
          }
        });
        
        // Debug log for model files
        if (hfPath.includes('config.json') || hfPath.includes('Xenova/flan-t5-small')) {
          console.log(`Proxying HF request: ${hfUrl} with Content-Type: ${contentType}`);
        }
        
        return response;
      }
      
      // Handle CORS preflight for HF proxy
      if (request.method === 'OPTIONS' && pathname.startsWith('/curator/_hf/')) {
        return new Response(null, {
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
            'Access-Control-Allow-Headers': '*',
            'Access-Control-Max-Age': '86400',
          }
        });
      }
      // Get all keys once
      const list = await env.__STATIC_CONTENT.list({ limit: 1000 });
      const allKeys = list.keys.map(k => k.name);
      
      // Helper to find file by pattern
      const findFileByPattern = (basePattern) => {
        if (allKeys.includes(basePattern)) return basePattern;
        const regex = new RegExp(`^${basePattern.replace(/\.([^.]+)$/, '\\.[a-f0-9]+\\.$1')}$`);
        return allKeys.find(key => regex.test(key));
      };
      
      // Handle base URL prefix
      const baseURL = '/curator';
      const originalPathname = pathname;
      if (pathname.startsWith(baseURL)) {
        pathname = pathname.slice(baseURL.length);
        if (!pathname.startsWith('/')) pathname = '/' + pathname;
      }
      
      // Debug logging
      console.log(`Request: ${originalPathname} -> ${pathname}`);
      
      // For root paths
      if (pathname === '/' || pathname === '') {
        const indexFile = findFileByPattern('index.html');
        if (indexFile) {
          const content = await env.__STATIC_CONTENT.get(indexFile, 'text');
          return new Response(content, {
            headers: { 'content-type': 'text/html; charset=utf-8' }
          });
        }
      }
      
      // Remove leading slash for searching
      let searchPath = pathname.startsWith('/') ? pathname.slice(1) : pathname;
      
      // For fonts specifically - they need special handling
      if (searchPath.startsWith('_fonts/')) {
        const fontName = searchPath.replace('_fonts/', '');
        const foundFont = allKeys.find(key => {
          if (!key.startsWith('_fonts/')) return false;
          const keyFontName = key.replace('_fonts/', '');
          return keyFontName.startsWith(fontName.split('.')[0]);
        });
        
        if (foundFont) {
          const content = await env.__STATIC_CONTENT.get(foundFont, 'arrayBuffer');
          const ext = foundFont.split('.').pop().toLowerCase();
          
          return new Response(content, {
            headers: { 
              'content-type': ext === 'woff2' ? 'font/woff2' : 'font/woff',
              'cache-control': 'public, max-age=31536000',
              'accept-ranges': 'bytes',
              'content-length': content.byteLength.toString()
            }
          });
        }
      }
      
      // For other assets
      let foundKey = null;
      
      if (searchPath.includes('.')) {
        // First try exact match
        if (allKeys.includes(searchPath)) {
          foundKey = searchPath;
        } else {
          const parts = searchPath.split('/');
          const filename = parts.pop();
          const dir = parts.length > 0 ? parts.join('/') + '/' : '';
          
          const filenameParts = filename.split('.');
          
          // Handle both formats: hash.ext and base.hash.ext
          if (filenameParts.length === 2) {
            // Simple format like D03hkso6.js
            foundKey = allKeys.find(key => key === `${dir}${filename}`);
            console.log(`Looking for simple format: ${dir}${filename}, found: ${foundKey || 'not found'}`);
          } else if (filenameParts.length === 3) {
            // Complex format like index.abc123.js
            const [base, hash, ext] = filenameParts;
            const pattern = new RegExp(`^${dir}${base}\\.${hash}\\.[a-f0-9]+\\.${ext}$`);
            foundKey = allKeys.find(key => pattern.test(key));
            console.log(`Looking for complex format with pattern, found: ${foundKey || 'not found'}`);
          }
          
          if (!foundKey) {
            foundKey = findFileByPattern(searchPath);
          }
        }
      }
      
      if (foundKey) {
        const ext = foundKey.split('.').pop().toLowerCase();
        
        // Determine if binary
        const binaryTypes = ['woff', 'woff2', 'ttf', 'otf', 'eot', 'png', 'jpg', 'jpeg', 'gif', 'ico', 'pdf', 'zip'];
        const isBinary = binaryTypes.includes(ext);
        
        // Get content with proper type
        const content = await env.__STATIC_CONTENT.get(
          foundKey, 
          isBinary ? 'arrayBuffer' : 'text'
        );
        
        const contentTypes = {
          'html': 'text/html; charset=utf-8',
          'js': 'application/javascript; charset=utf-8',
          'mjs': 'application/javascript; charset=utf-8',
          'css': 'text/css; charset=utf-8',
          'json': 'application/json; charset=utf-8',
          'woff': 'font/woff',
          'woff2': 'font/woff2',
          'ttf': 'font/ttf',
          'otf': 'font/otf',
          'txt': 'text/plain; charset=utf-8',
          'png': 'image/png',
          'jpg': 'image/jpeg',
          'jpeg': 'image/jpeg',
          'svg': 'image/svg+xml; charset=utf-8',
          'ico': 'image/x-icon'
        };
        
        const headers = {
          'content-type': contentTypes[ext] || 'application/octet-stream',
          'cache-control': ext === 'html' ? 'no-cache' : 'public, max-age=31536000'
        };
        
        // Add content-length for binary files
        if (isBinary && content.byteLength) {
          headers['content-length'] = content.byteLength.toString();
        }
        
        return new Response(content, { headers });
      }
      
      // Fallback to index.html for SPA
      const indexFile = allKeys.find(key => key.match(/index\.[a-f0-9]+\.html$/));
      if (indexFile) {
        const content = await env.__STATIC_CONTENT.get(indexFile, 'text');
        return new Response(content, {
          headers: { 'content-type': 'text/html; charset=utf-8' }
        });
      }
      
      return new Response(`Not found: ${pathname}`, { status: 404 });
      
    } catch (error) {
      return new Response(`Error: ${error.message}\nStack: ${error.stack}`, { status: 500 });
    }
  }
};