import { contextBridge, ipcRenderer } from 'electron'

const api = {
  children: {
    getAll: () => ipcRenderer.invoke('children:getAll'),
    getActive: (date: string) => ipcRenderer.invoke('children:getActive', date),
    create: (data: any) => ipcRenderer.invoke('children:create', data),
    update: (id: number, data: any) => ipcRenderer.invoke('children:update', id, data),
    delete: (id: number) => ipcRenderer.invoke('children:delete', id),
    reorder: (orderedIds: number[]) => ipcRenderer.invoke('children:reorder', orderedIds),
  },
  attendance: {
    getByWeek: (startDate: string, endDate: string) =>
      ipcRenderer.invoke('attendance:getByWeek', startDate, endDate),
    getByMonth: (year: number, month: number) =>
      ipcRenderer.invoke('attendance:getByMonth', year, month),
    upsert: (data: any) => ipcRenderer.invoke('attendance:upsert', data),
    delete: (id: number) => ipcRenderer.invoke('attendance:delete', id),
    deleteByChildDate: (childId: number, date: string) =>
      ipcRenderer.invoke('attendance:deleteByChildDate', childId, date),
    copyWeek: (childId: number, weekStartDates: string[]) =>
      ipcRenderer.invoke('attendance:copyWeek', childId, weekStartDates),
  },
  export: {
    excel: (year: number, month: number) => ipcRenderer.invoke('export:excel', year, month),
    excelYear: (year: number) => ipcRenderer.invoke('export:excelYear', year),
  },
  import: {
    attendanceImage: (imagePath: string, children: { first_name: string; last_name: string }[], weekDates: string[]) =>
      ipcRenderer.invoke('import:attendanceImage', imagePath, children, weekDates),
  },
  system: {
    getDbPath: () => ipcRenderer.invoke('system:getDbPath'),
    getStats: () => ipcRenderer.invoke('system:getStats'),
    getYearRange: () => ipcRenderer.invoke('system:getYearRange'),
    getSetting: (key: string) => ipcRenderer.invoke('system:getSetting', key),
    setSetting: (key: string, value: string) => ipcRenderer.invoke('system:setSetting', key, value),
    resetAll: () => ipcRenderer.invoke('system:resetAll'),
    openDbFolder: () => ipcRenderer.invoke('system:openDbFolder'),
    closeApp: () => ipcRenderer.invoke('system:closeApp'),
    minimizeApp: () => ipcRenderer.invoke('system:minimizeApp'),
    maximizeApp: () => ipcRenderer.invoke('system:maximizeApp'),
  },
}

contextBridge.exposeInMainWorld('api', api)

export type CheminDeCroixAPI = typeof api
