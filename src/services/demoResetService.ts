import { resetStore } from "@/services/store";

export function resetDemoData() {
  resetStore();
  if (typeof window !== "undefined") {
    window.location.reload();
  }
}
