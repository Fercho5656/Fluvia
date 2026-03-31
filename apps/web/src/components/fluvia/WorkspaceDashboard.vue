<script setup lang="ts">
import { ref, onMounted, computed, onUnmounted } from "vue";
import { orpc } from "@/lib/orpc";
import { toastStore } from "@/lib/toast-store";
import {
  Plus,
  Server,
  Activity,
  ChevronRight,
  Loader2,
  Settings,
  Database,
  Play,
  Square,
  RotateCw,
  Trash2,
  RefreshCcw,
  MoreVertical,
  X,
  Check,
  Pencil,
  Copy,
  Eye,
  EyeOff,
  ShieldAlert,
  ExternalLink,
  Search,
  Key,
} from "lucide-vue-next";
import { cn } from "@/lib/utils";
import StatCard from "@/components/ui/StatCard.vue";
import Modal from "@/components/ui/Modal.vue";
import Button from "@/components/ui/Button.vue";

const props = defineProps<{
  initialWorkspaces?: any[];
}>();

const workspaces = ref<any[]>(props.initialWorkspaces || []);
const previousWorkspaces = ref<any[]>([]);
const loading = ref(!props.initialWorkspaces);
const creating = ref(false);
const newWorkspaceName = ref("");
const searchQuery = ref("");

// Workspace Edit state
const editingWorkspaceId = ref<string | null>(null);
const editNameValue = ref("");

// Modals State
const showAddClientModal = ref(false);
const showProvisionModal = ref(false);
const showActionModal = ref(false);
const showSettingsModal = ref(false);

// Data for modals
const generatedPassword = ref("");
const passwordVisible = ref(false);
const passwordConfirmed = ref(false);
const provisioningWorkspaceId = ref<string | null>(null);

const actionPassword = ref("");
const currentAction = ref<{ type: string; id: string; label: string } | null>(null);
const actionLoading = ref(false);
const actionError = ref("");

const settingsServerId = ref<string | null>(null);
const settingsServerUrl = ref<string | null>(null);
const n8nApiKey = ref("");
const savingSettings = ref(false);

// Polling state
const pollInterval = ref<any>(null);
const bootingServers = ref<Set<string>>(new Set());
const expectingStaticTransition = ref(false);

function startPolling() {
  if (pollInterval.value) return;
  pollInterval.value = setInterval(async () => {
    const hasTransitional = workspaces.value.some((ws) =>
      ws.servers?.some((s: any) =>
        ["deploying", "deleting", "stopping", "resuming", "restarting"].includes(s.status),
      ),
    );

    if (hasTransitional || expectingStaticTransition.value) {
      await fetchWorkspaces();
    } else {
      stopPolling();
    }
  }, 5000);
}

function stopPolling() {
  if (pollInterval.value) {
    clearInterval(pollInterval.value);
    pollInterval.value = null;
  }
}

async function fetchWorkspaces() {
  try {
    const data = await orpc.fluvia.workspace.list();

    // Check for newly active servers without API Key or transitioning to "active"
    data.forEach((ws: any) => {
      ws.servers?.forEach((srv: any) => {
        const prevWs = previousWorkspaces.value.find((p) => p.id === ws.id);
        const prevSrv = prevWs?.servers?.find((ps: any) => ps.id === srv.id);

        // Track "Booting" state (active but recently started)
        if (
          srv.status === "active" &&
          prevSrv &&
          ["resuming", "restarting", "deploying"].includes(prevSrv.status)
        ) {
          bootingServers.value.add(srv.id);
          setTimeout(() => {
            bootingServers.value.delete(srv.id);
          }, 120000); // 2 minutes
        }

        const justFinishedProvisioning =
          prevSrv?.status === "provisioning" && srv.status === "active";

        if (justFinishedProvisioning && !srv.n8nApiKey) {
          toastStore.warn(
            `"${ws.name}" is now live! Please add your n8n API Key to start deploying.`,
            10000,
          );
        }
      });
    });

    previousWorkspaces.value = JSON.parse(JSON.stringify(data));
    workspaces.value = data;
    const hasTransitional = data.some((ws: any) =>
      ws.servers?.some((s: any) =>
        ["deploying", "deleting", "stopping", "resuming", "restarting"].includes(s.status),
      ),
    );
    if (hasTransitional) startPolling();
  } catch (error) {
    console.error("Failed to fetch workspaces:", error);
  } finally {
    loading.value = false;
  }
}

onMounted(() => {
  if (!props.initialWorkspaces || props.initialWorkspaces.length === 0) {
    fetchWorkspaces();
  } else {
    const hasTransitional = props.initialWorkspaces.some((ws: any) =>
      ws.servers?.some((s: any) =>
        ["deploying", "deleting", "stopping", "resuming", "restarting"].includes(s.status),
      ),
    );
    if (hasTransitional) startPolling();
  }
});

onUnmounted(() => stopPolling());

async function createWorkspace() {
  if (!newWorkspaceName.value) return;
  creating.value = true;
  try {
    await orpc.fluvia.workspace.create({ name: newWorkspaceName.value });
    toastStore.info(`Workspace "${newWorkspaceName.value}" created successfully.`);
    newWorkspaceName.value = "";
    showAddClientModal.value = false;
    await fetchWorkspaces();
  } catch (error) {
    console.error("Failed to create workspace:", error);
    toastStore.error("Failed to create workspace.");
  } finally {
    creating.value = false;
  }
}

async function provisionServer(workspaceName: string, workspaceId: string) {
  provisioningWorkspaceId.value = workspaceId;
  try {
    const result = await orpc.fluvia.server.provision({ workspaceName, workspaceId });
    generatedPassword.value = result.password;
    showProvisionModal.value = true;
    passwordConfirmed.value = false;
    toastStore.info("Server provisioning started.");
    await fetchWorkspaces();
  } catch (error: any) {
    console.error("Failed to provision server:", error);
    toastStore.error(error.message || "Failed to provision server.");
  } finally {
    provisioningWorkspaceId.value = null;
  }
}

function openSettingsModal(srv: any) {
  settingsServerId.value = srv.id;
  settingsServerUrl.value = srv.url;
  n8nApiKey.value = srv.n8nApiKey || "";
  showSettingsModal.value = true;
}

async function saveServerSettings() {
  if (!settingsServerId.value) return;
  savingSettings.value = true;
  try {
    await orpc.fluvia.server.saveSettings({
      id: settingsServerId.value,
      n8nApiKey: n8nApiKey.value,
    });
    showSettingsModal.value = false;
    toastStore.info("API Key saved successfully.");
    await fetchWorkspaces();
  } catch (error) {
    console.error("Failed to save settings:", error);
    toastStore.error("Failed to save API Key.");
  } finally {
    savingSettings.value = false;
  }
}

function openActionModal(type: string, id: string, label: string) {
  currentAction.value = { type, id, label };
  actionPassword.value = "";
  actionError.value = "";
  showActionModal.value = true;
}

async function executeAction() {
  if (!currentAction.value || !actionPassword.value) return;
  actionLoading.value = true;
  actionError.value = "";

  try {
    const { type, id, label } = currentAction.value;
    const payload = { id, password: actionPassword.value };

    if (type === "stop") await orpc.fluvia.server.stop(payload);
    else if (type === "resume") await orpc.fluvia.server.resume(payload);
    else if (type === "restart") await orpc.fluvia.server.restart(payload);
    else if (type === "delete") await orpc.fluvia.server.delete(payload);
    else if (type === "reinstall") await orpc.fluvia.server.reinstall(payload);

    toastStore.info(`Action "${label}" executed successfully.`);

    if (["stop", "resume", "restart"].includes(type)) {
      expectingStaticTransition.value = true;
      startPolling();
      setTimeout(() => {
        expectingStaticTransition.value = false;
      }, 30000);
    }

    showActionModal.value = false;
    currentAction.value = null;
    await fetchWorkspaces();
  } catch (error: any) {
    actionError.value = error.message || "Invalid password or server error.";
    toastStore.error(actionError.value);
  } finally {
    actionLoading.value = false;
  }
}

function startEditing(ws: any) {
  editingWorkspaceId.value = ws.id;
  editNameValue.value = ws.name;
}

async function saveWorkspaceName() {
  if (!editingWorkspaceId.value || !editNameValue.value) return;
  try {
    await orpc.fluvia.workspace.update({
      id: editingWorkspaceId.value,
      name: editNameValue.value,
    });
    toastStore.info("Workspace updated.");
    editingWorkspaceId.value = null;
    await fetchWorkspaces();
  } catch (error) {
    console.error("Failed to update workspace:", error);
    toastStore.error("Failed to update workspace.");
  }
}

async function deleteWorkspace(id: string) {
  if (!confirm("Are you sure? This will delete the workspace and ALL associated servers and data."))
    return;
  try {
    await orpc.fluvia.workspace.delete({ id });
    toastStore.warn("Workspace deleted.");
    await fetchWorkspaces();
  } catch (error) {
    console.error("Failed to delete workspace:", error);
    toastStore.error("Failed to delete workspace.");
  }
}

function copyToClipboard(text: string) {
  navigator.clipboard.writeText(text);
  toastStore.info("Copied to clipboard");
}

// Custom directive for auto-focus
const vFocus = {
  mounted: (el: HTMLInputElement) => el.focus(),
};

const filteredWorkspaces = computed(() => {
  if (!searchQuery.value) return workspaces.value;
  const q = searchQuery.value.toLowerCase();
  return workspaces.value.filter(
    (ws) => ws.name.toLowerCase().includes(q) || ws.id.toLowerCase().includes(q),
  );
});

const stats = computed(() => [
  {
    label: "Managed Clients",
    value: workspaces.value.length,
    icon: Database,
    color: "text-primary",
  },
  {
    label: "Active Nodes",
    value: workspaces.value.reduce((acc, ws) => acc + (ws.servers?.length || 0), 0),
    icon: Server,
    color: "text-emerald-400",
  },
  {
    label: "System Health",
    value: "99.9%",
    icon: Activity,
    color: "text-blue-400",
  },
]);
</script>

<template>
  <div class="space-y-12 pb-20">
    <!-- Header Section -->
    <header class="flex flex-col md:flex-row md:items-end justify-between gap-6">
      <div class="space-y-1">
        <h1 class="text-5xl font-extrabold tracking-tighter font-headline text-white">
          Agency Command
        </h1>
        <p class="text-on-surface/40 font-medium tracking-tight">
          Enterprise infrastructure oversight & n8n orchestration.
        </p>
      </div>
      <div class="flex items-center gap-3">
        <div class="relative hidden sm:block">
          <Search class="absolute left-4 top-1/2 -translate-y-1/2 size-4 text-on-surface/20" />
          <input
            v-model="searchQuery"
            class="bg-surface-container border border-outline-variant/30 rounded-full pl-11 pr-6 py-2.5 text-xs focus:ring-2 focus:ring-primary focus:outline-none transition-all w-64"
            placeholder="Filter workspaces..."
          />
        </div>
        <Button @click="showAddClientModal = true" size="md">
          <Plus class="size-4 mr-2" />
          Provision New Client
        </Button>
      </div>
    </header>

    <!-- Stats Grid -->
    <section class="grid grid-cols-1 sm:grid-cols-3 gap-4">
      <StatCard
        v-for="stat in stats"
        :key="stat.label"
        :label="stat.label"
        :value="stat.value"
        :icon="stat.icon"
        :class="stat.color"
      />
    </section>

    <!-- Workspace List -->
    <section class="space-y-6">
      <div v-if="loading" class="flex flex-col items-center justify-center py-24 gap-4">
        <Loader2 class="size-10 animate-spin text-primary opacity-20" />
        <p class="text-[10px] font-bold uppercase tracking-[0.3em] text-on-surface/20">
          Synchronizing Neural State...
        </p>
      </div>

      <div
        v-else-if="filteredWorkspaces.length === 0"
        class="text-center py-24 glass-panel rounded-3xl border-dashed flex flex-col items-center"
      >
        <div class="bg-white/5 p-6 rounded-full mb-6">
          <Database class="size-12 text-on-surface/10" />
        </div>
        <h3 class="text-xl font-bold text-white">No Infrastructure Found</h3>
        <p class="text-on-surface/40 mt-2 max-w-xs mx-auto text-sm">
          Initialize your first client workspace to begin provisioning automated instances.
        </p>
        <Button @click="showAddClientModal = true" variant="outline" class="mt-8" size="lg">
          <Plus class="size-4 mr-2" />
          Create First Workspace
        </Button>
      </div>

      <div
        v-for="ws in filteredWorkspaces"
        :key="ws.id"
        class="group bg-surface-container-low border border-outline-variant/20 rounded-3xl overflow-hidden hover:border-primary/20 transition-all duration-500"
      >
        <!-- Card Header -->
        <div class="px-8 py-6 bg-white/[0.02] border-b border-outline-variant/10">
          <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div class="flex items-center gap-4">
              <div
                class="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center border border-primary/20 group-hover:scale-110 transition-transform duration-500"
              >
                <Database class="size-6 text-primary" />
              </div>
              <div class="space-y-0.5">
                <div class="flex items-center gap-2">
                  <div v-if="editingWorkspaceId === ws.id" class="flex items-center gap-2">
                    <input
                      v-model="editNameValue"
                      class="bg-black/40 border border-primary/50 rounded-full px-3 py-1 text-lg font-bold text-white w-full h-9 focus:outline-none focus:ring-1 focus:ring-primary/50"
                      @keyup.enter="saveWorkspaceName"
                      @keyup.esc="editingWorkspaceId = null"
                      v-focus
                    />
                    <div class="flex gap-1 shrink-0">
                      <Button
                        @click="saveWorkspaceName"
                        variant="secondary"
                        size="sm"
                        class="h-9 w-9 !p-0 !bg-emerald-500/10 !border-emerald-500/20 text-emerald-400"
                      >
                        <Check class="size-4" />
                      </Button>
                      <Button
                        @click="editingWorkspaceId = null"
                        variant="ghost"
                        size="sm"
                        class="h-9 w-9 !p-0"
                      >
                        <X class="size-4" />
                      </Button>
                    </div>
                  </div>
                  <template v-else>
                    <h4 class="text-lg font-bold font-headline text-on-surface leading-8">
                      {{ ws.name }}
                    </h4>
                    <Button
                      @click="startEditing(ws)"
                      variant="ghost"
                      size="sm"
                      class="h-8 w-8 !p-0"
                    >
                      <Pencil class="size-4" />
                    </Button>
                  </template>
                </div>
                <p class="text-[10px] text-on-surface/40 uppercase tracking-widest font-bold">
                  ID: {{ ws.id.slice(0, 8) }} • {{ ws.servers?.[0]?.status || "Idle" }}
                </p>
              </div>
            </div>

            <div class="flex items-center gap-4 w-full sm:w-auto">
              <template v-if="ws.servers?.[0]">
                <span
                  v-if="bootingServers.has(ws.servers[0].id)"
                  class="px-3 py-1 text-[10px] font-bold rounded-full border uppercase bg-blue-500/10 text-blue-500 border-blue-500/20 animate-pulse"
                >
                  Booting
                </span>
                <span
                  v-else
                  :class="
                    cn(
                      'px-3 py-1 text-[10px] font-bold rounded-full border uppercase',
                      ws.servers[0].status === 'active'
                        ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
                        : 'bg-orange-500/10 text-orange-500 border-orange-500/20 animate-pulse',
                    )
                  "
                >
                  {{ ws.servers[0].status }}
                </span>
                <div
                  class="flex items-center gap-1 ml-auto sm:ml-4 border-l border-outline-variant pl-4"
                >
                  <span class="text-[10px] font-bold text-on-surface/40 uppercase">CPU</span>
                  <div class="w-16 h-1 bg-surface-container-highest rounded-full overflow-hidden">
                    <div
                      class="bg-primary h-full"
                      :style="{ width: ws.servers[0].status === 'active' ? '12%' : '0%' }"
                    ></div>
                  </div>
                </div>
              </template>
              <Button
                @click="deleteWorkspace(ws.id)"
                variant="danger"
                size="sm"
                class="h-9 w-9 !p-0"
              >
                <Trash2 class="size-4" />
              </Button>
            </div>
          </div>
        </div>

        <!-- Card Content -->
        <div class="p-8 flex flex-col md:flex-row gap-12">
          <div class="flex-1 space-y-6">
            <template v-if="ws.servers?.[0]">
              <div class="space-y-2">
                <label class="text-[10px] font-bold text-on-surface/40 uppercase tracking-[0.2em]"
                  >Endpoint URL</label
                >
                <div class="flex items-center gap-3">
                  <code
                    class="text-xs text-primary font-mono bg-black/40 px-4 py-2 rounded-full border border-primary/10 block w-fit"
                    >{{ ws.servers[0].url }}</code
                  >
                  <div class="flex items-center gap-1">
                    <Button
                      @click="copyToClipboard(ws.servers[0].url)"
                      variant="ghost"
                      size="sm"
                      class="h-8 w-8 !p-0"
                    >
                      <Copy class="size-3.5" />
                    </Button>
                    <Button
                      :href="ws.servers[0].url"
                      target="_blank"
                      variant="ghost"
                      size="sm"
                      class="h-8 w-8 !p-0"
                    >
                      <ExternalLink class="size-3.5" />
                    </Button>
                  </div>
                </div>
              </div>
              <div class="flex gap-12">
                <div class="space-y-1">
                  <label class="text-[10px] font-bold text-on-surface/40 uppercase tracking-[0.2em]"
                    >Version</label
                  >
                  <div class="flex items-center gap-2">
                    <p class="text-xs font-bold text-white">1.24.1</p>
                    <span
                      class="text-[8px] bg-white/5 px-1.5 py-0.5 rounded uppercase font-bold text-on-surface/40"
                      >Stable</span
                    >
                  </div>
                </div>
                <div class="space-y-1">
                  <label class="text-[10px] font-bold text-on-surface/40 uppercase tracking-[0.2em]"
                    >API Gateway</label
                  >
                  <div>
                    <Button
                      @click="openSettingsModal(ws.servers[0])"
                      variant="ghost"
                      size="sm"
                      :class="
                        cn(
                          '!h-6 !px-2 !text-[10px] !rounded-md !font-bold',
                          ws.servers[0].n8nApiKey
                            ? 'text-primary'
                            : 'text-amber-500 animate-pulse bg-amber-500/10',
                        )
                      "
                    >
                      <Key class="size-3 mr-1.5" />
                      {{ ws.servers[0].n8nApiKey ? "LINKED" : "KEY REQUIRED" }}
                    </Button>
                    <p
                      v-if="bootingServers.has(ws.servers[0].id)"
                      class="text-[9px] text-blue-400 font-bold mt-1.5 animate-pulse uppercase tracking-wider"
                    >
                      Initializing services...
                    </p>
                  </div>
                </div>
              </div>
            </template>
            <div
              v-else-if="provisioningWorkspaceId === ws.id"
              class="flex flex-col items-center justify-center py-10 bg-white/[0.02] rounded-3xl border border-dashed border-primary/20 gap-4"
            >
              <div class="relative">
                <div
                  class="absolute inset-0 bg-primary/20 blur-xl rounded-full animate-pulse"
                ></div>
                <Loader2 class="size-8 animate-spin text-primary relative z-10" />
              </div>
              <span class="text-[10px] font-bold uppercase tracking-[0.3em] text-primary"
                >Initializing CubePath Node...</span
              >
            </div>
            <div v-else class="py-6">
              <Button @click="provisionServer(ws.name, ws.id)" variant="outline" size="md">
                <Server class="size-4 mr-2" />
                Provision CubePath Instance
              </Button>
            </div>
          </div>

          <!-- Server Actions Grid -->
          <div
            v-if="ws.servers?.[0]"
            class="grid grid-cols-2 gap-2 border-t md:border-t-0 md:border-l border-outline-variant/10 pt-8 md:pt-0 md:pl-12 w-full md:w-80 shrink-0"
          >
            <Button
              v-if="ws.servers[0].status === 'stopped'"
              @click="openActionModal('resume', ws.servers[0].id, 'Resume Server')"
              variant="secondary"
              class="!px-3 !py-2.5 text-[10px] !bg-emerald-500/10 !border-emerald-500/20 text-emerald-400 hover:!bg-emerald-500/20"
            >
              <Play class="size-3.5 mr-2" />
              <span class="truncate">Resume</span>
            </Button>
            <Button
              v-if="ws.servers[0].status === 'active'"
              @click="openActionModal('stop', ws.servers[0].id, 'Stop Server')"
              variant="secondary"
              class="!px-3 !py-2.5 text-[10px]"
            >
              <Square class="size-3.5 text-on-surface/40 mr-2" />
              <span class="truncate">Stop</span>
            </Button>
            <Button
              @click="openActionModal('restart', ws.servers[0].id, 'Restart')"
              variant="secondary"
              class="!px-3 !py-2.5 text-[10px] !bg-amber-500/10 !border-amber-500/20 text-amber-400 hover:!bg-amber-500/20"
            >
              <RotateCw class="size-3.5 mr-2" />
              <span class="truncate">Restart</span>
            </Button>
            <Button
              @click="openActionModal('reinstall', ws.servers[0].id, 'Reinstall')"
              variant="outline"
              class="!px-3 !py-2.5 text-[10px] !border-blue-500/30 text-blue-400 hover:!bg-blue-500/5"
            >
              <RefreshCcw class="size-3.5 mr-2" />
              <span class="truncate">Reinstall</span>
            </Button>
            <Button
              @click="openActionModal('delete', ws.servers[0].id, 'Delete Server')"
              variant="danger"
              class="!px-3 !py-2.5 text-[10px]"
            >
              <Trash2 class="size-3.5 mr-2" />
              <span class="truncate">Delete</span>
            </Button>
          </div>
        </div>
      </div>
    </section>

    <!-- Modals Section -->
    <Modal
      :show="showAddClientModal"
      title="New Client Workspace"
      @close="showAddClientModal = false"
    >
      <form @submit.prevent="createWorkspace" class="space-y-6">
        <div class="space-y-2">
          <label class="text-[10px] font-bold text-on-surface/40 uppercase tracking-widest"
            >Workspace Name</label
          >
          <input
            v-model="newWorkspaceName"
            v-focus
            class="w-full bg-black/40 border border-outline-variant rounded-full px-6 py-4 outline-none focus:border-primary transition-all font-medium"
            placeholder="e.g. Acme Corp Automation"
          />
        </div>
        <div class="flex gap-3">
          <Button type="button" @click="showAddClientModal = false" variant="ghost" class="flex-1">
            Cancel
          </Button>
          <Button type="submit" :disabled="creating || !newWorkspaceName" class="flex-1" size="lg">
            <Loader2 v-if="creating" class="size-4 animate-spin mr-2" />
            Create Workspace
          </Button>
        </div>
      </form>
    </Modal>

    <!-- Provisioning Modal -->
    <Modal
      :show="showProvisionModal"
      title="Server Provisioning Started"
      @close="showProvisionModal = false"
    >
      <div class="space-y-6">
        <div class="bg-primary/10 border border-primary/20 rounded-3xl p-8 text-center">
          <ShieldAlert class="size-12 text-primary mx-auto mb-4" />
          <h4 class="text-xl font-bold text-white mb-2">Save your Root Password!</h4>
          <p class="text-xs text-on-surface/60 leading-relaxed">
            This is the **only time** you will see the plain text password. We store only a secure
            one-way hash. You need this for critical actions like Reinstall, Restart, and Delete.
          </p>
        </div>

        <div
          class="bg-black/40 border border-white/10 rounded-full p-2 pl-6 flex items-center gap-2"
        >
          <label class="text-[10px] uppercase tracking-widest text-on-surface/40 font-bold shrink-0"
            >Root Password</label
          >
          <input
            :type="passwordVisible ? 'text' : 'password'"
            :value="generatedPassword"
            readonly
            class="flex-1 bg-transparent border-none text-lg font-mono text-primary focus:ring-0 text-center"
          />
          <Button
            @click="passwordVisible = !passwordVisible"
            variant="ghost"
            size="icon"
            class="h-10 w-10"
          >
            <component :is="passwordVisible ? EyeOff : Eye" class="size-4" />
          </Button>
          <Button
            @click="copyToClipboard(generatedPassword)"
            variant="ghost"
            size="icon"
            class="h-10 w-10 text-primary"
          >
            <Copy class="size-4" />
          </Button>
        </div>

        <div class="space-y-4">
          <div class="flex items-center gap-3 px-4">
            <input
              type="checkbox"
              id="confirm-pwd"
              v-model="passwordConfirmed"
              class="size-4 rounded border-white/10 bg-black/40 text-primary focus:ring-primary"
            />
            <label for="confirm-pwd" class="text-xs text-on-surface/60">
              I have safely stored this password and understand it won't be shown again.
            </label>
          </div>
          <Button
            @click="showProvisionModal = false"
            :disabled="!passwordConfirmed"
            class="w-full"
            size="lg"
          >
            Continue to Dashboard
          </Button>
        </div>
      </div>
    </Modal>

    <!-- Action Verification Modal -->
    <Modal
      :show="showActionModal"
      :title="currentAction?.label || 'Verify Action'"
      maxWidth="max-w-sm"
      @close="showActionModal = false"
    >
      <div class="space-y-4">
        <p class="text-xs text-on-surface/60">
          Please enter your VPS root password to authorize this action.
        </p>
        <div class="space-y-3">
          <input
            v-model="actionPassword"
            type="password"
            placeholder="Root Password"
            class="w-full bg-black/20 border border-white/10 rounded-full px-6 py-3 text-sm focus:ring-2 focus:ring-primary focus:outline-none transition-all"
            @keyup.enter="executeAction"
          />
          <p
            v-if="actionError"
            class="text-[10px] text-rose-500 font-bold uppercase tracking-wide px-2"
          >
            {{ actionError }}
          </p>
        </div>
        <div class="flex gap-2">
          <Button @click="showActionModal = false" variant="ghost" class="flex-1"> Cancel </Button>
          <Button
            @click="executeAction"
            :disabled="actionLoading || !actionPassword"
            class="flex-1"
          >
            <Loader2 v-if="actionLoading" class="size-4 animate-spin mr-2" />
            Confirm
          </Button>
        </div>
      </div>
    </Modal>

    <!-- n8n Settings Modal -->
    <Modal
      :show="showSettingsModal"
      title="n8n API Credentials"
      maxWidth="max-w-md"
      @close="showSettingsModal = false"
    >
      <div class="space-y-6">
        <div class="text-center">
          <div
            class="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4 border border-primary/20"
          >
            <Key class="size-8 text-primary" />
          </div>
          <p class="text-xs text-on-surface/40">
            Enter your n8n Public API Key to enable AI deployments.
            <template v-if="settingsServerUrl">
              <br />
              <a
                :href="`${settingsServerUrl}/settings/api`"
                target="_blank"
                class="text-primary hover:underline inline-flex items-center gap-1 mt-2 font-bold"
              >
                Get it from your instance <ExternalLink class="size-3" />
              </a>
            </template>
          </p>
        </div>
        <div class="space-y-2">
          <label class="text-[10px] font-bold text-on-surface/40 uppercase tracking-widest"
            >API Key</label
          >
          <div class="relative group">
            <input
              v-model="n8nApiKey"
              class="w-full bg-black/40 border border-outline-variant rounded-full px-6 py-4 font-mono text-sm tracking-widest outline-none focus:border-primary transition-all"
              type="password"
              placeholder="fluvia_n8n_..."
            />
          </div>
        </div>
        <div class="flex gap-3 pt-2">
          <Button @click="showSettingsModal = false" variant="ghost" class="flex-1">
            Cancel
          </Button>
          <Button
            @click="saveServerSettings"
            :disabled="savingSettings || !n8nApiKey"
            class="flex-1"
            variant="primary"
          >
            <Loader2 v-if="savingSettings" class="size-4 animate-spin mr-2" />
            Save Key
          </Button>
        </div>
      </div>
    </Modal>
  </div>
</template>
