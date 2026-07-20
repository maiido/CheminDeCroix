export const DAY_START_MIN = 7 * 60 + 30 // 7h30
export const DAY_END_MIN = 18 * 60 + 45 // 18h45
export const SLOT_MINUTES = 15
export const TOTAL_SLOTS = (DAY_END_MIN - DAY_START_MIN) / SLOT_MINUTES

export const DAY_NAMES = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi']
export const DAY_NAMES_SHORT = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven']
export const MONTH_NAMES = [
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'
]

export function minutesToTime(min: number): string {
  const h = Math.floor(min / 60)
  const m = min % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

export function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number)
  return h * 60 + m
}

export function snapToSlot(min: number): number {
  return Math.round((min - DAY_START_MIN) / SLOT_MINUTES) * SLOT_MINUTES + DAY_START_MIN
}

export function slotToMinutes(slot: number): number {
  return DAY_START_MIN + slot * SLOT_MINUTES
}

export function slotToTime(slot: number): string {
  return minutesToTime(slotToMinutes(slot))
}

export function timeToSlot(time: string): number {
  return Math.round((timeToMinutes(time) - DAY_START_MIN) / SLOT_MINUTES)
}

export function getWeekStart(date: Date): Date {
  const d = new Date(date)
  const day = (d.getDay() + 6) % 7 // 0 = Monday
  d.setDate(d.getDate() - day)
  d.setHours(0, 0, 0, 0)
  return d
}

export function getWeekDates(weekStart: Date): Date[] {
  const dates: Date[] = []
  for (let i = 0; i < 5; i++) {
    const d = new Date(weekStart)
    d.setDate(d.getDate() + i)
    dates.push(d)
  }
  return dates
}

export function formatDate(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

export function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return `${h}h${String(m).padStart(2, '0')}`
}

export function isToday(date: Date): boolean {
  const today = new Date()
  return date.getDate() === today.getDate() &&
    date.getMonth() === today.getMonth() &&
    date.getFullYear() === today.getFullYear()
}

export function isWeekend(date: Date): boolean {
  const dow = (date.getDay() + 6) % 7
  return dow >= 5
}

export function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
}
