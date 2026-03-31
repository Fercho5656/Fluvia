<script setup lang="ts">
import { computed } from "vue";
import { cn } from "@/lib/utils";

interface Props {
  variant?: "primary" | "secondary" | "tertiary" | "outline";
  size?: "sm" | "md" | "lg" | "icon";
  class?: string;
  href?: string;
  disabled?: boolean;
  type?: "button" | "submit" | "reset";
}

const props = withDefaults(defineProps<Props>(), {
  variant: "primary",
  size: "md",
  type: "button",
});

const baseStyles =
  "inline-flex items-center justify-center font-label font-bold uppercase tracking-wider transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer whitespace-nowrap rounded-full";

const variants = {
  primary:
    "bg-primary text-on-primary shadow-lg shadow-primary/20 hover:bg-primary/90 hover:-translate-y-0.5",
  secondary:
    "bg-surface-container-highest border border-outline-variant text-on-surface hover:bg-surface-container-highest/80",
  tertiary: "text-on-surface hover:bg-surface-container-highest",
  outline: "border border-outline text-on-surface hover:bg-surface-container-highest",
};

const sizes = {
  sm: "h-9 px-4 text-[10px]",
  md: "h-11 px-6 text-xs",
  lg: "h-14 px-10 text-sm",
  icon: "h-10 w-10",
};

const componentType = computed(() => (props.href ? "a" : "button"));
</script>

<template>
  <component
    :is="componentType"
    :href="href"
    :type="!href ? type : undefined"
    :disabled="disabled"
    :class="cn(baseStyles, variants[variant], sizes[size], props.class)"
  >
    <slot />
  </component>
</template>
