<template>
  <!-- Problem/Challenge Section -->
  <section id="problem" class="py-20 bg-gradient-to-b from-background to-muted/10">
    <div class="container-smart">
      <div class="max-w-5xl mx-auto text-center space-y-12">
        <div class="space-y-6">
          <div class="inline-flex items-center gap-2 px-4 py-2 bg-destructive/10 text-destructive rounded-full text-sm font-medium">
            <Icon name="lucide:alert-circle" class="w-4 h-4" />
            The Problem
          </div>
          <h2 class="text-3xl sm:text-4xl lg:text-5xl font-bold text-foreground leading-tight">
            Is Your AI Assistant 
            <span class="text-destructive">Drowning</span> 
            in Code Complexity?
          </h2>
        </div>
        
        <div class="grid gap-8 md:grid-cols-3 text-left">
          <div class="p-8 bg-card rounded-2xl border shadow-lg hover:shadow-xl transition-all duration-300">
            <div class="w-12 h-12 bg-destructive/10 rounded-xl flex items-center justify-center mb-6">
              <Icon name="lucide:x-circle" class="w-6 h-6 text-destructive" />
            </div>
            <h3 class="text-xl font-semibold mb-4">Generic, Unhelpful Suggestions</h3>
            <p class="text-muted-foreground leading-relaxed">
              AI provides cookie-cutter solutions that don't understand your specific architecture, patterns, or business logic.
            </p>
          </div>
          
          <div class="p-8 bg-card rounded-2xl border shadow-lg hover:shadow-xl transition-all duration-300">
            <div class="w-12 h-12 bg-destructive/10 rounded-xl flex items-center justify-center mb-6">
              <Icon name="lucide:clock" class="w-6 h-6 text-destructive" />
            </div>
            <h3 class="text-xl font-semibold mb-4">Time Wasted Re-explaining</h3>
            <p class="text-muted-foreground leading-relaxed">
              Hours spent providing context, correcting mistakes, and explaining domain-specific requirements over and over.
            </p>
          </div>
          
          <div class="p-8 bg-card rounded-2xl border shadow-lg hover:shadow-xl transition-all duration-300">
            <div class="w-12 h-12 bg-destructive/10 rounded-xl flex items-center justify-center mb-6">
              <Icon name="lucide:frown" class="w-6 h-6 text-destructive" />
            </div>
            <h3 class="text-xl font-semibold mb-4">Frustration Instead of Flow</h3>
            <p class="text-muted-foreground leading-relaxed">
              What should be a productivity boost becomes a source of friction and disappointment.
            </p>
          </div>
        </div>
        
        <div class="max-w-3xl mx-auto p-8 bg-gradient-to-r from-muted/10 to-card border-l-4 border-destructive rounded-r-2xl">
          <p class="text-lg font-medium text-foreground leading-relaxed">
            Your team's valuable time shouldn't be spent hand-holding your AI. You need it to understand the nuances, workflows, and critical segments of your specific project.
          </p>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
// This component has no props or emits - it's purely presentational
</script> 