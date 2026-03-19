<script setup lang="ts">
import { ref, onMounted, computed } from "vue";
import { orpc } from "../../lib/orpc";
import {
  Plus,
  Server,
  Activity,
  ExternalLink,
  ChevronRight,
  Loader2,
  Settings,
  Database,
} from "lucide-vue-next";
import { cn } from "../../lib/utils";

const props = defineProps<{
  initialWorkspaces?: any[];
}>();

const workspaces = ref<any[]>(props.initialWorkspaces || []);
const loading = ref(!props.initialWorkspaces);
const creating = ref(false);
const newWorkspaceName = ref("");

async function fetchWorkspaces() {
  // Only fetch if we didn't get initial data, or to refresh
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

    <!-- Stats Overview (Subtle Layering) -->
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
            <div class="space-y-1">
              <h3 class="text-xl font-bold text-white group-hover:text-primary transition-colors">
                {{ ws.name }}
              </h3>
              <p class="text-xs font-mono text-muted-foreground tracking-widest uppercase">
                ID: {{ ws.id.slice(0, 8) }}
              </p>
            </div>
            <div class="flex gap-2">
              <button
                class="p-2 hover:bg-white/5 rounded-lg text-muted-foreground transition-colors"
              >
                <Settings class="size-4" />
              </button>
            </div>
          </div>

          <!-- Server Status -->
          <div v-if="ws.servers && ws.servers.length > 0" class="space-y-4">
            <div
              v-for="srv in ws.servers"
              :key="srv.id"
              class="bg-black/20 rounded-lg p-4 border border-white/5 space-y-3"
            >
              <div class="flex items-center justify-between">
                <div class="flex items-center gap-2">
                  <div
                    :class="
                      cn(
                        'size-2 rounded-full',
                        srv.status === 'active'
                          ? 'bg-accent animate-pulse'
                          : srv.status === 'provisioning'
                            ? 'bg-orange-400 animate-pulse'
                            : 'bg-rose-500',
                      )
                    "
                  ></div>
                  <span class="text-sm font-medium text-white capitalize">{{ srv.status }}</span>
                </div>
                <span class="text-[10px] font-mono text-muted-foreground"
                  >CUBEPATH: {{ srv.id.slice(0, 8) }}</span
                >
              </div>

              <div class="flex items-center justify-between gap-4 pt-2">
                <div class="flex flex-col gap-0.5 min-w-0">
                  <span
                    class="text-[10px] text-muted-foreground uppercase tracking-tighter font-bold"
                    >Endpoint</span
                  >
                  <span class="text-xs truncate text-accent font-mono">{{ srv.url }}</span>
                </div>

                <a
                  :href="`/dashboard/${ws.id}/designer?serverId=${srv.id}`"
                  class="bg-white/5 hover:bg-white/10 text-white px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-all whitespace-nowrap border border-white/5"
                >
                  Configure
                  <ChevronRight class="size-3" />
                </a>
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
            {{ ws.servers?.[0]?.workflows?.length || 0 }} Active Workflows
          </span>
          <div class="flex items-center gap-4">
            <a
              :href="`/dashboard/${ws.id}`"
              class="text-xs font-medium text-white/50 hover:text-white transition-colors flex items-center gap-1"
            >
              Details
              <ChevronRight class="size-3" />
            </a>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
