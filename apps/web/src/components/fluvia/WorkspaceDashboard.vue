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

async function provisionServer(workspaceId: string) {
  try {
    await orpc.fluvia.server.provision({ workspaceId });
    await fetchWorkspaces();
  } catch (error) {
    console.error("Failed to provision server:", error);
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

// Infrastructure Actions
async function stopServer(id: string) {
  await orpc.fluvia.server.stop({ id });
  await fetchWorkspaces();
  activeMenuId.value = null;
}

async function resumeServer(id: string) {
  await orpc.fluvia.server.resume({ id });
  await fetchWorkspaces();
  activeMenuId.value = null;
}

async function restartServer(id: string) {
  await orpc.fluvia.server.restart({ id });
  await fetchWorkspaces();
  activeMenuId.value = null;
}

async function deleteServer(id: string) {
  if (!confirm("Are you sure you want to delete this server? All deployed workflows will be lost."))
    return;
  await orpc.fluvia.server.delete({ id });
  await fetchWorkspaces();
  activeMenuId.value = null;
}

async function reinstallServer(id: string) {
  if (!confirm("This will wipe all data and reinstall the server from scratch. Proceed?")) return;
  await orpc.fluvia.server.reinstall({ id });
  await fetchWorkspaces();
  activeMenuId.value = null;
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
  <div class="space-y-8">
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
                      @click="stopServer(srv.id)"
                      class="w-full text-left p-2 hover:bg-white/5 rounded-lg text-xs flex items-center gap-2 text-white/80"
                    >
                      <Square class="size-3" /> Stop Server
                    </button>
                    <button
                      v-if="srv.status === 'stopped'"
                      @click="resumeServer(srv.id)"
                      class="w-full text-left p-2 hover:bg-white/5 rounded-lg text-xs flex items-center gap-2 text-white/80"
                    >
                      <Play class="size-3" /> Resume Server
                    </button>
                    <button
                      @click="restartServer(srv.id)"
                      class="w-full text-left p-2 hover:bg-white/5 rounded-lg text-xs flex items-center gap-2 text-white/80"
                    >
                      <RotateCw class="size-3" /> Restart
                    </button>
                    <div class="h-px bg-white/5 my-1"></div>
                    <button
                      @click="reinstallServer(srv.id)"
                      class="w-full text-left p-2 hover:bg-white/5 rounded-lg text-xs flex items-center gap-2 text-orange-400/80"
                    >
                      <RefreshCcw class="size-3" /> Reinstall
                    </button>
                    <button
                      @click="deleteServer(srv.id)"
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
            <p class="text-sm text-muted-foreground mb-4">No automation server provisioned.</p>
            <button
              @click="provisionServer(ws.id)"
              class="text-xs font-bold text-primary hover:text-primary/80 flex items-center gap-2 uppercase tracking-widest"
            >
              <Server class="size-3" />
              Provision CubePath Server
            </button>
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
  </div>
</template>
