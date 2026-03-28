<script setup lang="ts">
import { ref } from "vue";
import JsonViewer from "@/components/ui/JsonViewer.vue";
import workflowJson from "@/data/workflow-showcase.json";
import { Cpu, Loader2 } from "lucide-vue-next";

const isGenerating = ref(false);
const showJson = ref(false);
const hasStarted = ref(false);

const startGeneration = () => {
  hasStarted.value = true;
  isGenerating.value = true;

  // Simulate generation time
  setTimeout(() => {
    isGenerating.value = false;
    showJson.value = true;
  }, 2500);
};
</script>

<template>
  <div class="relative h-80 flex flex-col">
    <!-- Initial State: Call to Action -->
    <div
      v-if="!hasStarted"
      class="h-full flex flex-col items-center justify-center text-center p-4"
    >
      <button
        @click="startGeneration"
        class="group relative px-6 py-3 bg-primary-container text-white rounded-xl font-bold uppercase tracking-widest text-xs transition-all hover:bg-inverse-primary hover:-translate-y-0.5 active:scale-95 shadow-xl shadow-primary-container/20"
      >
        <div class="flex items-center gap-3">
          <Cpu class="size-4 group-hover:rotate-12 transition-transform" />
          <span>Generate Blueprint</span>
        </div>
      </button>
      <p class="mt-4 text-[10px] text-on-surface-variant uppercase tracking-[0.2em] opacity-50">
        Click to see the AI in action
      </p>
    </div>

    <!-- Generating State -->
    <div
      v-if="isGenerating"
      class="space-y-4 h-full flex flex-col justify-center animate-in fade-in duration-500"
    >
      <div class="flex items-center gap-3 mb-2">
        <Loader2 class="size-4 text-primary animate-spin" />
        <span class="text-xs font-bold uppercase tracking-[0.2em] text-primary/80"
          >AI Architect is thinking...</span
        >
      </div>
      <div class="space-y-2 opacity-50">
        <div class="h-4 bg-surface-container-highest rounded-full w-3/4 animate-pulse"></div>
        <div
          class="h-4 bg-surface-container-highest rounded-full w-1/2 animate-pulse [animation-delay:0.2s]"
        ></div>
        <div
          class="h-4 bg-surface-container-highest rounded-full w-2/3 animate-pulse [animation-delay:0.4s]"
        ></div>
        <div
          class="h-4 bg-surface-container-highest rounded-full w-1/3 animate-pulse [animation-delay:0.6s]"
        ></div>
      </div>
    </div>

    <!-- Final State: JSON Result -->
    <Transition
      enter-active-class="transition duration-700 ease-out"
      enter-from-class="opacity-0 translate-y-4 scale-95"
      enter-to-class="opacity-100 translate-y-0 scale-100"
    >
      <div v-if="showJson" class="h-full flex flex-col">
        <div
          class="flex items-center justify-between mb-4 pb-2 border-b border-outline-variant/10 shrink-0"
        >
          <span class="text-[10px] font-bold uppercase tracking-widest text-primary/60"
            >Blueprint Generated</span
          >
          <button
            @click="
              hasStarted = false;
              showJson = false;
            "
            class="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant hover:text-on-surface transition-colors"
          >
            Reset
          </button>
        </div>
        <JsonViewer :data="workflowJson" class="bg-transparent border-none p-0 flex-1 min-h-0" />
      </div>
    </Transition>

    <div v-if="isGenerating" class="absolute bottom-0 right-0">
      <span class="text-primary-container font-mono text-[10px] animate-pulse">
        // architecting_solution...
      </span>
    </div>
  </div>
</template>
