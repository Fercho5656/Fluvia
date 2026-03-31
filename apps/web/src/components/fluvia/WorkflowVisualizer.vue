<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed, watch } from "vue";
import { Maximize, ZoomIn, ZoomOut, MousePointer2 } from "lucide-vue-next";
import Button from "@/components/ui/Button.vue";

interface N8nNode {
  name: string;
  type: string;
  position: number[];
  parameters: Record<string, any>;
}

interface Props {
  nodes: N8nNode[];
  connections: Record<string, any>;
}

const props = defineProps<Props>();

// Canvas state
const svgRef = ref<SVGSVGElement | null>(null);
const viewbox = ref({ x: 0, y: 0, width: 1000, height: 1000 });
const isDragging = ref(false);
const lastMousePos = ref({ x: 0, y: 0 });

const nodeWidth = 180;
const nodeHeight = 80;

// Computed connections paths
const paths = computed(() => {
  const result: { d: string; id: string }[] = [];

  if (!props.connections) return result;

  Object.entries(props.connections).forEach(([sourceName, connectionData]: [string, any]) => {
    const sourceNode = props.nodes.find((n) => n.name === sourceName);
    if (!sourceNode || !connectionData.main) return;

    connectionData.main.forEach((outputs: any[]) => {
      outputs.forEach((target: any) => {
        const targetNode = props.nodes.find((n) => n.name === target.node);
        if (!targetNode) return;

        // Coordinates
        const startX = sourceNode.position[0] + nodeWidth;
        const startY = sourceNode.position[1] + nodeHeight / 2;
        const endX = targetNode.position[0];
        const endY = targetNode.position[1] + nodeHeight / 2;

        // Bezier curve
        const cp1x = startX + (endX - startX) / 2;
        const cp2x = startX + (endX - startX) / 2;

        result.push({
          id: `${sourceName}-${target.node}`,
          d: `M ${startX} ${startY} C ${cp1x} ${startY}, ${cp2x} ${endY}, ${endX} ${endY}`,
        });
      });
    });
  });

  return result;
});

// Pan & Zoom Logic
function handleMouseDown(e: MouseEvent) {
  isDragging.value = true;
  lastMousePos.value = { x: e.clientX, y: e.clientY };
}

function handleMouseMove(e: MouseEvent) {
  if (!isDragging.value) return;

  const dx =
    (e.clientX - lastMousePos.value.x) *
    (viewbox.value.width / (svgRef.value?.clientWidth || 1000));
  const dy =
    (e.clientY - lastMousePos.value.y) *
    (viewbox.value.height / (svgRef.value?.clientHeight || 1000));

  viewbox.value.x -= dx;
  viewbox.value.y -= dy;
  lastMousePos.value = { x: e.clientX, y: e.clientY };
}

function handleMouseUp() {
  isDragging.value = false;
}

function handleWheel(e: WheelEvent) {
  e.preventDefault();
  const zoomFactor = e.deltaY > 0 ? 1.1 : 0.9;

  const newWidth = viewbox.value.width * zoomFactor;
  const newHeight = viewbox.value.height * zoomFactor;

  // Center zoom
  viewbox.value.x -= (newWidth - viewbox.value.width) / 2;
  viewbox.value.y -= (newHeight - viewbox.value.height) / 2;
  viewbox.value.width = newWidth;
  viewbox.value.height = newHeight;
}

function autoFit() {
  if (props.nodes.length === 0) return;

  const minX = Math.min(...props.nodes.map((n) => n.position[0]));
  const minY = Math.min(...props.nodes.map((n) => n.position[1]));
  const maxX = Math.max(...props.nodes.map((n) => n.position[0] + nodeWidth));
  const maxY = Math.max(...props.nodes.map((n) => n.position[1] + nodeHeight));

  const width = maxX - minX;
  const height = maxY - minY;
  const padding = 100;

  viewbox.value = {
    x: minX - padding,
    y: minY - padding,
    width: width + padding * 2,
    height: height + padding * 2,
  };
}

// Node styling helper
function getNodeColor(type: string) {
  if (type.includes("trigger") || type.includes("webhook") || type.includes("schedule"))
    return "#10b981"; // Emerald
  if (type.includes("httpRequest") || type.includes("http")) return "#0ea5e9"; // Sky
  if (type.includes("code")) return "#f59e0b"; // Amber
  return "#6366f1"; // Indigo default
}

function getShortName(name: string) {
  return name.replace("n8n-nodes-base.", "").replace("Trigger", "");
}

watch(() => props.nodes, autoFit, { deep: true, immediate: true });

onMounted(() => {
  window.addEventListener("mouseup", handleMouseUp);
});

onUnmounted(() => {
  window.removeEventListener("mouseup", handleMouseUp);
});
</script>

<template>
  <div class="relative w-full h-full bg-black/20 overflow-hidden group/canvas">
    <!-- Grid Pattern Overlay -->
    <div
      class="absolute inset-0 pointer-events-none opacity-5"
      :style="{
        backgroundImage: 'radial-gradient(circle, white 1px, transparent 1px)',
        backgroundSize: '30px 30px',
        transform: `translate(${-viewbox.x % 30}px, ${-viewbox.y % 30}px)`,
      }"
    ></div>

    <svg
      ref="svgRef"
      class="w-full h-full cursor-grab active:cursor-grabbing"
      :viewBox="`${viewbox.x} ${viewbox.y} ${viewbox.width} ${viewbox.height}`"
      @mousedown="handleMouseDown"
      @mousemove="handleMouseMove"
      @wheel="handleWheel"
    >
      <!-- Connections -->
      <g class="connections">
        <path
          v-for="path in paths"
          :key="path.id"
          :d="path.d"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          class="text-primary/30"
        />
      </g>

      <!-- Nodes -->
      <g
        v-for="node in nodes"
        :key="node.name"
        :transform="`translate(${node.position[0]}, ${node.position[1]})`"
      >
        <!-- Node Card -->
        <rect
          :width="nodeWidth"
          :height="nodeHeight"
          rx="16"
          fill="rgba(30, 30, 30, 0.95)"
          stroke="rgba(255, 255, 255, 0.1)"
          stroke-width="1"
          class="drop-shadow-2xl"
        />

        <!-- Left accent stripe -->
        <rect width="6" :height="nodeHeight" rx="3" :fill="getNodeColor(node.type)" x="0" y="0" />

        <!-- Node Icon Placeholder -->
        <circle cx="35" cy="40" r="15" fill="rgba(255,255,255,0.05)" />
        <text x="35" y="45" text-anchor="middle" class="fill-white/20 font-bold text-[10px]">
          {{ node.type.split(".").pop()?.slice(0, 2).toUpperCase() }}
        </text>

        <!-- Node Info -->
        <text x="65" y="35" class="fill-white font-bold text-xs">
          {{ node.name.length > 15 ? node.name.slice(0, 15) + "..." : node.name }}
        </text>
        <text
          x="65"
          y="55"
          class="fill-on-surface/40 text-[10px] uppercase font-bold tracking-widest"
        >
          {{ getShortName(node.type) }}
        </text>

        <!-- Ports -->
        <circle :cx="0" :cy="nodeHeight / 2" r="4" fill="#333" stroke="#555" />
        <circle :cx="nodeWidth" :cy="nodeHeight / 2" r="4" fill="#333" stroke="#555" />
      </g>
    </svg>

    <!-- Toolbar -->
    <div
      class="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-2 p-1.5 bg-surface-container-highest/80 backdrop-blur-xl border border-outline-variant rounded-full shadow-2xl transition-all opacity-0 group-hover/canvas:opacity-100"
    >
      <Button
        variant="ghost"
        size="icon"
        class="h-8 w-8"
        @click="
          viewbox.width *= 0.9;
          viewbox.height *= 0.9;
        "
      >
        <ZoomIn class="size-4" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        class="h-8 w-8"
        @click="
          viewbox.width *= 1.1;
          viewbox.height *= 1.1;
        "
      >
        <ZoomOut class="size-4" />
      </Button>
      <div class="w-px h-4 bg-outline-variant mx-1"></div>
      <Button variant="ghost" size="sm" class="h-8 px-3 text-[10px]" @click="autoFit">
        <Maximize class="size-3 mr-2" />
        Auto Fit
      </Button>
    </div>
  </div>
</template>

<style scoped>
svg {
  user-select: none;
  touch-action: none;
}
text {
  pointer-events: none;
}
</style>
