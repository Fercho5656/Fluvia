<script setup lang="ts">
import { cn } from "@/lib/utils";

defineProps<{
  label: string;
  value: string | number;
  icon?: any;
  subtext?: string;
  trend?: "stable" | "up" | "down";
}>();
</script>

<template>
  <div
    class="stats-card bg-surface-container-low rounded-xl p-8 flex flex-col justify-between h-40 border border-white/5 transition-colors hover:border-primary/40"
  >
    <div class="flex justify-between items-start">
      <p class="text-[10px] font-bold text-on-surface/40 uppercase tracking-widest">{{ label }}</p>
      <div v-if="icon" class="bg-primary/10 p-2 rounded-lg">
        <component :is="icon" class="size-5 text-primary" />
      </div>
    </div>
    <div>
      <p class="text-4xl font-extrabold font-headline">{{ value }}</p>
      <div v-if="subtext" class="flex items-center gap-2 mt-2">
        <span
          v-if="trend === 'stable'"
          class="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"
        ></span>
        <span
          :class="
            cn(
              'text-[10px] font-bold uppercase',
              trend === 'stable' ? 'text-emerald-500' : 'text-on-surface/30',
            )
          "
        >
          {{ subtext }}
        </span>
      </div>
    </div>
  </div>
</template>
