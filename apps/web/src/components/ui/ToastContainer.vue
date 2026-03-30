<script setup lang="ts">
import { toastStore } from "@/lib/toast-store";
import Toast from "./Toast.vue";
import { ref, onMounted } from "vue";

const isMounted = ref(false);
onMounted(() => {
  isMounted.value = true;
});
</script>

<template>
  <Teleport to="body" v-if="isMounted">
    <div
      class="fixed top-4 right-4 z-[200] flex flex-col gap-2 max-w-sm w-full pointer-events-none"
    >
      <TransitionGroup
        enter-active-class="transition duration-300 ease-out"
        enter-from-class="opacity-0 translate-x-8"
        enter-to-class="opacity-100 translate-x-0"
        leave-active-class="transition duration-200 ease-in"
        leave-from-class="opacity-100 scale-100"
        leave-to-class="opacity-0 scale-95"
      >
        <div v-for="toast in toastStore.toasts" :key="toast.id" class="pointer-events-auto w-full">
          <Toast
            :message="toast.message"
            :status="toast.status"
            :timeout="toast.timeout"
            @close="toastStore.remove(toast.id)"
          />
        </div>
      </TransitionGroup>
    </div>
  </Teleport>
</template>
