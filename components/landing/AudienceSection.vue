<template>
  <!-- Who Is It For Section -->
  <section id="audience" class="py-20 bg-gradient-to-b from-background to-muted/10">
    <div class="container-smart">
      <div class="max-w-5xl mx-auto text-center space-y-12">
        <div class="space-y-6">
          <div class="inline-flex items-center gap-2 px-4 py-2 bg-purple-100 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300 rounded-full text-sm font-medium">
            <Icon name="lucide:users" class="w-4 h-4" />
            Who It's For
          </div>
          <h2 class="text-3xl sm:text-4xl lg:text-5xl font-bold text-foreground leading-tight">
            Empowering <span class="text-purple-600">Experts</span>, 
            Boosting <span class="text-purple-600">Teams</span>
          </h2>
          <p class="text-xl text-muted-foreground leading-relaxed max-w-3xl mx-auto">
            contextMax is ideal for technical leaders who want to amplify their expertise
          </p>
        </div>
        
        <div class="grid gap-8 lg:grid-cols-2 text-left">
          <div class="group p-10 bg-gradient-to-br from-card to-muted/20 rounded-3xl border-2 hover:border-purple-300 hover:shadow-2xl transition-all duration-500">
            <div class="flex items-start gap-6">
              <div class="w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform duration-300">
                <Icon name="lucide:code" class="w-8 h-8 text-white" />
              </div>
              <div class="space-y-4">
                <h3 class="text-2xl font-bold">Senior Software Engineers & Technical Leads</h3>
                <p class="text-muted-foreground leading-relaxed text-lg">
                  Deepen the capabilities of your AI assistants and efficiently share your project expertise with your team. 
                  Transform years of domain knowledge into actionable AI context.
                </p>
                <div class="flex flex-wrap gap-2 pt-2">
                  <span class="px-3 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-full text-sm">Architecture Knowledge</span>
                  <span class="px-3 py-1 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded-full text-sm">Code Patterns</span>
                  <span class="px-3 py-1 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 rounded-full text-sm">Best Practices</span>
                </div>
              </div>
            </div>
          </div>
          
          <div class="group p-10 bg-gradient-to-br from-card to-muted/20 rounded-3xl border-2 hover:border-purple-300 hover:shadow-2xl transition-all duration-500">
            <div class="flex items-start gap-6">
              <div class="w-16 h-16 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-2xl flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform duration-300">
                <Icon name="lucide:users" class="w-8 h-8 text-white" />
              </div>
              <div class="space-y-4">
                <h3 class="text-2xl font-bold">Engineering Managers & CTOs</h3>
                <p class="text-muted-foreground leading-relaxed text-lg">
                  Enhance team productivity, ensure higher code quality with AI adoption, and streamline the onboarding 
                  process for complex systems across your organization.
                </p>
                <div class="flex flex-wrap gap-2 pt-2">
                  <span class="px-3 py-1 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 rounded-full text-sm">Team Productivity</span>
                  <span class="px-3 py-1 bg-teal-100 dark:bg-teal-900/30 text-teal-700 dark:text-teal-300 rounded-full text-sm">Quality Assurance</span>
                  <span class="px-3 py-1 bg-cyan-100 dark:bg-cyan-900/30 text-cyan-700 dark:text-cyan-300 rounded-full text-sm">Knowledge Transfer</span>
                </div>
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