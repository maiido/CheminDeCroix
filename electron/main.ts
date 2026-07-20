import { app, BrowserWindow, ipcMain, dialog, shell } from 'electron'
import path from 'path'
import fs from 'fs'
import { Database } from './database'

let mainWindow: BrowserWindow | null = null
let db: Database | null = null

interface ImportDay {
  date: string
  arrival: string
  departure: string
}

interface ImportChild {
  first_name: string
  last_name: string
  days: ImportDay[]
}

interface ImportResult {
  children: ImportChild[]
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    title: 'CheminDeCroix',
    frame: false,
    titleBarStyle: 'hidden',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  const isDev = !app.isPackaged
  if (isDev) {
    mainWindow.loadURL('http://localhost:5173')
    mainWindow.webContents.openDevTools({ mode: 'detach' })
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'))
  }

  // Log renderer console errors to main process stdout
  mainWindow.webContents.on('console-message', (_e, level, message, line, sourceId) => {
    const prefix = ['LOG', 'WARN', 'ERROR'][level] || 'LOG'
    console.log(`[Renderer ${prefix}] ${message} (${sourceId}:${line})`)
  })
  mainWindow.webContents.on('render-process-gone', (_e, details) => {
    console.error('[Main] Renderer process gone:', details)
  })
  mainWindow.webContents.on('unresponsive', () => {
    console.error('[Main] Renderer process unresponsive!')
  })
  mainWindow.on('unresponsive', () => {
    console.error('[Main] Window unresponsive!')
  })
}

function setupDatabase() {
  const userDataPath = app.getPath('userData')
  const dbPath = path.join(userDataPath, 'chemindecroix.db')
  db = new Database(dbPath)
}

function setupIpc() {
  if (!db) return

  // Children CRUD
  ipcMain.handle('children:getAll', () => db!.getAllChildren())
  ipcMain.handle('children:getActive', (_e, date: string) => db!.getActiveChildren(date))
  ipcMain.handle('children:create', (_e, data) => db!.createChild(data))
  ipcMain.handle('children:update', (_e, id: number, data) => db!.updateChild(id, data))
  ipcMain.handle('children:delete', (_e, id: number) => db!.deleteChild(id))
  ipcMain.handle('children:reorder', (_e, orderedIds: number[]) => db!.reorderChildren(orderedIds))

  // Attendance CRUD
  ipcMain.handle('attendance:getByWeek', (_e, startDate: string, endDate: string) =>
    db!.getAttendanceByDateRange(startDate, endDate)
  )
  ipcMain.handle('attendance:getByMonth', (_e, year: number, month: number) =>
    db!.getAttendanceByMonth(year, month)
  )
  ipcMain.handle('attendance:upsert', (_e, data) => db!.upsertAttendance(data))
  ipcMain.handle('attendance:delete', (_e, id: number) => db!.deleteAttendance(id))
  ipcMain.handle('attendance:deleteByChildDate', (_e, childId: number, date: string) =>
    db!.deleteAttendanceByChildDate(childId, date)
  )
  ipcMain.handle('attendance:copyWeek', async (_e, childId: number, weekStartDates: string[]) => {
    try {
      db!.copyWeekFromPrevious(childId, weekStartDates)
    } catch (err) {
      console.error('[IPC] attendance:copyWeek error:', err)
      throw err
    }
  })

  // Export
  ipcMain.handle('export:excel', async (_e, year: number, month: number) => {
    const { exportToExcel } = await import('./excelExport')
    const children = db!.getActiveChildrenForMonth(year, month)
    const attendance = db!.getAttendanceByMonth(year, month)
    const result = await dialog.showSaveDialog(mainWindow!, {
      defaultPath: `CheminDeCroix_${year}_${String(month + 1).padStart(2, '0')}.xlsx`,
      filters: [{ name: 'Excel', extensions: ['xlsx'] }],
    })
    if (result.canceled || !result.filePath) return { success: false }
    await exportToExcel(result.filePath, children, attendance, year, month)
    return { success: true, path: result.filePath }
  })

  ipcMain.handle('export:excelYear', async (_e, year: number) => {
    const { exportYearToExcel } = await import('./excelExport')
    const children = db!.getActiveChildrenForYear(year)
    const attendance = db!.getAttendanceByYear(year)
    const result = await dialog.showSaveDialog(mainWindow!, {
      defaultPath: `CheminDeCroix_${year}_annuel.xlsx`,
      filters: [{ name: 'Excel', extensions: ['xlsx'] }],
    })
    if (result.canceled || !result.filePath) return { success: false }
    await exportYearToExcel(result.filePath, children, attendance, year)
    return { success: true, path: result.filePath }
  })

  // Import image via OpenAI Vision
  ipcMain.handle('import:attendanceImage', async (_e, imagePath: string, children: { first_name: string; last_name: string }[], weekDates: string[]) => {
    const apiKey = db!.getSetting('openai_api_key')
    if (!apiKey) {
      return { success: false, error: 'Aucune clé API configurée. Allez dans Documentation > Paramètres IA.' }
    }
    let baseUrl = (db!.getSetting('openai_base_url') || 'https://api.openai.com/v1').replace(/\/$/, '')
    const model = db!.getSetting('openai_model') || 'gpt-4o'
    const reasoning = db!.getSetting('openai_reasoning') || 'none'

    // Auto-detect OpenRouter keys if still on default OpenAI endpoint
    if (apiKey.startsWith('sk-or-') && baseUrl === 'https://api.openai.com/v1') {
      baseUrl = 'https://openrouter.ai/api/v1'
    }

    console.log('[ImportImage] Using endpoint:', baseUrl, 'model:', model)

    try {
      const imageBuffer = fs.readFileSync(imagePath)
      const base64Image = imageBuffer.toString('base64')
      const ext = path.extname(imagePath).slice(1).toLowerCase()
      const mimeType = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg'

      const childrenList = children.map(c => `${c.first_name} ${c.last_name}`).join(', ')
      const daysList = weekDates.map((d, i) => {
        const date = new Date(d)
        const dayNames = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi']
        return `${dayNames[i]} ${d} (${date.getDate()}/${date.getMonth() + 1})`
      }).join(', ')

      const prompt = `Tu extrais des présences depuis une feuille papier de crèche.

Ta réponse doit être UNIQUEMENT un JSON valide. Ne donne aucune explication, aucun commentaire, aucun markdown.

## Structure du document

Chaque enfant possède une grille :
- 5 colonnes de jours, toujours dans cet ordre strict :
  1. lundi
  2. mardi
  3. mercredi
  4. jeudi
  5. vendredi
- Des lignes horaires correspondant à des créneaux de 30 minutes.
- Chaque ligne indique un intervalle, par exemple :
  - 07h30-08h00
  - 08h00-08h30
  - 13h30-14h00
  - 18h00-18h30

IMPORTANT :
- Ignore totalement les dates, numéros de semaine ou mois visibles sur le papier.
- Utilise EXCLUSIVEMENT les dates fournies dans ${daysList}.
- Associe toujours les colonnes lundi-vendredi aux dates de ${daysList}, dans cet ordre.
- Analyse uniquement les enfants présents dans ${childrenList}.
- Ne crée jamais d'enfant qui n'est pas clairement identifié sur le document.

## Signification des marquages

Les parents peuvent signaler une présence par :
- Une ou plusieurs croix X dans les créneaux.
- Un trait horizontal indiquant une présence continue entre les horaires concernés.
- Un trait vertical pouvant indiquer les mêmes horaires sur plusieurs jours.
- Une grande croix diagonale couvrant nettement une grande partie ou toute la colonne d'un jour : cela signifie ABSENT.

Les écritures manuscrites peuvent être pâles, colorées, partielles ou irrégulières.

## Règle absolue : ne jamais deviner

Ne complète JAMAIS une information manquante :
- Ne déduis jamais un horaire à partir d'un autre jour.
- Ne déduis jamais un départ habituel, notamment 18:30.
- Ne prolonge jamais une présence jusqu'à la fermeture.
- Ne transforme jamais une absence de croix en absence.
- Ne suppose jamais qu'une croix manquante est présente.
- En cas de doute, omets le jour concerné.

## Détection d'une absence

Retourne :
{ "arrival": "absent", "departure": "absent" }

UNIQUEMENT si une grande croix manuscrite explicite couvre clairement tout ou une très grande partie de la colonne du jour et signale visiblement une absence.

NE retourne PAS "absent" dans les cas suivants :
- Aucune croix visible.
- Une seule croix visible.
- Une croix du matin sans croix ou indication de fin.
- Une croix de fin sans indication de début.
- Un tracé ambigu, incomplet, pâle ou illisible.
- Des croix manquantes.

Dans tous ces cas, omets simplement ce jour du JSON.

## Détection d'une présence

Pour retourner un jour de présence, tu dois pouvoir déterminer de manière fiable :
1. l'heure d'arrivée ;
2. l'heure de départ.

Si le début OU la fin est absent, incomplet, ambigu ou illisible, n'inclus pas ce jour.

Une présence doit reposer sur un marquage suffisamment clair :
- plusieurs croix permettant d'identifier le premier et le dernier créneau ;
- ou un trait horizontal clair couvrant une période continue ;
- ou un marquage vertical clair, uniquement si ses limites horaires sont lisibles et non ambiguës.

Une seule croix isolée dans une journée ne suffit jamais : omets le jour.

Si les croix du soir manquent, même si les autres jours indiquent souvent un départ à 18:30, omets le jour.
Exemple : une croix le matin mais aucune croix de fin clairement lisible => ne retourne pas ce jour.

## Calcul obligatoire des heures

Chaque croix représente le créneau de 30 minutes de sa ligne.

- L'arrivée est le DÉBUT du premier créneau marqué.
- Le départ est la FIN du dernier créneau marqué.
- Le départ ne doit JAMAIS être le début du dernier créneau.

Exemples obligatoires :
- Dernier créneau marqué : 13h30-14h00 => departure: "14:00"
- Dernier créneau marqué : 17h30-18h00 => departure: "18:00"
- Dernier créneau marqué : 18h00-18h30 => departure: "18:30"
- Premier créneau marqué : 08h00-08h30 => arrival: "08:00"

Ne retourne jamais "13:30" comme départ si le dernier créneau est 13h30-14h00.
Ne retourne jamais "18:00" comme départ si le dernier créneau est 18h00-18h30.

## Contrôle final obligatoire avant réponse

Pour chaque jour inclus :
- Vérifie que le prénom correspond bien à un enfant de ${childrenList}.
- Vérifie que la date correspond à la bonne colonne dans ${daysList}.
- Vérifie que l'arrivée est le début du premier créneau.
- Vérifie que le départ est la fin du dernier créneau.
- Vérifie qu'il existe une information suffisamment claire sur le début ET la fin.
- Si l'une de ces vérifications échoue, omets le jour.

## Format JSON obligatoire

{
  "children": [
    {
      "first_name": "Prénom",
      "last_name": "Nom",
      "days": [
        {
          "date": "YYYY-MM-DD",
          "arrival": "HH:MM",
          "departure": "HH:MM"
        },
        {
          "date": "YYYY-MM-DD",
          "arrival": "absent",
          "departure": "absent"
        }
      ]
    }
  ]
}

Règles JSON :
- JSON strictement valide.
- Aucun texte avant ou après le JSON.
- N'inclus pas un enfant non trouvé.
- N'inclus pas un jour si les horaires ne sont pas déterminables avec certitude.
- Un enfant peut avoir une liste "days" vide seulement si son nom est clairement présent mais qu'aucun jour fiable ne peut être extrait.
`;
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      }
      if (baseUrl === 'https://openrouter.ai/api/v1') {
        headers['HTTP-Referer'] = 'https://github.com/maiido'
        headers['X-Title'] = 'CheminDeCroix'
      }

      const requestBody: Record<string, unknown> = {
          model: model,
          messages: [
            {
              role: 'user',
              content: [
                { type: 'text', text: prompt },
                {
                  type: 'image_url',
                  image_url: {
                    url: `data:${mimeType};base64,${base64Image}`,
                    detail: 'high',
                  },
                },
              ],
            },
          ],
          max_tokens: 64000,
          temperature: 0,
          response_format: {
            type: 'json_schema',
            json_schema: {
              name: 'attendance_import',
              strict: true,
              schema: {
                type: 'object',
                additionalProperties: false,
                properties: {
                  children: {
                    type: 'array',
                    items: {
                      type: 'object',
                      additionalProperties: false,
                      properties: {
                        first_name: { type: 'string' },
                        last_name: { type: 'string' },
                        days: {
                          type: 'array',
                          items: {
                            type: 'object',
                            additionalProperties: false,
                            properties: {
                              date: { type: 'string' },
                              arrival: { type: 'string' },
                              departure: { type: 'string' },
                            },
                            required: ['date', 'arrival', 'departure'],
                          },
                        },
                      },
                      required: ['first_name', 'last_name', 'days'],
                    },
                  },
                },
                required: ['children'],
              },
            },
          },
      }

      if (reasoning !== 'none') {
        requestBody.reasoning = { effort: reasoning }
      }

      const response = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers,
        body: JSON.stringify(requestBody),
      })

      if (!response.ok) {
        const errText = await response.text()
        return { success: false, error: `Erreur API (${response.status}) sur ${baseUrl}: ${errText}` }
      }

      const data = await response.json()
      const content = data.choices?.[0]?.message?.content
      const finishReason = data.choices?.[0]?.finish_reason

      console.log('[ImportImage] finish_reason:', finishReason)
      console.log('[ImportImage] content length:', content?.length)
      console.log('[ImportImage] content (first 500 chars):', content?.substring(0, 500))
      console.log('[ImportImage] content (last 500 chars):', content?.substring(content.length - 500))

      if (!content) {
        return { success: false, error: 'Réponse vide de l\'IA' }
      }

      if (finishReason === 'length') {
        return { success: false, error: 'La réponse de l\'IA a été tronquée (limite de tokens atteinte). Essayez un modèle avec plus de tokens de sortie ou moins d\'enfants.', raw: content }
      }

      // Extract JSON from response (handle markdown code blocks and surrounding text)
      let jsonStr = content.trim()
      if (jsonStr.startsWith('```')) {
        jsonStr = jsonStr.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '')
      }
      // Try to extract JSON object if there's text around it
      const jsonMatch = jsonStr.match(/\{[\s\S]*\}/)
      if (jsonMatch && !jsonStr.startsWith('{')) {
        jsonStr = jsonMatch[0]
      }

      let parsed: ImportResult
      try {
        parsed = JSON.parse(jsonStr)
      } catch (parseErr) {
        return { success: false, error: `Impossible de parser le JSON retourné par l'IA. Erreur: ${String(parseErr)}`, raw: content }
      }

      // Force dates to match the selected week in the app, ignoring any dates the AI may have hallucinated
      for (const child of parsed.children) {
        child.days = child.days.slice(0, 5).map((day, i) => ({
          ...day,
          date: weekDates[i] ?? day.date,
        }))
      }

      return { success: true, data: parsed }
    } catch (err) {
      return { success: false, error: String(err) }
    }
  })

  // System
  ipcMain.handle('system:getDbPath', () => {
    return path.join(app.getPath('userData'), 'chemindecroix.db')
  })
  ipcMain.handle('system:getStats', () => db!.getStats())
  ipcMain.handle('system:getYearRange', () => db!.getYearRange())
  ipcMain.handle('system:getSetting', (_e, key: string) => db!.getSetting(key))
  ipcMain.handle('system:setSetting', (_e, key: string, value: string) => db!.setSetting(key, value))
  ipcMain.handle('system:resetAll', () => {
    db!.resetAll()
    return true
  })
  ipcMain.handle('system:openDbFolder', () => {
    shell.openPath(app.getPath('userData'))
  })
  ipcMain.handle('system:closeApp', () => {
    mainWindow?.close()
  })
  ipcMain.handle('system:minimizeApp', () => {
    mainWindow?.minimize()
  })
  ipcMain.handle('system:maximizeApp', () => {
    if (mainWindow?.isMaximized()) mainWindow.unmaximize()
    else mainWindow?.maximize()
  })
}

app.whenReady().then(() => {
  setupDatabase()
  setupIpc()
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('before-quit', () => {
  db?.close()
})
