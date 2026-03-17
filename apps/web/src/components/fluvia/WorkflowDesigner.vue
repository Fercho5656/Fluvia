<script setup lang="ts">
import { ref, computed } from "vue";
import { orpc } from "../../../lib/orpc";
import {
  Send,
  Terminal,
  CloudUpload,
  Loader2,
  CheckCircle2,
  Cpu,
  RefreshCcw,
  Sparkles,
} from "lucide-vue-next";
import { cn } from "../../../lib/utils";

const props = defineProps<{
  workspaceId: string;
  serverId: string;
}>();

const prompt = ref("");
const isGenerating = ref(false);
const isDeploying = ref(false);
const generatedWorkflow = ref<any>(null);
const deploySuccess = ref(false);

async function generateWorkflow() {
  if (!prompt.value || isGenerating.value) return;

  isGenerating.value = true;
  generatedWorkflow.value = null;
  deploySuccess.value = false;

  try {
    const result = await orpc.fluvia.workflow.generate({
      serverId: props.serverId,
      prompt: prompt.value,
      name: `AI: ${prompt.value.slice(0, 20)}...`,
    });
    generatedWorkflow.value = result;
  } catch (error) {
    console.error("Generation failed:", error);
  } finally {
    isGenerating.value = false;
  }
}

async function deployWorkflow() {
  if (!generatedWorkflow.value || isDeploying.value) return;

  isDeploying.value = true;
  try {
    await orpc.fluvia.workflow.deploy({
      workflowId: generatedWorkflow.value.id,
    });
    deploySuccess.value = true;
  } catch (error) {
    console.error("Deployment failed:", error);
  } finally {
    isDeploying.value = false;
  }
}

// Helper to highlight JSON (Simple for prototype)
function formatJson(json: any) {
  return JSON.stringify(json, null, 2);
}
</script>

<template>
  <div class="h-[calc(100vh-12rem)] flex flex-col gap-6">
    <!-- Breadcrumbs -->
    <div class="flex items-center gap-2 text-sm text-muted-foreground">
      <a href="/fluvia" class="hover:text-white transition-colors">Workspaces</a>
      <span>/</span>
      <span class="text-white font-medium">Designer</span>
    </div>

    <div class="flex-1 flex gap-6 min-h-0">
      <!-- Left: AI Input Panel -->
      <div class="w-1/3 flex flex-col gap-4">
        <div
          class="flex-1 bg-surface-elevated border border-border rounded-2xl p-6 flex flex-col gap-6"
        >
          <div class="space-y-2">
            <div class="bg-primary/10 w-fit p-2 rounded-lg">
              <Sparkles class="size-5 text-primary" />
            </div>
            <h2 class="text-2xl font-bold text-white tracking-tight">AI Workflow Agent</h2>
            <p class="text-sm text-muted-foreground">
              Describe the automation you want to build in plain English. Our agent will translate
              it into a production-ready n8n workflow.
            </p>
          </div>

          <div class="flex-1 flex flex-col gap-4">
            <textarea
              v-model="prompt"
              placeholder="e.g. When a new row is added to my Google Sheet, send a summary message to the #operations Slack channel."
              class="flex-1 bg-black/20 border border-white/10 rounded-xl p-4 text-sm focus:ring-2 focus:ring-primary focus:outline-none resize-none placeholder:text-muted-foreground/50 transition-all"
            ></textarea>

            <button
              @click="generateWorkflow"
              :disabled="isGenerating || !prompt"
              class="bg-primary hover:bg-primary/90 disabled:opacity-50 text-white w-full py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-all shadow-xl shadow-primary/20"
            >
              <Loader2 v-if="isGenerating" class="size-4 animate-spin" />
              <Cpu v-else class="size-4" />
              {{ isGenerating ? "Generating Flow..." : "Generate n8n Workflow" }}
            </button>
          </div>

          <div class="bg-primary/5 rounded-xl p-4 border border-primary/10">
            <h4 class="text-xs font-bold text-primary uppercase tracking-widest mb-2">
              Capabilities
            </h4>
            <ul class="space-y-2">
              <li
                v-for="cap in [
                  'HTTP Request handling',
                  'Database CRUD operations',
                  'Third-party API integrations',
                  'Conditional logic (IF/Else)',
                ]"
                :key="cap"
                class="text-xs text-muted-foreground flex items-center gap-2"
              >
                <div class="size-1 rounded-full bg-primary/40"></div>
                {{ cap }}
              </li>
            </ul>
          </div>
        </div>
      </div>

      <!-- Right: Terminal / JSON View -->
      <div class="flex-1 flex flex-col gap-4 min-w-0">
        <div
          class="flex-1 bg-surface-elevated border border-border rounded-2xl overflow-hidden flex flex-col"
        >
          <!-- Terminal Header -->
          <div
            class="bg-black/40 px-4 py-3 border-b border-border flex items-center justify-between"
          >
            <div class="flex items-center gap-2">
              <div class="flex gap-1.5 mr-2">
                <div class="size-2.5 rounded-full bg-rose-500/50"></div>
                <div class="size-2.5 rounded-full bg-orange-400/50"></div>
                <div class="size-2.5 rounded-full bg-emerald-400/50"></div>
              </div>
              <Terminal class="size-4 text-muted-foreground" />
              <span class="text-xs font-mono text-muted-foreground">n8n_flow_output.json</span>
            </div>

            <div v-if="generatedWorkflow" class="flex items-center gap-2">
              <button
                @click="generateWorkflow"
                class="text-[10px] uppercase tracking-widest font-bold text-muted-foreground hover:text-white transition-colors flex items-center gap-1"
              >
                <RefreshCcw class="size-3" />
                Regenerate
              </button>
            </div>
          </div>

          <!-- Terminal Body -->
          <div class="flex-1 overflow-auto p-6 font-mono text-sm relative">
            <div
              v-if="isGenerating"
              class="absolute inset-0 flex items-center justify-center bg-black/20 backdrop-blur-[2px] z-10"
            >
              <div class="flex flex-col items-center gap-3">
                <div class="flex gap-1">
                  <div class="size-1.5 rounded-full bg-primary animate-bounce"></div>
                  <div
                    class="size-1.5 rounded-full bg-primary animate-bounce [animation-delay:0.2s]"
                  ></div>
                  <div
                    class="size-1.5 rounded-full bg-primary animate-bounce [animation-delay:0.4s]"
                  ></div>
                </div>
                <span class="text-xs text-primary font-bold uppercase tracking-widest"
                  >Compiling Nodes</span
                >
              </div>
            </div>

            <div v-if="generatedWorkflow" class="terminal-view whitespace-pre">
              <pre class="text-muted-foreground">{{ formatJson(generatedWorkflow.n8nJson) }}</pre>
            </div>

            <div
              v-else-if="!isGenerating"
              class="h-full flex flex-col items-center justify-center text-center opacity-30 grayscale"
            >
              <Terminal class="size-12 mb-4" />
              <p class="text-sm max-w-xs">
                Waiting for AI input... The generated workflow will appear here in production-ready
                JSON.
              </p>
            </div>
          </div>

          <!-- Terminal Footer / Deploy Bar -->
          <div
            class="bg-black/40 px-6 py-4 border-t border-border flex items-center justify-between"
          >
            <div class="flex flex-col">
              <span class="text-[10px] text-muted-foreground font-bold uppercase tracking-widest"
                >Deployment Status</span
              >
              <span
                class="text-sm font-medium"
                :class="deploySuccess ? 'text-emerald-400' : 'text-white/50'"
              >
                {{
                  deploySuccess
                    ? "Workflow Active"
                    : generatedWorkflow
                      ? "Pending Deployment"
                      : "Ready"
                }}
              </span>
            </div>

            <button
              v-if="generatedWorkflow && !deploySuccess"
              @click="deployWorkflow"
              :disabled="isDeploying"
              class="bg-accent hover:bg-accent/90 disabled:opacity-50 text-accent-foreground px-6 py-2 rounded-lg text-sm font-bold flex items-center gap-2 transition-all shadow-lg shadow-accent/20"
            >
              <Loader2 v-if="isDeploying" class="size-4 animate-spin" />
              <CloudUpload v-else class="size-4" />
              Deploy to Server
            </button>

            <div v-else-if="deploySuccess" class="flex items-center gap-2 text-emerald-400">
              <CheckCircle2 class="size-5" />
              <span class="text-sm font-bold">Successfully Deployed</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
