import type { ScheduleEntry } from '@/types/schedule'
import type { DbScheduleEntry } from '@/types/database'
import { supabase } from './client'

// ─── Mapping ─────────────────────────────────────────────────────────────────

function mapScheduleEntry(row: DbScheduleEntry): ScheduleEntry {
  return {
    id: row.id,
    dayOfWeek: row.day_of_week,
    startTime: row.start_time,
    endTime: row.end_time,
    subjectName: row.subject_name,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

// ─── Operations ──────────────────────────────────────────────────────────────

/**
 * Fetch all schedule entries, ordered by day then start time.
 */
export async function getSchedule(): Promise<ScheduleEntry[]> {
  const { data, error } = await supabase
    .from('schedule')
    .select('*')
    .order('day_of_week', { ascending: true })
    .order('start_time', { ascending: true })

  if (error) throw error
  return (data as DbScheduleEntry[]).map(mapScheduleEntry)
}

/**
 * Add a new schedule entry.
 */
export async function addScheduleEntry(entry: {
  dayOfWeek: number
  startTime: string
  endTime: string
  subjectName: string
}): Promise<ScheduleEntry> {
  const { data, error } = await supabase
    .from('schedule')
    .insert({
      day_of_week: entry.dayOfWeek,
      start_time: entry.startTime,
      end_time: entry.endTime,
      subject_name: entry.subjectName,
    })
    .select()
    .single()

  if (error) throw error
  return mapScheduleEntry(data as DbScheduleEntry)
}

/**
 * Delete a schedule entry by ID.
 */
export async function deleteScheduleEntry(id: string): Promise<void> {
  const { error } = await supabase
    .from('schedule')
    .delete()
    .eq('id', id)

  if (error) throw error
}

/**
 * Find the active subject right now based on current day and time.
 * Returns null if no subject is scheduled at this moment.
 * Useful for the audio server to know which folder to save recordings to.
 */
export async function getActiveSubject(): Promise<ScheduleEntry | null> {
  const now = new Date()
  const dayOfWeek = now.getDay() // 0=Sun, 1=Mon ... 6=Sat
  // Convert JS day (0-6, Sun-based) to our schema (1-5, Mon-based)
  if (dayOfWeek === 0 || dayOfWeek === 6) return null // Weekend
  const dbDay = dayOfWeek // Mon=1 .. Fri=5 — happens to match

  const currentTime = now.toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  })

  const { data, error } = await supabase
    .from('schedule')
    .select('*')
    .eq('day_of_week', dbDay)
    .lte('start_time', currentTime)
    .gte('end_time', currentTime)
    .limit(1)
    .single()

  if (error) {
    if (error.code === 'PGRST116') return null // No rows
    throw error
  }

  return mapScheduleEntry(data as DbScheduleEntry)
}
