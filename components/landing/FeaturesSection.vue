<template>
  <!-- How It Works/Features Section -->
  <section id="features" class="py-20 bg-gradient-to-b from-background to-muted/10">
    <div class="container-smart">
      <div class="max-w-5xl mx-auto text-center space-y-12">
        <div class="space-y-6">
          <div class="inline-flex items-center gap-2 px-4 py-2 bg-secondary/10 text-secondary rounded-full text-sm font-medium">
            <Icon name="lucide:settings" class="w-4 h-4" />
            How It Works
          </div>
          <h2 class="text-3xl sm:text-4xl lg:text-5xl font-bold text-foreground leading-tight">
            Simple to Use, 
            <span class="text-secondary">Powerful in Effect</span>
          </h2>
          <p class="text-xl text-muted-foreground leading-relaxed max-w-3xl mx-auto">
            contextMax is designed for efficiency and ease
          </p>
        </div>
        
        <!-- Process Flow Visualization -->
        <div class="relative max-w-4xl mx-auto mb-16">
          <div class="grid gap-8 md:grid-cols-4">
            <div class="relative text-center">
              <div class="w-16 h-16 bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl flex items-center justify-center mb-4 mx-auto shadow-lg">
                <span class="text-white font-bold text-xl">1</span>
              </div>
              <h3 class="font-semibold mb-2">Browse Code</h3>
              <p class="text-sm text-muted-foreground">Navigate your project structure</p>
              {/* Arrow for desktop */}
              <div class="hidden md:block absolute top-8 -right-4 w-8 h-0.5 bg-gradient-to-r from-blue-500 to-indigo-500"></div>
              <Icon name="lucide:arrow-right" class="hidden md:block absolute top-6 -right-1 w-4 h-4 text-indigo-500" />
            </div>
            
            <div class="relative text-center">
              <div class="w-16 h-16 bg-gradient-to-br from-indigo-500 to-indigo-600 rounded-2xl flex items-center justify-center mb-4 mx-auto shadow-lg">
                <span class="text-white font-bold text-xl">2</span>
              </div>
              <h3 class="font-semibold mb-2">Select Snippets</h3>
              <p class="text-sm text-muted-foreground">Choose relevant code sections</p>
              <div class="hidden md:block absolute top-8 -right-4 w-8 h-0.5 bg-gradient-to-r from-indigo-500 to-purple-500"></div>
              <Icon name="lucide:arrow-right" class="hidden md:block absolute top-6 -right-1 w-4 h-4 text-purple-500" />
            </div>
            
            <div class="relative text-center">
              <div class="w-16 h-16 bg-gradient-to-br from-purple-500 to-purple-600 rounded-2xl flex items-center justify-center mb-4 mx-auto shadow-lg">
                <span class="text-white font-bold text-xl">3</span>
              </div>
              <h3 class="font-semibold mb-2">Create Context Set</h3>
              <p class="text-sm text-muted-foreground">Name and organize selections</p>
              <div class="hidden md:block absolute top-8 -right-4 w-8 h-0.5 bg-gradient-to-r from-purple-500 to-pink-500"></div>
              <Icon name="lucide:arrow-right" class="hidden md:block absolute top-6 -right-1 w-4 h-4 text-pink-500" />
            </div>
            
            <div class="text-center">
              <div class="w-16 h-16 bg-gradient-to-br from-pink-500 to-pink-600 rounded-2xl flex items-center justify-center mb-4 mx-auto shadow-lg">
                <span class="text-white font-bold text-xl">4</span>
              </div>
              <h3 class="font-semibold mb-2">Export & Share</h3>
              <p class="text-sm text-muted-foreground">Generate context-sets.json</p>
            </div>
          </div>
        </div>
        
        <!-- Feature Grid -->
        <div class="grid gap-8 lg:grid-cols-2 text-left">
          <div class="group p-8 bg-card rounded-2xl border hover:border-secondary/50 hover:shadow-2xl transition-all duration-300">
            <div class="flex items-start gap-4">
              <div class="w-12 h-12 bg-secondary/10 rounded-xl flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform duration-300">
                <Icon name="lucide:mouse-pointer-click" class="w-6 h-6 text-secondary" />
              </div>
              <div>
                <h3 class="text-xl font-semibold mb-3">Visually Select Key Code</h3>
                <p class="text-muted-foreground leading-relaxed">
                  Intuitively browse your project's codebase (which stays securely on your computer) and highlight the most relevant snippets with precision.
                </p>
              </div>
            </div>
          </div>
          
          <div class="group p-8 bg-card rounded-2xl border hover:border-secondary/50 hover:shadow-2xl transition-all duration-300">
            <div class="flex items-start gap-4">
              <div class="w-12 h-12 bg-secondary/10 rounded-xl flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform duration-300">
                <Icon name="lucide:layers" class="w-6 h-6 text-secondary" />
              </div>
              <div>
                <h3 class="text-xl font-semibold mb-3">Create Named "Context Sets"</h3>
                <p class="text-muted-foreground leading-relaxed">
                  Group your selections and workflow descriptions into clear, reusable packets like "User Authentication Module" or "API Endpoint Details."
                </p>
              </div>
            </div>
          </div>
          
          <div class="group p-8 bg-card rounded-2xl border hover:border-secondary/50 hover:shadow-2xl transition-all duration-300">
            <div class="flex items-start gap-4">
              <div class="w-12 h-12 bg-secondary/10 rounded-xl flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform duration-300">
                <Icon name="lucide:git-branch" class="w-6 h-6 text-secondary" />
              </div>
              <div>
                <h3 class="text-xl font-semibold mb-3">Define Interconnected Workflows</h3>
                <p class="text-muted-foreground leading-relaxed">
                  Easily map out related sequences of operations within the code to give AI a complete picture of your system's behavior.
                </p>
              </div>
            </div>
          </div>
          
          <div class="group p-8 bg-card rounded-2xl border hover:border-secondary/50 hover:shadow-2xl transition-all duration-300">
            <div class="flex items-start gap-4">
              <div class="w-12 h-12 bg-secondary/10 rounded-xl flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform duration-300">
                <Icon name="lucide:share" class="w-6 h-6 text-secondary" />
              </div>
              <div>
                <h3 class="text-xl font-semibold mb-3">Export & Share with Your Team</h3>
                <p class="text-muted-foreground leading-relaxed">
                  Save definitions to a context-sets.json file that becomes part of your project, usable by any developer and their preferred AI assistant.
                </p>
              </div>
          </div>
        </div>
      </div>
      
        <!-- Key Benefits Row -->
        <div class="grid gap-6 md:grid-cols-2 mt-16">
          <div class="p-6 bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 rounded-2xl border border-green-200 dark:border-green-800">
            <div class="flex items-center gap-3 mb-3">
              <Icon name="lucide:globe" class="w-6 h-6 text-green-600" />
              <h3 class="font-semibold text-green-800 dark:text-green-200">Always Free & Browser-Based</h3>
            </div>
            <p class="text-green-700 dark:text-green-300 text-sm">
              Instantly usable with no installation or server-side processing of your code.
            </p>
          </div>
          
          <div class="p-6 bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-blue-900/20 dark:to-cyan-900/20 rounded-2xl border border-blue-200 dark:border-blue-800">
            <div class="flex items-center gap-3 mb-3">
              <Icon name="lucide:shield-check" class="w-6 h-6 text-blue-600" />
              <h3 class="font-semibold text-blue-800 dark:text-blue-200">Privacy First</h3>
            </div>
            <p class="text-blue-700 dark:text-blue-300 text-sm">
              Your code never leaves your local machine. We don't see it, store it, or share it. Period.
            </p>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
// This component has no props or emits - it's purely presentational
</script> 