import { Child } from '../types'

interface SidebarProps {
  view: 'calendar' | 'children' | 'recap' | 'export' | 'docs'
  onViewChange: (view: 'calendar' | 'children' | 'recap' | 'export' | 'docs') => void
  childrenList: Child[]
  selectedChildId: number | null
  onSelectChild: (id: number) => void
  onReorder: (orderedIds: number[]) => void
  autoNextChild: boolean
  onToggleAutoNextChild: () => void
}

const NAV_ITEMS = [
  { id: 'calendar' as const, label: 'Calendrier', icon: '📅' },
  { id: 'children' as const, label: 'Enfants', icon: '👶' },
  { id: 'recap' as const, label: 'Récapitulatif', icon: '📋' },
  { id: 'export' as const, label: 'Export', icon: '📊' },
  { id: 'docs' as const, label: 'Documentation', icon: '📖' },
]

export function Sidebar({ view, onViewChange, childrenList, selectedChildId, onSelectChild, onReorder, autoNextChild, onToggleAutoNextChild }: SidebarProps) {
  return (
    <div className="w-64 bg-primary text-primary-foreground flex flex-col h-full">
      <div className="px-4 py-5 border-b border-primary-foreground/10">
        <h1 className="text-xl font-bold tracking-tight">CheminDeCroix</h1>
        <p className="text-xs text-primary-foreground/60 mt-1">Crèche parentale</p>
      </div>

      <nav className="px-2 py-3 space-y-1">
        {NAV_ITEMS.map(item => (
          <button
            key={item.id}
            onClick={() => onViewChange(item.id)}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
              view === item.id
                ? 'bg-primary-foreground/15 text-primary-foreground'
                : 'text-primary-foreground/60 hover:bg-primary-foreground/10 hover:text-primary-foreground'
            }`}
          >
            <span className="text-base">{item.icon}</span>
            {item.label}
          </button>
        ))}
      </nav>

      {view === 'calendar' && (
        <div className="flex-1 overflow-y-auto px-2 py-3 border-t border-primary-foreground/10">
          <p className="text-xs font-semibold text-primary-foreground/40 uppercase tracking-wider px-3 mb-2">
            Enfants actifs
          </p>
          <div className="space-y-1">
            {childrenList.length === 0 && (
              <p className="text-xs text-primary-foreground/40 px-3 py-2">
                Aucun enfant actif. Ajoutez-en dans l'onglet Enfants.
              </p>
            )}
            {childrenList.map((child, idx) => (
              <div
                key={child.id}
                className={`flex items-center gap-1 rounded-md transition-colors ${
                  selectedChildId === child.id
                    ? 'bg-primary-foreground/20 text-primary-foreground'
                    : 'text-primary-foreground/70 hover:bg-primary-foreground/10'
                }`}
              >
                <button
                  onClick={() => onSelectChild(child.id)}
                  className="flex-1 flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors"
                >
                  <span
                    className="w-3 h-3 rounded-full flex-shrink-0"
                    style={{ backgroundColor: child.color }}
                  />
                  <span className="truncate text-left">
                    {child.first_name} {child.last_name}
                  </span>
                </button>
                <div className="flex flex-col pr-1">
                  <button
                    onClick={() => {
                      if (idx > 0) {
                        const ids = childrenList.map(c => c.id)
                        ;[ids[idx - 1], ids[idx]] = [ids[idx], ids[idx - 1]]
                        onReorder(ids)
                      }
                    }}
                    disabled={idx === 0}
                    className="text-xs text-primary-foreground/50 hover:text-primary-foreground disabled:opacity-20 leading-none"
                    title="Monter"
                  >
                    ▲
                  </button>
                  <button
                    onClick={() => {
                      if (idx < childrenList.length - 1) {
                        const ids = childrenList.map(c => c.id)
                        ;[ids[idx + 1], ids[idx]] = [ids[idx], ids[idx + 1]]
                        onReorder(ids)
                      }
                    }}
                    disabled={idx === childrenList.length - 1}
                    className="text-xs text-primary-foreground/50 hover:text-primary-foreground disabled:opacity-20 leading-none"
                    title="Descendre"
                  >
                    ▼
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="px-3 py-3 border-t border-primary-foreground/10 mt-auto">
        <label className="flex items-center gap-2 cursor-pointer text-sm text-primary-foreground/70 hover:text-primary-foreground">
          <input
            type="checkbox"
            checked={autoNextChild}
            onChange={onToggleAutoNextChild}
            className="w-4 h-4 rounded accent-primary-foreground"
          />
          <span>Passer à l'enfant suivant automatiquement</span>
        </label>
      </div>
    </div>
  )
}
