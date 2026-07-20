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

export interface ImportResultChild {
  first_name: string
  last_name: string
  days: { date: string; arrival: string; departure: string }[]
}

export interface ImportResult {
  children: ImportResultChild[]
}

export interface CheminDeCroixAPI {
  children: {
    getAll: () => Promise<Child[]>
    getActive: (date: string) => Promise<Child[]>
    create: (data: { first_name: string; last_name: string; start_date: string; end_date?: string | null }) => Promise<Child>
    update: (id: number, data: Partial<{ first_name: string; last_name: string; start_date: string; end_date: string | null }>) => Promise<void>
    delete: (id: number) => Promise<void>
    reorder: (orderedIds: number[]) => Promise<void>
  }
  attendance: {
    getByWeek: (startDate: string, endDate: string) => Promise<Attendance[]>
    getByMonth: (year: number, month: number) => Promise<Attendance[]>
    upsert: (data: { child_id: number; date: string; arrival_time: string; departure_time: string }) => Promise<void>
    delete: (id: number) => Promise<void>
    deleteByChildDate: (childId: number, date: string) => Promise<void>
    copyWeek: (childId: number, weekStartDates: string[]) => Promise<void>
  }
  export: {
    excel: (year: number, month: number) => Promise<{ success: boolean; path?: string }>
    excelYear: (year: number) => Promise<{ success: boolean; path?: string }>
  }
  import: {
    attendanceImage: (imagePath: string, children: { first_name: string; last_name: string }[], weekDates: string[]) =>
      Promise<{ success: boolean; error?: string; data?: ImportResult; raw?: string }>
  }
  system: {
    getDbPath: () => Promise<string>
    getStats: () => Promise<{ childrenCount: number; attendanceCount: number }>
    getYearRange: () => Promise<{ minYear: number; maxYear: number }>
    getSetting: (key: string) => Promise<string | null>
    setSetting: (key: string, value: string) => Promise<void>
    resetAll: () => Promise<boolean>
    openDbFolder: () => Promise<void>
    closeApp: () => Promise<void>
    minimizeApp: () => Promise<void>
    maximizeApp: () => Promise<void>
  }
}

declare global {
  interface Window {
    api: CheminDeCroixAPI
  }
}
