export default defineNuxtPlugin(() => {
  const { initializeAnalytics, trackPageView } = useAnalytics()
  
  // Initialize analytics services
  initializeAnalytics()
  
  // Track initial page view
  nextTick(() => {
    trackPageView()
  })
  
  // Track page views on route changes
  const router = useRouter()
  router.afterEach((to, from) => {
    // Only track if it's actually a different page
    if (to.path !== from.path) {
      nextTick(() => {
        trackPageView({
          url: to.fullPath,
          title: document.title
        })
      })
    }
  })
}) 