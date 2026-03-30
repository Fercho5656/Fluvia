<script setup lang="ts">
import { X } from "lucide-vue-next";
import { cn } from "@/lib/utils";
import { ref, onMounted } from "vue";

defineProps<{
  show: boolean;
  title: string;
  maxWidth?: string;
}>();

defineEmits(["close"]);

const isMounted = ref(false);
onMounted(() => {
  isMounted.value = true;
});
</script>

<template>
  <Teleport to="body" v-if="isMounted">
    <div v-if="show" class="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div class="absolute inset-0 bg-black/80 backdrop-blur-sm" @click="$emit('close')"></div>
      <div
        :class="
          cn(
            'relative w-full bg-surface-container rounded-2xl border border-outline p-8 shadow-2xl transition-all animate-in fade-in zoom-in-95 duration-200',
            maxWidth || 'max-w-xl',
          )
        "
      >
        <div class="flex justify-between items-center mb-8">
          <h3 class="text-2xl font-bold font-headline">{{ title }}</h3>
          <button
            @click="$emit('close')"
            class="p-2 hover:bg-surface-container-highest rounded-full transition-colors text-on-surface/40"
          >
            <X class="size-5" />
          </button>
        </div>
        <slot />
      </div>
    </div>
  </Teleport>
</template>
