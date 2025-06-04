<template>
  <!-- Solution Section -->
  <section id="solution" class="py-20 bg-gradient-to-b from-muted/10 to-background">
    <div class="container-smart">
      <div class="max-w-5xl mx-auto text-center space-y-12">
        <div class="space-y-6">
          <div class="inline-flex items-center gap-2 px-4 py-2 bg-primary/10 text-primary rounded-full text-sm font-medium">
            <Icon name="lucide:lightbulb" class="w-4 h-4" />
            The Solution
          </div>
          <h2 class="text-3xl sm:text-4xl lg:text-5xl font-bold text-foreground leading-tight">
            You Define Exactly What Your AI Sees. 
            <span class="text-primary">Unlock True AI Potential.</span>
          </h2>
        </div>
        
        <div class="space-y-8 text-left">
          <div class="max-w-3xl mx-auto">
            <p class="text-xl text-muted-foreground leading-relaxed text-center mb-12">
              contextMax puts your project experts in control. Our free, browser-based tool allows your most knowledgeable developers to easily create 
              <strong class="text-primary">"Context Sets"</strong>—precise instruction packets for AI assistants.
            </p>
          </div>
          
          <div class="grid gap-8 lg:grid-cols-3">
            <div class="group p-8 bg-card rounded-2xl border shadow-lg hover:shadow-xl hover:border-primary/50 transition-all duration-300">
              <div class="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300">
                <Icon name="lucide:target" class="w-6 h-6 text-primary" />
              </div>
              <h3 class="text-xl font-semibold mb-4">Pinpoint Critical Code</h3>
              <p class="text-muted-foreground leading-relaxed">
                Visually select specific files, functions, or even exact lines relevant to any task. No more guesswork about what's important.
              </p>
            </div>
            
            <div class="group p-8 bg-card rounded-2xl border shadow-lg hover:shadow-xl hover:border-primary/50 transition-all duration-300">
              <div class="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300">
                <Icon name="lucide:workflow" class="w-6 h-6 text-primary" />
              </div>
              <h3 class="text-xl font-semibold mb-4">Explain Key Workflows</h3>
              <p class="text-muted-foreground leading-relaxed">
                Clearly map out how different parts of your software interact for specific features like "User Login Flow" or "Payment Processing."
              </p>
            </div>
            
            <div class="group p-8 bg-card rounded-2xl border shadow-lg hover:shadow-xl hover:border-primary/50 transition-all duration-300">
              <div class="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300">
                <Icon name="lucide:package" class="w-6 h-6 text-primary" />
              </div>
              <h3 class="text-xl font-semibold mb-4">Package & Share Expertise</h3>
              <p class="text-muted-foreground leading-relaxed">
                Save these "Context Sets" as a simple context-sets.json file, making expert knowledge accessible to your whole team.
              </p>
            </div>
          </div>
          
          <div class="max-w-4xl mx-auto p-8 bg-gradient-to-r from-primary/5 via-secondary/5 to-primary/5 border border-primary/20 rounded-2xl backdrop-blur-sm">
            <div class="text-center">
              <Icon name="lucide:zap" class="w-12 h-12 mx-auto text-primary mb-4" />
              <p class="text-xl font-medium text-foreground leading-relaxed">
                By providing this curated, structured information, your AI assistant transforms from a generalist into a 
                <strong class="text-primary">specialized, highly effective partner</strong> for your unique codebase.
              </p>
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