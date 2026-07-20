import { useState, useEffect } from 'react'

export function Documentation() {
  const [dbPath, setDbPath] = useState('')
  const [stats, setStats] = useState<{ childrenCount: number; attendanceCount: number } | null>(null)
  const [showResetConfirm, setShowResetConfirm] = useState(false)
  const [resetDone, setResetDone] = useState(false)
  const [apiKey, setApiKey] = useState('')
  const [baseUrl, setBaseUrl] = useState('')
  const [model, setModel] = useState('')
  const [reasoning, setReasoning] = useState('none')
  const [apiKeySaved, setApiKeySaved] = useState(false)

  useEffect(() => {
    window.api.system.getDbPath().then(setDbPath)
    window.api.system.getStats().then(setStats)
    window.api.system.getSetting('openai_api_key').then(key => setApiKey(key || ''))
    window.api.system.getSetting('openai_base_url').then(url => setBaseUrl(url || 'https://api.openai.com/v1'))
    window.api.system.getSetting('openai_model').then(m => setModel(m || 'gpt-4o'))
    window.api.system.getSetting('openai_reasoning').then(r => setReasoning(r || 'none'))
  }, [])

  const handleSaveApiKey = async () => {
    await window.api.system.setSetting('openai_api_key', apiKey)
    await window.api.system.setSetting('openai_base_url', baseUrl)
    await window.api.system.setSetting('openai_model', model)
    await window.api.system.setSetting('openai_reasoning', reasoning)
    setApiKeySaved(true)
    setTimeout(() => setApiKeySaved(false), 2000)
  }

  const handleReset = async () => {
    await window.api.system.resetAll()
    setResetDone(true)
    setShowResetConfirm(false)
    const s = await window.api.system.getStats()
    setStats(s)
  }

  const handleOpenFolder = () => {
    window.api.system.openDbFolder()
  }

  return (
    <div className="flex-1 overflow-y-auto bg-card">
      <div className="max-w-3xl mx-auto px-8 py-8 space-y-8">
        <div>
          <h1 className="text-2xl font-bold mb-2">Documentation</h1>
          <p className="text-muted-foreground">Guide d'utilisation et informations techniques de CheminDeCroix</p>
        </div>

        {/* Utilisation */}
        <section className="space-y-3">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <span>📖</span> Utilisation
          </h2>
          <div className="space-y-2 text-sm text-muted-foreground pl-6">
            <p><strong className="text-foreground">Calendrier hebdomadaire</strong> : sélectionnez un enfant dans la sidebar, puis glissez sur la grille pour créer une plage horaire (arrivée → départ). Cliquez sur un bloc existant pour le modifier ou le supprimer.</p>
            <p><strong className="text-foreground">Vue tableau</strong> : basculez en vue tableau via le bouton dans la sidebar. Toutes les présences de la semaine sont éditables inline pour tous les enfants.</p>
            <p><strong className="text-foreground">Copier semaine précédente</strong> : bouton dans la toolbar du calendrier pour dupliquer les horaires de la semaine précédente vers la semaine courante.</p>
            <p><strong className="text-foreground">Enfant suivant</strong> : passe automatiquement à l'enfant suivant quand la semaine est complète. Bouton manuel disponible dans la toolbar.</p>
            <p><strong className="text-foreground">Réordonner les enfants</strong> : utilisez les flèches ▲▼ dans la sidebar pour changer l'ordre de sélection.</p>
            <p><strong className="text-foreground">Export Excel</strong> : onglet Export → choisissez le mois → génère un fichier avec un onglet récap (total par enfant) + un onglet détaillé par enfant.</p>
          </div>
        </section>

        {/* Base de données */}
        <section className="space-y-3">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <span>💾</span> Base de données
          </h2>
          <div className="bg-secondary/50 rounded-lg p-4 space-y-3">
            <div>
              <p className="text-sm font-medium text-foreground mb-1">Emplacement du fichier</p>
              <code className="block text-xs bg-background border rounded px-3 py-2 font-mono break-all">
                {dbPath || 'Chargement...'}
              </code>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={handleOpenFolder}
                className="px-4 py-2 text-sm rounded-md bg-secondary hover:bg-secondary/80 text-foreground font-medium"
              >
                Ouvrir le dossier
              </button>
              <p className="text-xs text-muted-foreground">
                Le fichier <code className="font-mono">chemindecroix.db</code> contient toutes les données (enfants + présences).
              </p>
            </div>
          </div>
          <div className="text-sm text-muted-foreground pl-6 space-y-1">
            <p><strong className="text-foreground">Sauvegarde</strong> : copiez le fichier <code className="font-mono">chemindecroix.db</code> pour sauvegarder vos données. Pour restaurer, remplacez le fichier par votre sauvegarde (application fermée).</p>
            <p><strong className="text-foreground">En cas de souci</strong> : vous pouvez ouvrir le dossier ci-dessus et faire une copie du fichier .db avant toute manipulation.</p>
          </div>
        </section>

        {/* Statistiques */}
        {stats && (
          <section className="space-y-3">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <span>📊</span> Statistiques
            </h2>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-secondary/50 rounded-lg p-4 text-center">
                <p className="text-3xl font-bold text-foreground">{stats.childrenCount}</p>
                <p className="text-sm text-muted-foreground mt-1">Enfants enregistrés</p>
              </div>
              <div className="bg-secondary/50 rounded-lg p-4 text-center">
                <p className="text-3xl font-bold text-foreground">{stats.attendanceCount}</p>
                <p className="text-sm text-muted-foreground mt-1">Présences enregistrées</p>
              </div>
            </div>
          </section>
        )}

        {/* Paramètres IA */}
        <section className="space-y-3">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <span>🤖</span> Paramètres IA
          </h2>
          <div className="bg-secondary/50 rounded-lg p-4 space-y-4">
            <div>
              <p className="text-sm font-medium text-foreground mb-1">Clé API</p>
              <p className="text-xs text-muted-foreground mb-2">
                Compatible OpenAI et OpenRouter. Stockée localement dans la base de données.
              </p>
              <input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="sk-... / sk-or-..."
                className="w-full px-3 py-2 rounded-md border border-input bg-background text-foreground text-sm font-mono"
              />
            </div>
            <div>
              <p className="text-sm font-medium text-foreground mb-1">Endpoint API</p>
              <p className="text-xs text-muted-foreground mb-2">
                URL de base de l'API (sans <code>/chat/completions</code>).
              </p>
              <input
                type="text"
                value={baseUrl}
                onChange={(e) => setBaseUrl(e.target.value)}
                placeholder="https://api.openai.com/v1"
                className="w-full px-3 py-2 rounded-md border border-input bg-background text-foreground text-sm font-mono"
              />
            </div>
            <div>
              <p className="text-sm font-medium text-foreground mb-1">Modèle</p>
              <p className="text-xs text-muted-foreground mb-2">
                Modèle avec support vision (ex: <code>gpt-4o</code>, <code>anthropic/claude-3.5-sonnet</code>).
              </p>
              <input
                type="text"
                value={model}
                onChange={(e) => setModel(e.target.value)}
                placeholder="gpt-4o"
                className="w-full px-3 py-2 rounded-md border border-input bg-background text-foreground text-sm font-mono"
              />
            </div>
            <div>
              <p className="text-sm font-medium text-foreground mb-1">Niveau de raisonnement</p>
              <p className="text-xs text-muted-foreground mb-2">
                Active le raisonnement étendu pour les modèles qui le supportent (ex: <code>low</code>, <code>medium</code>, <code>high</code>). Mettre <code>none</code> pour désactiver.
              </p>
              <select
                value={reasoning}
                onChange={(e) => setReasoning(e.target.value)}
                className="w-full px-3 py-2 rounded-md border border-input bg-background text-foreground text-sm"
              >
                <option value="none">Aucun (none)</option>
                <option value="low">Faible (low)</option>
                <option value="medium">Moyen (medium)</option>
                <option value="high">Élevé (high)</option>
              </select>
            </div>
            <button
              onClick={handleSaveApiKey}
              disabled={!apiKey}
              className="px-4 py-2 text-sm rounded-md bg-primary text-primary-foreground hover:bg-primary/90 font-medium disabled:opacity-50"
            >
              {apiKeySaved ? '✓ Enregistré' : 'Enregistrer'}
            </button>
          </div>
        </section>

        {/* RAZ */}
        <section className="space-y-3">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <span>⚠️</span> Remise à zéro
          </h2>
          <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-4 space-y-3">
            <p className="text-sm text-foreground">
              La remise à zéro supprime <strong>tous les enfants</strong> et <strong>toutes les présences</strong>. Cette action est irréversible.
            </p>
            <p className="text-xs text-muted-foreground">
              Pensez à faire une sauvegarde du fichier de base de données avant de continuer.
            </p>
            {!showResetConfirm && !resetDone && (
              <button
                onClick={() => setShowResetConfirm(true)}
                className="px-4 py-2 text-sm rounded-md bg-destructive text-destructive-foreground hover:bg-destructive/90 font-medium"
              >
                Remise à zéro
              </button>
            )}
            {showResetConfirm && (
              <div className="flex items-center gap-3">
                <span className="text-sm font-medium text-foreground">Êtes-vous sûr ?</span>
                <button
                  onClick={handleReset}
                  className="px-4 py-2 text-sm rounded-md bg-destructive text-destructive-foreground hover:bg-destructive/90 font-medium"
                >
                  Oui, tout supprimer
                </button>
                <button
                  onClick={() => setShowResetConfirm(false)}
                  className="px-4 py-2 text-sm rounded-md bg-secondary hover:bg-secondary/80 text-foreground font-medium"
                >
                  Annuler
                </button>
              </div>
            )}
            {resetDone && (
              <p className="text-sm text-green-600 font-medium">
                ✓ Remise à zéro effectuée. Toutes les données ont été supprimées.
              </p>
            )}
          </div>
        </section>

        {/* Raccourcis */}
        <section className="space-y-3">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <span>⌨️</span> Raccourcis & astuces
          </h2>
          <div className="space-y-2 text-sm text-muted-foreground pl-6">
            <p><strong className="text-foreground">Glisser-déposer</strong> sur le calendrier pour créer une présence rapidement.</p>
            <p><strong className="text-foreground">Clic sur un bloc</strong> de présence pour éditer les heures ou supprimer.</p>
            <p><strong className="text-foreground">Vue tableau</strong> : cliquez sur une heure pour l'éditer, ou sur "+" pour ajouter une présence.</p>
            <p><strong className="text-foreground">Flèches ▲▼</strong> dans la sidebar pour réordonner les enfants.</p>
            <p><strong className="text-foreground">Copier semaine précédente</strong> : gain de temps quand les horaires sont réguliers.</p>
          </div>
        </section>

        {/* À propos */}
        <section className="space-y-3">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <span>ℹ️</span> À propos
          </h2>
          <div className="text-sm text-muted-foreground pl-6 space-y-1">
            <p><strong className="text-foreground">CheminDeCroix</strong> v1.0.0 — Application de suivi des présences pour crèche parentale.</p>
            <p>Réalisé pour la crèche parentale Les Pitchouns à Strasbourg en 2026.</p>
            <p>Technologies : Electron, React, TypeScript, SQLite, TailwindCSS.</p>
            <p>Jours d'ouverture : lundi au vendredi, 7h30 — 18h45.</p>
            <p><a href="https://github.com/maiido" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">https://github.com/maiido</a></p>
          </div>
        </section>
      </div>
    </div>
  )
}
