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
  <div class="flex items-center gap-2.5 bg-[var(--iot-bg-subtle)] border border-[var(--iot-border)] rounded-full px-4.5 py-2 text-xs backdrop-blur-md transition-all duration-300 hover:border-[var(--iot-accent)]/30">
    <span class="w-2.5 h-2.5 rounded-full transition-all duration-300" :class="[online ? 'bg-emerald-500 shadow-[0_0_8px_#10b981]' : 'bg-zinc-600']" />
    <span class="font-semibold text-[var(--iot-text)]">{{ online ? "Online" : "Offline" }}</span>
  </div>
</template>
