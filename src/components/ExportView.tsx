import { useState, useEffect } from 'react'
import { MONTH_NAMES } from '../lib/utils'

export function ExportView() {
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth())
  const [exportMode, setExportMode] = useState<'month' | 'year'>('year')
  const [exporting, setExporting] = useState(false)
  const [result, setResult] = useState<{ success: boolean; path?: string } | null>(null)
  const [yearRange, setYearRange] = useState<{ minYear: number; maxYear: number }>({ minYear: now.getFullYear(), maxYear: now.getFullYear() })

  useEffect(() => {
    window.api.system.getYearRange().then(setYearRange)
  }, [])

  const handleExport = async () => {
    setExporting(true)
    setResult(null)
    try {
      const res = exportMode === 'year'
        ? await window.api.export.excelYear(year)
        : await window.api.export.excel(year, month)
      setResult(res)
    } catch (err) {
      setResult({ success: false })
    }
    setExporting(false)
  }

  const years: number[] = []
  for (let y = yearRange.minYear; y <= yearRange.maxYear; y++) {
    years.push(y)
  }

  return (
    <div className="flex flex-col h-full overflow-auto bg-card">
      <div className="px-6 py-4 border-b">
        <h2 className="text-lg font-semibold">Export Excel</h2>
      </div>

      <div className="p-6 max-w-md">
        <p className="text-sm text-muted-foreground mb-6">
          Exportez les présences dans un fichier Excel. Choisissez un mois spécifique
          ou une année complète.
        </p>

        <div className="space-y-4">
          {/* Toggle Mois / Année */}
          <div className="flex gap-2">
            <button
              onClick={() => setExportMode('month')}
              className={`flex-1 px-4 py-2 text-sm rounded-md font-medium transition-colors ${
                exportMode === 'month'
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-secondary hover:bg-secondary/80 text-foreground'
              }`}
            >
              Par mois
            </button>
            <button
              onClick={() => setExportMode('year')}
              className={`flex-1 px-4 py-2 text-sm rounded-md font-medium transition-colors ${
                exportMode === 'year'
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-secondary hover:bg-secondary/80 text-foreground'
              }`}
            >
              Année complète
            </button>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {exportMode === 'month' && (
              <label className="block">
                <span className="text-sm text-muted-foreground">Mois</span>
                <select
                  value={month}
                  onChange={(e) => setMonth(Number(e.target.value))}
                  className="w-full mt-1 px-3 py-2 rounded-md border border-input bg-background text-foreground"
                >
                  {MONTH_NAMES.map((name, i) => (
                    <option key={i} value={i}>{name}</option>
                  ))}
                </select>
              </label>
            )}
            <label className={exportMode === 'year' ? 'block col-span-2' : 'block'}>
              <span className="text-sm text-muted-foreground">Année</span>
              <select
                value={year}
                onChange={(e) => setYear(Number(e.target.value))}
                className="w-full mt-1 px-3 py-2 rounded-md border border-input bg-background text-foreground"
              >
                {years.map(y => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </label>
          </div>

          <button
            onClick={handleExport}
            disabled={exporting}
            className="w-full px-4 py-3 text-sm rounded-md bg-primary text-primary-foreground hover:bg-primary/90 font-medium disabled:opacity-50"
          >
            {exporting
              ? 'Export en cours...'
              : exportMode === 'year'
                ? `Exporter l'année ${year}`
                : `Exporter ${MONTH_NAMES[month]} ${year}`
            }
          </button>

          {result && (
            <div className={`p-3 rounded-md text-sm ${result.success ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
              {result.success
                ? `Export réussi : ${result.path}`
                : 'Export annulé ou échoué.'}
            </div>
          )}
        </div>

        <div className="mt-8 p-4 rounded-md bg-secondary/50 text-sm text-muted-foreground space-y-2">
          <p className="font-medium text-foreground">Contenu du fichier Excel :</p>
          {exportMode === 'year' ? (
            <ul className="list-disc list-inside space-y-1">
              <li><strong>Onglet « Récap »</strong> : total d'heures par enfant pour chaque mois de l'année + total annuel</li>
              <li><strong>Onglet par enfant</strong> : une feuille par enfant avec toutes les présences de l'année (date, jour, arrivée, départ, durée, mois) et total annuel</li>
            </ul>
          ) : (
            <ul className="list-disc list-inside space-y-1">
              <li><strong>Onglet « Récap »</strong> : total d'heures et jours de présence par enfant pour le mois, avec total général</li>
              <li><strong>Onglet par enfant</strong> : une feuille par enfant avec détail jour par jour (date, jour, arrivée, départ, durée) et total mensuel</li>
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}
