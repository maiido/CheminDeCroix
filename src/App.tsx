import { useState, useEffect, useCallback } from 'react'
import { Child, Attendance } from './types'
import { getWeekStart, getWeekDates, formatDate } from './lib/utils'
import { Sidebar } from './components/Sidebar'
import { TitleBar } from './components/TitleBar'
import { WeeklyCalendar } from './components/WeeklyCalendar'
import { WeekTableView } from './components/WeekTableView'
import { ChildManager } from './components/ChildManager'
import { ExportView } from './components/ExportView'
import { Documentation } from './components/Documentation'
import { RecapView } from './components/RecapView'

type View = 'calendar' | 'children' | 'recap' | 'export' | 'docs'
type CalendarMode = 'calendar' | 'table'

export default function App() {
  const [view, setView] = useState<View>('calendar')
  const [calendarMode, setCalendarMode] = useState<CalendarMode>('calendar')
  const [children, setChildren] = useState<Child[]>([])
  const [activeChildren, setActiveChildren] = useState<Child[]>([])
  const [selectedChildId, setSelectedChildId] = useState<number | null>(null)
  const [weekStart, setWeekStart] = useState<Date>(getWeekStart(new Date()))
  const [attendance, setAttendance] = useState<Attendance[]>([])
  const [autoNextChild, setAutoNextChild] = useState(() => {
    const stored = localStorage.getItem('autoNextChild')
    return stored === null ? true : stored === 'true'
  })

  const toggleAutoNextChild = useCallback(() => {
    setAutoNextChild(prev => {
      const next = !prev
      localStorage.setItem('autoNextChild', String(next))
      return next
    })
  }, [])

  const weekDates = getWeekDates(weekStart)

  const loadChildren = useCallback(async () => {
    const all = await window.api.children.getAll()
    setChildren(all)
  }, [])

  const loadActiveChildren = useCallback(async () => {
    const all = await window.api.children.getAll()
    setActiveChildren(all)
    if (all.length > 0 && selectedChildId === null) {
      setSelectedChildId(all[0].id)
    }
  }, [selectedChildId])

  const loadAttendance = useCallback(async () => {
    const start = formatDate(weekDates[0])
    const end = formatDate(weekDates[4])
    const att = await window.api.attendance.getByWeek(start, end)
    setAttendance(att)
  }, [weekStart])

  useEffect(() => {
    loadChildren()
  }, [loadChildren])

  useEffect(() => {
    loadActiveChildren()
  }, [loadActiveChildren])

  useEffect(() => {
    loadAttendance()
  }, [loadAttendance])

  const handlePrevWeek = () => {
    const d = new Date(weekStart)
    d.setDate(d.getDate() - 7)
    setWeekStart(d)
  }

  const handleNextWeek = () => {
    const d = new Date(weekStart)
    d.setDate(d.getDate() + 7)
    setWeekStart(d)
  }

  const handleToday = () => {
    setWeekStart(getWeekStart(new Date()))
  }

  const handleUpsertAttendance = async (data: { child_id: number; date: string; arrival_time: string; departure_time: string }) => {
    await window.api.attendance.upsert(data)
    await loadAttendance()
    // Auto-next: if the selected child now has all 5 days filled, switch to next child
    if (!autoNextChild) return
    const updatedAtt = await window.api.attendance.getByWeek(formatDate(weekDates[0]), formatDate(weekDates[4]))
    const childDays = new Set(updatedAtt.filter(a => a.child_id === data.child_id).map(a => a.date))
    const weekDateStrs = weekDates.map(d => formatDate(d))
    const allFilled = weekDateStrs.every(d => childDays.has(d))
    if (allFilled) {
      const currentIdx = activeChildren.findIndex(c => c.id === data.child_id)
      if (currentIdx >= 0 && currentIdx < activeChildren.length - 1) {
        setSelectedChildId(activeChildren[currentIdx + 1].id)
      }
    }
  }

  const handleDeleteAttendance = async (id: number) => {
    await window.api.attendance.delete(id)
    await loadAttendance()
  }

  const handleDeleteAttendanceByChildDate = async (childId: number, date: string) => {
    await window.api.attendance.deleteByChildDate(childId, date)
    await loadAttendance()
  }

  const handleChildCreated = async () => {
    await loadChildren()
    await loadActiveChildren()
  }

  const handleChildUpdated = async () => {
    await loadChildren()
    await loadActiveChildren()
  }

  const handleChildDeleted = async () => {
    await loadChildren()
    await loadActiveChildren()
    setSelectedChildId(null)
  }

  const handleReorder = async (orderedIds: number[]) => {
    await window.api.children.reorder(orderedIds)
    await loadChildren()
    await loadActiveChildren()
  }

  const handleCopyWeek = async (childId: number) => {
    try {
      const weekDateStrs = weekDates.map(d => formatDate(d))
      console.log('[App] copyWeek', { childId, weekDateStrs })
      await window.api.attendance.copyWeek(childId, weekDateStrs)
      await loadAttendance()
    } catch (err) {
      console.error('[App] copyWeek error:', err)
      alert('Erreur lors de la copie de la semaine précédente: ' + String(err))
    }
  }

  const handleNextChild = () => {
    if (!selectedChildId) return
    const currentIdx = activeChildren.findIndex(c => c.id === selectedChildId)
    if (currentIdx >= 0 && currentIdx < activeChildren.length - 1) {
      setSelectedChildId(activeChildren[currentIdx + 1].id)
    }
  }

  const handleMarkAbsent = async (childId: number, date: string) => {
    await window.api.attendance.upsert({
      child_id: childId,
      date,
      arrival_time: 'absent',
      departure_time: 'absent',
    })
    await loadAttendance()
    if (!autoNextChild) return
    const updatedAtt = await window.api.attendance.getByWeek(formatDate(weekDates[0]), formatDate(weekDates[4]))
    const childDays = new Set(updatedAtt.filter(a => a.child_id === childId).map(a => a.date))
    const weekDateStrs = weekDates.map(d => formatDate(d))
    const allFilled = weekDateStrs.every(d => childDays.has(d))
    if (allFilled) {
      const currentIdx = activeChildren.findIndex(c => c.id === childId)
      if (currentIdx >= 0 && currentIdx < activeChildren.length - 1) {
        setSelectedChildId(activeChildren[currentIdx + 1].id)
      }
    }
  }

  const selectedChild = activeChildren.find(c => c.id === selectedChildId) || null

  return (
    <div className="flex flex-col h-screen w-screen bg-secondary/30">
      <TitleBar
        onMinimize={() => window.api.system.minimizeApp()}
        onMaximize={() => window.api.system.maximizeApp()}
        onClose={() => window.api.system.closeApp()}
      />
      <div className="flex flex-1 overflow-hidden">
      <Sidebar
        view={view}
        onViewChange={setView}
        childrenList={activeChildren}
        selectedChildId={selectedChildId}
        onSelectChild={setSelectedChildId}
        onReorder={handleReorder}
        autoNextChild={autoNextChild}
        onToggleAutoNextChild={toggleAutoNextChild}
      />
      <div className="flex-1 flex flex-col overflow-hidden">
        {view === 'calendar' && calendarMode === 'calendar' && (
          <WeeklyCalendar
            weekStart={weekStart}
            weekDates={weekDates}
            allChildren={activeChildren}
            selectedChild={selectedChild}
            attendance={attendance}
            onPrevWeek={handlePrevWeek}
            onNextWeek={handleNextWeek}
            onToday={handleToday}
            onWeekChange={(date) => setWeekStart(date)}
            onUpsertAttendance={handleUpsertAttendance}
            onDeleteAttendance={handleDeleteAttendance}
            onCopyWeek={handleCopyWeek}
            onNextChild={handleNextChild}
            onToggleView={() => setCalendarMode(m => m === 'calendar' ? 'table' : 'calendar')}
            onMarkAbsent={handleMarkAbsent}
          />
        )}
        {view === 'calendar' && calendarMode === 'table' && (
          <WeekTableView
            weekStart={weekStart}
            weekDates={weekDates}
            allChildren={activeChildren}
            attendance={attendance}
            onPrevWeek={handlePrevWeek}
            onNextWeek={handleNextWeek}
            onToday={handleToday}
            onWeekChange={(date) => setWeekStart(date)}
            onUpsertAttendance={handleUpsertAttendance}
            onDeleteAttendance={handleDeleteAttendanceByChildDate}
            onToggleView={() => setCalendarMode(m => m === 'calendar' ? 'table' : 'calendar')}
            onMarkAbsent={handleMarkAbsent}
          />
        )}
        {view === 'children' && (
          <ChildManager
            children={children}
            onChildCreated={handleChildCreated}
            onChildUpdated={handleChildUpdated}
            onChildDeleted={handleChildDeleted}
          />
        )}
        {view === 'recap' && <RecapView children={children} />}
        {view === 'export' && <ExportView />}
        {view === 'docs' && <Documentation />}
      </div>
      </div>
    </div>
  )
}
