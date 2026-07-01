import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { ScheduleEntry } from '@/types/schedule'
import { DAY_LIST } from '@/types/schedule'
import * as scheduleService from '@/services/supabase/schedule'

export const useScheduleStore = defineStore('schedule', () => {
  // ─── State ──────────────────────────────────────────────────────────────────
  const entries = ref<ScheduleEntry[]>([])
  const loading = ref(false)
  const saving = ref(false)

  // ─── Getters ────────────────────────────────────────────────────────────────

  /** Entries grouped by day of week (1-5). Each day always has an array (possibly empty). */
  const entriesByDay = computed(() => {
    const grouped: Record<number, ScheduleEntry[]> = {}
    for (const day of DAY_LIST) {
      grouped[day] = []
    }
    for (const entry of entries.value) {
      if (grouped[entry.dayOfWeek]) {
        grouped[entry.dayOfWeek].push(entry)
      }
    }
    return grouped
  })

  // ─── Actions ─────────────────────────────────────────────────────────────────

  async function load(): Promise<void> {
    loading.value = true
    try {
      entries.value = await scheduleService.getSchedule()
    } finally {
      loading.value = false
    }
  }

  async function add(entry: {
    dayOfWeek: number
    startTime: string
    endTime: string
    subjectName: string
  }): Promise<void> {
    saving.value = true
    try {
      const saved = await scheduleService.addScheduleEntry(entry)
      entries.value.push(saved)
      // Re-sort after insert
      entries.value.sort((a, b) => {
        if (a.dayOfWeek !== b.dayOfWeek) return a.dayOfWeek - b.dayOfWeek
        return a.startTime.localeCompare(b.startTime)
      })
    } finally {
      saving.value = false
    }
  }

  async function remove(id: string): Promise<void> {
    saving.value = true
    try {
      await scheduleService.deleteScheduleEntry(id)
      entries.value = entries.value.filter(e => e.id !== id)
    } finally {
      saving.value = false
    }
  }

  return {
    entries,
    loading,
    saving,
    entriesByDay,
    load,
    add,
    remove,
  }
})
