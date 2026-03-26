<script setup lang="ts">
import { ref, onMounted, computed } from "vue";
import { orpc } from "@/lib/orpc";
import {
  Terminal,
  CloudUpload,
  Loader2,
  CheckCircle2,
  Cpu,
  RefreshCcw,
  Sparkles,
  Save,
  ChevronDown,
  ShieldCheck,
} from "lucide-vue-next";
import { cn } from "@/lib/utils";

const props = defineProps<{
  initialWorkflowId?: string;
}>();

const prompt = ref("");
const isGenerating = ref(false);
const isSaving = ref(false);
const isDeploying = ref(false);
const generatedJson = ref<any>(null);
const workflowName = ref("New AI Workflow");
const savedWorkflowId = ref(props.initialWorkflowId || null);

// Deployment state
const workspaces = ref<any[]>([]);
const selectedServerId = ref("");
const showDeployMenu = ref(false);
const deploySuccess = ref(false);

const selectedServerUrl = computed(() => {
  if (!selectedServerId.value) return null;
  const srv = workspaces.value
    .flatMap((ws) => ws.servers || [])
    .find((s) => s.id === selectedServerId.value);
  return srv?.url?.split("//")[1] || null;
});

async function fetchInitialData() {
  if (savedWorkflowId.value) {
    try {
      const wf = await orpc.fluvia.customWorkflow.get({ id: savedWorkflowId.value });
      generatedJson.value = wf.n8nJson;
      workflowName.value = wf.name;
      prompt.value = wf.description || "";
    } catch (e) {
      console.error("Failed to fetch workflow:", e);
    }
  }

  try {
    workspaces.value = await orpc.fluvia.workspace.list({ sync: false });
  } catch (e) {
    console.error("Failed to fetch servers:", e);
  }
}

async function generateWorkflow() {
  if (!prompt.value || isGenerating.value) return;

  isGenerating.value = true;
  generatedJson.value = null;
  deploySuccess.value = false;

  try {
    const result = await orpc.fluvia.workflow.generate({
      prompt: prompt.value,
      name: workflowName.value,
    });
    generatedJson.value = result.n8nJson;
  } catch (error) {
    console.error("Generation failed:", error);
  } finally {
    isGenerating.value = false;
  }
}

async function saveBlueprint() {
  if (!generatedJson.value || isSaving.value) return;

  isSaving.value = true;
  try {
    if (savedWorkflowId.value) {
      await orpc.fluvia.customWorkflow.update({
        id: savedWorkflowId.value,
        name: workflowName.value,
        n8nJson: generatedJson.value,
        description: prompt.value,
      });
    } else {
      const result = await orpc.fluvia.customWorkflow.create({
        name: workflowName.value,
        n8nJson: generatedJson.value,
        description: prompt.value,
      });
      savedWorkflowId.value = result.id;
    }
  } catch (error) {
    console.error("Save failed:", error);
  } finally {
    isSaving.value = false;
  }
}

async function deployToSelectedServer() {
  if (!selectedServerId.value || !generatedJson.value || isDeploying.value) return;

  // 1. Check if server has API Key configured
  const selectedServer = workspaces.value
    .flatMap((ws) => ws.servers || [])
    .find((s) => s.id === selectedServerId.value);

  if (!selectedServer?.n8nApiKey) {
    if (
      confirm(
        "This server doesn't have an n8n API Key configured. You need to add it in the Dashboard first. Go there now?",
      )
    ) {
      window.location.href = "/dashboard";
    }
    return;
  }

  // 2. Auto-save before deploy if it's new
  if (!savedWorkflowId.value) {
    await saveBlueprint();
  }

  isDeploying.value = true;
  try {
    const result = await orpc.fluvia.workflow.deploy({
      serverId: selectedServerId.value,
      customWorkflowId: savedWorkflowId.value!,
      name: workflowName.value,
      n8nJson: generatedJson.value,
    });

    if (result.pushedToRealN8n) {
      deploySuccess.value = true;
      showDeployMenu.value = false;
    } else {
      alert("Workflow saved locally but couldn't be pushed to n8n instance.");
    }
  } catch (error: any) {
    console.error("Deployment failed:", error);
    alert(error.message || "Failed to deploy workflow to n8n.");
  } finally {
    isDeploying.value = false;
  }
}

function formatJson(json: any) {
  return JSON.stringify(json, null, 2);
}

onMounted(fetchInitialData);
</script>

<template>
  <div class="h-[calc(100vh-12rem)] flex flex-col gap-6">
    <!-- Header/Breadcrumbs -->
    <div class="flex items-center justify-between">
      <div class="flex items-center gap-2 text-sm text-muted-foreground">
        <a href="/dashboard" class="hover:text-white transition-colors">Dashboard</a>
        <span>/</span>
        <span class="text-white font-medium">AI Designer</span>
      </div>

      <div class="flex items-center gap-3">
        <input
          v-model="workflowName"
          class="bg-transparent border-none text-right font-bold text-white focus:ring-0 placeholder:text-white/20"
          placeholder="Workflow Name..."
        />
        <button
          @click="saveBlueprint"
          :disabled="!generatedJson || isSaving"
          class="bg-surface-elevated border border-border px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 hover:bg-surface-highest transition-all"
        >
          <Loader2 v-if="isSaving" class="size-4 animate-spin" />
          <Save v-else class="size-4" />
          {{ savedWorkflowId ? "Update Blueprint" : "Save Blueprint" }}
        </button>
      </div>
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
              Describe your business logic. We'll generate a production-ready blueprint.
            </p>
          </div>

          <div class="flex-1 flex flex-col gap-4">
            <textarea
              v-model="prompt"
              placeholder="e.g. When a new row is added to Google Sheets, send a Slack message..."
              class="flex-1 bg-black/20 border border-white/10 rounded-xl p-4 text-sm focus:ring-2 focus:ring-primary focus:outline-none resize-none placeholder:text-muted-foreground/50 transition-all"
            ></textarea>

            <button
              @click="generateWorkflow"
              :disabled="isGenerating || !prompt"
              class="bg-primary hover:bg-primary/90 disabled:opacity-50 text-white w-full py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-all shadow-xl shadow-primary/20"
            >
              <Loader2 v-if="isGenerating" class="size-4 animate-spin" />
              <Cpu v-else class="size-4" />
              Generate Blueprint
            </button>
          </div>
        </div>
      </div>

      <!-- Right: Terminal / JSON View -->
      <div class="flex-1 flex flex-col gap-4 min-w-0">
        <div
          class="flex-1 bg-surface-elevated border border-border rounded-2xl overflow-hidden flex flex-col"
        >
          <div
            class="bg-black/40 px-4 py-3 border-b border-border flex items-center justify-between"
          >
            <div class="flex items-center gap-2">
              <Terminal class="size-4 text-muted-foreground" />
              <span class="text-xs font-mono text-muted-foreground">n8n_blueprint.json</span>
            </div>
            <div v-if="generatedJson" class="flex items-center gap-2">
              <button
                @click="generateWorkflow"
                class="text-[10px] uppercase font-bold text-muted-foreground hover:text-white transition-colors flex items-center gap-1"
              >
                <RefreshCcw class="size-3" /> Regenerate
              </button>
            </div>
          </div>

          <div class="flex-1 overflow-auto p-6 font-mono text-sm relative">
            <div
              v-if="isGenerating"
              class="absolute inset-0 flex items-center justify-center bg-black/40 backdrop-blur-sm z-10"
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
                  >Generating Nodes</span
                >
              </div>
            </div>

            <div v-if="generatedJson" class="terminal-view whitespace-pre">
              <pre class="text-muted-foreground">{{ formatJson(generatedJson) }}</pre>
            </div>
            <div
              v-else
              class="h-full flex flex-col items-center justify-center text-center opacity-30 grayscale"
            >
              <Terminal class="size-12 mb-4" />
              <p class="text-sm max-w-xs">Your AI-generated blueprint will appear here.</p>
            </div>
          </div>

          <!-- Deploy Bar -->
          <div
            class="bg-black/40 px-6 py-4 border-t border-border flex items-center justify-between"
          >
            <div class="flex flex-col">
              <span class="text-[10px] text-muted-foreground font-bold uppercase tracking-widest"
                >Deployment Target</span
              >
              <div v-if="!deploySuccess" class="relative">
                <button
                  @click="showDeployMenu = !showDeployMenu"
                  class="flex items-center gap-2 text-sm font-medium text-white/80 hover:text-white"
                >
                  {{ selectedServerUrl || "Select Target Server" }}
                  <ChevronDown class="size-4" />
                </button>

                <!-- Simple Dropdown -->
                <div
                  v-if="showDeployMenu"
                  class="absolute bottom-full left-0 mb-2 w-64 glass-panel rounded-xl overflow-hidden shadow-2xl z-50"
                >
                  <div
                    v-for="ws in workspaces"
                    :key="ws.id"
                    class="p-2 border-b border-white/5 last:border-0"
                  >
                    <span class="text-[10px] uppercase font-bold text-primary px-2">{{
                      ws.name
                    }}</span>
                    <button
                      v-for="srv in ws.servers"
                      :key="srv.id"
                      @click="
                        selectedServerId = srv.id;
                        showDeployMenu = false;
                      "
                      class="w-full text-left p-2 hover:bg-white/5 rounded-lg text-xs flex items-center justify-between"
                    >
                      <div class="flex items-center gap-2 overflow-hidden">
                        <span
                          :class="
                            cn(
                              'truncate',
                              selectedServerId === srv.id
                                ? 'text-white font-bold'
                                : 'text-muted-foreground',
                            )
                          "
                        >
                          {{ srv.url.split("//")[1] }}
                        </span>
                        <ShieldCheck
                          v-if="srv.n8nApiKey"
                          class="size-3 text-emerald-400 shrink-0"
                        />
                      </div>
                      <div
                        v-if="selectedServerId === srv.id"
                        class="size-1.5 rounded-full bg-primary shrink-0"
                      ></div>
                    </button>
                  </div>
                  <div v-if="workspaces.length === 0" class="p-4 text-center">
                    <p class="text-[10px] text-muted-foreground mb-2">No servers found</p>
                    <a href="/dashboard" class="text-[10px] text-primary font-bold uppercase"
                      >Provision Now</a
                    >
                  </div>
                </div>
              </div>
              <span v-else class="text-sm font-medium text-emerald-400">Deployed Successfully</span>
            </div>

            <button
              v-if="generatedJson && !deploySuccess"
              @click="deployToSelectedServer"
              :disabled="!selectedServerId || isDeploying"
              class="bg-accent hover:bg-accent/90 disabled:opacity-50 text-accent-foreground px-6 py-2 rounded-lg text-sm font-bold flex items-center gap-2 transition-all"
            >
              <Loader2 v-if="isDeploying" class="size-4 animate-spin" />
              <CloudUpload v-else class="size-4" />
              Deploy to Server
            </button>
            <div v-else-if="deploySuccess" class="flex items-center gap-2 text-emerald-400">
              <CheckCircle2 class="size-5" />
              <span class="text-sm font-bold">Live</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
