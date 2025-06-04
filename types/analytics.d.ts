// Global types for analytics services
declare global {
  interface Window {
    umami?: {
      track: (event: string, properties?: Record<string, any>) => void
    }
  }
}

export {} 