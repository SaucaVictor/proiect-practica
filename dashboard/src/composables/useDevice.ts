import { ref, onUnmounted } from "vue";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "../firebase";

export interface DeviceInfo {
  address: string;
  port: number;
  lastSeen: { toDate: () => Date } | null;
  online: boolean;
}

export function useDevice() {
  const device = ref<DeviceInfo | null>(null);

  const unsub = onSnapshot(doc(db, "devices", "wemos"), (snap) => {
    device.value = snap.exists() ? (snap.data() as DeviceInfo) : null;
  });

  onUnmounted(unsub);
  return { device };
}
