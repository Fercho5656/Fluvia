<script setup lang="ts">
import { ref } from "vue";
import JsonViewer from "@/components/ui/JsonViewer.vue";
import workflowJson from "@/data/workflow-showcase.json";
import { Cpu, Loader2, RotateCcw, LayoutDashboard, FileCode, Sparkles } from "lucide-vue-next";
import Button from "@/components/ui/Button.vue";
import WorkflowVisualizer from "./WorkflowVisualizer.vue";
import { cn } from "@/lib/utils";

const isGenerating = ref(false);
const showResult = ref(false);
const hasStarted = ref(false);
const viewMode = ref<"visual" | "json">("visual");

const startGeneration = () => {
  hasStarted.value = true;
  isGenerating.value = true;

  // Simulate generation time
  setTimeout(() => {
    isGenerating.value = false;
    showResult.value = true;
  }, 2500);
};

const reset = () => {
  hasStarted.value = false;
  showResult.value = false;
  viewMode.value = "visual";
};
</script>

<template>
  <div
    class="relative flex-1 flex flex-col bg-surface-container-low/50 border border-outline-variant/20 rounded-3xl overflow-hidden shadow-2xl"
  >
    <!-- Initial State: Call to Action -->
    <div
      v-if="!hasStarted"
      class="h-full flex flex-col items-center justify-center text-center p-8 relative overflow-hidden"
    >
      <!-- Background Glow -->
      <div class="absolute inset-0 bg-primary/5 blur-[100px] rounded-full"></div>

      <div class="relative z-10 space-y-6 max-w-md">
        <div
          class="bg-primary/10 size-20 rounded-3xl flex items-center justify-center mx-auto border border-primary/20 animate-pulse"
        >
          <Sparkles class="size-10 text-primary" />
        </div>
        <div class="space-y-2">
          <h3 class="text-2xl font-bold text-white font-headline">AI Workflow Architect</h3>
          <p class="text-sm text-on-surface/40 leading-relaxed">
            Translate simple business requirements into n8n automation blueprints in minutes
            (sometimes seconds).
          </p>
          <p class="text-sm text-primary-container leading-relaxed">
            "Connect Shopify to Google Sheets and send a Slack notification whenever an order over
            $100 is placed."
          </p>
        </div>
        <Button @click="startGeneration" variant="primary" size="lg" class="group">
          <Cpu class="size-4 mr-3 group-hover:rotate-12 transition-transform" />
          Test Engine Response
        </Button>
        <p class="text-[10px] uppercase tracking-[0.3em] text-on-surface/30 font-bold">
          Free Instant Preview
        </p>
        <small class="text-[10px] uppercase tracking-[0.3em] text-on-surface/50 font-bold">
          * Demo example, no real-time AI generation.<br />
          Pre-generated results for showcase purposes.
        </small>
      </div>
    </div>

    <!-- Generating State -->
    <div
      v-if="isGenerating"
      class="h-full flex flex-col items-center justify-center p-12 bg-black/40 backdrop-blur-xl"
    >
      <div class="flex flex-col items-center gap-6">
        <div class="relative">
          <div class="absolute inset-0 bg-primary/20 blur-2xl rounded-full animate-pulse"></div>
          <Loader2 class="size-16 text-primary animate-spin relative z-10" />
        </div>
        <div class="text-center space-y-2">
          <span class="text-xs font-bold uppercase tracking-[0.3em] text-primary"
            >Synthesizing Architecture</span
          >
          <div class="flex gap-1.5 justify-center">
            <div class="h-1 w-8 bg-primary/40 rounded-full overflow-hidden">
              <div class="h-full bg-primary animate-[shimmer_1.5s_infinite]"></div>
            </div>
            <div class="h-1 w-12 bg-primary/40 rounded-full overflow-hidden">
              <div class="h-full bg-primary animate-[shimmer_1.5s_infinite_0.2s]"></div>
            </div>
            <div class="h-1 w-6 bg-primary/40 rounded-full overflow-hidden">
              <div class="h-full bg-primary animate-[shimmer_1.5s_infinite_0.4s]"></div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Result State -->
    <div v-if="showResult" class="h-full flex flex-col">
      <!-- Toolbar -->
      <div
        class="flex items-center justify-between px-6 py-4 border-b border-outline-variant/10 bg-white/[0.02]"
      >
        <div
          class="flex items-center gap-1 bg-surface-container-highest p-1 rounded-full border border-outline-variant/30"
        >
          <Button
            variant="ghost"
            size="sm"
            :class="
              cn(
                '!h-7 !px-3 !text-[10px] !rounded-full transition-all',
                viewMode === 'visual'
                  ? 'bg-primary text-on-primary shadow-lg shadow-primary/20'
                  : 'text-on-surface/40',
              )
            "
            @click="viewMode = 'visual'"
          >
            <LayoutDashboard class="size-3 mr-1.5" />
            Visual
          </Button>
          <Button
            variant="ghost"
            size="sm"
            :class="
              cn(
                '!h-7 !px-3 !text-[10px] !rounded-full transition-all',
                viewMode === 'json'
                  ? 'bg-primary text-on-primary shadow-lg shadow-primary/20'
                  : 'text-on-surface/40',
              )
            "
            @click="viewMode = 'json'"
          >
            <FileCode class="size-3 mr-1.5" />
            JSON
          </Button>
        </div>

        <Button
          @click="reset"
          variant="ghost"
          size="sm"
          class="h-8 !px-3 !text-on-surface/40 hover:!text-on-surface"
        >
          <RotateCcw class="size-3.5 mr-2" />
          Reset Demo
        </Button>
      </div>

      <!-- Viewer Area -->
      <div class="flex-1 min-h-0 relative">
        <WorkflowVisualizer
          v-if="viewMode === 'visual'"
          :nodes="workflowJson.nodes"
          :connections="workflowJson.connections"
        />
        <div v-else class="h-full overflow-auto bg-black/20">
          <JsonViewer :data="workflowJson" class="bg-transparent border-none p-8" />
        </div>
      </div>
    </div>

    <!-- Bottom Status (Only when generating) -->
    <div v-if="isGenerating" class="absolute bottom-4 right-6 pointer-events-none">
      <span class="text-primary/40 font-mono text-[9px] uppercase tracking-widest animate-pulse">
        // pipeline_active: architecture_v2.0
      </span>
    </div>
  </div>
</template>

<style scoped>
@keyframes shimmer {
  0% {
    transform: translateX(-100%);
  }
  100% {
    transform: translateX(100%);
  }
}
</style>
