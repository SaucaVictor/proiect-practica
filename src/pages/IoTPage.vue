<script setup lang="ts">
import { ref } from "vue";
import ParticleScene from "@/iot-interface/components/ParticleScene.vue";
import DeviceStatus from "@/iot-interface/components/DeviceStatus.vue";
import SensorCard from "@/iot-interface/components/SensorCard.vue";
import SensorChart from "@/iot-interface/components/SensorChart.vue";
import ControlPanel from "@/iot-interface/components/ControlPanel.vue";
import ScenarioManager from "@/iot-interface/components/ScenarioManager.vue";
import AdvancedGraphs from "@/iot-interface/components/AdvancedGraphs.vue";
import { useSensors } from "@/iot-interface/composables/useSensors";
import { useDevice } from "@/iot-interface/composables/useDevice";
import "@/iot-interface/styles/iot-theme.css";

const { sensors } = useSensors();
const { device } = useDevice();

const currentTab = ref<"dashboard" | "analytics">("dashboard");
</script>

<template>
  <div class="iot-page flex-1 overflow-y-auto bg-[var(--iot-bg)] text-[var(--iot-text)] relative z-10 select-none">
    <!-- Beautiful Animated canvas behind -->
    <ParticleScene />

    <!-- Container -->
    <div class="relative z-10 max-w-7xl mx-auto px-6 py-10 flex flex-col gap-8">
      
      <!-- Top Header -->
      <header class="flex flex-wrap items-center justify-between gap-6 pb-6 border-b border-white/5">
        <div class="logo">
          <h1 class="text-2xl font-bold tracking-tight text-[var(--iot-text)] flex items-center gap-2">
            Wemos Control
          </h1>
          <p class="text-xs text-[var(--iot-text-muted)] mt-1">Panou IoT — Monitorizare și Automatizare Sală Curs</p>
        </div>

        <div class="flex bg-[var(--iot-surface)] border border-[var(--iot-border)] rounded-2xl p-1">
          <button
            class="px-5 py-2 rounded-xl border-0 bg-transparent text-xs font-semibold text-[var(--iot-text-muted)] cursor-pointer transition-all duration-200 hover:text-[var(--iot-text)]"
            :class="{ 'bg-[var(--iot-accent-subtle)] text-[var(--iot-accent)] border border-[var(--iot-accent-border)]': currentTab === 'dashboard' }"
            @click="currentTab = 'dashboard'"
          >
            Panou Principal
          </button>
          <button
            class="px-5 py-2 rounded-xl border-0 bg-transparent text-xs font-semibold text-[var(--iot-text-muted)] cursor-pointer transition-all duration-200 hover:text-[var(--iot-text)]"
            :class="{ 'bg-[var(--iot-accent-subtle)] text-[var(--iot-accent)] border border-[var(--iot-accent-border)]': currentTab === 'analytics' }"
            @click="currentTab = 'analytics'"
          >
            Analiză Detaliată
          </button>
        </div>

        <!-- Device Status badge -->
        <DeviceStatus :device="device" />
      </header>

      <!-- View Switcher -->
      <Transition
        enter-active-class="transition duration-300 ease-out"
        enter-from-class="opacity-0 translate-y-3"
        enter-to-class="opacity-100 translate-y-0"
        leave-active-class="transition duration-200 ease-in"
        leave-from-class="opacity-100 translate-y-0"
        leave-to-class="opacity-0 translate-y-3"
        mode="out-in"
      >
        <!-- Main Dashboard View -->
        <div v-if="currentTab === 'dashboard'" class="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          <!-- Left side: Live Sensors and Historical Mini-Charts -->
          <div class="lg:col-span-2 space-y-8">
            
            <!-- Sensor Cards Section -->
            <section class="space-y-4">
              <h2 class="text-xs font-bold tracking-widest uppercase text-[var(--iot-text-muted)]">Senzori Live</h2>
              <div v-if="Object.keys(sensors).length" class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <SensorCard
                  v-for="(data, name) in sensors"
                  :key="name"
                  :name="String(name)"
                  :data="data"
                />
              </div>
              <div v-else class="flex flex-col items-center justify-center p-8 bg-[var(--iot-card-bg)] border border-[var(--iot-border)] rounded-2xl text-xs text-[var(--iot-text-muted)]/60">
                <div class="w-5 h-5 border-2 border-white/10 border-t-[var(--iot-accent)] rounded-full animate-spin mb-2" />
                <span>Nicio dată de la senzori — se așteaptă telemetria de la Wemos...</span>
              </div>
            </section>

            <!-- mini charts section -->
            <section class="space-y-4">
              <h2 class="text-xs font-bold tracking-widest uppercase text-[var(--iot-text-muted)]">Grafice Live Senzori</h2>
              <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <SensorChart sensor-name="Temperature" label="Temperatură" color="#ef4444" unit="°C" />
                <SensorChart sensor-name="Curent"      label="Curent"      color="#3b82f6" unit=" A" />
                <SensorChart sensor-name="Light"       label="Lumină"      color="#eab308" />
              </div>
            </section>

            <!-- Scenario manager section -->
            <section class="space-y-4 bg-[var(--iot-card-bg)]/30 border border-[var(--iot-border)] rounded-2xl p-6">
              <ScenarioManager />
            </section>
          </div>

          <!-- Right side: Control Panel -->
          <div class="space-y-4">
            <h2 class="text-xs font-bold tracking-widest uppercase text-[var(--iot-text-muted)]">Comenzi Echipament</h2>
            <ControlPanel />
          </div>
        </div>

        <!-- Advanced Analytics View -->
        <div v-else class="space-y-4">
          <AdvancedGraphs />
        </div>
      </Transition>

    </div>
  </div>
</template>

<style scoped>
.iot-page {
  font-family: 'Inter', sans-serif;
  scrollbar-width: thin;
  scrollbar-color: var(--iot-border-hover) transparent;
}
.iot-page::-webkit-scrollbar { width: 4px; }
.iot-page::-webkit-scrollbar-thumb {
  background-color: var(--iot-border-hover);
  border-radius: 4px;
}
</style>
