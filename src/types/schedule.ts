// ─── Schedule types ─────────────────────────────────────────────────────────

export interface ScheduleEntry {
  id: string
  dayOfWeek: number        // 1 = Luni, 2 = Marți, 3 = Miercuri, 4 = Joi, 5 = Vineri
  startTime: string        // "HH:MM" or "HH:MM:SS"
  endTime: string          // "HH:MM" or "HH:MM:SS"
  subjectName: string
  createdAt: string
  updatedAt: string
}

export const DAY_NAMES: Record<number, string> = {
  1: 'Luni',
  2: 'Marți',
  3: 'Miercuri',
  4: 'Joi',
  5: 'Vineri',
}

export const DAY_LIST = [1, 2, 3, 4, 5] as const
