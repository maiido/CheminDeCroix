import { useState, useEffect, useCallback, useRef } from 'react'
import { Child, Attendance, ImportResult, ImportResultChild } from '../types'
import {
  getWeekStart, getWeekDates, formatDate, minutesToTime, timeToMinutes,
  snapToSlot, DAY_START_MIN, SLOT_MINUTES, MONTH_NAMES, DAY_NAMES_SHORT,
  formatDuration, isToday,
} from '../lib/utils'

interface WeekTableViewProps {
  weekStart: Date
  weekDates: Date[]
  allChildren: Child[]
  attendance: Attendance[]
  onPrevWeek: () => void
  onNextWeek: () => void
  onToday: () => void
  onWeekChange: (date: Date) => void
  onUpsertAttendance: (data: { child_id: number; date: string; arrival_time: string; departure_time: string }) => void
  onDeleteAttendance: (childId: number, date: string) => void
  onToggleView: () => void
  onMarkAbsent: (childId: number, date: string) => void
}

interface EditCell {
  childId: number
  date: string
  field: 'arrival' | 'departure'
}

export function WeekTableView({
  weekStart,
  weekDates,
  allChildren,
  attendance,
  onPrevWeek,
  onNextWeek,
  onToday,
  onWeekChange,
  onUpsertAttendance,
  onDeleteAttendance,
  onToggleView,
  onMarkAbsent,
}: WeekTableViewProps) {
  const [editCell, setEditCell] = useState<EditCell | null>(null)
  const [editArrival, setEditArrival] = useState('')
  const [editDeparture, setEditDeparture] = useState('')
  const [importing, setImporting] = useState(false)
  const [importResult, setImportResult] = useState<ImportResult | null>(null)
  const [importError, setImportError] = useState('')
  const [importPreview, setImportPreview] = useState(false)
  const [focusedCell, setFocusedCell] = useState<{ row: number; col: number } | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const cellRefs = useRef<(HTMLTableCellElement | null)[]>([])
  const editInputRef = useRef<HTMLInputElement>(null)
  const editDepartureRef = useRef<HTMLInputElement>(null)

  // Build attendance map: { childId_dateStr: Attendance }
  const attMap = new Map<string, Attendance>()
  for (const a of attendance) {
    attMap.set(`${a.child_id}_${a.date}`, a)
  }

  const handleStartEdit = (childId: number, date: string, field: 'arrival' | 'departure') => {
    const key = `${childId}_${date}`
    const att = attMap.get(key)
    setEditArrival(att?.arrival_time || '08:00')
    setEditDeparture(att?.departure_time || '18:00')
    setEditCell({ childId, date, field })
  }

  const focusCell = (row: number, col: number) => {
    const idx = row * 5 + col
    cellRefs.current[idx]?.focus()
  }

  const handleCellKeyDown = (e: React.KeyboardEvent, row: number, col: number) => {
    if (editCell) return
    const child = allChildren[row]
    if (!child) return
    const dateStr = formatDate(weekDates[col])
    const att = attMap.get(`${child.id}_${dateStr}`)

    switch (e.key) {
      case 'ArrowRight':
        e.preventDefault()
        if (col < 4) { setFocusedCell({ row, col: col + 1 }); focusCell(row, col + 1) }
        break
      case 'ArrowLeft':
        e.preventDefault()
        if (col > 0) { setFocusedCell({ row, col: col - 1 }); focusCell(row, col - 1) }
        break
      case 'ArrowDown':
        e.preventDefault()
        if (row < allChildren.length - 1) { setFocusedCell({ row: row + 1, col }); focusCell(row + 1, col) }
        break
      case 'ArrowUp':
        e.preventDefault()
        if (row > 0) { setFocusedCell({ row: row - 1, col }); focusCell(row - 1, col) }
        break
      case 'Enter':
      case ' ': {
        e.preventDefault()
        if (att && att.arrival_time !== 'absent') {
          handleStartEdit(child.id, dateStr, 'arrival')
        } else if (!att) {
          setEditArrival('08:00')
          setEditDeparture('18:00')
          setEditCell({ childId: child.id, date: dateStr, field: 'arrival' })
        }
        break
      }
      case 'Delete':
      case 'Backspace':
        e.preventDefault()
        if (att) handleDeleteRow(child.id, dateStr)
        break
      case 'a':
      case 'A':
        e.preventDefault()
        if (!att) onMarkAbsent(child.id, dateStr)
        break
    }
  }

  const handleEditKeyDown = (e: React.KeyboardEvent, field: 'arrival' | 'departure') => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleSaveEdit()
    } else if (e.key === 'Escape') {
      e.preventDefault()
      setEditCell(null)
    } else if (e.key === 'Tab' && field === 'departure' && !e.shiftKey && editCell) {
      e.preventDefault()
      handleSaveEdit()
      // Find next cell and open it in edit mode
      const row = allChildren.findIndex(c => c.id === editCell.childId)
      const col = weekDates.findIndex(d => formatDate(d) === editCell.date)
      let nextRow = row, nextCol = col + 1
      if (nextCol > 4) { nextCol = 0; nextRow++ }
      if (nextRow < allChildren.length) {
        const nextChild = allChildren[nextRow]
        const nextDateStr = formatDate(weekDates[nextCol])
        const nextAtt = attMap.get(`${nextChild.id}_${nextDateStr}`)
        setFocusedCell({ row: nextRow, col: nextCol })
        setEditArrival(nextAtt?.arrival_time || '08:00')
        setEditDeparture(nextAtt?.departure_time || '18:00')
        setEditCell({ childId: nextChild.id, date: nextDateStr, field: 'arrival' })
      }
    } else if (e.key === 'Tab' && field === 'arrival' && e.shiftKey && editCell) {
      e.preventDefault()
      handleSaveEdit()
      // Move to previous cell's departure
      const row = allChildren.findIndex(c => c.id === editCell.childId)
      const col = weekDates.findIndex(d => formatDate(d) === editCell.date)
      let prevRow = row, prevCol = col - 1
      if (prevCol < 0) { prevCol = 4; prevRow-- }
      if (prevRow >= 0) {
        const prevChild = allChildren[prevRow]
        const prevDateStr = formatDate(weekDates[prevCol])
        const prevAtt = attMap.get(`${prevChild.id}_${prevDateStr}`)
        setFocusedCell({ row: prevRow, col: prevCol })
        setEditArrival(prevAtt?.arrival_time || '08:00')
        setEditDeparture(prevAtt?.departure_time || '18:00')
        setEditCell({ childId: prevChild.id, date: prevDateStr, field: 'departure' })
      }
    }
  }

  useEffect(() => {
    if (editCell) {
      const ref = editCell.field === 'departure' ? editDepartureRef : editInputRef
      ref.current?.focus()
      ref.current?.select()
    }
  }, [editCell])

  const normalizeTime = (value: string): string => {
    const cleaned = value.replace(/[^0-9:]/g, '')
    const parts = cleaned.split(':')
    if (parts.length === 2) {
      const h = parseInt(parts[0], 10)
      const m = parseInt(parts[1], 10)
      if (!isNaN(h) && !isNaN(m)) {
        return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
      }
    }
    if (parts.length === 1 && cleaned.length >= 3 && cleaned.length <= 4) {
      const all = cleaned.replace(/:/g, '')
      const h = parseInt(all.slice(0, -2) || '0', 10)
      const m = parseInt(all.slice(-2), 10)
      if (!isNaN(h) && !isNaN(m)) {
        return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
      }
    }
    return ''
  }

  const handleSaveEdit = () => {
    if (!editCell) return
    const arrival = normalizeTime(editArrival)
    const departure = normalizeTime(editDeparture)

    if (arrival && departure) {
      onUpsertAttendance({
        child_id: editCell.childId,
        date: editCell.date,
        arrival_time: arrival,
        departure_time: departure,
      })
      setEditCell(null)
    }
  }

  const handleDeleteRow = (childId: number, date: string) => {
    onDeleteAttendance(childId, date)
  }

  const handleImportImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setImporting(true)
    setImportError('')
    setImportResult(null)
    setImportPreview(true)
    try {
      const weekDateStrs = weekDates.map(d => formatDate(d))
      const childrenData = allChildren.map(c => ({ first_name: c.first_name, last_name: c.last_name }))
      const filePath = (file as File & { path: string }).path
      const result = await window.api.import.attendanceImage(filePath, childrenData, weekDateStrs)
      if (result.success && result.data) {
        setImportResult(result.data)
      } else {
        let errMsg = result.error || 'Erreur inconnue'
        if (result.raw) {
          errMsg += '\n\n--- Réponse brute de l\'IA ---\n' + result.raw
        }
        setImportError(errMsg)
        setImportPreview(false)
      }
    } catch (err) {
      setImportError(String(err))
      setImportPreview(false)
    }
    setImporting(false)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const handleApplyImport = () => {
    if (!importResult) return
    for (const child of importResult.children) {
      const matched = allChildren.find(c =>
        c.first_name.toLowerCase() === child.first_name.toLowerCase() &&
        c.last_name.toLowerCase() === child.last_name.toLowerCase()
      )
      if (!matched) continue
      for (const day of child.days) {
        if (day.arrival && day.departure) {
          onUpsertAttendance({
            child_id: matched.id,
            date: day.date,
            arrival_time: day.arrival,
            departure_time: day.departure,
          })
        }
      }
    }
    setImportPreview(false)
    setImportResult(null)
  }

  const monthLabel = `${MONTH_NAMES[weekStart.getMonth()]} ${weekStart.getFullYear()}`
  const weekEnd = weekDates[4]
  const weekEndLabel = `${MONTH_NAMES[weekEnd.getMonth()]} ${weekEnd.getFullYear()}`
  const isSameMonth = weekStart.getMonth() === weekEnd.getMonth()
  const weekLabel = isSameMonth ? monthLabel : `${monthLabel} — ${weekEndLabel}`
  const weekDetail = weekDates.map((d, i) => `${DAY_NAMES_SHORT[i]} ${d.getDate()}/${d.getMonth() + 1}`).join(' · ')

  // Convert weekStart to YYYY-Www format for <input type="week"> (ISO 8601)
  // ISO week 1 = week containing the first Thursday of the year (or Jan 4)
  const tmp = new Date(weekStart)
  tmp.setHours(0, 0, 0, 0)
  // Find the Thursday of the current week (ISO week year is determined by Thursday)
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
    // ISO: week 1 Monday = Jan 4 adjusted to its Monday
    const jan4 = new Date(year, 0, 4)
    const week1Monday = new Date(jan4)
    week1Monday.setDate(jan4.getDate() - ((jan4.getDay() + 6) % 7))
    const target = new Date(week1Monday)
    target.setDate(target.getDate() + (week - 1) * 7)
    onWeekChange(target)
  }

  return (
    <div className="flex flex-col h-full overflow-hidden bg-card">
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
            title="Basculer en vue calendrier"
          >
            📅 Calendrier
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleImportImage}
            className="hidden"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={importing}
            className="ml-2 px-3 py-1.5 text-sm rounded-md bg-primary text-primary-foreground hover:bg-primary/90 font-medium disabled:opacity-50"
            title="Importer une image de présence"
          >
            {importing ? '⏳ Analyse...' : '📷 Importer image'}
          </button>
        </div>
        <span className="text-xs text-muted-foreground hidden lg:inline">
          ←→↑↓ naviguer · Entrée = éditer · Tab = champ suivant · A = absent · Suppr = effacer
        </span>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        <table className="w-full border-collapse">
          <thead className="sticky top-0 z-10">
            <tr className="bg-secondary/80">
              <th className="text-left px-3 py-2 border-b border-r font-semibold text-sm min-w-[160px]">
                Enfant
              </th>
              {weekDates.map((date, i) => {
                const today = isToday(date)
                return (
                  <th
                    key={i}
                    className={`px-2 py-2 border-b border-r font-semibold text-sm text-center min-w-[140px] ${today ? 'bg-primary/10' : ''}`}
                  >
                    <div className="text-xs text-muted-foreground">{DAY_NAMES_SHORT[i]}</div>
                    <div className={today ? 'text-primary' : ''}>{date.getDate()}</div>
                  </th>
                )
              })}
              <th className="px-3 py-2 border-b font-semibold text-sm text-center min-w-[80px]">
                Total
              </th>
            </tr>
          </thead>
          <tbody>
            {allChildren.length === 0 && (
              <tr>
                <td colSpan={7} className="text-center text-muted-foreground py-12">
                  Aucun enfant actif pour cette semaine.
                </td>
              </tr>
            )}
            {allChildren.map((child, ri) => {
              let weekTotal = 0
              return (
                <tr key={child.id} className="hover:bg-secondary/20">
                  <td className="px-3 py-2 border-b border-r text-sm">
                    <div className="flex items-center gap-2">
                      <span
                        className="w-3 h-3 rounded-full flex-shrink-0"
                        style={{ backgroundColor: child.color }}
                      />
                      <span className="font-medium">{child.first_name} {child.last_name}</span>
                    </div>
                  </td>
                  {weekDates.map((date, di) => {
                    const dateStr = formatDate(date)
                    const key = `${child.id}_${dateStr}`
                    const att = attMap.get(key)
                    const isEditing = editCell?.childId === child.id && editCell?.date === dateStr
                    const today = isToday(date)
                    const isFocused = focusedCell?.row === ri && focusedCell?.col === di

                    if (att && att.arrival_time !== 'absent') {
                      weekTotal += timeToMinutes(att.departure_time) - timeToMinutes(att.arrival_time)
                    }

                    return (
                      <td
                        key={di}
                        ref={(el) => { cellRefs.current[ri * 5 + di] = el }}
                        tabIndex={isEditing ? -1 : 0}
                        onFocus={() => setFocusedCell({ row: ri, col: di })}
                        onKeyDown={(e) => handleCellKeyDown(e, ri, di)}
                        className={`px-1 py-1 border-b border-r text-center text-sm outline-none ${today ? 'bg-primary/5' : ''} ${isFocused ? 'ring-2 ring-primary ring-inset' : ''}`}
                      >
                        {isEditing ? (
                          <div className="flex flex-col gap-1">
                            <input
                              ref={editInputRef}
                              type="text"
                              inputMode="numeric"
                              placeholder="08:00"
                              value={editArrival}
                              onChange={(e) => setEditArrival(e.target.value)}
                              onKeyDown={(e) => handleEditKeyDown(e, 'arrival')}
                              className="w-full px-1 py-0.5 text-xs rounded border border-input bg-background text-center"
                            />
                            <input
                              ref={editDepartureRef}
                              type="text"
                              inputMode="numeric"
                              placeholder="18:00"
                              value={editDeparture}
                              onChange={(e) => setEditDeparture(e.target.value)}
                              onKeyDown={(e) => handleEditKeyDown(e, 'departure')}
                              className="w-full px-1 py-0.5 text-xs rounded border border-input bg-background text-center"
                            />
                            <div className="flex gap-1 justify-center">
                              <button
                                onClick={handleSaveEdit}
                                className="text-xs px-2 py-0.5 rounded bg-primary text-primary-foreground hover:bg-primary/90"
                              >
                                ✓
                              </button>
                              <button
                                onClick={() => setEditCell(null)}
                                className="text-xs px-2 py-0.5 rounded bg-secondary text-secondary-foreground hover:bg-secondary/80"
                              >
                                ✕
                              </button>
                            </div>
                          </div>
                        ) : att ? (
                          att.arrival_time === 'absent' ? (
                            <div className="flex flex-col items-center gap-0.5 group">
                              <span className="text-red-600 font-medium">Absent</span>
                              <button
                                onClick={() => handleDeleteRow(child.id, dateStr)}
                                className="text-xs text-destructive opacity-0 group-hover:opacity-100 transition-opacity mt-0.5"
                                title="Supprimer"
                              >
                                ✕ Suppr
                              </button>
                            </div>
                          ) : (
                          <div className="flex flex-col items-center gap-0.5 group">
                            <span
                              className="cursor-pointer hover:underline"
                              onClick={() => handleStartEdit(child.id, dateStr, 'arrival')}
                            >
                              {att.arrival_time}
                            </span>
                            <span className="text-muted-foreground text-xs">—</span>
                            <span
                              className="cursor-pointer hover:underline"
                              onClick={() => handleStartEdit(child.id, dateStr, 'departure')}
                            >
                              {att.departure_time}
                            </span>
                            <button
                              onClick={() => handleDeleteRow(child.id, dateStr)}
                              className="text-xs text-destructive opacity-0 group-hover:opacity-100 transition-opacity mt-0.5"
                              title="Supprimer"
                            >
                              ✕ Suppr
                            </button>
                          </div>
                          )
                        ) : (
                          <div className="flex flex-col items-center gap-1 py-1">
                            <button
                              onClick={() => {
                                setEditArrival('08:00')
                                setEditDeparture('18:00')
                                setEditCell({ childId: child.id, date: dateStr, field: 'arrival' })
                              }}
                              className="text-muted-foreground/40 hover:text-muted-foreground hover:bg-secondary/30 rounded text-xs px-2 py-1"
                            >
                              +
                            </button>
                            <button
                              onClick={() => onMarkAbsent(child.id, dateStr)}
                              className="text-[10px] text-red-600 hover:text-red-700 hover:bg-red-50 rounded px-1.5 py-0.5"
                              title="Marquer absent"
                            >
                              Absent
                            </button>
                          </div>
                        )}
                      </td>
                    )
                  })}
                  <td className="px-3 py-2 border-b text-center text-sm font-semibold bg-secondary/10">
                    {weekTotal > 0 ? formatDuration(weekTotal) : '—'}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Import error */}
      {importError && (
        <div className="px-6 py-3 bg-red-50 border-t text-sm text-red-700 select-text">
          <p className="font-medium mb-1">Erreur import :</p>
          <pre className="whitespace-pre-wrap font-mono text-xs bg-red-100/50 p-2 rounded mb-2 select-text">{importError}</pre>
          <div className="flex gap-2">
            <button
              onClick={() => navigator.clipboard.writeText(importError)}
              className="underline"
            >
              Copier
            </button>
            <button onClick={() => setImportError('')} className="underline">Fermer</button>
          </div>
        </div>
      )}

      {/* Import preview modal */}
      {importPreview && (importing || importResult) && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-card rounded-lg shadow-xl max-w-3xl w-full max-h-[80vh] overflow-auto">
            {importing && (
              <div className="px-6 py-16 text-center">
                <div className="inline-block w-10 h-10 border-4 border-primary/20 border-t-primary rounded-full animate-spin mb-4" />
                <h3 className="text-lg font-semibold mb-1">Analyse de l'image en cours...</h3>
                <p className="text-sm text-muted-foreground">Import sur la semaine : {weekDetail}</p>
                <p className="text-sm text-muted-foreground">L'IA analyse la feuille de présence. Cela peut prendre quelques secondes.</p>
              </div>
            )}
            {!importing && importResult && (
              <>
            <div className="px-6 py-4 border-b flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold">Aperçu de l'import</h3>
                <p className="text-xs text-muted-foreground mt-0.5">Import sur la semaine : {weekDetail}</p>
              </div>
              <button
                onClick={() => { setImportPreview(false); setImportResult(null) }}
                className="text-muted-foreground hover:text-foreground text-xl"
              >
                ✕
              </button>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-sm text-muted-foreground">
                Vérifiez les données ci-dessous avant de les appliquer. Les présences existantes seront écrasées.
              </p>
              {importResult.children.map((child, i) => {
                const matched = allChildren.find(c =>
                  c.first_name.toLowerCase() === child.first_name.toLowerCase() &&
                  c.last_name.toLowerCase() === child.last_name.toLowerCase()
                )
                return (
                  <div key={i} className="border rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="font-medium">{child.first_name} {child.last_name}</span>
                      {matched ? (
                        <span className="text-xs text-green-600">✓ Reconnu</span>
                      ) : (
                        <span className="text-xs text-red-600">✕ Non reconnu</span>
                      )}
                    </div>
                    <div className="grid grid-cols-5 gap-2">
                      {child.days.map((day, j) => (
                        <div key={j} className="text-sm border rounded p-2 text-center">
                          <div className="text-xs text-muted-foreground">
                            {DAY_NAMES_SHORT[j]} {new Date(day.date).getDate()}
                          </div>
                          {day.arrival === 'absent' ? (
                            <div className="text-red-600 font-medium">Absent</div>
                          ) : (
                            <div className="font-mono">
                              {day.arrival} → {day.departure}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })}
              <div className="flex justify-end gap-3 pt-2">
                <button
                  onClick={() => { setImportPreview(false); setImportResult(null) }}
                  className="px-4 py-2 text-sm rounded-md bg-secondary hover:bg-secondary/80 text-foreground font-medium"
                >
                  Annuler
                </button>
                <button
                  onClick={handleApplyImport}
                  className="px-4 py-2 text-sm rounded-md bg-primary text-primary-foreground hover:bg-primary/90 font-medium"
                >
                  Appliquer
                </button>
              </div>
            </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
