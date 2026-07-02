<script setup lang="ts">
import { computed } from "vue";
import type { DeviceInfo } from "../composables/useDevice";

const props = defineProps<{ device: DeviceInfo | null }>();

const online = computed(() => {
  if (!props.device?.lastSeen) return false;
  const age = Date.now() - props.device.lastSeen.toDate().getTime();
  return age < 10000; // online if heard from in last 10s
});
</script>

<template>
  <div class="device-badge">
    <span class="dot" :class="{ online }" />
    <span class="label">{{ online ? "Online" : "Offline" }}</span>
  </div>
</template>

<style scoped>
.device-badge {
  display: flex; align-items: center; gap: 10px;
  background: rgba(255,255,255,0.04);
  border: 1px solid rgba(255,255,255,0.08);
  border-radius: 100px;
  padding: 8px 18px;
  font-size: 0.8rem;
  backdrop-filter: blur(10px);
}
.dot {
  width: 8px; height: 8px; border-radius: 50%;
  background: #475569;
  transition: background .3s, box-shadow .3s;
}
.dot.online { background: #22c55e; box-shadow: 0 0 8px #22c55e; }
.label { font-weight: 600; color: #e2e8f0; }
.ip { font-family: 'JetBrains Mono', monospace; color: #818cf8; }
.time { color: #64748b; font-size: 0.72rem; }
.muted { color: #475569; }
</style>
