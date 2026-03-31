<script setup lang="ts">
import { ref, onMounted, computed } from "vue";
import { orpc } from "@/lib/orpc";
import { toastStore } from "@/lib/toast-store";
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
import JsonViewer from "@/components/ui/JsonViewer.vue";
import Button from "@/components/ui/Button.vue";

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
    toastStore.info("Workflow blueprint generated.");
  } catch (error) {
    console.error("Generation failed:", error);
    toastStore.error("Failed to generate workflow.");
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
      toastStore.info("Blueprint updated.");
    } else {
      const result = await orpc.fluvia.customWorkflow.create({
        name: workflowName.value,
        n8nJson: generatedJson.value,
        description: prompt.value,
      });
      savedWorkflowId.value = result.id;
      toastStore.info("Blueprint saved to library.");
    }
  } catch (error) {
    console.error("Save failed:", error);
    toastStore.error("Failed to save blueprint.");
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
    toastStore.error("Target server missing n8n API Key. Configure it in Dashboard.");
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
      toastStore.info("Successfully pushed to n8n instance.");
    } else {
      toastStore.warn("Workflow saved locally but couldn't be pushed to n8n.");
    }
  } catch (error: any) {
    console.error("Deployment failed:", error);
    toastStore.error(error.message || "Failed to deploy workflow to n8n.");
  } finally {
    isDeploying.value = false;
  }
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
        <Button
          @click="saveBlueprint"
          :disabled="!generatedJson || isSaving"
          variant="secondary"
          size="sm"
          class="px-4 py-2"
        >
          <Loader2 v-if="isSaving" class="size-4 animate-spin mr-2" />
          <Save v-else class="size-4 mr-2" />
          {{ savedWorkflowId ? "Update Blueprint" : "Save Blueprint" }}
        </Button>
      </div>
    </div>

    <div class="flex-1 flex gap-6 min-h-0">
      <!-- Left: AI Input Panel -->
      <div class="w-1/3 flex flex-col gap-4">
        <div
          class="flex-1 bg-surface-elevated border border-border rounded-2xl p-6 flex flex-col gap-6"
        >
          <div class="space-y-2">
            <div class="bg-primary/10 w-fit p-2 rounded-full">
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
              class="flex-1 bg-black/20 border border-white/10 rounded-2xl p-4 text-sm focus:ring-2 focus:ring-primary focus:outline-none resize-none placeholder:text-muted-foreground/50 transition-all"
            ></textarea>

            <Button
              @click="generateWorkflow"
              :disabled="isGenerating || !prompt"
              size="lg"
              class="w-full"
            >
              <Loader2 v-if="isGenerating" class="size-5 animate-spin mr-2" />
              <Sparkles v-else class="size-5 mr-2" />
              {{ isGenerating ? "Agent is working..." : "Generate Blueprint" }}
            </Button>
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
              <Button
                @click="generateWorkflow"
                variant="ghost"
                size="sm"
                class="h-7 text-[10px] !px-2"
              >
                <RefreshCcw class="size-3 mr-1" /> Regenerate
              </Button>
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

            <JsonViewer
              v-if="generatedJson"
              :data="generatedJson"
              class="flex-1 bg-transparent border-none p-0"
            />
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
                <Button
                  @click="showDeployMenu = !showDeployMenu"
                  variant="secondary"
                  size="sm"
                  class="mt-1 h-8"
                >
                  {{ selectedServerUrl || "Select Target Server" }}
                  <ChevronDown class="size-4 ml-2" />
                </Button>

                <!-- Simple Dropdown -->
                <div
                  v-if="showDeployMenu"
                  class="absolute bottom-full left-0 mb-2 w-64 glass-panel rounded-2xl overflow-hidden shadow-2xl z-50 p-2"
                >
                  <div v-for="ws in workspaces" :key="ws.id" class="mb-2 last:mb-0">
                    <span class="text-[10px] uppercase font-bold text-on-surface/40 px-2">{{
                      ws.name
                    }}</span>
                    <Button
                      v-for="srv in ws.servers"
                      :key="srv.id"
                      @click="
                        selectedServerId = srv.id;
                        showDeployMenu = false;
                      "
                      variant="ghost"
                      size="sm"
                      class="w-full !justify-between !px-2 !h-9"
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
                        class="size-1.5 rounded-full bg-primary shrink-0 mr-1"
                      ></div>
                    </Button>
                  </div>
                  <div v-if="workspaces.length === 0" class="p-4 text-center">
                    <p class="text-[10px] text-muted-foreground mb-2">No servers found</p>
                    <a
                      href="/dashboard"
                      class="text-[10px] text-primary font-bold uppercase hover:underline"
                      >Provision Now</a
                    >
                  </div>
                </div>
              </div>
              <span v-else class="text-sm font-bold text-emerald-400 mt-1"
                >Deployed Successfully</span
              >
            </div>

            <Button
              v-if="generatedJson && !deploySuccess"
              @click="deployToSelectedServer"
              :disabled="!selectedServerId || isDeploying"
              variant="primary"
              size="md"
              class="px-6"
            >
              <Loader2 v-if="isDeploying" class="size-4 animate-spin mr-2" />
              <CloudUpload v-else class="size-4 mr-2" />
              Deploy to Server
            </Button>
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
