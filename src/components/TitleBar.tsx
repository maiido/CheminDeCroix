interface TitleBarProps {
  onMinimize: () => void
  onMaximize: () => void
  onClose: () => void
}

export function TitleBar({ onMinimize, onMaximize, onClose }: TitleBarProps) {
  return (
    <div className="flex items-center justify-between h-9 bg-primary text-primary-foreground select-none" style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}>
      <div className="flex items-center gap-2 pl-4">
        <span className="text-sm font-bold tracking-tight">CheminDeCroix</span>
      </div>
      <div className="flex" style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
        <button
          onClick={onMinimize}
          className="w-12 h-9 flex items-center justify-center hover:bg-primary-foreground/15 transition-colors"
          title="Réduire"
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5">
            <line x1="2" y1="6" x2="10" y2="6" />
          </svg>
        </button>
        <button
          onClick={onMaximize}
          className="w-12 h-9 flex items-center justify-center hover:bg-primary-foreground/15 transition-colors"
          title="Agrandir"
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5">
            <rect x="2.5" y="2.5" width="7" height="7" />
          </svg>
        </button>
        <button
          onClick={onClose}
          className="w-12 h-9 flex items-center justify-center hover:bg-red-500 transition-colors"
          title="Fermer"
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5">
            <line x1="2" y1="2" x2="10" y2="10" />
            <line x1="10" y1="2" x2="2" y2="10" />
          </svg>
        </button>
      </div>
    </div>
  )
}
