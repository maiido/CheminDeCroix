import { useState, useEffect, useCallback } from 'react'
import { Child, Attendance } from '../types'
import { MONTH_NAMES, timeToMinutes, formatDuration } from '../lib/utils'

export function RecapView({ children }: { children: Child[] }) {
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [mode, setMode] = useState<'month' | 'year'>('year')
  const [month, setMonth] = useState(now.getMonth())
  const [attendance, setAttendance] = useState<Attendance[]>([])
  const [yearRange, setYearRange] = useState<{ minYear: number; maxYear: number }>({ minYear: now.getFullYear(), maxYear: now.getFullYear() })

  useEffect(() => {
    window.api.system.getYearRange().then(setYearRange)
  }, [])

  const loadAttendance = useCallback(async () => {
    if (mode === 'year') {
      const all: Attendance[] = []
      for (let m = 0; m < 12; m++) {
        const att = await window.api.attendance.getByMonth(year, m)
        all.push(...att)
      }
      setAttendance(all)
    } else {
      const att = await window.api.attendance.getByMonth(year, month)
      setAttendance(att)
    }
  }, [year, month, mode])

  useEffect(() => {
    loadAttendance()
  }, [loadAttendance])

  const years: number[] = []
  for (let y = yearRange.minYear; y <= yearRange.maxYear; y++) {
    years.push(y)
  }

  // Build attendance map: childId -> dateStr -> Attendance
  const attMap = new Map<number, Map<string, Attendance>>()
  for (const a of attendance) {
    if (!attMap.has(a.child_id)) attMap.set(a.child_id, new Map())
    attMap.get(a.child_id)!.set(a.date, a)
  }

  function getMonthMinutes(childId: number, m: number): number {
    const childAtt = attMap.get(childId)
    if (!childAtt) return 0
    const daysInMonth = new Date(year, m + 1, 0).getDate()
    let total = 0
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${year}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
      const att = childAtt.get(dateStr)
      if (att && att.arrival_time !== 'absent') {
        total += timeToMinutes(att.departure_time) - timeToMinutes(att.arrival_time)
      }
    }
    return total
  }

  function getChildTotal(childId: number): number {
    if (mode === 'year') {
      let total = 0
      for (let m = 0; m < 12; m++) total += getMonthMinutes(childId, m)
      return total
    } else {
      return getMonthMinutes(childId, month)
    }
  }

  function getDaysPresent(childId: number): number {
    const childAtt = attMap.get(childId)
    if (!childAtt) return 0
    let count = 0
    for (const att of childAtt.values()) {
      if (att.arrival_time === 'absent') continue
      if (mode === 'year') {
        if (att.date.startsWith(String(year))) count++
      } else {
        const prefix = `${year}-${String(month + 1).padStart(2, '0')}`
        if (att.date.startsWith(prefix)) count++
      }
    }
    return count
  }

  function getAbsentDays(childId: number): number {
    const childAtt = attMap.get(childId)
    if (!childAtt) return 0
    let count = 0
    for (const att of childAtt.values()) {
      if (att.arrival_time !== 'absent') continue
      if (mode === 'year') {
        if (att.date.startsWith(String(year))) count++
      } else {
        const prefix = `${year}-${String(month + 1).padStart(2, '0')}`
        if (att.date.startsWith(prefix)) count++
      }
    }
    return count
  }

  const grandTotal = children.reduce((sum, c) => sum + getChildTotal(c.id), 0)
  const grandDays = children.reduce((sum, c) => sum + getDaysPresent(c.id), 0)
  const grandAbsent = children.reduce((sum, c) => sum + getAbsentDays(c.id), 0)

  return (
    <div className="flex flex-col h-full overflow-auto bg-card">
      <div className="px-6 py-4 border-b">
        <h2 className="text-lg font-semibold">Récapitulatif</h2>
      </div>

      <div className="p-6">
        {/* Controls */}
        <div className="flex items-center gap-4 mb-6 flex-wrap">
          <div className="flex gap-2">
            <button
              onClick={() => setMode('year')}
              className={`px-4 py-2 text-sm rounded-md font-medium transition-colors ${
                mode === 'year'
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-secondary hover:bg-secondary/80 text-foreground'
              }`}
            >
              Année complète
            </button>
            <button
              onClick={() => setMode('month')}
              className={`px-4 py-2 text-sm rounded-md font-medium transition-colors ${
                mode === 'month'
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-secondary hover:bg-secondary/80 text-foreground'
              }`}
            >
              Par mois
            </button>
          </div>

          {mode === 'month' && (
            <label className="block">
              <select
                value={month}
                onChange={(e) => setMonth(Number(e.target.value))}
                className="px-3 py-2 rounded-md border border-input bg-background text-foreground text-sm"
              >
                {MONTH_NAMES.map((name, i) => (
                  <option key={i} value={i}>{name}</option>
                ))}
              </select>
            </label>
          )}

          <label className="block">
            <select
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
              className="px-3 py-2 rounded-md border border-input bg-background text-foreground text-sm"
            >
              {years.map(y => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </label>
        </div>

        {/* Year recap table */}
        {mode === 'year' && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-secondary/50">
                  <th className="px-3 py-2 text-left border font-semibold">Nom</th>
                  <th className="px-3 py-2 text-left border font-semibold">Prénom</th>
                  {MONTH_NAMES.map((m, i) => (
                    <th key={i} className="px-2 py-2 text-center border font-semibold min-w-[60px]">{m.substring(0, 4)}</th>
                  ))}
                  <th className="px-3 py-2 text-center border font-semibold bg-secondary/70">Total</th>
                  <th className="px-3 py-2 text-center border font-semibold bg-secondary/70">Jours</th>
                  <th className="px-3 py-2 text-center border font-semibold bg-secondary/70">Absents</th>
                </tr>
              </thead>
              <tbody>
                {children.map(child => {
                  const total = getChildTotal(child.id)
                  const days = getDaysPresent(child.id)
                  const absent = getAbsentDays(child.id)
                  return (
                    <tr key={child.id} className="hover:bg-secondary/30">
                      <td className="px-3 py-2 border">{child.last_name}</td>
                      <td className="px-3 py-2 border">{child.first_name}</td>
                      {Array.from({ length: 12 }, (_, m) => {
                        const min = getMonthMinutes(child.id, m)
                        return (
                          <td key={m} className="px-2 py-2 text-center border text-muted-foreground">
                            {min > 0 ? formatDuration(min) : '—'}
                          </td>
                        )
                      })}
                      <td className="px-3 py-2 text-center border font-semibold bg-secondary/20">{formatDuration(total)}</td>
                      <td className="px-3 py-2 text-center border">{days}</td>
                      <td className="px-3 py-2 text-center border text-red-600">{absent > 0 ? absent : '—'}</td>
                    </tr>
                  )
                })}
              </tbody>
              <tfoot>
                <tr className="font-bold bg-secondary/50">
                  <td className="px-3 py-2 border" colSpan={2}>Total général</td>
                  {Array.from({ length: 12 }, (_, m) => {
                    const min = children.reduce((sum, c) => sum + getMonthMinutes(c.id, m), 0)
                    return (
                      <td key={m} className="px-2 py-2 text-center border">{min > 0 ? formatDuration(min) : '—'}</td>
                    )
                  })}
                  <td className="px-3 py-2 text-center border bg-secondary/70">{formatDuration(grandTotal)}</td>
                  <td className="px-3 py-2 text-center border bg-secondary/70">{grandDays}</td>
                  <td className="px-3 py-2 text-center border bg-secondary/70 text-red-600">{grandAbsent > 0 ? grandAbsent : '—'}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}

        {/* Month recap table */}
        {mode === 'month' && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-secondary/50">
                  <th className="px-3 py-2 text-left border font-semibold">Nom</th>
                  <th className="px-3 py-2 text-left border font-semibold">Prénom</th>
                  <th className="px-3 py-2 text-center border font-semibold">Total heures</th>
                  <th className="px-3 py-2 text-center border font-semibold">Jours présents</th>
                  <th className="px-3 py-2 text-center border font-semibold">Jours absents</th>
                </tr>
              </thead>
              <tbody>
                {children.map(child => {
                  const total = getChildTotal(child.id)
                  const days = getDaysPresent(child.id)
                  const absent = getAbsentDays(child.id)
                  return (
                    <tr key={child.id} className="hover:bg-secondary/30">
                      <td className="px-3 py-2 border">{child.last_name}</td>
                      <td className="px-3 py-2 border">{child.first_name}</td>
                      <td className="px-3 py-2 text-center border font-semibold bg-secondary/20">{formatDuration(total)}</td>
                      <td className="px-3 py-2 text-center border">{days}</td>
                      <td className="px-3 py-2 text-center border text-red-600">{absent > 0 ? absent : '—'}</td>
                    </tr>
                  )
                })}
              </tbody>
              <tfoot>
                <tr className="font-bold bg-secondary/50">
                  <td className="px-3 py-2 border" colSpan={2}>Total général</td>
                  <td className="px-3 py-2 text-center border bg-secondary/70">{formatDuration(grandTotal)}</td>
                  <td className="px-3 py-2 text-center border bg-secondary/70">{grandDays}</td>
                  <td className="px-3 py-2 text-center border bg-secondary/70 text-red-600">{grandAbsent > 0 ? grandAbsent : '—'}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
