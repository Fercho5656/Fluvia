<script setup lang="ts">
import { Info, AlertTriangle, XCircle, X } from "lucide-vue-next";
import { cn } from "@/lib/utils";
import type { ToastStatus } from "@/lib/toast-store";

const props = defineProps<{
  message: string;
  status: ToastStatus;
  timeout?: number;
}>();

defineEmits(["close"]);

const statusConfig = {
  info: {
    icon: Info,
    bg: "bg-primary-container/20",
    text: "text-primary",
    border: "border-primary/20",
    iconColor: "text-primary",
    progressBg: "bg-primary",
  },
  warn: {
    icon: AlertTriangle,
    bg: "bg-tertiary-container/20",
    text: "text-tertiary",
    border: "border-tertiary/20",
    iconColor: "text-tertiary",
    progressBg: "bg-tertiary",
  },
  error: {
    icon: XCircle,
    bg: "bg-error-container/20",
    text: "text-error",
    border: "border-error/20",
    iconColor: "text-error",
    progressBg: "bg-error",
  },
};

const config = statusConfig[props.status];
</script>

<template>
  <div
    :class="
      cn(
        'relative flex items-center gap-4 p-4 rounded-xl backdrop-blur-md border shadow-lg overflow-hidden',
        config.bg,
        config.border,
        config.text,
      )
    "
  >
    <component :is="config.icon" :class="cn('size-5 shrink-0', config.iconColor)" />
    <p class="text-sm font-medium">{{ message }}</p>
    <button
      @click="$emit('close')"
      class="ml-auto p-1 hover:bg-white/10 rounded-full transition-colors"
    >
      <X class="size-4 opacity-50 hover:opacity-100" />
    </button>

    <!-- Progress Bar -->
    <div
      v-if="timeout && timeout > 0"
      class="absolute bottom-0 left-0 h-0.5 w-full overflow-hidden"
    >
      <div
        :class="cn('h-full w-full origin-left shrink-animation', config.progressBg)"
        :style="{ animationDuration: `${timeout}ms` }"
      ></div>
    </div>
  </div>
</template>

<style scoped>
@keyframes shrink {
  from {
    transform: scaleX(1);
  }
  to {
    transform: scaleX(0);
  }
}

.shrink-animation {
  animation-name: shrink;
  animation-timing-function: linear;
  animation-fill-mode: forwards;
}
</style>
