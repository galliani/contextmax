export interface HealthCheckResult {
  feature: string
  available: boolean
  error?: string
}

export async function checkBrowserAPIs(): Promise<HealthCheckResult[]> {
  const results: HealthCheckResult[] = []

  // Check File System Access API
  results.push({
    feature: 'File System Access API',
    available: 'showOpenFilePicker' in window && 
               'showDirectoryPicker' in window &&
               'showSaveFilePicker' in window
  })

  // Check Origin Private File System (OPFS)
  try {
    if ('storage' in navigator && 'getDirectory' in navigator.storage) {
      const root = await navigator.storage.getDirectory()
      results.push({
        feature: 'Origin Private File System (OPFS)',
        available: true
      })
    } else {
      results.push({
        feature: 'Origin Private File System (OPFS)',
        available: false,
        error: 'OPFS API not found'
      })
    }
  } catch (error) {
    results.push({
      feature: 'Origin Private File System (OPFS)',
      available: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    })
  }

  // Check IndexedDB
  try {
    const testDB = await new Promise<boolean>((resolve) => {
      const request = indexedDB.open('contextmax-health-check', 1)
      request.onsuccess = () => {
        request.result.close()
        indexedDB.deleteDatabase('contextmax-health-check')
        resolve(true)
      }
      request.onerror = () => resolve(false)
    })
    
    results.push({
      feature: 'IndexedDB',
      available: testDB
    })
  } catch (error) {
    results.push({
      feature: 'IndexedDB',
      available: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    })
  }

  // Check WebGPU (for AI acceleration)
  results.push({
    feature: 'WebGPU (AI Acceleration)',
    available: 'gpu' in navigator
  })

  // Check Web Workers
  results.push({
    feature: 'Web Workers',
    available: 'Worker' in window
  })

  // Check SharedArrayBuffer (for multi-threading)
  results.push({
    feature: 'SharedArrayBuffer',
    available: 'SharedArrayBuffer' in window
  })

  // Check Browser Type and Version
  const userAgent = navigator.userAgent
  const isChrome = userAgent.includes('Chrome') && !userAgent.includes('Edg')
  const isEdge = userAgent.includes('Edg')
  const isFirefox = userAgent.includes('Firefox')
  const isSafari = userAgent.includes('Safari') && !userAgent.includes('Chrome')

  results.push({
    feature: 'Supported Browser',
    available: isChrome || isEdge,
    error: (!isChrome && !isEdge) ? 
      `ContextMax works best in Chrome or Edge. Current browser: ${
        isFirefox ? 'Firefox' : isSafari ? 'Safari' : 'Unknown'
      }` : undefined
  })

  return results
}

export function getHealthCheckSummary(results: HealthCheckResult[]): {
  allPassed: boolean
  criticalPassed: boolean
  warnings: string[]
  errors: string[]
} {
  const critical = ['File System Access API', 'Origin Private File System (OPFS)', 'IndexedDB']
  const errors: string[] = []
  const warnings: string[] = []

  results.forEach(result => {
    if (!result.available) {
      const message = `${result.feature}: ${result.error || 'Not available'}`
      if (critical.includes(result.feature)) {
        errors.push(message)
      } else {
        warnings.push(message)
      }
    }
  })

  return {
    allPassed: results.every(r => r.available),
    criticalPassed: results
      .filter(r => critical.includes(r.feature))
      .every(r => r.available),
    warnings,
    errors
  }
}