<template>
  <!-- Secondary Call to Action Section -->
  <section id="cta" class="py-20 bg-gradient-to-br from-primary/5 via-secondary/5 to-primary/5">
    <div class="container-smart">
      <div class="max-w-4xl mx-auto text-center space-y-10">
        <div class="space-y-6">
          <h2 class="text-3xl sm:text-4xl lg:text-5xl font-bold text-foreground leading-tight">
            Ready to Make Your AI an 
            <span class="text-primary">Expert</span> on Your Code?
          </h2>
          <p class="text-2xl text-muted-foreground leading-relaxed font-medium">
            Stop the frustration. Start getting truly intelligent assistance.
          </p>
        </div>
        
        <div class="space-y-6">
          <div class="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <Button
              @click="onTryNow"
              class="group relative text-xl px-12 py-6 bg-gradient-to-r from-primary to-secondary hover:from-primary/90 hover:to-secondary/90 text-white shadow-2xl hover:shadow-3xl transform hover:scale-105 transition-all duration-300 font-bold rounded-2xl"
              size="lg"
            >
              <div class="relative flex items-center">
                <Icon name="lucide:rocket" class="w-7 h-7 mr-4 group-hover:animate-pulse" />
                Try contextMax Now
                <Icon name="lucide:arrow-right" class="w-6 h-6 ml-3 group-hover:translate-x-1 transition-transform duration-300" />
              </div>
            </Button>
          </div>
          
          <div class="flex flex-wrap justify-center items-center gap-8 text-sm text-muted-foreground">
            <div class="flex items-center gap-2">
              <Icon name="lucide:check-circle" class="w-5 h-5 text-green-500" />
              <span class="font-medium">100% Free Forever</span>
            </div>
            <div class="flex items-center gap-2">
              <Icon name="lucide:shield" class="w-5 h-5 text-blue-500" />
              <span class="font-medium">Secure & Private</span>
            </div>
            <div class="flex items-center gap-2">
              <Icon name="lucide:zap" class="w-5 h-5 text-yellow-500" />
              <span class="font-medium">Instant Setup</span>
            </div>
          </div>
          
          <p class="text-lg text-muted-foreground italic">
            "Your expertise, amplified. Your code, secured. Your AI, finally intelligent."
          </p>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
interface Emits {
  (e: 'scroll-to-top'): void
}

const emit = defineEmits<Emits>()

// Analytics helpers - use the composable directly
const { trackCTAClick, trackLandingPageSection } = useAnalyticsHelpers()

function onTryNow() {
  // Track the secondary CTA click
  trackCTAClick('secondary_cta')
  emit('scroll-to-top')
}

// Track when CTA section comes into view
onMounted(() => {
  if (import.meta.client) {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            trackLandingPageSection('cta')
            observer.disconnect() // Only track once
          }
        })
      },
      { threshold: 0.5 }
    )

    const ctaElement = document.querySelector('#cta')
    if (ctaElement) {
      observer.observe(ctaElement)
    }
  }
})
</script> 