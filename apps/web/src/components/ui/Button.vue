<script setup lang="ts">
import { computed } from "vue";
import { cn } from "@/lib/utils";

interface Props {
  variant?: "primary" | "secondary" | "tertiary" | "outline" | "ghost" | "danger";
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
  "inline-flex items-center justify-center font-label font-bold uppercase tracking-wider transition-all active:scale-95 cursor-pointer whitespace-nowrap rounded-full";

const variants = {
  primary:
    "bg-linear-to-br from-primary-container to-inverse-primary text-on-primary-container shadow-lg shadow-primary-container/20 hover:shadow-primary-container/40 hover:-translate-y-0.5",
  secondary:
    "bg-surface-container-highest/40 backdrop-blur-md border border-outline-variant/30 text-on-surface hover:bg-surface-container-highest/60",
  tertiary: "text-on-surface/60 hover:text-on-surface hover:bg-white/5",
  ghost: "text-on-surface/40 hover:text-on-surface hover:bg-white/5",
  outline: "border border-outline-variant/50 text-on-surface hover:bg-white/5",
  danger: "bg-error/10 border border-error/20 text-error hover:bg-error/20",
};

const sizes = {
  sm: "h-9 px-4 text-[10px]",
  md: "h-11 px-6 text-xs",
  lg: "h-14 px-10 text-sm",
  icon: "h-10 w-10",
};

const componentType = computed(() => (props.href ? "a" : "button"));

// Handle clicks on disabled links manually as native <a> doesn't support disabled attribute
function handleClick(e: MouseEvent) {
  if (props.disabled) {
    e.preventDefault();
    e.stopPropagation();
  }
}
</script>

<template>
  <component
    :is="componentType"
    :href="disabled ? undefined : href"
    :type="!href ? type : undefined"
    :disabled="disabled"
    @click="handleClick"
    :class="
      cn(
        baseStyles,
        variants[variant],
        sizes[size],
        disabled && 'opacity-40 cursor-not-allowed pointer-events-none',
        props.class,
      )
    "
  >
    <slot />
  </component>
</template>
