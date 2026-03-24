<script setup lang="ts">
import { ref, onMounted, computed } from "vue";
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
} from "lucide-vue-next";
import { cn } from "@/lib/utils";

const props = defineProps<{
  initialWorkspaces?: any[];
}>();

const workspaces = ref<any[]>(props.initialWorkspaces || []);
const loading = ref(!props.initialWorkspaces);
const creating = ref(false);
const newWorkspaceName = ref("");
const activeMenuId = ref<string | null>(null);

// Workspace Edit state
const editingWorkspaceId = ref<string | null>(null);
const editNameValue = ref("");

// Password Security State
const showProvisionModal = ref(false);
const generatedPassword = ref("");
const passwordVisible = ref(false);
const passwordConfirmed = ref(false);

const provisioningWorkspaceId = ref<string | null>(null);

const showActionModal = ref(false);
const actionPassword = ref("");
const currentAction = ref<{ type: string; id: string; label: string } | null>(null);
const actionLoading = ref(false);
const actionError = ref("");

async function fetchWorkspaces() {
  try {
    const data = await orpc.fluvia.workspace.list();
    workspaces.value = data;
  } catch (error) {
    console.error("Failed to fetch workspaces:", error);
  } finally {
    loading.value = false;
  }
}

onMounted(() => {
  if (!props.initialWorkspaces || props.initialWorkspaces.length === 0) {
    fetchWorkspaces();
  }
});

async function createWorkspace() {
  if (!newWorkspaceName.value) return;
  creating.value = true;
  try {
    await orpc.fluvia.workspace.create({ name: newWorkspaceName.value });
    newWorkspaceName.value = "";
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
    alert(error.message || "Failed to provision server. CubePath may be out of IPv4 resources.");
  } finally {
    provisioningWorkspaceId.value = null;
  }
}

function copyPassword() {
  navigator.clipboard.writeText(generatedPassword.value);
}

// Action Verification
function openActionModal(type: string, id: string, label: string) {
  currentAction.value = { type, id, label };
  actionPassword.value = "";
  actionError.value = "";
  showActionModal.value = true;
  activeMenuId.value = null;
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

    showActionModal.value = false;
    currentAction.value = null;
    await fetchWorkspaces();
  } catch (error: any) {
    actionError.value = error.message || "Invalid password or server error.";
  } finally {
    actionLoading.value = false;
  }
}

// Workspace Actions
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

const stats = computed(() => [
  { label: "Active Servers", value: activeServersCount.value, icon: Server },
  { label: "Total Workflows", value: totalWorkflowsCount.value, icon: Activity },
  { label: "In Provisioning", value: provisioningServersCount.value, icon: Loader2 },
]);
</script>

<template>
  <div class="space-y-8 relative">
    <!-- Header Section -->
    <div class="flex flex-col md:flex-row md:items-center justify-between gap-4">
      <div>
        <h1 class="text-4xl font-bold tracking-tight text-white">Agency Command</h1>
        <p class="text-muted-foreground mt-1">
          Manage infrastructure and automation for your clients.
        </p>
      </div>

      <div class="flex items-center gap-3">
        <div class="relative group">
          <input
            v-model="newWorkspaceName"
            type="text"
            placeholder="New Client Name..."
            class="bg-surface-elevated border border-border rounded-lg px-4 py-2.5 text-sm w-64 focus:ring-2 focus:ring-primary focus:outline-none transition-all"
            @keyup.enter="createWorkspace"
          />
        </div>
        <button
          @click="createWorkspace"
          :disabled="creating || !newWorkspaceName"
          class="bg-primary hover:bg-primary/90 disabled:opacity-50 text-white px-4 py-2.5 rounded-lg text-sm font-medium flex items-center gap-2 transition-all shadow-lg shadow-primary/20"
        >
          <Loader2 v-if="creating" class="size-4 animate-spin" />
          <Plus v-else class="size-4" />
          Add Client
        </button>
      </div>
    </div>

    <!-- Stats Overview -->
    <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
      <div
        v-for="stat in stats"
        :key="stat.label"
        class="bg-surface-elevated border border-border p-6 rounded-xl space-y-2"
      >
        <div class="flex items-center justify-between">
          <span class="text-muted-foreground text-sm font-medium">{{ stat.label }}</span>
          <component :is="stat.icon" class="size-5 text-primary/60" />
        </div>
        <div class="text-3xl font-bold text-white">{{ stat.value }}</div>
      </div>
    </div>

    <!-- Workspaces List -->
    <div v-if="loading" class="flex flex-col items-center justify-center py-20 gap-4">
      <Loader2 class="size-8 animate-spin text-primary" />
      <p class="text-muted-foreground animate-pulse">Syncing infrastructure...</p>
    </div>

    <div
      v-else-if="workspaces.length === 0"
      class="text-center py-20 glass-panel rounded-2xl border-dashed"
    >
      <div class="bg-primary/10 size-16 rounded-full flex items-center justify-center mx-auto mb-4">
        <Database class="size-8 text-primary" />
      </div>
      <h3 class="text-xl font-semibold text-white">No Client Workspaces</h3>
      <p class="text-muted-foreground mt-2 max-w-xs mx-auto">
        Create your first client workspace to start deploying automation servers.
      </p>
    </div>

    <div v-else class="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div
        v-for="ws in workspaces"
        :key="ws.id"
        class="group bg-surface-elevated border border-border hover:border-primary/30 rounded-xl overflow-hidden transition-all duration-300 hover:shadow-2xl hover:shadow-primary/5"
      >
        <div class="p-6 space-y-6">
          <div class="flex items-start justify-between">
            <div class="space-y-1 flex-1 min-w-0">
              <div v-if="editingWorkspaceId === ws.id" class="flex items-center gap-2 mr-4">
                <input
                  v-model="editNameValue"
                  class="bg-black/20 border border-primary/50 rounded px-2 py-1 text-lg font-bold text-white w-full focus:outline-none focus:ring-1 focus:ring-primary"
                  @keyup.enter="saveWorkspaceName"
                  @keyup.esc="editingWorkspaceId = null"
                  auto-focus
                />
                <button
                  @click="saveWorkspaceName"
                  class="p-1 text-emerald-400 hover:bg-emerald-400/10 rounded"
                >
                  <Check class="size-4" />
                </button>
                <button
                  @click="editingWorkspaceId = null"
                  class="p-1 text-rose-400 hover:bg-rose-400/10 rounded"
                >
                  <X class="size-4" />
                </button>
              </div>
              <h3
                v-else
                class="text-xl font-bold text-white group-hover:text-primary transition-colors truncate"
              >
                {{ ws.name }}
              </h3>

              <p class="text-xs font-mono text-muted-foreground tracking-widest uppercase">
                ID: {{ ws.id.slice(0, 8) }}
              </p>
            </div>
            <div class="flex gap-1">
              <button
                @click="startEditing(ws)"
                class="p-2 hover:bg-white/5 rounded-lg text-muted-foreground transition-colors"
                title="Edit Name"
              >
                <Pencil class="size-4" />
              </button>
              <button
                @click="deleteWorkspace(ws.id)"
                class="p-2 hover:bg-rose-500/10 rounded-lg text-muted-foreground hover:text-rose-500 transition-colors"
                title="Delete Client"
              >
                <Trash2 class="size-4" />
              </button>
            </div>
          </div>

          <!-- Servers -->
          <div v-if="ws.servers && ws.servers.length > 0" class="space-y-4">
            <div
              v-for="srv in ws.servers"
              :key="srv.id"
              class="bg-black/20 rounded-lg p-4 border border-white/5 space-y-3 relative"
            >
              <div class="flex items-center justify-between">
                <div class="flex items-center gap-2">
                  <div
                    :class="
                      cn(
                        'size-2 rounded-full',
                        srv.status === 'active'
                          ? 'bg-accent animate-pulse'
                          : srv.status === 'stopped'
                            ? 'bg-zinc-600'
                            : srv.status === 'provisioning'
                              ? 'bg-orange-400 animate-pulse'
                              : 'bg-rose-500',
                      )
                    "
                  ></div>
                  <span class="text-sm font-medium text-white capitalize">{{ srv.status }}</span>
                </div>

                <!-- Infrastructure Menu -->
                <div class="relative">
                  <button
                    @click="activeMenuId = activeMenuId === srv.id ? null : srv.id"
                    class="p-1 hover:bg-white/10 rounded transition-colors"
                  >
                    <MoreVertical class="size-4 text-muted-foreground" />
                  </button>

                  <div
                    v-if="activeMenuId === srv.id"
                    class="absolute right-0 top-full mt-2 w-48 glass-panel rounded-xl shadow-2xl z-50 p-1 overflow-hidden"
                  >
                    <button
                      v-if="srv.status === 'active'"
                      @click="openActionModal('stop', srv.id, 'Stop Server')"
                      class="w-full text-left p-2 hover:bg-white/5 rounded-lg text-xs flex items-center gap-2 text-white/80"
                    >
                      <Square class="size-3" /> Stop Server
                    </button>
                    <button
                      v-if="srv.status === 'stopped'"
                      @click="openActionModal('resume', srv.id, 'Resume Server')"
                      class="w-full text-left p-2 hover:bg-white/5 rounded-lg text-xs flex items-center gap-2 text-white/80"
                    >
                      <Play class="size-3" /> Resume Server
                    </button>
                    <button
                      @click="openActionModal('restart', srv.id, 'Restart')"
                      class="w-full text-left p-2 hover:bg-white/5 rounded-lg text-xs flex items-center gap-2 text-white/80"
                    >
                      <RotateCw class="size-3" /> Restart
                    </button>
                    <div class="h-px bg-white/5 my-1"></div>
                    <button
                      @click="openActionModal('reinstall', srv.id, 'Reinstall')"
                      class="w-full text-left p-2 hover:bg-white/5 rounded-lg text-xs flex items-center gap-2 text-orange-400/80"
                    >
                      <RefreshCcw class="size-3" /> Reinstall
                    </button>
                    <button
                      @click="openActionModal('delete', srv.id, 'Delete Server')"
                      class="w-full text-left p-2 hover:bg-white/5 rounded-lg text-xs flex items-center gap-2 text-rose-500/80"
                    >
                      <Trash2 class="size-3" /> Delete Server
                    </button>
                  </div>
                </div>
              </div>

              <div class="flex items-center justify-between gap-4 pt-2">
                <div class="flex flex-col gap-0.5 min-w-0">
                  <span
                    class="text-[10px] text-muted-foreground uppercase tracking-tighter font-bold"
                    >Endpoint</span
                  >
                  <span class="text-xs truncate text-accent font-mono">{{ srv.url }}</span>
                </div>

                <span class="text-[10px] font-mono text-muted-foreground uppercase"
                  >CubePath: {{ srv.id.slice(0, 8) }}</span
                >
              </div>
            </div>
          </div>

          <div
            v-else
            class="bg-black/20 rounded-lg p-8 border border-dashed border-white/10 flex flex-col items-center justify-center text-center"
          >
            <template v-if="provisioningWorkspaceId === ws.id">
              <Loader2 class="size-8 animate-spin text-primary mb-4" />
              <p class="text-sm text-muted-foreground">Provisioning your server...</p>
              <p
                class="text-[10px] text-muted-foreground/60 mt-1 uppercase tracking-widest font-bold"
              >
                Retrying if IP reservation fails
              </p>
            </template>
            <template v-else>
              <p class="text-sm text-muted-foreground mb-4">No automation server provisioned.</p>
              <button
                @click="provisionServer(ws.name, ws.id)"
                class="text-xs font-bold text-primary hover:text-primary/80 flex items-center gap-2 uppercase tracking-widest"
              >
                <Server class="size-3" />
                Provision CubePath Server
              </button>
            </template>
          </div>
        </div>

        <!-- Footer / Action bar -->
        <div class="bg-black/10 px-6 py-3 border-t border-border flex items-center justify-between">
          <span class="text-[10px] text-muted-foreground font-medium uppercase tracking-widest">
            {{ ws.servers?.[0]?.workflows?.length || 0 }} Snapshots Deployed
          </span>
          <div class="flex items-center gap-4">
            <a
              :href="`/dashboard/designer`"
              class="text-xs font-medium text-white/50 hover:text-white transition-colors flex items-center gap-1"
            >
              AI Designer
              <ChevronRight class="size-3" />
            </a>
          </div>
        </div>
      </div>
    </div>

    <!-- MODALS -->

    <!-- One-Time Password Display Modal -->
    <div
      v-if="showProvisionModal"
      class="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
    >
      <div
        class="glass-panel w-full max-w-md p-8 rounded-2xl border-primary/20 space-y-6 shadow-2xl"
      >
        <div class="flex flex-col items-center text-center space-y-2">
          <div class="bg-primary/20 p-3 rounded-full mb-2">
            <ShieldAlert class="size-8 text-primary" />
          </div>
          <h2 class="text-2xl font-bold text-white">VPS Security Credentials</h2>
          <p class="text-muted-foreground text-sm">
            Your server is being provisioned. This is the **ONLY TIME** you will see your root
            password. Please store it securely (e.g., in a password manager).
          </p>
        </div>

        <div class="bg-black/40 border border-white/10 rounded-xl p-4 space-y-2">
          <label class="text-[10px] uppercase tracking-widest text-muted-foreground font-bold"
            >Root Password</label
          >
          <div class="flex items-center gap-2">
            <input
              :type="passwordVisible ? 'text' : 'password'"
              :value="generatedPassword"
              readonly
              class="flex-1 bg-transparent border-none text-xl font-mono text-accent focus:ring-0"
            />
            <button
              @click="passwordVisible = !passwordVisible"
              class="p-2 hover:bg-white/5 rounded-lg transition-colors"
            >
              <component :is="passwordVisible ? EyeOff : Eye" class="size-4" />
            </button>
            <button
              @click="copyPassword"
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
            <label for="confirm-pwd" class="text-xs text-muted-foreground">
              I have safely stored this password and understand it won't be shown again.
            </label>
          </div>

          <button
            @click="showProvisionModal = false"
            :disabled="!passwordConfirmed"
            class="w-full bg-primary hover:bg-primary/90 disabled:opacity-30 text-white font-bold py-3 rounded-xl transition-all shadow-lg shadow-primary/20"
          >
            I'm Ready to Continue
          </button>
        </div>
      </div>
    </div>

    <!-- Action Verification Modal -->
    <div
      v-if="showActionModal"
      class="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
    >
      <div class="glass-panel w-full max-w-sm p-6 rounded-2xl border-white/10 space-y-4 shadow-2xl">
        <div class="flex items-center justify-between">
          <h3 class="text-lg font-bold text-white">{{ currentAction?.label }}</h3>
          <button @click="showActionModal = false" class="p-1 hover:bg-white/5 rounded-lg">
            <X class="size-5 text-muted-foreground" />
          </button>
        </div>

        <p class="text-xs text-muted-foreground">
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
          <p v-if="actionError" class="text-[10px] text-rose-500 font-bold uppercase tracking-wide">
            {{ actionError }}
          </p>
        </div>

        <div class="flex gap-2">
          <button
            @click="showActionModal = false"
            class="flex-1 bg-white/5 hover:bg-white/10 text-white text-sm py-2.5 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            @click="executeAction"
            :disabled="actionLoading || !actionPassword"
            class="flex-1 bg-primary hover:bg-primary/90 disabled:opacity-50 text-white text-sm font-bold py-2.5 rounded-lg transition-all flex items-center justify-center gap-2"
          >
            <Loader2 v-if="actionLoading" class="size-4 animate-spin" />
            Confirm
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
