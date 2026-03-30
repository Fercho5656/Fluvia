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
  "inline-flex items-center justify-center font-label font-bold uppercase tracking-wider transition-all active:scale-95 disabled:pointer-events-none disabled:opacity-50 cursor-pointer whitespace-nowrap";

const variants = {
  primary:
    "bg-primary-container text-white electric-glow hover:bg-inverse-primary hover:-translate-y-0.5",
  secondary:
    "bg-surface-container-highest/40 backdrop-blur-md border border-outline-variant/30 text-on-surface hover:bg-surface-container-highest",
  tertiary: "text-on-surface hover:bg-surface-container-highest/50",
  outline: "border border-outline-variant text-on-surface hover:bg-surface-container-highest",
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
