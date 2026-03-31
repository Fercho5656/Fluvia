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
    <Transition name="modal">
      <div v-if="show" class="fixed inset-0 z-[100] flex items-center justify-center p-4">
        <!-- Backdrop -->
        <div class="absolute inset-0 bg-black/80 backdrop-blur-sm" @click="$emit('close')"></div>

        <!-- Content -->
        <div
          :class="
            cn(
              'relative w-full bg-surface-container rounded-2xl border border-outline p-8 shadow-2xl modal-content',
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
    </Transition>
  </Teleport>
</template>

<style scoped>
.modal-enter-active,
.modal-leave-active {
  transition: opacity 0.25s ease;
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}

.modal-enter-active .modal-content {
  transition:
    transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 1),
    opacity 0.25s ease;
}

.modal-leave-active .modal-content {
  transition:
    transform 0.2s ease-in,
    opacity 0.2s ease-in;
}

.modal-enter-from .modal-content {
  transform: scale(0.95) translateY(10px);
  opacity: 0;
}

.modal-leave-to .modal-content {
  transform: scale(0.98);
  opacity: 0;
}
</style>
