<script setup lang="ts">
import { ref, onMounted, computed, onUnmounted } from "vue";
import { orpc } from "@/lib/orpc";
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
const n8nApiKey = ref("");
const savingSettings = ref(false);

// Polling state
const pollInterval = ref<any>(null);
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
    newWorkspaceName.value = "";
    showAddClientModal.value = false;
    await fetchWorkspaces();
  } catch (error) {
    console.error("Failed to create workspace:", error);
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
    await fetchWorkspaces();
  } catch (error: any) {
    console.error("Failed to provision server:", error);
    alert(error.message || "Failed to provision server.");
  } finally {
    provisioningWorkspaceId.value = null;
  }
}

function openSettingsModal(srv: any) {
  settingsServerId.value = srv.id;
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
    await fetchWorkspaces();
  } catch (error) {
    console.error("Failed to save settings:", error);
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
    const { type, id } = currentAction.value;
    const payload = { id, password: actionPassword.value };

    if (type === "stop") await orpc.fluvia.server.stop(payload);
    else if (type === "resume") await orpc.fluvia.server.resume(payload);
    else if (type === "restart") await orpc.fluvia.server.restart(payload);
    else if (type === "delete") await orpc.fluvia.server.delete(payload);
    else if (type === "reinstall") await orpc.fluvia.server.reinstall(payload);

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
    editingWorkspaceId.value = null;
    await fetchWorkspaces();
  } catch (error) {
    console.error("Failed to update workspace:", error);
  }
}

async function deleteWorkspace(id: string) {
  if (!confirm("Are you sure? This will delete the workspace and ALL associated servers and data."))
    return;
  try {
    await orpc.fluvia.workspace.delete({ id });
    await fetchWorkspaces();
  } catch (error) {
    console.error("Failed to delete workspace:", error);
  }
}

const activeServersCount = computed(
  () => workspaces.value.filter((w) => w.servers?.some((s: any) => s.status === "active")).length,
);

const totalWorkflowsCount = computed(() =>
  workspaces.value.reduce((acc, w) => {
    const serverWorkflows =
      w.servers?.reduce((sAcc: number, s: any) => sAcc + (s.workflows?.length || 0), 0) || 0;
    return acc + serverWorkflows;
  }, 0),
);

const provisioningServersCount = computed(
  () =>
    workspaces.value.filter((w) => w.servers?.some((s: any) => s.status === "provisioning")).length,
);

const filteredWorkspaces = computed(() => {
  if (!searchQuery.value) return workspaces.value;
  const query = searchQuery.value.toLowerCase();
  return workspaces.value.filter(
    (ws) =>
      ws.name.toLowerCase().includes(query) ||
      ws.id.toLowerCase().includes(query) ||
      ws.servers?.some((s: any) => s.url.toLowerCase().includes(query)),
  );
});

function copyToClipboard(text: string) {
  navigator.clipboard.writeText(text);
}

// Custom directive for auto-focus
const vFocus = {
  mounted: (el: HTMLInputElement) => el.focus(),
};
</script>

<template>
  <div class="space-y-12 pb-20">
    <!-- Header Section -->
    <div class="flex flex-col md:flex-row md:items-end justify-between gap-6">
      <div class="space-y-1">
        <h1 class="text-4xl font-extrabold tracking-tighter text-on-surface font-headline">
          Agency Command
        </h1>
        <p class="text-on-surface/40 font-medium">
          Manage infrastructure and automation for your clients.
        </p>
      </div>

      <Button @click="showAddClientModal = true" size="md">
        <Plus class="size-4 mr-2" />
        Add Client
      </Button>
    </div>

    <!-- Summary Stats Grid -->
    <section class="grid grid-cols-1 md:grid-cols-3 gap-6">
      <StatCard
        label="Active Servers"
        :value="activeServersCount"
        :icon="Server"
        subtext="All systems stable"
        trend="stable"
      />
      <StatCard
        label="Total Workflows"
        :value="totalWorkflowsCount"
        :icon="Activity"
        subtext="+0 since yesterday"
      />
      <StatCard
        label="In Provisioning"
        :value="provisioningServersCount"
        :icon="RefreshCcw"
        :subtext="provisioningServersCount > 0 ? 'Deploying now' : 'Queue Empty'"
      />
    </section>

    <!-- Main Listing Area -->
    <section class="space-y-6">
      <div class="flex flex-col sm:flex-row items-start sm:items-center justify-between px-2 gap-4">
        <div class="flex items-center gap-4">
          <h3 class="text-xl font-bold font-headline">Client Environments</h3>
          <span
            class="px-2 py-0.5 bg-surface-container-highest text-[10px] font-bold rounded text-on-surface/60"
          >
            {{ filteredWorkspaces.length }} Total
          </span>
        </div>
        <div class="relative w-full sm:w-auto">
          <Search class="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-on-surface/30" />
          <input
            v-model="searchQuery"
            class="bg-surface-container border border-outline-variant rounded-lg pl-10 pr-4 py-2.5 text-xs focus:ring-1 focus:ring-primary focus:border-primary w-full sm:w-80 text-on-surface placeholder-on-surface/30 outline-none"
            placeholder="Search clients or instances..."
            type="text"
          />
        </div>
      </div>

      <!-- Loading State -->
      <div v-if="loading" class="flex flex-col items-center justify-center py-20 gap-4">
        <Loader2 class="size-8 animate-spin text-primary" />
        <p class="text-on-surface/40 font-bold uppercase tracking-widest text-[10px]">
          Syncing infrastructure...
        </p>
      </div>

      <!-- Empty State -->
      <div
        v-else-if="workspaces.length === 0"
        class="text-center py-20 bg-surface-container-low rounded-2xl border border-dashed border-outline-variant"
      >
        <div
          class="bg-primary/10 size-16 rounded-full flex items-center justify-center mx-auto mb-4 border border-primary/20"
        >
          <Database class="size-8 text-primary" />
        </div>
        <h3 class="text-xl font-bold text-on-surface font-headline">No Client Workspaces</h3>
        <p class="text-on-surface/40 mt-2 max-w-xs mx-auto text-sm">
          Create your first client workspace to start deploying automation servers.
        </p>
      </div>

      <!-- Client Grid -->
      <div v-else class="grid grid-cols-1 gap-6">
        <div
          v-for="ws in filteredWorkspaces"
          :key="ws.id"
          class="bg-surface-container-low rounded-xl border border-outline-variant overflow-hidden group hover:border-primary/40 transition-all"
        >
          <!-- Card Header -->
          <div
            class="p-6 border-b border-outline-variant flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
          >
            <div class="flex items-center gap-4">
              <div
                class="w-12 h-12 rounded-lg bg-surface-container-highest flex items-center justify-center border border-outline"
              >
                <Database class="size-6 text-on-surface/40" />
              </div>
              <div>
                <div class="flex items-center gap-2 min-h-8">
                  <div v-if="editingWorkspaceId === ws.id" class="flex items-center gap-2 flex-1">
                    <input
                      v-model="editNameValue"
                      class="bg-black/40 border border-primary/50 rounded px-2 py-0 text-lg font-bold text-white w-full h-8 focus:outline-none focus:ring-1 focus:ring-primary/50"
                      @keyup.enter="saveWorkspaceName"
                      @keyup.esc="editingWorkspaceId = null"
                      v-focus
                    />
                    <div class="flex gap-1 shrink-0">
                      <button
                        @click="saveWorkspaceName"
                        class="text-emerald-400 hover:text-emerald-300 transition-colors p-1"
                      >
                        <Check class="size-4" />
                      </button>
                      <button
                        @click="editingWorkspaceId = null"
                        class="text-on-surface/20 hover:text-on-surface transition-colors p-1"
                      >
                        <X class="size-4" />
                      </button>
                    </div>
                  </div>
                  <template v-else>
                    <h4 class="text-lg font-bold font-headline text-on-surface leading-8">
                      {{ ws.name }}
                    </h4>
                    <button
                      @click="startEditing(ws)"
                      class="p-1 hover:bg-surface-container-highest rounded text-on-surface/30 hover:text-primary transition-colors"
                    >
                      <Pencil class="size-4" />
                    </button>
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
              <button
                @click="deleteWorkspace(ws.id)"
                class="p-2 hover:bg-rose-500/10 rounded-lg text-on-surface/20 hover:text-rose-500 transition-colors ml-auto sm:ml-0"
              >
                <Trash2 class="size-4" />
              </button>
            </div>
          </div>

          <!-- Card Content -->
          <div class="p-6 flex flex-col md:flex-row gap-8">
            <div class="flex-1 space-y-4">
              <template v-if="ws.servers?.[0]">
                <div>
                  <label class="text-[10px] font-bold text-on-surface/40 uppercase tracking-tighter"
                    >Endpoint URL</label
                  >
                  <div class="flex items-center gap-2 mt-1">
                    <code
                      class="text-xs text-primary font-mono bg-primary/5 px-3 py-1.5 rounded border border-primary/10"
                      >{{ ws.servers[0].url }}</code
                    >
                    <a
                      :href="ws.servers[0].url"
                      target="_blank"
                      class="text-on-surface/40 hover:text-on-surface"
                      ><ExternalLink class="size-4"
                    /></a>
                  </div>
                </div>
                <div class="flex gap-8">
                  <div>
                    <label
                      class="text-[10px] font-bold text-on-surface/40 uppercase tracking-tighter"
                      >Version</label
                    >
                    <p class="text-xs mt-0.5 font-medium">1.24.1 (Stable)</p>
                  </div>
                  <div>
                    <label
                      class="text-[10px] font-bold text-on-surface/40 uppercase tracking-tighter"
                      >API Status</label
                    >
                    <button
                      @click="openSettingsModal(ws.servers[0])"
                      class="flex items-center gap-1.5 text-xs mt-0.5 text-primary hover:underline font-bold"
                    >
                      <Key class="size-3" />
                      {{ ws.servers[0].n8nApiKey ? "Configured" : "Missing Key" }}
                    </button>
                  </div>
                </div>
              </template>
              <div
                v-else-if="provisioningWorkspaceId === ws.id"
                class="flex items-center gap-3 py-4 text-primary"
              >
                <Loader2 class="size-5 animate-spin" />
                <span class="text-xs font-bold uppercase tracking-widest"
                  >Initialising CubePath Provisioning...</span
                >
              </div>
              <div v-else class="py-4">
                <Button @click="provisionServer(ws.name, ws.id)" variant="outline" size="md">
                  <Server class="size-4 mr-2" />
                  Provision CubePath Instance
                </Button>
              </div>
            </div>

            <!-- Server Actions Grid -->
            <div
              v-if="ws.servers?.[0]"
              class="grid grid-cols-2 gap-2 border-t md:border-t-0 md:border-l border-outline-variant pt-6 md:pt-0 md:pl-8 w-full md:w-70 shrink-0"
            >
              <button
                v-if="ws.servers[0].status === 'stopped'"
                @click="openActionModal('resume', ws.servers[0].id, 'Resume Server')"
                class="flex items-center justify-center gap-2 px-3 py-2.5 bg-surface-container hover:bg-surface-container-highest border border-outline-variant rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all"
              >
                <Play class="size-3.5 text-emerald-500" />
                <span class="truncate">Resume</span>
              </button>
              <button
                v-if="ws.servers[0].status === 'active'"
                @click="openActionModal('stop', ws.servers[0].id, 'Stop Server')"
                class="flex items-center justify-center gap-2 px-3 py-2.5 bg-surface-container hover:bg-surface-container-highest border border-outline-variant rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all"
              >
                <Square class="size-3.5 text-on-surface/40" />
                <span class="truncate">Stop</span>
              </button>
              <button
                @click="openActionModal('restart', ws.servers[0].id, 'Restart')"
                class="flex items-center justify-center gap-2 px-3 py-2.5 bg-surface-container hover:bg-surface-container-highest border border-outline-variant rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all"
              >
                <RotateCw class="size-3.5 text-amber-500" />
                <span class="truncate">Restart</span>
              </button>
              <button
                @click="openActionModal('reinstall', ws.servers[0].id, 'Reinstall')"
                class="flex items-center justify-center gap-2 px-3 py-2.5 bg-surface-container hover:bg-surface-container-highest border border-outline-variant rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all"
              >
                <RefreshCcw class="size-3.5 text-blue-500" />
                <span class="truncate">Reinstall</span>
              </button>
              <button
                @click="openActionModal('delete', ws.servers[0].id, 'Delete Server')"
                class="flex items-center justify-center gap-2 px-3 py-2.5 bg-surface-container hover:bg-error/10 hover:border-error/40 border border-outline-variant rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all text-on-surface/60 hover:text-error"
              >
                <Trash2 class="size-3.5" />
                <span class="truncate">Delete</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- Modals Implementation -->

    <!-- Add Client Modal -->
    <Modal
      :show="showAddClientModal"
      title="Provision New Client"
      @close="showAddClientModal = false"
    >
      <form class="space-y-6" @submit.prevent="createWorkspace">
        <div class="col-span-2">
          <label
            class="block text-[10px] font-bold text-on-surface/40 uppercase tracking-widest mb-2"
            >Client Company Name</label
          >
          <input
            v-model="newWorkspaceName"
            class="w-full bg-surface-container-low border border-outline-variant rounded-lg px-4 py-3 text-sm focus:ring-1 focus:ring-primary focus:border-primary outline-none"
            placeholder="e.g. Acme Corp"
            type="text"
            required
          />
        </div>
        <div class="pt-4">
          <Button type="submit" :disabled="creating || !newWorkspaceName" class="w-full" size="lg">
            <Loader2 v-if="creating" class="size-4 animate-spin mr-2" />
            Initialize Workspace
          </Button>
        </div>
      </form>
    </Modal>

    <!-- One-Time Password Display Modal -->
    <Modal
      :show="showProvisionModal"
      title="VPS Security Credentials"
      @close="showProvisionModal = false"
    >
      <div class="space-y-6">
        <div class="flex flex-col items-center text-center space-y-2">
          <div class="bg-primary/20 p-3 rounded-full mb-2">
            <ShieldAlert class="size-8 text-primary" />
          </div>
          <p class="text-on-surface/60 text-sm">
            This is the **ONLY TIME** you will see your root password. Please store it securely.
          </p>
        </div>

        <div class="bg-black/40 border border-white/10 rounded-xl p-4 space-y-2">
          <label class="text-[10px] uppercase tracking-widest text-on-surface/40 font-bold"
            >Root Password</label
          >
          <div class="flex items-center gap-2">
            <input
              :type="passwordVisible ? 'text' : 'password'"
              :value="generatedPassword"
              readonly
              class="flex-1 bg-transparent border-none text-xl font-mono text-primary focus:ring-0"
            />
            <button
              @click="passwordVisible = !passwordVisible"
              class="p-2 hover:bg-white/5 rounded-lg transition-colors"
            >
              <component :is="passwordVisible ? EyeOff : Eye" class="size-4" />
            </button>
            <button
              @click="copyToClipboard(generatedPassword)"
              class="p-2 hover:bg-white/5 rounded-lg transition-colors text-primary"
            >
              <Copy class="size-4" />
            </button>
          </div>
        </div>

        <div class="space-y-4">
          <div class="flex items-center gap-3">
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
            class="w-full bg-black/20 border border-white/10 rounded-lg px-4 py-2.5 text-sm focus:ring-2 focus:ring-primary focus:outline-none transition-all"
            @keyup.enter="executeAction"
          />
          <p v-if="actionError" class="text-[10px] text-error font-bold uppercase tracking-wide">
            {{ actionError }}
          </p>
        </div>
        <div class="flex gap-2">
          <button
            @click="showActionModal = false"
            class="flex-1 bg-white/5 hover:bg-white/10 text-on-surface text-sm py-2.5 rounded-lg transition-colors"
          >
            Cancel
          </button>
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
          </p>
        </div>
        <div class="space-y-2">
          <label class="text-[10px] font-bold text-on-surface/40 uppercase tracking-widest"
            >API Key</label
          >
          <div class="relative group">
            <input
              v-model="n8nApiKey"
              class="w-full bg-black/40 border border-outline-variant rounded-lg px-4 py-3 font-mono text-sm tracking-widest outline-none"
              type="password"
              placeholder="fluvia_n8n_..."
            />
          </div>
        </div>
        <div class="flex gap-3 pt-2">
          <button
            @click="showSettingsModal = false"
            class="flex-1 bg-surface-container-highest hover:bg-surface-container-highest/80 text-xs font-bold py-3 rounded-lg border border-outline-variant transition-all"
          >
            Cancel
          </button>
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
