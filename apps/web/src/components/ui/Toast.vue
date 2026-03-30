<script setup lang="ts">
import { Info, AlertTriangle, XCircle, X } from "lucide-vue-next";
import { cn } from "@/lib/utils";
import type { ToastStatus } from "@/lib/toast-store";

const props = defineProps<{
  message: string;
  status: ToastStatus;
}>();

defineEmits(["close"]);

const statusConfig = {
  info: {
    icon: Info,
    bg: "bg-primary-container/20",
    text: "text-primary",
    border: "border-primary/20",
    iconColor: "text-primary",
  },
  warn: {
    icon: AlertTriangle,
    bg: "bg-tertiary-container/20",
    text: "text-tertiary",
    border: "border-tertiary/20",
    iconColor: "text-tertiary",
  },
  error: {
    icon: XCircle,
    bg: "bg-error-container/20",
    text: "text-error",
    border: "border-error/20",
    iconColor: "text-error",
  },
};

const config = statusConfig[props.status];
</script>

<template>
  <div
    :class="
      cn(
        'flex items-center gap-4 p-4 rounded-xl backdrop-blur-md border shadow-lg',
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
  </div>
</template>
