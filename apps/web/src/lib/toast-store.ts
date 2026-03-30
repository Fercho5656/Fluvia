import { reactive } from "vue";

export type ToastStatus = "info" | "warn" | "error";

export interface Toast {
  id: string;
  message: string;
  status: ToastStatus;
  timeout?: number;
}

export const toastStore = reactive({
  toasts: [] as Toast[],
  add(message: string, status: ToastStatus = "info", timeout = 5000) {
    const id = Math.random().toString(36).substring(2, 9);
    this.toasts.push({ id, message, status, timeout });

    if (timeout > 0) {
      setTimeout(() => {
        this.remove(id);
      }, timeout);
    }
  },
  remove(id: string) {
    const index = this.toasts.findIndex((t) => t.id === id);
    if (index !== -1) {
      this.toasts.splice(index, 1);
    }
  },
  clear() {
    this.toasts.splice(0, this.toasts.length);
  },
  info(message: string, timeout?: number) {
    this.add(message, "info", timeout);
  },
  warn(message: string, timeout?: number) {
    this.add(message, "warn", timeout);
  },
  error(message: string, timeout?: number) {
    this.add(message, "error", timeout);
  },
});
