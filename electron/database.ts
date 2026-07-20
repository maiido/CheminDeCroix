import BetterSqlite3 from 'better-sqlite3'
import type { Database as DatabaseType } from 'better-sqlite3'

export interface Child {
  id: number
  first_name: string
  last_name: string
  start_date: string
  end_date: string | null
  color: string
  sort_order: number
  created_at: string
}

export interface Attendance {
  id: number
  child_id: number
  date: string
  arrival_time: string
  departure_time: string
  created_at: string
  updated_at: string
}

const COLORS = [
  '#ef4444', '#f97316', '#f59e0b', '#eab308', '#84cc16',
  '#22c55e', '#10b981', '#14b8a6', '#06b6d4', '#0ea5e9',
  '#3b82f6', '#6366f1', '#8b5cf6', '#a855f7', '#d946ef',
  '#ec4899', '#f43f5e', '#64748b', '#78716c', '#a3a3a3',
]

export class Database {
  private db: DatabaseType

  constructor(dbPath: string) {
    this.db = new BetterSqlite3(dbPath)
    this.db.pragma('journal_mode = WAL')
    this.init()
  }

  private init() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS children (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        first_name TEXT NOT NULL,
        last_name TEXT NOT NULL,
        start_date TEXT NOT NULL,
        end_date TEXT,
        color TEXT NOT NULL,
        sort_order INTEGER DEFAULT 0,
        created_at TEXT DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS attendance (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        child_id INTEGER NOT NULL,
        date TEXT NOT NULL,
        arrival_time TEXT NOT NULL,
        departure_time TEXT NOT NULL,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now')),
        UNIQUE(child_id, date),
        FOREIGN KEY (child_id) REFERENCES children(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );
    `)
    // Migration: add sort_order column if missing
    try {
      this.db.exec('ALTER TABLE children ADD COLUMN sort_order INTEGER DEFAULT 0')
    } catch {
      // Column already exists
    }
  }

  private getNextColor(): string {
    const count = this.db.prepare('SELECT COUNT(*) as c FROM children').get() as { c: number }
    return COLORS[count.c % COLORS.length]
  }

  getAllChildren(): Child[] {
    return this.db.prepare('SELECT * FROM children ORDER BY sort_order, last_name, first_name').all() as Child[]
  }

  getActiveChildren(date: string): Child[] {
    return this.db.prepare(`
      SELECT * FROM children
      WHERE start_date <= ? AND (end_date IS NULL OR end_date >= ?)
      ORDER BY sort_order, last_name, first_name
    `).all(date, date) as Child[]
  }

  getActiveChildrenForMonth(year: number, month: number): Child[] {
    const monthStart = `${year}-${String(month + 1).padStart(2, '0')}-01`
    const nextMonth = month === 11 ? `${year + 1}-01-01` : `${year}-${String(month + 2).padStart(2, '0')}-01`
    return this.db.prepare(`
      SELECT * FROM children
      WHERE start_date < ? AND (end_date IS NULL OR end_date >= ?)
      ORDER BY sort_order, last_name, first_name
    `).all(nextMonth, monthStart) as Child[]
  }

  createChild(data: { first_name: string; last_name: string; start_date: string; end_date?: string | null }): Child {
    const color = this.getNextColor()
    const stmt = this.db.prepare(`
      INSERT INTO children (first_name, last_name, start_date, end_date, color)
      VALUES (?, ?, ?, ?, ?)
    `)
    const result = stmt.run(data.first_name, data.last_name, data.start_date, data.end_date ?? null, color)
    return this.db.prepare('SELECT * FROM children WHERE id = ?').get(result.lastInsertRowid) as Child
  }

  updateChild(id: number, data: { first_name?: string; last_name?: string; start_date?: string; end_date?: string | null }): void {
    const fields: string[] = []
    const values: any[] = []
    if (data.first_name !== undefined) { fields.push('first_name = ?'); values.push(data.first_name) }
    if (data.last_name !== undefined) { fields.push('last_name = ?'); values.push(data.last_name) }
    if (data.start_date !== undefined) { fields.push('start_date = ?'); values.push(data.start_date) }
    if (data.end_date !== undefined) { fields.push('end_date = ?'); values.push(data.end_date) }
    if (fields.length === 0) return
    values.push(id)
    this.db.prepare(`UPDATE children SET ${fields.join(', ')} WHERE id = ?`).run(...values)
  }

  deleteChild(id: number): void {
    this.db.prepare('DELETE FROM children WHERE id = ?').run(id)
  }

  reorderChildren(orderedIds: number[]): void {
    const stmt = this.db.prepare('UPDATE children SET sort_order = ? WHERE id = ?')
    const tx = this.db.transaction(() => {
      orderedIds.forEach((id, index) => stmt.run(index, id))
    })
    tx()
  }

  copyWeekFromPrevious(childId: number, weekStartDates: string[]): void {
    console.log('[DB] copyWeekFromPrevious', { childId, weekStartDates })
    // weekStartDates = array of 5 date strings for the current week (Mon-Fri) in YYYY-MM-DD format
    // Parse dates safely: split by '-' to avoid timezone issues with new Date('YYYY-MM-DD')
    const prevWeekDates = weekStartDates.map(d => {
      const [y, m, day] = d.split('-').map(Number)
      const date = new Date(y, m - 1, day)
      date.setDate(date.getDate() - 7)
      return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
    })
    console.log('[DB] prevWeekDates', prevWeekDates)

    if (prevWeekDates.length === 0) {
      console.warn('[DB] copyWeekFromPrevious: no dates provided')
      return
    }

    const placeholders = prevWeekDates.map(() => '?').join(',')
    const prevAtt = this.db.prepare(`
      SELECT * FROM attendance WHERE child_id = ? AND date IN (${placeholders})
    `).all(childId, ...prevWeekDates) as Attendance[]
    console.log('[DB] previous attendance found:', prevAtt.length, 'entries')

    if (prevAtt.length === 0) {
      console.warn('[DB] copyWeekFromPrevious: no previous week attendance to copy')
      return
    }

    const upsert = this.db.prepare(`
      INSERT INTO attendance (child_id, date, arrival_time, departure_time, updated_at)
      VALUES (?, ?, ?, ?, datetime('now'))
      ON CONFLICT(child_id, date) DO UPDATE SET
        arrival_time = excluded.arrival_time,
        departure_time = excluded.departure_time,
        updated_at = datetime('now')
    `)
    const tx = this.db.transaction(() => {
      for (const att of prevAtt) {
        const prevIdx = prevWeekDates.indexOf(att.date)
        if (prevIdx >= 0 && prevIdx < weekStartDates.length) {
          console.log(`[DB] copying ${att.date} -> ${weekStartDates[prevIdx]} (${att.arrival_time}-${att.departure_time})`)
          upsert.run(childId, weekStartDates[prevIdx], att.arrival_time, att.departure_time)
        }
      }
    })
    tx()
    console.log('[DB] copyWeekFromPrevious done')
  }

  getAttendanceByDateRange(startDate: string, endDate: string): Attendance[] {
    return this.db.prepare(`
      SELECT * FROM attendance WHERE date >= ? AND date <= ? ORDER BY date, arrival_time
    `).all(startDate, endDate) as Attendance[]
  }

  getAttendanceByMonth(year: number, month: number): Attendance[] {
    const monthStart = `${year}-${String(month + 1).padStart(2, '0')}-01`
    const nextMonth = month === 11 ? `${year + 1}-01-01` : `${year}-${String(month + 2).padStart(2, '0')}-01`
    return this.db.prepare(`
      SELECT * FROM attendance WHERE date >= ? AND date < ? ORDER BY date, arrival_time
    `).all(monthStart, nextMonth) as Attendance[]
  }

  getAttendanceByYear(year: number): Attendance[] {
    const yearStart = `${year}-01-01`
    const yearEnd = `${year + 1}-01-01`
    return this.db.prepare(`
      SELECT * FROM attendance WHERE date >= ? AND date < ? ORDER BY date, arrival_time
    `).all(yearStart, yearEnd) as Attendance[]
  }

  getActiveChildrenForYear(year: number): Child[] {
    const yearStart = `${year}-01-01`
    const yearEnd = `${year + 1}-01-01`
    return this.db.prepare(`
      SELECT * FROM children
      WHERE start_date < ? AND (end_date IS NULL OR end_date >= ?)
      ORDER BY sort_order, last_name, first_name
    `).all(yearEnd, yearStart) as Child[]
  }

  upsertAttendance(data: { child_id: number; date: string; arrival_time: string; departure_time: string }): void {
    this.db.prepare(`
      INSERT INTO attendance (child_id, date, arrival_time, departure_time, updated_at)
      VALUES (?, ?, ?, ?, datetime('now'))
      ON CONFLICT(child_id, date) DO UPDATE SET
        arrival_time = excluded.arrival_time,
        departure_time = excluded.departure_time,
        updated_at = datetime('now')
    `).run(data.child_id, data.date, data.arrival_time, data.departure_time)
  }

  deleteAttendance(id: number): void {
    this.db.prepare('DELETE FROM attendance WHERE id = ?').run(id)
  }

  deleteAttendanceByChildDate(childId: number, date: string): void {
    this.db.prepare('DELETE FROM attendance WHERE child_id = ? AND date = ?').run(childId, date)
  }

  resetAll(): void {
    this.db.exec('DELETE FROM attendance')
    this.db.exec('DELETE FROM children')
    this.db.exec('DELETE FROM sqlite_sequence WHERE name IN ("children", "attendance")')
  }

  getStats(): { childrenCount: number; attendanceCount: number } {
    const childrenCount = (this.db.prepare('SELECT COUNT(*) as c FROM children').get() as { c: number }).c
    const attendanceCount = (this.db.prepare('SELECT COUNT(*) as c FROM attendance').get() as { c: number }).c
    return { childrenCount, attendanceCount }
  }

  getYearRange(): { minYear: number; maxYear: number } {
    const row = this.db.prepare('SELECT MIN(date) as minDate, MAX(date) as maxDate FROM attendance').get() as { minDate: string | null; maxDate: string | null }
    const currentYear = new Date().getFullYear()
    if (!row.minDate || !row.maxDate) {
      return { minYear: currentYear, maxYear: currentYear }
    }
    const minYear = Math.min(parseInt(row.minDate.substring(0, 4)), currentYear)
    const maxYear = Math.max(parseInt(row.maxDate.substring(0, 4)), currentYear)
    return { minYear, maxYear }
  }

  getSetting(key: string): string | null {
    const row = this.db.prepare('SELECT value FROM settings WHERE key = ?').get(key) as { value: string } | undefined
    return row?.value ?? null
  }

  setSetting(key: string, value: string): void {
    this.db.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value').run(key, value)
  }

  close() {
    this.db.close()
  }
}
