import { posthog } from 'posthog-js'

export interface AnalyticsEvent {
  name: string
  properties?: Record<string, any>
}

export interface AnalyticsPageView {
  url?: string
  title?: string
  referrer?: string
}

export const useAnalytics = () => {
  const config = useRuntimeConfig()
  
  // Initialize analytics services
  const initializeAnalytics = () => {
    if (!import.meta.client) return
    
    // Initialize PostHog
    if (config.public.posthogPublicKey) {
      try {
        posthog.init(config.public.posthogPublicKey, {
          api_host: config.public.posthogHost,
          person_profiles: 'always',
          capture_pageview: false, // We'll handle page views manually
          capture_pageleave: true,
          cross_subdomain_cookie: false,
          secure_cookie: true,
          // Privacy settings
          opt_out_capturing_by_default: false,
          respect_dnt: true,
        })
        
        console.log('PostHog initialized successfully')
      } catch (error) {
        console.error('Failed to initialize PostHog:', error)
      }
    }
    
    // Initialize Umami (via script injection)
    if (config.public.umamiUrl && config.public.umamiWebsiteId) {
      try {
        // Check if Umami script is already loaded
        if (!document.querySelector('[data-website-id]')) {
          const script = document.createElement('script')
          script.defer = true
          script.src = config.public.umamiUrl
          script.setAttribute('data-website-id', config.public.umamiWebsiteId)
          script.setAttribute('data-auto-track', 'false') // We'll handle tracking manually
          document.head.appendChild(script)
          
          console.log('Umami script injected successfully')
        }
      } catch (error) {
        console.error('Failed to initialize Umami:', error)
      }
    }
  }
  
  // Track page views
  const trackPageView = (data?: AnalyticsPageView) => {
    if (!import.meta.client) return
    
    const pageData = {
      url: data?.url || window.location.pathname,
      title: data?.title || document.title,
      referrer: data?.referrer || document.referrer,
    }
    
    // PostHog page view
    if (config.public.posthogPublicKey && posthog) {
      try {
        posthog.capture('$pageview', {
          $current_url: pageData.url,
          $title: pageData.title,
          $referrer: pageData.referrer,
        })
      } catch (error) {
        console.error('PostHog page view tracking failed:', error)
      }
    }
    
    // Umami page view
    if (config.public.umamiUrl && config.public.umamiWebsiteId) {
      try {
        // Check if umami function is available
        if (typeof (window as any).umami !== 'undefined') {
          (window as any).umami.track(pageData.url)
        }
      } catch (error) {
        console.error('Umami page view tracking failed:', error)
      }
    }
  }
  
  // Track custom events
  const trackEvent = (event: AnalyticsEvent) => {
    if (!import.meta.client) return
    
    // PostHog event tracking
    if (config.public.posthogPublicKey && posthog) {
      try {
        posthog.capture(event.name, event.properties)
      } catch (error) {
        console.error('PostHog event tracking failed:', error)
      }
    }
    
    // Umami event tracking
    if (config.public.umamiUrl && config.public.umamiWebsiteId) {
      try {
        if (typeof (window as any).umami !== 'undefined') {
          (window as any).umami.track(event.name, event.properties)
        }
      } catch (error) {
        console.error('Umami event tracking failed:', error)
      }
    }
  }
  
  // Identify user (mainly for PostHog)
  const identifyUser = (userId: string, traits?: Record<string, any>) => {
    if (!import.meta.client) return
    
    if (config.public.posthogPublicKey && posthog) {
      try {
        posthog.identify(userId, traits)
      } catch (error) {
        console.error('PostHog user identification failed:', error)
      }
    }
  }
  
  // Reset user session
  const resetUser = () => {
    if (!import.meta.client) return
    
    if (config.public.posthogPublicKey && posthog) {
      try {
        posthog.reset()
      } catch (error) {
        console.error('PostHog user reset failed:', error)
      }
    }
  }
  
  // Set user properties
  const setUserProperties = (properties: Record<string, any>) => {
    if (!import.meta.client) return
    
    if (config.public.posthogPublicKey && posthog) {
      try {
        posthog.people.set(properties)
      } catch (error) {
        console.error('PostHog set user properties failed:', error)
      }
    }
  }
  
  // Opt out of tracking
  const optOut = () => {
    if (!import.meta.client) return
    
    if (config.public.posthogPublicKey && posthog) {
      try {
        posthog.opt_out_capturing()
      } catch (error) {
        console.error('PostHog opt out failed:', error)
      }
    }
  }
  
  // Opt in to tracking
  const optIn = () => {
    if (!import.meta.client) return
    
    if (config.public.posthogPublicKey && posthog) {
      try {
        posthog.opt_in_capturing()
      } catch (error) {
        console.error('PostHog opt in failed:', error)
      }
    }
  }
  
  return {
    initializeAnalytics,
    trackPageView,
    trackEvent,
    identifyUser,
    resetUser,
    setUserProperties,
    optOut,
    optIn,
  }
}

// Helper functions for common events
export const useAnalyticsHelpers = () => {
  const { trackEvent } = useAnalytics()
  
  const trackProjectSelection = () => {
    trackEvent({
      name: 'project_selected',
      properties: {
        category: 'user_action',
        action: 'select_project'
      }
    })
  }
  
  const trackContextSetCreated = (contextSetName: string) => {
    trackEvent({
      name: 'context_set_created',
      properties: {
        category: 'user_action',
        action: 'create_context_set',
        context_set_name: contextSetName
      }
    })
  }
  
  const trackFileAdded = (fileName: string) => {
    trackEvent({
      name: 'file_added_to_manifest',
      properties: {
        category: 'user_action',
        action: 'add_file',
        file_name: fileName
      }
    })
  }
  
  const trackDownload = (downloadType: 'context_sets' | 'file_content') => {
    trackEvent({
      name: 'download_initiated',
      properties: {
        category: 'user_action',
        action: 'download',
        download_type: downloadType
      }
    })
  }
  
  const trackCTAClick = (ctaLocation: string) => {
    trackEvent({
      name: 'cta_clicked',
      properties: {
        category: 'conversion',
        action: 'cta_click',
        cta_location: ctaLocation
      }
    })
  }
  
  const trackLandingPageSection = (section: string) => {
    trackEvent({
      name: 'landing_section_viewed',
      properties: {
        category: 'engagement',
        action: 'section_view',
        section: section
      }
    })
  }
  
  const trackNavigation = (from: string, to: string) => {
    trackEvent({
      name: 'navigation',
      properties: {
        category: 'user_action',
        action: 'navigate',
        from_view: from,
        to_view: to
      }
    })
  }
  
  const trackDataRestored = (projectName: string | null) => {
    trackEvent({
      name: 'data_restored',
      properties: {
        category: 'user_action',
        action: 'restore_data',
        has_project_name: !!projectName
      }
    })
  }
  
  const trackProjectRestored = (projectName: string) => {
    trackEvent({
      name: 'project_reconnected',
      properties: {
        category: 'user_action',
        action: 'reconnect_project',
        project_name: projectName
      }
    })
  }
  
  return {
    trackProjectSelection,
    trackContextSetCreated,
    trackFileAdded,
    trackDownload,
    trackCTAClick,
    trackLandingPageSection,
    trackNavigation,
    trackDataRestored,
    trackProjectRestored,
    trackEvent,
  }
} 