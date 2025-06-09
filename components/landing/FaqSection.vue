/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */
<template>
  <!-- FAQ Section -->
  <section id="faq" class="py-20 bg-gradient-to-b from-background to-muted/10">
    <div class="container-smart">
      <div class="max-w-4xl mx-auto text-center space-y-12">
        <div class="space-y-6">
          <div class="inline-flex items-center gap-2 px-4 py-2 bg-amber-100 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300 rounded-full text-sm font-medium">
            <Icon name="lucide:help-circle" class="w-4 h-4" />
            FAQ
          </div>
          <h2 class="text-3xl sm:text-4xl lg:text-5xl font-bold text-foreground leading-tight">
            Frequently Asked 
            <span class="text-amber-600">Questions</span>
          </h2>
          <p class="text-xl text-muted-foreground leading-relaxed max-w-3xl mx-auto">
            Got questions? We've got answers to help you get started with confidence.
          </p>
        </div>
        
        <!-- FAQ Accordion -->
        <div class="space-y-4 text-left">
          <div 
            v-for="(faq, index) in faqs" 
            :key="index"
            class="group bg-card rounded-2xl border shadow-sm hover:shadow-md transition-all duration-300"
          >
            <button
              @click="toggleFaq(index)"
              class="w-full flex items-start justify-between p-6 text-left focus:outline-none focus:ring-2 focus:ring-primary/20 rounded-2xl"
              :aria-expanded="openFaq === index"
              :aria-controls="`faq-content-${index}`"
            >
              <div class="flex-1 pr-4">
                <h3 class="text-lg font-semibold text-foreground group-hover:text-primary transition-colors duration-200">
                  {{ faq.question }}
                </h3>
              </div>
              <div class="flex-shrink-0">
                <Icon 
                  name="lucide:chevron-down" 
                  :class="[
                    'w-5 h-5 text-muted-foreground transition-transform duration-200',
                    openFaq === index ? 'rotate-180' : ''
                  ]" 
                />
              </div>
            </button>
            
            <div 
              v-show="openFaq === index"
              :id="`faq-content-${index}`"
              class="px-6 pb-6 animate-fadeIn"
            >
              <div class="pt-2 border-t border-muted-foreground/10">
                <p class="text-muted-foreground leading-relaxed whitespace-pre-line">{{ faq.answer }}</p>
              </div>
            </div>
          </div>
        </div>
        
        <!-- Additional Help -->
        <div class="mt-16 p-8 bg-gradient-to-r from-primary/5 via-secondary/5 to-primary/5 border border-primary/20 rounded-2xl backdrop-blur-sm">
          <div class="text-center space-y-4">
            <Icon name="lucide:message-circle" class="w-12 h-12 mx-auto text-primary" />
            <h3 class="text-xl font-bold text-foreground">Still have questions?</h3>
            <p class="text-muted-foreground leading-relaxed max-w-2xl mx-auto">
              We're here to help! Feel free to reach out if you need any clarification or have specific questions about your use case.
            </p>
            <div class="flex flex-wrap justify-center items-center gap-4 pt-4">
              <a 
                href="https://github.com/galliani" 
                target="_blank" 
                rel="noopener noreferrer"
                class="inline-flex items-center gap-2 px-4 py-2 bg-primary/10 hover:bg-primary/20 text-primary rounded-lg transition-colors duration-200"
              >
                <Icon name="lucide:github" class="w-4 h-4" />
                <span class="font-medium">GitHub</span>
              </a>
              <a 
                href="https://51newyork.com" 
                target="_blank" 
                rel="noopener noreferrer"
                class="inline-flex items-center gap-2 px-4 py-2 bg-secondary/10 hover:bg-secondary/20 text-secondary rounded-lg transition-colors duration-200"
              >
                <Icon name="lucide:external-link" class="w-4 h-4" />
                <span class="font-medium">51NewYork</span>
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
interface FAQ {
  question: string
  answer: string
}

interface Props {
  faqs: FAQ[]
}

defineProps<Props>()

// State for accordion
const openFaq = ref<number | null>(null)

function toggleFaq(index: number) {
  openFaq.value = openFaq.value === index ? null : index
}
</script> 