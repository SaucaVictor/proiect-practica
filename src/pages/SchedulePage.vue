<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { storeToRefs } from 'pinia'
import { useScheduleStore } from '@/stores/schedule.store'
import { DAY_NAMES, DAY_LIST } from '@/types/schedule'
import Button from '@/components/ui/Button.vue'
import { useToast } from '@/composables/useToast'
import ScheduleResourceDrawer from '@/components/schedule/ScheduleResourceDrawer.vue'

const scheduleStore = useScheduleStore()
const { entriesByDay, loading, saving } = storeToRefs(scheduleStore)
const toast = useToast()

// ─── Drawer state ─────────────────────────────────────────────────────────────
const selectedEntry = ref<any>(null)
const drawerOpen = ref(false)

function openResourceManager(entry: any) {
  selectedEntry.value = entry
  drawerOpen.value = true
}

// ─── Form state ──────────────────────────────────────────────────────────────
const formDay = ref(1)
const formStart = ref('08:00')
const formEnd = ref('10:00')
const formSubject = ref('')
const formOpen = ref(false)

onMounted(async () => {
  await scheduleStore.load()
})

async function handleAdd() {
  if (!formSubject.value.trim()) {
    toast.error('Completează numele materiei')
    return
  }
  if (formStart.value >= formEnd.value) {
    toast.error('Ora de început trebuie să fie înainte de ora de sfârșit')
    return
  }

  try {
    await scheduleStore.add({
      dayOfWeek: formDay.value,
      startTime: formStart.value,
      endTime: formEnd.value,
      subjectName: formSubject.value.trim(),
    })
    toast.success('Interval adăugat cu succes!')
    // Reset form
    formSubject.value = ''
    formOpen.value = false
  } catch (err) {
    toast.error('Eroare la adăugare', (err as Error).message)
  }
}

async function handleDelete(id: string, name: string) {
  try {
    await scheduleStore.remove(id)
    toast.success(`„${name}" a fost șters`)
  } catch (err) {
    toast.error('Eroare la ștergere', (err as Error).message)
  }
}

function formatTime(time: string): string {
  // "HH:MM:SS" → "HH:MM"
  return time.slice(0, 5)
}
</script>

<template>
  <div class="schedule-page">
    <div class="schedule-container">
      <!-- Header -->
      <div class="schedule-header">
        <div>
          <h1 class="schedule-title">Orar</h1>
          <p class="schedule-subtitle">Definește orarul săptămânal al sălii de curs</p>
        </div>
        <Button
          id="add-schedule-btn"
          :variant="formOpen ? 'secondary' : 'primary'"
          size="md"
          @click="formOpen = !formOpen"
        >
          <svg v-if="!formOpen" width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path d="M8 2v12M2 8h12" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
          </svg>
          {{ formOpen ? 'Anulează' : 'Adaugă curs' }}
        </Button>
      </div>

      <!-- Add form -->
      <Transition name="slide-down">
        <div v-if="formOpen" class="add-form">
          <div class="form-grid">
            <div class="form-field">
              <label for="form-day" class="form-label">Ziua</label>
              <select id="form-day" v-model.number="formDay" class="form-select">
                <option v-for="day in DAY_LIST" :key="day" :value="day">
                  {{ DAY_NAMES[day] }}
                </option>
              </select>
            </div>

            <div class="form-field">
              <label for="form-start" class="form-label">Ora început</label>
              <input
                id="form-start"
                v-model="formStart"
                type="time"
                class="form-input"
              />
            </div>

            <div class="form-field">
              <label for="form-end" class="form-label">Ora sfârșit</label>
              <input
                id="form-end"
                v-model="formEnd"
                type="time"
                class="form-input"
              />
            </div>

            <div class="form-field form-field--wide">
              <label for="form-subject" class="form-label">Materia</label>
              <input
                id="form-subject"
                v-model="formSubject"
                type="text"
                class="form-input"
                placeholder="ex: Matematică, Fizică, Programare..."
                @keydown.enter="handleAdd"
              />
            </div>
          </div>

          <div class="form-actions">
            <Button
              id="submit-schedule-btn"
              variant="primary"
              size="md"
              :loading="saving"
              @click="handleAdd"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <polyline points="20 6 9 17 4 12" />
              </svg>
              Salvează
            </Button>
          </div>
        </div>
      </Transition>

      <!-- Loading state -->
      <div v-if="loading" class="loading-state">
        <div class="loading-spinner" />
        <span>Se încarcă orarul...</span>
      </div>

      <!-- Schedule grid -->
      <div v-else class="days-grid">
        <div
          v-for="day in DAY_LIST"
          :key="day"
          class="day-card"
        >
          <div class="day-header">
            <span class="day-name">{{ DAY_NAMES[day] }}</span>
            <span class="day-count">{{ entriesByDay[day]?.length ?? 0 }} cursuri</span>
          </div>

          <div class="day-entries">
            <!-- Empty state -->
            <div v-if="!entriesByDay[day]?.length" class="empty-day">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" opacity="0.4" aria-hidden="true">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                <line x1="16" y1="2" x2="16" y2="6" />
                <line x1="8" y1="2" x2="8" y2="6" />
                <line x1="3" y1="10" x2="21" y2="10" />
              </svg>
              <span>Niciun curs</span>
            </div>

            <!-- Entries -->
            <div
              v-for="entry in entriesByDay[day]"
              :key="entry.id"
              class="entry-card group"
            >
              <div class="entry-time">
                <span class="time-badge">{{ formatTime(entry.startTime) }}</span>
                <span class="time-separator">–</span>
                <span class="time-badge">{{ formatTime(entry.endTime) }}</span>
              </div>
              <div class="entry-subject">{{ entry.subjectName }}</div>
              
              <!-- Resources Button -->
              <button
                class="entry-resources"
                title="Gestionare resurse curs (materiale PDF/TXT)"
                aria-label="Resurse curs"
                @click.stop="openResourceManager(entry)"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                  <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                </svg>
              </button>

              <button
                class="entry-delete"
                title="Șterge"
                aria-label="Șterge interval"
                @click="handleDelete(entry.id, entry.subjectName)"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                  <polyline points="3 6 5 6 21 6" />
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>
    <!-- Resource Manager Drawer -->
    <ScheduleResourceDrawer
      v-if="selectedEntry"
      v-show="drawerOpen"
      :entry="selectedEntry"
      @close="drawerOpen = false"
    />
    </div>
  </div>
</template>

<style scoped>
.schedule-page { @apply flex-1 overflow-y-auto; }

.schedule-container {
  @apply max-w-4xl mx-auto px-6 py-10 flex flex-col gap-8;
}

/* ── Header ─────────────────────────────────────────────────────────────────── */

.schedule-header {
  @apply flex items-start justify-between gap-4;
}

.schedule-title {
  @apply text-2xl font-bold text-surface-950 dark:text-surface-950;
}

.schedule-subtitle {
  @apply text-sm text-surface-600 dark:text-surface-600 mt-1;
}

/* ── Add Form ───────────────────────────────────────────────────────────────── */

.add-form {
  @apply flex flex-col gap-5 p-5
         bg-surface-100 dark:bg-surface-100
         rounded-2xl border border-surface-200 dark:border-surface-200;
}

.form-grid {
  @apply grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4;
}

.form-field {
  @apply flex flex-col gap-1.5;
}

.form-field--wide {
  @apply sm:col-span-2 lg:col-span-4;
}

.form-label {
  @apply text-xs font-semibold uppercase tracking-wider text-surface-600 dark:text-surface-600;
}

.form-input,
.form-select {
  @apply w-full h-10 px-3 rounded-xl text-sm
         bg-surface-200 dark:bg-surface-200
         border border-surface-300 dark:border-surface-300
         text-surface-950 dark:text-surface-950
         placeholder:text-surface-500
         focus:outline-none focus:ring-1 focus:ring-accent-500
         transition-colors duration-150;
}

.form-select {
  @apply cursor-pointer appearance-none;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3E%3Cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='m6 8 4 4 4-4'/%3E%3C/svg%3E");
  background-position: right 0.5rem center;
  background-repeat: no-repeat;
  background-size: 1.25rem;
  padding-right: 2rem;
}

.form-actions {
  @apply flex justify-end;
}

/* ── Days Grid ──────────────────────────────────────────────────────────────── */

.days-grid {
  @apply flex flex-col gap-4;
}

.day-card {
  @apply rounded-2xl border border-surface-200 dark:border-surface-200
         bg-surface-100 dark:bg-surface-100
         overflow-hidden;
}

.day-header {
  @apply flex items-center justify-between px-5 py-3
         border-b border-surface-200 dark:border-surface-200;
}

.day-name {
  @apply text-sm font-bold text-surface-950 dark:text-surface-950;
}

.day-count {
  @apply text-xs text-surface-500 dark:text-surface-600;
}

.day-entries {
  @apply flex flex-col;
}

/* ── Empty state ────────────────────────────────────────────────────────────── */

.empty-day {
  @apply flex items-center justify-center gap-2 py-6
         text-sm text-surface-500 dark:text-surface-600;
}

/* ── Entry card ─────────────────────────────────────────────────────────────── */

.entry-card {
  @apply flex items-center gap-4 px-5 py-3
         border-b border-surface-900/50 dark:border-surface-200/50
         last:border-b-0
         hover:bg-surface-200/40 dark:hover:bg-surface-200/40
         transition-colors duration-100;
}

.entry-time {
  @apply flex items-center gap-1.5 flex-shrink-0;
}

.time-badge {
  @apply text-xs font-mono font-semibold px-2 py-1 rounded-lg
         bg-accent-500/10 dark:bg-accent-500/15
         text-accent-600 dark:text-accent-400;
}

.time-separator {
  @apply text-surface-400 dark:text-surface-500 text-xs;
}

.entry-subject {
  @apply flex-1 text-sm font-medium text-surface-200 dark:text-surface-950 truncate;
}

.entry-delete {
  @apply flex items-center justify-center w-8 h-8 rounded-lg
         text-surface-400 dark:text-surface-500
         hover:bg-red-500/10 hover:text-red-500
         opacity-0 group-hover:opacity-100
         transition-all duration-150 cursor-pointer
         flex-shrink-0;
}

.entry-resources {
  @apply flex items-center justify-center w-8 h-8 rounded-lg
         text-surface-400 dark:text-surface-500
         hover:bg-accent-500/10 hover:text-accent-500
         opacity-0 group-hover:opacity-100
         transition-all duration-150 cursor-pointer
         flex-shrink-0;
}

/* ── Loading ────────────────────────────────────────────────────────────────── */

.loading-state {
  @apply flex items-center justify-center gap-3 py-20
         text-sm text-surface-600 dark:text-surface-600;
}

.loading-spinner {
  @apply w-5 h-5 rounded-full border-2 border-accent-500 border-t-transparent animate-spin;
}

/* ── Transition ─────────────────────────────────────────────────────────────── */

.slide-down-enter-active,
.slide-down-leave-active {
  transition: all 0.2s ease;
  overflow: hidden;
}

.slide-down-enter-from,
.slide-down-leave-to {
  opacity: 0;
  max-height: 0;
  margin-top: 0;
  padding-top: 0;
  padding-bottom: 0;
}

.slide-down-enter-to,
.slide-down-leave-from {
  opacity: 1;
  max-height: 500px;
}
</style>
