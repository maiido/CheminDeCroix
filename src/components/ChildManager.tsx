import { useState } from 'react'
import { Child } from '../types'

interface ChildManagerProps {
  children: Child[]
  onChildCreated: () => void
  onChildUpdated: () => void
  onChildDeleted: () => void
}

interface FormData {
  first_name: string
  last_name: string
  start_date: string
  end_date: string
}

const EMPTY_FORM: FormData = {
  first_name: '',
  last_name: '',
  start_date: new Date().toISOString().split('T')[0],
  end_date: '',
}

export function ChildManager({ children, onChildCreated, onChildUpdated, onChildDeleted }: ChildManagerProps) {
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [form, setForm] = useState<FormData>(EMPTY_FORM)
  const [error, setError] = useState('')

  const handleAdd = () => {
    setForm(EMPTY_FORM)
    setEditingId(null)
    setShowForm(true)
    setError('')
  }

  const handleEdit = (child: Child) => {
    setForm({
      first_name: child.first_name,
      last_name: child.last_name,
      start_date: child.start_date,
      end_date: child.end_date || '',
    })
    setEditingId(child.id)
    setShowForm(true)
    setError('')
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.first_name.trim() || !form.last_name.trim()) {
      setError('Le prénom et le nom sont obligatoires')
      return
    }
    if (!form.start_date) {
      setError('La date d\'entrée est obligatoire')
      return
    }

    const data = {
      first_name: form.first_name.trim(),
      last_name: form.last_name.trim(),
      start_date: form.start_date,
      end_date: form.end_date || null,
    }

    if (editingId) {
      await window.api.children.update(editingId, data)
      onChildUpdated()
    } else {
      await window.api.children.create(data)
      onChildCreated()
    }
    setShowForm(false)
    setForm(EMPTY_FORM)
    setEditingId(null)
  }

  const handleDelete = async (child: Child) => {
    if (!confirm(`Supprimer ${child.first_name} ${child.last_name} ? Cette action supprimera aussi toutes ses présences.`)) return
    await window.api.children.delete(child.id)
    onChildDeleted()
  }

  const isActive = (child: Child): boolean => {
    const today = new Date().toISOString().split('T')[0]
    return child.start_date <= today && (!child.end_date || child.end_date >= today)
  }

  return (
    <div className="flex flex-col h-full overflow-auto bg-card">
      <div className="flex items-center justify-between px-6 py-4 border-b">
        <h2 className="text-lg font-semibold">Gestion des enfants</h2>
        <button
          onClick={handleAdd}
          className="px-4 py-2 text-sm rounded-md bg-primary text-primary-foreground hover:bg-primary/90 font-medium"
        >
          + Ajouter un enfant
        </button>
      </div>

      <div className="p-6">
        {children.length === 0 && !showForm && (
          <p className="text-muted-foreground text-center py-12">
            Aucun enfant enregistré. Cliquez sur « Ajouter un enfant » pour commencer.
          </p>
        )}

        <div className="grid gap-3">
          {children.map(child => (
            <div
              key={child.id}
              className="flex items-center justify-between p-4 rounded-lg border bg-card hover:shadow-sm transition-shadow"
            >
              <div className="flex items-center gap-3">
                <span
                  className="w-4 h-4 rounded-full flex-shrink-0"
                  style={{ backgroundColor: child.color }}
                />
                <div>
                  <div className="font-medium">
                    {child.first_name} {child.last_name}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Entrée : {new Date(child.start_date).toLocaleDateString('fr-FR')}
                    {child.end_date && ` · Sortie : ${new Date(child.end_date).toLocaleDateString('fr-FR')}`}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                  isActive(child)
                    ? 'bg-green-100 text-green-700'
                    : 'bg-gray-100 text-gray-500'
                }`}>
                  {isActive(child) ? 'Actif' : 'Inactif'}
                </span>
                <button
                  onClick={() => handleEdit(child)}
                  className="px-3 py-1.5 text-sm rounded-md bg-secondary text-secondary-foreground hover:bg-secondary/80 font-medium"
                >
                  Modifier
                </button>
                <button
                  onClick={() => handleDelete(child)}
                  className="px-3 py-1.5 text-sm rounded-md bg-destructive text-destructive-foreground hover:bg-destructive/90 font-medium"
                >
                  Supprimer
                </button>
              </div>
            </div>
          ))}
        </div>

        {showForm && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={() => setShowForm(false)}>
            <div className="bg-card rounded-lg shadow-xl p-6 w-96 space-y-4" onClick={(e) => e.stopPropagation()}>
              <h3 className="text-lg font-semibold">
                {editingId ? 'Modifier l\'enfant' : 'Ajouter un enfant'}
              </h3>
              <form onSubmit={handleSubmit} className="space-y-3">
                <label className="block">
                  <span className="text-sm text-muted-foreground">Prénom *</span>
                  <input
                    type="text"
                    value={form.first_name}
                    onChange={(e) => setForm({ ...form, first_name: e.target.value })}
                    autoFocus
                    className="w-full mt-1 px-3 py-2 rounded-md border border-input bg-background text-foreground"
                  />
                </label>
                <label className="block">
                  <span className="text-sm text-muted-foreground">Nom *</span>
                  <input
                    type="text"
                    value={form.last_name}
                    onChange={(e) => setForm({ ...form, last_name: e.target.value })}
                    className="w-full mt-1 px-3 py-2 rounded-md border border-input bg-background text-foreground"
                  />
                </label>
                <label className="block">
                  <span className="text-sm text-muted-foreground">Date d'entrée *</span>
                  <input
                    type="date"
                    value={form.start_date}
                    onChange={(e) => setForm({ ...form, start_date: e.target.value })}
                    className="w-full mt-1 px-3 py-2 rounded-md border border-input bg-background text-foreground"
                  />
                </label>
                <label className="block">
                  <span className="text-sm text-muted-foreground">Date de sortie (laisser vide si toujours présent)</span>
                  <input
                    type="date"
                    value={form.end_date}
                    onChange={(e) => setForm({ ...form, end_date: e.target.value })}
                    className="w-full mt-1 px-3 py-2 rounded-md border border-input bg-background text-foreground"
                  />
                </label>
                {error && <p className="text-sm text-destructive">{error}</p>}
                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowForm(false)}
                    className="px-3 py-2 text-sm rounded-md bg-secondary text-secondary-foreground hover:bg-secondary/80 font-medium"
                  >
                    Annuler
                  </button>
                  <button
                    type="submit"
                    className="px-3 py-2 text-sm rounded-md bg-primary text-primary-foreground hover:bg-primary/90 font-medium"
                  >
                    {editingId ? 'Enregistrer' : 'Ajouter'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
