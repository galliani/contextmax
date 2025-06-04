<template>
  <!-- Benefits Section -->
  <section id="benefits" class="py-20 bg-gradient-to-b from-muted/10 to-background">
    <div class="container-smart">
      <div class="max-w-6xl mx-auto text-center space-y-12">
        <div class="space-y-6">
          <div class="inline-flex items-center gap-2 px-4 py-2 bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-300 rounded-full text-sm font-medium">
            <Icon name="lucide:trending-up" class="w-4 h-4" />
            Benefits
          </div>
          <h2 class="text-3xl sm:text-4xl lg:text-5xl font-bold text-foreground leading-tight">
            Elevate Your Development with AI That 
            <span class="text-green-600">Truly Understands</span>
          </h2>
          <p class="text-xl text-muted-foreground leading-relaxed max-w-3xl mx-auto">
            When your AI has the right map, it navigates your code with precision. Here's how your team benefits:
          </p>
        </div>
        
        <!-- Balanced Benefits Grid -->
        <div class="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          <!-- Primary Benefit - spans full row on larger screens -->
          <div class="lg:col-span-3 p-8 bg-gradient-to-br from-emerald-500 to-teal-600 text-white rounded-2xl shadow-2xl">
            <div class="text-center space-y-4">
              <div class="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center mx-auto">
                <span class="text-3xl">✨</span>
              </div>
              <h3 class="text-2xl font-bold">Dramatically More Accurate AI</h3>
              <p class="text-emerald-100 leading-relaxed max-w-2xl mx-auto">
                Get suggestions and code generation that are highly relevant and correct for your specific project, not generic templates.
              </p>
            </div>
          </div>
          
          <!-- Secondary Benefits Grid -->
          <div class="p-6 bg-card rounded-2xl border hover:shadow-lg transition-all duration-300">
            <div class="flex items-start gap-4">
              <span class="text-3xl flex-shrink-0">🎯</span>
              <div>
                <h3 class="text-lg font-semibold mb-2">Pinpoint Developer Control</h3>
                <p class="text-muted-foreground text-sm">
                  You decide exactly what context the AI uses, down to specific lines and workflows.
                </p>
              </div>
            </div>
          </div>
          
          <div class="p-6 bg-card rounded-2xl border hover:shadow-lg transition-all duration-300">
            <div class="flex items-start gap-4">
              <span class="text-3xl flex-shrink-0">⏱️</span>
              <div>
                <h3 class="text-lg font-semibold mb-2">Slash Development Time</h3>
                <p class="text-muted-foreground text-sm">
                  Reduce hours spent manually guiding, correcting, or re-explaining complex code.
                </p>
              </div>
            </div>
          </div>
          
          <div class="p-6 bg-card rounded-2xl border hover:shadow-lg transition-all duration-300">
            <div class="flex items-start gap-4">
              <span class="text-3xl flex-shrink-0">🚀</span>
              <div>
                <h3 class="text-lg font-semibold mb-2">Accelerate Team Onboarding</h3>
                <p class="text-muted-foreground text-sm">
                  New developers (and your AI!) grasp complex features faster using expert-defined Context Sets.
                </p>
              </div>
            </div>
          </div>
          
          <div class="p-6 bg-card rounded-2xl border hover:shadow-lg transition-all duration-300">
            <div class="flex items-start gap-4">
              <span class="text-3xl flex-shrink-0">🔒</span>
              <div>
                <h3 class="text-lg font-semibold mb-2">Maintain Code Consistency & Quality</h3>
                <p class="text-muted-foreground text-sm">
                  Ensure AI-assisted coding aligns with your project's established architecture.
                </p>
              </div>
            </div>
          </div>
          
          <div class="p-6 bg-card rounded-2xl border hover:shadow-lg transition-all duration-300">
            <div class="flex items-start gap-4">
              <span class="text-3xl flex-shrink-0">🧠</span>
              <div>
                <h3 class="text-lg font-semibold mb-2">Capture & Scale Expert Knowledge</h3>
                <p class="text-muted-foreground text-sm">
                  Preserve invaluable codebase insights from senior developers in a reusable format.
                </p>
              </div>
            </div>
          </div>
          
          <div class="p-6 bg-card rounded-2xl border hover:shadow-lg transition-all duration-300">
            <div class="flex items-start gap-4">
              <span class="text-3xl flex-shrink-0">🛡️</span>
              <div>
                <h3 class="text-lg font-semibold mb-2">Work Securely & Freely</h3>
                <p class="text-muted-foreground text-sm">
                  Instantly accessible in your browser, costs nothing, keeps your code safe locally.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
// This component has no props or emits - it's purely presentational
</script> 