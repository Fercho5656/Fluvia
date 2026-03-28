<script setup lang="ts">
import { computed } from "vue";
import { cn } from "@/lib/utils";

const props = defineProps<{
  data: any;
  class?: string;
}>();

const highlightedHtml = computed(() => {
  if (!props.data) return "";

  const json = typeof props.data === "string" ? props.data : JSON.stringify(props.data, null, 2);

  // Simple regex-based syntax highlighting
  return json.replace(
    /("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g,
    (match) => {
      let cls = "text-orange-400"; // number
      if (/^"/.test(match)) {
        if (/:$/.test(match)) {
          cls = "text-primary"; // key
        } else {
          cls = "text-accent"; // string
        }
      } else if (/true|false/.test(match)) {
        cls = "text-purple-400"; // boolean
      } else if (/null/.test(match)) {
        cls = "text-slate-500"; // null
      }
      return `<span class="${cls}">${match}</span>`;
    },
  );
});
</script>

<template>
  <div :class="cn('terminal-view overflow-auto font-mono text-xs md:text-sm', props.class)">
    <pre v-html="highlightedHtml"></pre>
  </div>
</template>

<style scoped>
pre {
  margin: 0;
  white-space: pre-wrap;
  word-break: break-all;
}
</style>
