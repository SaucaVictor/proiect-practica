<script setup lang="ts">
import { ref } from "vue";
import ThreeScene from "./components/ThreeScene.vue";
import DeviceStatus from "./components/DeviceStatus.vue";
import SensorCard from "./components/SensorCard.vue";
import SensorChart from "./components/SensorChart.vue";
import ControlPanel from "./components/ControlPanel.vue";
import ScenarioManager from "./components/ScenarioManager.vue";
import AdvancedGraphs from "./components/AdvancedGraphs.vue";
import { useSensors } from "./composables/useSensors";
import { useDevice } from "./composables/useDevice";

const { sensors } = useSensors();
const { device } = useDevice();

const currentTab = ref<"dashboard" | "analytics">("dashboard");
</script>

<template>
  <div class="app">
    <ThreeScene />

    <div class="layout">
      <!-- Header -->
      <header class="header">
        <div class="logo">
          <div>
            <h1>Wemos Control</h1>
            <p>Panou IoT - Sală de Curs</p>
          </div>
        </div>

        <!-- Top Navigation -->
        <div class="nav-tabs">
          <button
            class="nav-tab"
            :class="{ active: currentTab === 'dashboard' }"
            @click="currentTab = 'dashboard'"
          >
            <span>Panou Principal</span>
          </button>
          <button
            class="nav-tab"
            :class="{ active: currentTab === 'analytics' }"
            @click="currentTab = 'analytics'"
          >
            <span>Analiză Detaliată</span>
          </button>
        </div>

        <DeviceStatus :device="device" />
      </header>

      <!-- View Switcher -->
      <Transition name="fade" mode="out-in">
        <div v-if="currentTab === 'dashboard'">
          <!-- Main -->
          <main class="main">
            <!-- Sensors -->
            <section class="sensors-section">
              <div class="section-label">Senzori Live</div>
              <div v-if="Object.keys(sensors).length" class="sensor-grid">
                <SensorCard
                  v-for="(data, name) in sensors"
                  :key="name"
                  :name="String(name)"
                  :data="data"
                />
              </div>
              <div v-else class="empty">
                <span>Nicio dată de la senzori — așteptăm Wemos…</span>
              </div>
            </section>

            <!-- Controls -->
            <section class="controls-section">
              <div class="section-label">Comenzi Dispozitiv</div>
              <ControlPanel />
            </section>
          </main>

          <!-- Charts -->
          <section class="charts-section">
            <div class="section-label">Istoric Senzori</div>
            <div class="charts-grid">
              <SensorChart sensor-name="Temperature" label="Temperatură" color="#ef4444" unit="°C" />
              <SensorChart sensor-name="Curent"      label="Curent"      color="#3b82f6" unit=" A" />
              <SensorChart sensor-name="Light"       label="Lumină"      color="#eab308" />
            </div>
          </section>

          <!-- Scenario Manager -->
          <section class="scenario-section">
            <div class="scenario-panel">
              <ScenarioManager />
            </div>
          </section>
        </div>

        <div v-else>
          <AdvancedGraphs />
        </div>
      </Transition>
    </div>
  </div>
</template>

<style>
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap');

*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

body {
  font-family: 'Inter', sans-serif;
  background: #0d0f14;
  color: #e2e8f0;
  min-height: 100vh;
}
</style>

<style scoped>
.app { min-height: 100vh; position: relative; }

.layout {
  position: relative; z-index: 1;
  max-width: 1280px; margin: 0 auto;
  padding: 32px 24px 60px;
}

/* Header */
.header {
  display: flex; align-items: center; justify-content: space-between;
  flex-wrap: wrap; gap: 16px; margin-bottom: 44px;
}
.logo { display: flex; align-items: center; gap: 14px; }
.logo-dot {
  width: 8px; height: 8px; border-radius: 50%;
  background: #fff;
  box-shadow: 0 0 8px #fff;
}
.logo h1 { font-size: 1.25rem; font-weight: 700; color: #f1f5f9; }
.logo p  { font-size: 0.73rem; color: #64748b; margin-top: 2px; }

/* Navigation Tabs */
.nav-tabs {
  display: flex;
  background: rgba(255, 255, 255, 0.02);
  border: 1px solid rgba(255, 255, 255, 0.05);
  border-radius: 14px;
  padding: 4px;
  backdrop-filter: blur(8px);
}
@media (max-width: 700px) {
  .nav-tabs { order: 3; width: 100%; justify-content: center; }
}
.nav-tab {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 20px;
  background: transparent;
  border: 1px solid transparent;
  border-radius: 10px;
  color: #94a3b8;
  font-size: 0.82rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}
.nav-tab:hover {
  color: #f1f5f9;
}
.nav-tab.active {
  background: rgba(6, 182, 212, 0.08);
  border-color: rgba(6, 182, 212, 0.25);
  color: #22d3ee;
  box-shadow: 0 0 16px rgba(6, 182, 212, 0.05);
}

/* Main layout */
.main {
  display: grid;
  grid-template-columns: 1fr 340px;
  gap: 28px;
  align-items: start;
}
@media (max-width: 860px) { .main { grid-template-columns: 1fr; } }

.section-label {
  font-size: 0.68rem; font-weight: 700; letter-spacing: .12em;
  text-transform: uppercase; color: #64748b; margin-bottom: 16px;
}

/* Sensor grid */
.sensor-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 14px;
}
.empty {
  display: flex; flex-direction: column; align-items: center; gap: 10px;
  padding: 56px 24px; color: #475569; font-size: 0.88rem;
  border: 1px dashed rgba(255,255,255,0.07); border-radius: 14px;
}

/* Charts */
.charts-section { margin-top: 36px; }
.charts-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;
}
@media (max-width: 900px)  { .charts-grid { grid-template-columns: 1fr 1fr; } }
@media (max-width: 600px)  { .charts-grid { grid-template-columns: 1fr; } }

/* Scenarios */
.scenario-section { margin-top: 36px; }
.scenario-panel {
  background: rgba(19, 22, 31, 0.75);
  border: 1px solid rgba(255,255,255,0.07);
  border-radius: 18px; padding: 28px 28px 32px;
  backdrop-filter: blur(16px);
}

/* View transitions */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.25s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

/* Mobile Responsiveness Improvements */
@media (max-width: 600px) {
  .header {
    flex-direction: row;
    align-items: center;
    text-align: center;
    margin-bottom: 24px;
    gap: 16px;
  }
  .logo {
    flex-direction: column;
    gap: 6px;
  }
  .nav-tabs {
    width: 100%;
    justify-content: center;
  }
  .nav-tab {
    flex: 1;
    justify-content: center;
    padding: 10px 8px;
    font-size: 0.78rem;
  }
  .layout {
    padding: 16px 12px 40px;
  }
  .scenario-panel {
    padding: 20px 16px;
  }
  .section-label {
    margin-bottom: 12px;
  }
}

@media (max-width: 480px) {
  .sensor-grid {
    grid-template-columns: repeat(2, 1fr);
    gap: 10px;
  }
}
</style>
