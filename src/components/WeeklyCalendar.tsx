import { useState, useRef, useCallback, useEffect } from 'react'
import { Child, Attendance } from '../types'
import {
  DAY_NAMES,
  DAY_NAMES_SHORT,
  MONTH_NAMES,
  TOTAL_SLOTS,
  SLOT_MINUTES,
  DAY_START_MIN,
  slotToMinutes,
  minutesToTime,
  timeToSlot,
  snapToSlot,
  formatDate,
  isToday,
  formatDuration,
  timeToMinutes,
} from '../lib/utils'

interface WeeklyCalendarProps {
  weekStart: Date
  weekDates: Date[]
  allChildren: Child[]
  selectedChild: Child | null
  attendance: Attendance[]
  onPrevWeek: () => void
  onNextWeek: () => void
  onToday: () => void
  onWeekChange: (date: Date) => void
  onUpsertAttendance: (data: { child_id: number; date: string; arrival_time: string; departure_time: string }) => void
  onDeleteAttendance: (id: number) => void
  onCopyWeek: (childId: number) => void
  onNextChild: () => void
  onToggleView: () => void
  onMarkAbsent: (childId: number, date: string) => void
}

interface DragState {
  dayIndex: number
  startSlot: number
  currentSlot: number
}

interface ResizeState {
  attId: number
  childId: number
  date: string
  edge: 'top' | 'bottom'
  originalSlot: number
}

interface MoveState {
  attId: number
  childId: number
  originalDate: string
  durationSlots: number
  currentDayIndex: number
  currentSlot: number
  pointerOffsetSlots: number
}

const HEADER_HEIGHT = 40

export function WeeklyCalendar({
  weekStart,
  weekDates,
  allChildren,
  selectedChild,
  attendance,
  onPrevWeek,
  onNextWeek,
  onToday,
  onWeekChange,
  onUpsertAttendance,
  onDeleteAttendance,
  onCopyWeek,
  onNextChild,
  onToggleView,
  onMarkAbsent,
}: WeeklyCalendarProps) {
  const [drag, setDrag] = useState<DragState | null>(null)
  const [editingAtt, setEditingAtt] = useState<Attendance | null>(null)
  const [quickAdd, setQuickAdd] = useState<{ dayIndex: number; arrival: string; departure: string } | null>(null)
  const [slotHeight, setSlotHeight] = useState(28)
  const [resize, setResize] = useState<ResizeState | null>(null)
  const [move, setMove] = useState<MoveState | null>(null)
  const [focusedDay, setFocusedDay] = useState(0)
  const dayRefs = useRef<(HTMLDivElement | null)[]>([])
  const keyboardActive = useRef(false)
  const resizeJustEnded = useRef(false)
  const moveJustEnded = useRef(false)
  const gridRef = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const editArrivalRef = useRef<HTMLInputElement>(null)
  const quickAddArrivalRef = useRef<HTMLInputElement>(null)

  // Auto-fit slot height so the full day is visible without scrolling
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const update = () => {
      const h = el.clientHeight - HEADER_HEIGHT
      if (h > 0) setSlotHeight(Math.max(8, Math.floor(h / TOTAL_SLOTS)))
    }
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // Build attendance map: { dateStr: Attendance[] } — only selected child
  const attByDate = new Map<string, Attendance[]>()
  for (const a of attendance) {
    if (selectedChild && a.child_id !== selectedChild.id) continue
    if (!attByDate.has(a.date)) attByDate.set(a.date, [])
    attByDate.get(a.date)!.push(a)
  }

  const childById = new Map(allChildren.map(c => [c.id, c]))

  const handleResizeStart = useCallback((e: React.MouseEvent, att: Attendance, edge: 'top' | 'bottom') => {
    e.stopPropagation()
    e.preventDefault()
    const startSlot = timeToSlot(att.arrival_time)
    const endSlot = timeToSlot(att.departure_time)
    setResize({
      attId: att.id,
      childId: att.child_id,
      date: att.date,
      edge,
      originalSlot: edge === 'top' ? startSlot : endSlot,
    })
  }, [])

  const handleResizeEnd = useCallback(() => {
    if (!resize) return
    const att = attendance.find(a => a.id === resize.attId)
    if (att) {
      const startSlot = timeToSlot(att.arrival_time)
      const endSlot = timeToSlot(att.departure_time)
      let newStart = startSlot
      let newEnd = endSlot
      if (resize.edge === 'top') {
        newStart = Math.min(resize.originalSlot, endSlot - 1)
      } else {
        newEnd = Math.max(resize.originalSlot, startSlot + 1)
      }
      onUpsertAttendance({
        child_id: resize.childId,
        date: resize.date,
        arrival_time: minutesToTime(slotToMinutes(newStart)),
        departure_time: minutesToTime(slotToMinutes(newEnd)),
      })
    }
    setResize(null)
    resizeJustEnded.current = true
    setTimeout(() => { resizeJustEnded.current = false }, 50)
  }, [resize, attendance, onUpsertAttendance])

  const handleMoveStart = useCallback((e: React.MouseEvent, att: Attendance, dayIndex: number) => {
    e.stopPropagation()
    e.preventDefault()
    const startSlot = timeToSlot(att.arrival_time)
    const endSlot = timeToSlot(att.departure_time)
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    const yInBlock = e.clientY - rect.top
    const clickSlot = Math.floor(yInBlock / slotHeight)
    setMove({
      attId: att.id,
      childId: att.child_id,
      originalDate: att.date,
      durationSlots: endSlot - startSlot,
      currentDayIndex: dayIndex,
      currentSlot: startSlot,
      pointerOffsetSlots: clickSlot,
    })
  }, [slotHeight])

  const handleMoveEnd = useCallback(() => {
    if (!move) return
    const newDate = formatDate(weekDates[move.currentDayIndex])
    const newStart = move.currentSlot
    const newEnd = move.currentSlot + move.durationSlots
    onUpsertAttendance({
      child_id: move.childId,
      date: newDate,
      arrival_time: minutesToTime(slotToMinutes(newStart)),
      departure_time: minutesToTime(slotToMinutes(newEnd)),
    })
    // Delete original if moved to a different date
    if (move.originalDate !== newDate) {
      onDeleteAttendance(move.attId)
    }
    setMove(null)
    moveJustEnded.current = true
    setTimeout(() => { moveJustEnded.current = false }, 50)
  }, [move, weekDates, onUpsertAttendance, onDeleteAttendance])

  // Window-level listeners for resize and move drags
  useEffect(() => {
    if (!resize && !move) return
    const onWinMouseMove = (e: MouseEvent) => {
      const grid = gridRef.current
      if (!grid) return
      const rect = grid.getBoundingClientRect()
      const y = e.clientY - rect.top - HEADER_HEIGHT
      const hourColWidth = 64
      const x = e.clientX - rect.left - hourColWidth
      const gridWidth = rect.width - hourColWidth
      const colWidth = gridWidth / weekDates.length
      const dayIndex = Math.max(0, Math.min(weekDates.length - 1, Math.floor(x / colWidth)))
      const slot = Math.max(0, Math.min(TOTAL_SLOTS, Math.floor(y / slotHeight)))
      if (resize) {
        setResize(prev => prev ? { ...prev, originalSlot: slot } : null)
      }
      if (move) {
        const adjustedSlot = slot - move.pointerOffsetSlots
        const clampedSlot = Math.max(0, Math.min(TOTAL_SLOTS - move.durationSlots, adjustedSlot))
        setMove(prev => prev ? { ...prev, currentDayIndex: dayIndex, currentSlot: clampedSlot } : null)
      }
    }
    const onWinMouseUp = () => {
      handleResizeEnd()
      handleMoveEnd()
    }
    window.addEventListener('mousemove', onWinMouseMove)
    window.addEventListener('mouseup', onWinMouseUp)
    return () => {
      window.removeEventListener('mousemove', onWinMouseMove)
      window.removeEventListener('mouseup', onWinMouseUp)
    }
  }, [resize, move, slotHeight, weekDates.length, handleResizeEnd, handleMoveEnd])

  const handleMouseDown = useCallback((e: React.MouseEvent, dayIndex: number) => {
    if (!selectedChild) return
    if (e.button !== 0) return
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    const y = e.clientY - rect.top
    const slot = Math.floor(y / slotHeight)
    if (slot < 0 || slot >= TOTAL_SLOTS) return
    setDrag({ dayIndex, startSlot: slot, currentSlot: slot })
  }, [selectedChild])

  const handleMouseMove = useCallback((e: React.MouseEvent, dayIndex: number) => {
    if (!drag || drag.dayIndex !== dayIndex) return
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    const y = e.clientY - rect.top
    const slot = Math.max(0, Math.min(TOTAL_SLOTS - 1, Math.floor(y / slotHeight)))
    setDrag(prev => prev ? { ...prev, currentSlot: slot } : null)
  }, [drag])

  const handleMouseUp = useCallback(() => {
    if (!drag || !selectedChild) {
      setDrag(null)
      return
    }
    const startSlot = Math.min(drag.startSlot, drag.currentSlot)
    const endSlot = Math.max(drag.startSlot, drag.currentSlot)
    if (startSlot === endSlot) {
      setDrag(null)
      return
    }
    const date = formatDate(weekDates[drag.dayIndex])
    const arrival = minutesToTime(slotToMinutes(startSlot))
    const departure = minutesToTime(slotToMinutes(endSlot + 1))
    onUpsertAttendance({
      child_id: selectedChild.id,
      date,
      arrival_time: arrival,
      departure_time: departure,
    })
    setDrag(null)
  }, [drag, selectedChild, weekDates, onUpsertAttendance])

  const handleAttendanceClick = (e: React.MouseEvent, att: Attendance) => {
    e.stopPropagation()
    if (resizeJustEnded.current || moveJustEnded.current) return
    setEditingAtt(att)
  }

  // Keyboard navigation on a day column
  const handleDayKeyDown = useCallback((e: React.KeyboardEvent, dayIndex: number) => {
    if (editingAtt || quickAdd) return
    if (!selectedChild) return

    const dateStr = formatDate(weekDates[dayIndex])
    const dayAtts = (attByDate.get(dateStr) || []).filter(a => a.arrival_time !== 'absent')
    const absentAtt = (attByDate.get(dateStr) || []).find(a => a.arrival_time === 'absent')

    switch (e.key) {
      case 'ArrowLeft':
        e.preventDefault()
        if (dayIndex > 0) {
          setFocusedDay(dayIndex - 1)
          dayRefs.current[dayIndex - 1]?.focus()
        }
        break
      case 'ArrowRight':
        e.preventDefault()
        if (dayIndex < weekDates.length - 1) {
          setFocusedDay(dayIndex + 1)
          dayRefs.current[dayIndex + 1]?.focus()
        }
        break
      case 'Tab':
        // Let Tab work naturally to move to next day
        setFocusedDay(e.shiftKey ? Math.max(0, dayIndex - 1) : Math.min(weekDates.length - 1, dayIndex + 1))
        break
      case 'Enter': {
        e.preventDefault()
        if (dayAtts.length > 0) {
          setEditingAtt(dayAtts[0])
        } else if (!absentAtt) {
          setQuickAdd({ dayIndex, arrival: '08:00', departure: '18:00' })
        }
        break
      }
      case 'Delete':
      case 'Backspace': {
        e.preventDefault()
        if (dayAtts.length > 0) {
          onDeleteAttendance(dayAtts[0].id)
        } else if (absentAtt) {
          onDeleteAttendance(absentAtt.id)
        }
        break
      }
      case 'a':
      case 'A': {
        e.preventDefault()
        if (!absentAtt) {
          onMarkAbsent(selectedChild.id, dateStr)
        }
        break
      }
      case 'n':
      case 'N': {
        e.preventDefault()
        if (!absentAtt && dayAtts.length === 0) {
          setQuickAdd({ dayIndex, arrival: '08:00', departure: '18:00' })
        }
        break
      }
    }
  }, [selectedChild, weekDates, attByDate, editingAtt, quickAdd, onDeleteAttendance, onMarkAbsent])

  const handleSaveQuickAdd = () => {
    if (!quickAdd || !selectedChild) return
    const dateStr = formatDate(weekDates[quickAdd.dayIndex])
    onUpsertAttendance({
      child_id: selectedChild.id,
      date: dateStr,
      arrival_time: quickAdd.arrival,
      departure_time: quickAdd.departure,
    })
    setQuickAdd(null)
  }

  const handleSaveEdit = () => {
    if (!editingAtt || !selectedChild) return
    onUpsertAttendance({
      child_id: editingAtt.child_id,
      date: editingAtt.date,
      arrival_time: editingAtt.arrival_time,
      departure_time: editingAtt.departure_time,
    })
    setEditingAtt(null)
  }

  // Auto-focus inputs when modals open
  useEffect(() => {
    if (editingAtt && editArrivalRef.current) {
      editArrivalRef.current.focus()
      editArrivalRef.current.select()
    }
  }, [editingAtt])

  useEffect(() => {
    if (quickAdd && quickAddArrivalRef.current) {
      quickAddArrivalRef.current.focus()
      quickAddArrivalRef.current.select()
    }
  }, [quickAdd])

  // Return focus to day column when modals close
  useEffect(() => {
    if (!editingAtt && !quickAdd && keyboardActive.current) {
      dayRefs.current[focusedDay]?.focus()
    }
  }, [editingAtt, quickAdd, focusedDay])

  const handleDeleteAtt = () => {
    if (editingAtt) {
      onDeleteAttendance(editingAtt.id)
      setEditingAtt(null)
    }
  }

  const handleAdjustAtt = (field: 'arrival_time' | 'departure_time', value: string) => {
    if (!editingAtt || !selectedChild) return
    const update = { ...editingAtt, [field]: value }
    onUpsertAttendance({
      child_id: update.child_id,
      date: update.date,
      arrival_time: update.arrival_time,
      departure_time: update.departure_time,
    })
    setEditingAtt(null)
  }

  // Generate hour labels (every hour)
  const hourLabels: { label: string; slot: number }[] = []
  for (let s = 0; s <= TOTAL_SLOTS; s += 4) {
    hourLabels.push({ label: minutesToTime(DAY_START_MIN + s * SLOT_MINUTES), slot: s })
  }

  const monthLabel = `${MONTH_NAMES[weekStart.getMonth()]} ${weekStart.getFullYear()}`
  const weekEnd = weekDates[4]
  const weekEndLabel = `${MONTH_NAMES[weekEnd.getMonth()]} ${weekEnd.getFullYear()}`
  const isSameMonth = weekStart.getMonth() === weekEnd.getMonth()

  // Convert weekStart to YYYY-Www format for <input type="week"> (ISO 8601)
  const tmp = new Date(weekStart)
  tmp.setHours(0, 0, 0, 0)
  const thursday = new Date(tmp)
  thursday.setDate(tmp.getDate() + (3 - ((tmp.getDay() + 6) % 7)))
  const isoYear = thursday.getFullYear()
  const jan4 = new Date(isoYear, 0, 4)
  const jan4Thursday = new Date(jan4)
  jan4Thursday.setDate(jan4.getDate() + (3 - ((jan4.getDay() + 6) % 7)))
  const weekNum = 1 + Math.round((thursday.getTime() - jan4Thursday.getTime()) / (7 * 86400000))
  const weekInputValue = `${isoYear}-W${String(weekNum).padStart(2, '0')}`

  const handleWeekInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    if (!value) return
    const [yearStr, weekStr] = value.split('-W')
    const year = parseInt(yearStr)
    const week = parseInt(weekStr)
    const jan4 = new Date(year, 0, 4)
    const week1Monday = new Date(jan4)
    week1Monday.setDate(jan4.getDate() - ((jan4.getDay() + 6) % 7))
    const target = new Date(week1Monday)
    target.setDate(target.getDate() + (week - 1) * 7)
    onWeekChange(target)
  }

  return (
    <div className="flex flex-col h-full" onMouseUp={handleMouseUp} onMouseLeave={handleMouseUp}>
      {/* Toolbar */}
      <div className="flex items-center justify-between px-6 py-3 bg-card border-b">
        <div className="flex items-center gap-3">
          <button
            onClick={onPrevWeek}
            className="p-2 rounded-md hover:bg-secondary text-foreground"
            title="Semaine précédente"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </button>
          <div className="flex items-center gap-2">
            <input
              type="week"
              value={weekInputValue}
              onChange={handleWeekInputChange}
              className="text-lg font-semibold text-center bg-secondary/50 hover:bg-secondary rounded-md px-2 py-1 cursor-pointer border border-transparent hover:border-input"
              title="Sélectionner une semaine"
            />
            <span className="text-sm text-muted-foreground">
              {isSameMonth ? monthLabel : `${monthLabel} — ${weekEndLabel}`}
            </span>
          </div>
          <button
            onClick={onNextWeek}
            className="p-2 rounded-md hover:bg-secondary text-foreground"
            title="Semaine suivante"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9 18l6-6-6-6" />
            </svg>
          </button>
          <button
            onClick={onToday}
            className="ml-2 px-3 py-1.5 text-sm rounded-md bg-secondary hover:bg-secondary/80 text-foreground font-medium"
          >
            Aujourd'hui
          </button>
          <button
            onClick={onToggleView}
            className="ml-2 px-3 py-1.5 text-sm rounded-md bg-secondary hover:bg-secondary/80 text-foreground font-medium"
            title="Basculer en vue tableau"
          >
            📋 Tableau
          </button>
        </div>
        {selectedChild && (
          <div className="flex items-center gap-3 text-sm">
            <button
              onClick={() => onCopyWeek(selectedChild.id)}
              className="px-3 py-1.5 text-sm rounded-md bg-secondary hover:bg-secondary/80 text-foreground font-medium"
              title="Copier les présences de la semaine précédente"
            >
              Copier semaine précédente
            </button>
            <button
              onClick={onNextChild}
              className="px-3 py-1.5 text-sm rounded-md bg-primary text-primary-foreground hover:bg-primary/90 font-medium"
              title="Passer à l'enfant suivant"
            >
              Enfant suivant →
            </button>
            <span className="text-muted-foreground">Sélectionné :</span>
            <span className="flex items-center gap-2 font-medium">
              <span className="w-3 h-3 rounded-full" style={{ backgroundColor: selectedChild.color }} />
              {selectedChild.first_name} {selectedChild.last_name}
            </span>
            <span className="text-xs text-muted-foreground ml-2 hidden lg:inline">
              ←→ jour · Entrée = éditer · N = nouveau · A = absent · Suppr = effacer
            </span>
          </div>
        )}
      </div>

      {/* Calendar */}
      <div
        className="flex-1 overflow-hidden bg-card outline-none"
        ref={containerRef}
      >
        <div className="flex" ref={gridRef}>
          {/* Hour column */}
          <div className="sticky left-0 z-10 w-16 flex-shrink-0 bg-card border-r">
            <div className="h-10 border-b" />
            {hourLabels.map(({ label, slot }) => (
              <div
                key={slot}
                className="text-xs text-muted-foreground text-right pr-2 -translate-y-1.5"
                style={{ height: slot === TOTAL_SLOTS ? 0 : slotHeight * 4 }}
              >
                {slot < TOTAL_SLOTS && label}
              </div>
            ))}
          </div>

          {/* Day columns */}
          {weekDates.map((date, dayIndex) => {
            const dateStr = formatDate(date)
            const dayAtts = attByDate.get(dateStr) || []
            const today = isToday(date)

            return (
              <div
                key={dayIndex}
                ref={(el) => { dayRefs.current[dayIndex] = el }}
                tabIndex={selectedChild ? 0 : -1}
                onFocus={() => { setFocusedDay(dayIndex); keyboardActive.current = true }}
                onBlur={() => { keyboardActive.current = false }}
                onKeyDown={(e) => handleDayKeyDown(e, dayIndex)}
                className={`flex-1 min-w-[140px] border-r last:border-r-0 relative outline-none ${focusedDay === dayIndex && keyboardActive.current ? 'ring-2 ring-primary ring-inset z-10' : ''}`}
              >
                {/* Day header */}
                <div className={`h-10 flex items-center justify-center gap-1 border-b ${today ? 'bg-primary/5' : ''} ${focusedDay === dayIndex && keyboardActive.current ? 'bg-primary/10' : ''}`}>
                  <div className="flex flex-col items-center">
                    <span className="text-xs font-medium text-muted-foreground">{DAY_NAMES_SHORT[dayIndex]}</span>
                    <span className={`text-sm font-semibold ${today ? 'text-primary' : 'text-foreground'}`}>
                      {date.getDate()}
                    </span>
                  </div>
                  {selectedChild && (
                    <button
                      onClick={() => onMarkAbsent(selectedChild.id, dateStr)}
                      className="ml-1 px-1.5 py-0.5 text-[10px] rounded bg-red-100 text-red-700 hover:bg-red-200 font-medium"
                      title="Marquer absent"
                    >
                      Absent
                    </button>
                  )}
                </div>

                {/* Grid */}
                <div
                  className="relative cursor-crosshair"
                  style={{ height: TOTAL_SLOTS * slotHeight }}
                  onMouseDown={(e) => handleMouseDown(e, dayIndex)}
                  onMouseMove={(e) => handleMouseMove(e, dayIndex)}
                >
                  {/* Slot lines */}
                  {Array.from({ length: TOTAL_SLOTS }, (_, i) => (
                    <div
                      key={i}
                      className="absolute left-0 right-0 border-t border-border/30"
                      style={{ top: i * slotHeight, height: slotHeight }}
                    />
                  ))}

                  {/* Hour lines (stronger) */}
                  {hourLabels.map(({ slot }) => (
                    slot > 0 && slot < TOTAL_SLOTS && (
                      <div
                        key={slot}
                        className="absolute left-0 right-0 border-t border-border/60"
                        style={{ top: slot * slotHeight }}
                      />
                    )
                  ))}

                  {/* Absent block */}
                  {dayAtts.some(att => att.arrival_time === 'absent') && selectedChild && (
                    <div
                      className="absolute left-1 right-1 rounded-md flex flex-col items-center justify-center text-xs text-red-700 border-2 border-dashed border-red-300 bg-red-50"
                      style={{
                        top: 0,
                        height: TOTAL_SLOTS * slotHeight,
                      }}
                    >
                      <span className="font-semibold text-lg">Absent</span>
                      {selectedChild && (
                        <button
                          onClick={() => onDeleteAttendance(dayAtts.find(att => att.arrival_time === 'absent')!.id)}
                          className="mt-2 px-2 py-1 text-[10px] rounded bg-red-200 hover:bg-red-300 text-red-800 font-medium"
                        >
                          Annuler l'absence
                        </button>
                      )}
                    </div>
                  )}

                  {/* Existing attendance blocks */}
                  {dayAtts.filter(att => att.arrival_time !== 'absent').map(att => {
                    const child = childById.get(att.child_id)
                    if (!child) return null
                    // Hide block while being moved
                    if (move && move.attId === att.id) return null
                    let startSlot = timeToSlot(att.arrival_time)
                    let endSlot = timeToSlot(att.departure_time)
                    // Apply live resize preview
                    if (resize && resize.attId === att.id) {
                      if (resize.edge === 'top') {
                        startSlot = Math.min(resize.originalSlot, endSlot - 1)
                      } else {
                        endSlot = Math.max(resize.originalSlot, startSlot + 1)
                      }
                    }
                    const top = startSlot * slotHeight
                    const height = (endSlot - startSlot) * slotHeight
                    const durationMin = slotToMinutes(endSlot) - slotToMinutes(startSlot)
                    return (
                      <div
                        key={att.id}
                        onClick={(e) => handleAttendanceClick(e, att)}
                        onMouseDown={(e) => handleMoveStart(e, att, dayIndex)}
                        className="absolute left-1 right-1 rounded-md flex flex-col items-center justify-center text-xs text-white cursor-grab hover:opacity-80 transition-opacity shadow-sm overflow-hidden group active:cursor-grabbing"
                        style={{
                          top,
                          height: Math.max(height, slotHeight),
                          backgroundColor: child.color,
                        }}
                      >
                        {/* Top resize handle */}
                        <div
                          onMouseDown={(e) => handleResizeStart(e, att, 'top')}
                          className="absolute top-0 left-0 right-0 h-2 cursor-ns-resize bg-white/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                        >
                          <div className="w-8 h-0.5 bg-white/70 rounded" />
                        </div>
                        <span className="font-semibold">{child.first_name}</span>
                        <span className="text-[10px] opacity-90">
                          {minutesToTime(slotToMinutes(startSlot))} - {minutesToTime(slotToMinutes(endSlot))}
                        </span>
                        <span className="text-[10px] opacity-75 font-medium">
                          {formatDuration(durationMin)}
                        </span>
                        {/* Bottom resize handle */}
                        <div
                          onMouseDown={(e) => handleResizeStart(e, att, 'bottom')}
                          className="absolute bottom-0 left-0 right-0 h-2 cursor-ns-resize bg-white/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                        >
                          <div className="w-8 h-0.5 bg-white/70 rounded" />
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            onDeleteAttendance(att.id)
                          }}
                          onMouseDown={(e) => e.stopPropagation()}
                          className="absolute top-0.5 right-0.5 w-5 h-5 rounded-full bg-black/30 hover:bg-red-500 flex items-center justify-center text-[10px] opacity-0 group-hover:opacity-100 transition-opacity"
                          title="Supprimer ce créneau"
                        >
                          ✕
                        </button>
                      </div>
                    )
                  })}

                  {/* Move preview */}
                  {move && move.currentDayIndex === dayIndex && (
                    <div
                      className="absolute left-1 right-1 rounded-md border-2 border-dashed flex flex-col items-center justify-center text-xs font-medium pointer-events-none"
                      style={{
                        top: move.currentSlot * slotHeight,
                        height: move.durationSlots * slotHeight,
                        backgroundColor: (childById.get(move.childId)?.color || '#ccc') + '40',
                        borderColor: childById.get(move.childId)?.color || '#ccc',
                        color: childById.get(move.childId)?.color || '#666',
                      }}
                    >
                      <span className="font-semibold">{childById.get(move.childId)?.first_name}</span>
                      <span className="text-[10px]">
                        {minutesToTime(slotToMinutes(move.currentSlot))} - {minutesToTime(slotToMinutes(move.currentSlot + move.durationSlots))}
                      </span>
                    </div>
                  )}

                  {/* Drag preview */}
                  {drag && drag.dayIndex === dayIndex && (
                    <div
                      className="absolute left-1 right-1 rounded-md border-2 border-dashed flex items-center justify-center text-xs font-medium"
                      style={{
                        top: Math.min(drag.startSlot, drag.currentSlot) * slotHeight,
                        height: (Math.abs(drag.currentSlot - drag.startSlot) + 1) * slotHeight,
                        backgroundColor: selectedChild ? selectedChild.color + '30' : 'transparent',
                        borderColor: selectedChild?.color || '#ccc',
                        color: selectedChild?.color || '#666',
                      }}
                    >
                      {selectedChild && (
                        <span>
                          {minutesToTime(slotToMinutes(Math.min(drag.startSlot, drag.currentSlot)))}
                          {' - '}
                          {minutesToTime(slotToMinutes(Math.max(drag.startSlot, drag.currentSlot) + 1))}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Edit modal */}
      {editingAtt && (
        <div
          className="fixed inset-0 bg-black/40 flex items-center justify-center z-50"
          onClick={() => setEditingAtt(null)}
        >
          <div
            className="bg-card rounded-lg shadow-xl p-6 w-80 space-y-4"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => {
              if (e.key === 'Enter') { e.preventDefault(); handleSaveEdit() }
              if (e.key === 'Delete' && e.shiftKey) { e.preventDefault(); handleDeleteAtt() }
              if (e.key === 'Escape') { e.preventDefault(); setEditingAtt(null) }
            }}
          >
            <h3 className="text-lg font-semibold">Modifier la présence</h3>
            <div className="space-y-3">
              <label className="block">
                <span className="text-sm text-muted-foreground">Arrivée</span>
                <input
                  ref={editArrivalRef}
                  type="time"
                  step={900}
                  value={editingAtt.arrival_time}
                  onChange={(e) => setEditingAtt({ ...editingAtt, arrival_time: e.target.value })}
                  className="w-full mt-1 px-3 py-2 rounded-md border border-input bg-background text-foreground"
                />
              </label>
              <label className="block">
                <span className="text-sm text-muted-foreground">Départ</span>
                <input
                  type="time"
                  step={900}
                  value={editingAtt.departure_time}
                  onChange={(e) => setEditingAtt({ ...editingAtt, departure_time: e.target.value })}
                  className="w-full mt-1 px-3 py-2 rounded-md border border-input bg-background text-foreground"
                />
              </label>
              <div className="text-sm text-muted-foreground">
                Durée : {formatDuration(timeToMinutes(editingAtt.departure_time) - timeToMinutes(editingAtt.arrival_time))}
              </div>
            </div>
            <div className="flex justify-between gap-2 pt-2">
              <button
                onClick={handleDeleteAtt}
                className="px-3 py-2 text-sm rounded-md bg-destructive text-destructive-foreground hover:bg-destructive/90 font-medium"
              >
                Supprimer
              </button>
              <div className="flex gap-2">
                <button
                  onClick={() => setEditingAtt(null)}
                  className="px-3 py-2 text-sm rounded-md bg-secondary text-secondary-foreground hover:bg-secondary/80 font-medium"
                >
                  Annuler
                </button>
                <button
                  onClick={handleSaveEdit}
                  className="px-3 py-2 text-sm rounded-md bg-primary text-primary-foreground hover:bg-primary/90 font-medium"
                >
                  Enregistrer
                </button>
              </div>
            </div>
            <p className="text-xs text-muted-foreground text-center">Entrée = enregistrer · Échap = annuler · Maj+Suppr = supprimer</p>
          </div>
        </div>
      )}

      {/* Quick add modal */}
      {quickAdd && selectedChild && (
        <div
          className="fixed inset-0 bg-black/40 flex items-center justify-center z-50"
          onClick={() => setQuickAdd(null)}
        >
          <div
            className="bg-card rounded-lg shadow-xl p-6 w-80 space-y-4"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => {
              if (e.key === 'Enter') { e.preventDefault(); handleSaveQuickAdd() }
              if (e.key === 'Escape') { e.preventDefault(); setQuickAdd(null) }
            }}
          >
            <h3 className="text-lg font-semibold">
              Nouvelle présence — {DAY_NAMES[quickAdd.dayIndex]} {weekDates[quickAdd.dayIndex].getDate()}/{weekDates[quickAdd.dayIndex].getMonth() + 1}
            </h3>
            <div className="space-y-3">
              <label className="block">
                <span className="text-sm text-muted-foreground">Arrivée</span>
                <input
                  ref={quickAddArrivalRef}
                  type="time"
                  step={900}
                  value={quickAdd.arrival}
                  onChange={(e) => setQuickAdd({ ...quickAdd, arrival: e.target.value })}
                  className="w-full mt-1 px-3 py-2 rounded-md border border-input bg-background text-foreground"
                />
              </label>
              <label className="block">
                <span className="text-sm text-muted-foreground">Départ</span>
                <input
                  type="time"
                  step={900}
                  value={quickAdd.departure}
                  onChange={(e) => setQuickAdd({ ...quickAdd, departure: e.target.value })}
                  className="w-full mt-1 px-3 py-2 rounded-md border border-input bg-background text-foreground"
                />
              </label>
              <div className="text-sm text-muted-foreground">
                Durée : {formatDuration(timeToMinutes(quickAdd.departure) - timeToMinutes(quickAdd.arrival))}
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setQuickAdd(null)}
                className="px-3 py-2 text-sm rounded-md bg-secondary text-secondary-foreground hover:bg-secondary/80 font-medium"
              >
                Annuler
              </button>
              <button
                onClick={handleSaveQuickAdd}
                className="px-3 py-2 text-sm rounded-md bg-primary text-primary-foreground hover:bg-primary/90 font-medium"
              >
                Ajouter
              </button>
            </div>
            <p className="text-xs text-muted-foreground text-center">Entrée = ajouter · Échap = annuler</p>
          </div>
        </div>
      )}
    </div>
  )
}
