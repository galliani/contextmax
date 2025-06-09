/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */
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