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
  Eye,
  Code2,
  LayoutDashboard,
  FileCode,
  Send,
  User,
  Bot,
} from "lucide-vue-next";
import { cn } from "@/lib/utils";
import JsonViewer from "@/components/ui/JsonViewer.vue";
import Button from "@/components/ui/Button.vue";
import WorkflowVisualizer from "./WorkflowVisualizer.vue";

const props = defineProps<{
  initialWorkflowId?: string;
}>();

const prompt = ref("");
const isGenerating = ref(false);
const isSaving = ref(false);
const isDeploying = ref(false);
const generatedJson = ref<any>(null);
const currentBlueprint = ref<any>(null);
const workflowName = ref("New AI Workflow");
const savedWorkflowId = ref(props.initialWorkflowId || null);
const viewMode = ref<"visual" | "json">("visual");

// Chat state
const chatHistory = ref<{ role: "user" | "assistant"; content: string }[]>([]);

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
      currentBlueprint.value = (wf as any).blueprint || null;
      workflowName.value = wf.name;
      if (wf.description) {
        chatHistory.value.push({ role: "user", content: wf.description });
        chatHistory.value.push({ role: "assistant", content: "Blueprint loaded from library." });
      }
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

  const userInstruction = prompt.value;
  chatHistory.value.push({ role: "user", content: userInstruction });
  prompt.value = "";
  isGenerating.value = true;
  deploySuccess.value = false;

  try {
    const result = await orpc.fluvia.workflow.generate({
      prompt: userInstruction,
      name: workflowName.value,
      currentBlueprint: currentBlueprint.value,
    });

    generatedJson.value = result.n8nJson;
    currentBlueprint.value = result.blueprint;

    chatHistory.value.push({
      role: "assistant",
      content: currentBlueprint.value
        ? "I've updated the workflow based on your request."
        : "Workflow blueprint generated.",
    });

    toastStore.info("Workflow updated.");
  } catch (error) {
    console.error("Generation failed:", error);
    chatHistory.value.push({
      role: "assistant",
      content: "Sorry, I encountered an error while processing your request.",
    });
    toastStore.error("Failed to generate workflow.");
  } finally {
    isGenerating.value = false;
  }
}

async function saveBlueprint() {
  if (!generatedJson.value || isSaving.value) return;

  isSaving.value = true;
  try {
    const lastInstruction = chatHistory.value.filter((c) => c.role === "user").pop()?.content || "";

    if (savedWorkflowId.value) {
      await orpc.fluvia.customWorkflow.update({
        id: savedWorkflowId.value,
        name: workflowName.value,
        n8nJson: generatedJson.value,
        blueprint: currentBlueprint.value,
        description: lastInstruction,
      });
      toastStore.info("Blueprint updated.");
    } else {
      const result = await orpc.fluvia.customWorkflow.create({
        name: workflowName.value,
        n8nJson: generatedJson.value,
        blueprint: currentBlueprint.value,
        description: lastInstruction,
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

  const selectedServer = workspaces.value
    .flatMap((ws) => ws.servers || [])
    .find((s) => s.id === selectedServerId.value);

  if (!selectedServer?.n8nApiKey) {
    toastStore.error("Target server missing n8n API Key. Configure it in Dashboard.");
    return;
  }

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
      <!-- Left: AI Input Panel (Chat) -->
      <div class="w-1/3 flex flex-col gap-4">
        <div
          class="flex-1 bg-surface-elevated border border-border rounded-2xl flex flex-col overflow-hidden"
        >
          <!-- Chat Header -->
          <div class="p-6 border-b border-border bg-white/[0.02]">
            <div class="flex items-center gap-3">
              <div class="bg-primary/10 p-2 rounded-full">
                <Sparkles class="size-5 text-primary" />
              </div>
              <div>
                <h2 class="text-xl font-bold text-white tracking-tight">AI Architect</h2>
                <p class="text-[10px] uppercase tracking-widest text-on-surface/40 font-bold">
                  Iterative Workflow Design
                </p>
              </div>
            </div>
          </div>

          <!-- Chat History -->
          <div class="flex-1 overflow-auto p-6 space-y-6">
            <div
              v-if="chatHistory.length === 0"
              class="h-full flex flex-col items-center justify-center text-center px-4"
            >
              <Bot class="size-12 text-on-surface/10 mb-4" />
              <p class="text-sm text-on-surface/40 italic">
                "Describe the automation you need, and I'll build the blueprint for you."
              </p>
            </div>
            <div
              v-for="(msg, i) in chatHistory"
              :key="i"
              :class="cn('flex flex-col gap-2', msg.role === 'user' ? 'items-end' : 'items-start')"
            >
              <div class="flex items-center gap-2 px-1">
                <component
                  :is="msg.role === 'user' ? User : Bot"
                  class="size-3 text-on-surface/40"
                />
                <span class="text-[9px] uppercase font-bold tracking-widest text-on-surface/40">
                  {{ msg.role === "user" ? "Me" : "Architect" }}
                </span>
              </div>
              <div
                :class="
                  cn(
                    'max-w-[90%] px-4 py-3 rounded-2xl text-xs leading-relaxed',
                    msg.role === 'user'
                      ? 'bg-primary/10 border border-primary/20 text-primary-container font-medium'
                      : 'bg-white/5 border border-white/10 text-on-surface/80',
                  )
                "
              >
                {{ msg.content }}
              </div>
            </div>
          </div>

          <!-- Chat Input -->
          <div class="p-4 bg-black/20 border-t border-border">
            <div class="relative">
              <textarea
                v-model="prompt"
                placeholder="Ask to build or modify..."
                class="w-full bg-surface-container border border-outline-variant rounded-2xl p-4 pr-12 text-sm focus:ring-2 focus:ring-primary focus:outline-none resize-none placeholder:text-muted-foreground/30 transition-all min-h-[100px]"
                @keydown.enter.prevent.exact="generateWorkflow"
              ></textarea>
              <Button
                @click="generateWorkflow"
                :disabled="!prompt || isGenerating"
                variant="primary"
                size="sm"
                class="absolute bottom-3 right-3 h-8 w-8 !p-0"
              >
                <Loader2 v-if="isGenerating" class="size-4 animate-spin" />
                <Send v-else class="size-4" />
              </Button>
            </div>
            <p
              class="mt-2 text-[9px] text-center text-on-surface/20 uppercase font-bold tracking-tighter"
            >
              Press Enter to send instruction
            </p>
          </div>
        </div>

        <!-- Deployment Control -->
        <div class="bg-surface-elevated border border-border rounded-2xl p-6 space-y-4">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-2">
              <div class="bg-emerald-500/10 p-1.5 rounded-full">
                <CloudUpload class="size-4 text-emerald-400" />
              </div>
              <h3 class="text-sm font-bold text-white uppercase tracking-wider">Deploy</h3>
            </div>

            <!-- Target Server Selection -->
            <div class="relative">
              <Button
                @click="showDeployMenu = !showDeployMenu"
                variant="secondary"
                size="sm"
                class="h-8 !px-3"
              >
                <span class="max-w-[100px] truncate">{{
                  selectedServerUrl || "Select Target"
                }}</span>
                <ChevronDown class="size-4 ml-2" />
              </Button>

              <div
                v-if="showDeployMenu"
                class="absolute bottom-full right-0 mb-2 w-64 glass-panel rounded-2xl overflow-hidden shadow-2xl z-50 p-2"
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
                      <ShieldCheck v-if="srv.n8nApiKey" class="size-3 text-emerald-400 shrink-0" />
                    </div>
                    <div
                      v-if="selectedServerId === srv.id"
                      class="size-1.5 rounded-full bg-primary shrink-0 mr-1"
                    ></div>
                  </Button>
                </div>
              </div>
            </div>
          </div>

          <Button
            @click="deployToSelectedServer"
            :disabled="!generatedJson || !selectedServerId || isDeploying"
            class="w-full"
            size="md"
          >
            <Loader2 v-if="isDeploying" class="size-4 animate-spin mr-2" />
            <CloudUpload v-else class="size-4 mr-2" />
            {{ deploySuccess ? "Pushed Successfully" : "Push to Live Instance" }}
          </Button>
        </div>
      </div>

      <!-- Right: Terminal / JSON View -->
      <div class="flex-1 flex flex-col gap-4 min-w-0">
        <div
          class="flex-1 bg-surface-elevated border border-border rounded-2xl overflow-hidden flex flex-col"
        >
          <div
            class="bg-black/40 px-4 py-2 border-b border-border flex items-center justify-between min-h-[52px]"
          >
            <div
              class="flex items-center gap-1 bg-surface-container-highest p-1 rounded-full border border-outline-variant"
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
            <div v-if="generatedJson" class="flex items-center gap-2">
              <Button
                @click="
                  currentBlueprint = null;
                  generatedJson = null;
                  chatHistory = [];
                "
                variant="ghost"
                size="sm"
                class="!h-7 !text-[10px] !px-3"
              >
                Reset
              </Button>
            </div>
          </div>

          <div class="flex-1 overflow-auto font-mono text-sm relative">
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
                  >Processing Instructions</span
                >
              </div>
            </div>

            <template v-if="generatedJson">
              <WorkflowVisualizer
                v-if="viewMode === 'visual'"
                :nodes="generatedJson.nodes"
                :connections="generatedJson.connections"
              />
              <JsonViewer
                v-else
                :data="generatedJson"
                class="flex-1 bg-transparent border-none p-6"
              />
            </template>
            <div
              v-else
              class="h-full flex flex-col items-center justify-center text-center opacity-30 grayscale"
            >
              <Terminal class="size-12 mb-4" />
              <p class="text-sm max-w-xs">Your AI-generated blueprint will appear here.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
