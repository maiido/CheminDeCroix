# CheminDeCroix

Application Electron de suivi des présences pour crèche parentale.

## Prérequis

- **Node.js** >= 18
- **npm** >= 9
- **Python 3** (requis par `better-sqlite3` pour la compilation native)
- **make** / **g++** (build tools C++)

### Prérequis par OS

| OS | Prérequis supplémentaires |
|---|---|
| **Linux** | `build-essential`, `python3` |
| **Windows** | Visual Studio Build Tools (C++ workload) ou `npm install --global windows-build-tools` |
| **macOS** | Xcode Command Line Tools (`xcode-select --install`) |

## Installation

```bash
git clone <repo>
cd chemindecroix
npm install
```

Le hook `postinstall` recompile automatiquement `better-sqlite3` pour votre version d'Electron locale.

## Lancer en développement

```bash
npm run electron:dev
```

Démarre Vite (port 5173) + Electron en parallèle.

## Build par plateforme

### Linux (depuis Linux)

```bash
npm run build:linux
```

Output : `release/CheminDeCroix-1.0.0.AppImage`

### Windows (depuis Linux avec Wine)

```bash
npm run build:win
```

Output : `release/CheminDeCroix Setup 1.0.0.exe` (installateur NSIS)

### macOS (depuis Linux)

```bash
npm run build:mac
```

Output :
- `release/CheminDeCroix-1.0.0-mac.zip` (Intel x64)
- `release/CheminDeCroix-1.0.0-arm64-mac.zip` (Apple Silicon M1/M2/M3)

Chaque archive contient l'application `.app` et un fichier `Lisez-moi.txt` avec les instructions d'installation.

> **Note** : Le format DMG nécessite macOS pour la compilation. Le format ZIP est utilisé pour les builds cross-platform depuis Linux. Pour générer un DMG, lancez `npm run build:mac` depuis un Mac.

## ⚠️ macOS : "CheminDeCroix est endommagé"

macOS Gatekeeper bloque les applications non signées avec le message *"CheminDeCroix est endommagé, vous devriez placer cet élément dans la corbeille"*.

### Solution

Extraire le `.zip`, placer `CheminDeCroix.app` dans `/Applications`, puis lancer dans le Terminal :

```bash
xattr -cr /Applications/CheminDeCroix.app
```

L'application peut alors être ouverte normalement.

> **Note** : Le code signing nécessite macOS + un compte développeur Apple. Les builds cross-platform depuis Linux ne peuvent pas être signés.

## ⚠️ Problème connu : better-sqlite3 après un build cross-platform

Après un build pour une autre plateforme (ex: macOS depuis Linux), `better-sqlite3` est recompilé pour cette plateforme. Le dev local casse avec l'erreur :

```
Error: .../better_sqlite3.node: invalid ELF header
```

### Solution

Recompiler `better-sqlite3` pour votre plateforme locale :

```bash
npm run rebuild:native
```

Puis relancez `npm run electron:dev`.

### Explication

`electron-builder` recompile les dépendances natives pour la plateforme cible. Le hook `postinstall` et le script `rebuild:native` utilisent `@electron/rebuild` pour recompiler pour l'Electron local.

## Scripts disponibles

| Script | Description |
|---|---|
| `npm run electron:dev` | Lance Vite + Electron en dev |
| `npm run electron:build` | Compile TypeScript + build Vite (sans packaging) |
| `npm run build:win` | Build complet pour Windows (NSIS) |
| `npm run build:mac` | Build complet pour macOS (ZIP x64 + arm64) |
| `npm run build:linux` | Build complet pour Linux (AppImage) |
| `npm run rebuild:native` | Recompile better-sqlite3 pour l'OS local |
| `npm run dev` | Lance Vite seul (frontend sans Electron) |

## Fonctionnalités

- **Calendrier hebdomadaire** (lun-ven, 7h30-18h45, pas de 15 min) avec drag-to-create
- **Vue tableau éditable** : tous les enfants × jours, édition inline
- **Copier semaine précédente** pour un enfant
- **Enfant suivant** : passage auto quand la semaine est complète + bouton manuel
- **Réordonner les enfants** (flèches ▲▼ dans la sidebar)
- **Gestion des enfants** : CRUD complet, dates d'entrée/sortie, couleurs automatiques
- **Export Excel** : onglet récap mensuel (total par enfant) + onglet détaillé par enfant
- **Documentation intégrée** : chemin BDD, statistiques, remise à zéro
- **Import par image (IA)** : décode une feuille de présence photographiée via OpenAI / OpenRouter
- **Fenêtre frameless** avec barre de titre custom

## Import par image (IA)

L'application peut importer automatiquement les présences depuis une feuille papier scannée ou photographiée. Le fichier `modèle.jpg` à la racine du dépôt est un modèle que vous pouvez adapter et remplir à la main.

### Principe

1. Sélectionnez la semaine concernée dans le calendrier.
2. Cliquez sur **📷 Importer image** dans la vue tableau hebdomadaire.
3. Choisissez la photo ou le scan de la feuille.
4. L'application envoie l'image à un modèle de langage avec vision (OpenAI / OpenRouter), accompagnée de la liste des enfants et des 5 dates de la semaine.
5. L'IA extrait les marquages manuscrits (croix `X`, traits continus, etc.) et renvoie un JSON structuré avec, pour chaque enfant et chaque jour, les heures d'arrivée et de départ. Attention, elle peut alluciner.
6. Un aperçu des résultats s'affiche ; vous validez avant application.

### Format attendu de la feuille

- 5 colonnes, une par jour de la semaine (lundi, mardi, mercredi, jeudi, vendredi).
- Des lignes d'horaires découpées en créneaux (par défaut des demi-heures, ex. 07h30-08h00, 08h00-08h30, etc.).
- Une présence est indiquée par des croix `X`, un trait horizontal continu ou un trait vertical clair.
- Une absence doit être marquée par une grande croix diagonale couvrant toute la colonne du jour.
- Si un début ou une fin n'est pas clair, l'IA omettra le jour concerné plutôt que de deviner.

### Configuration IA

Rendez-vous dans l'onglet **Documentation > Paramètres IA** de l'application :

| Paramètre | Description | Valeur par défaut |
|---|---|---|
| **Clé API** | Clé OpenAI (`sk-...`) ou OpenRouter (`sk-or-...`). Stockée localement dans SQLite. | — |
| **Endpoint API** | URL de base de l'API, sans `/chat/completions`. | `https://api.openai.com/v1` |
| **Modèle** | Modèle compatible vision. | `gpt-4o` |
| **Niveau de raisonnement** | Raisonnement étendu (`low`, `medium`, `high`) si le modèle le supporte. | `none` |

- Si la clé commence par `sk-or-`, l'endpoint passe automatiquement sur `https://openrouter.ai/api/v1`.
- Les images sont envoyées au fournisseur d'IA choisi. Assurez-vous d'accepter les conditions de confidentialité correspondantes.

### Conseils et limites

- Formats supportés : **JPEG**, **PNG**, **WebP**.
- Prenez la photo dans une lumière suffisante, de face et sans reflet.
- L'IA ne complète jamais une information ambiguë : un jour manquant ou illisible sera ignoré. (ou pas)
- En cas de réponse tronquée (`finish_reason: length`), réduisez le nombre d'enfants sur la feuille ou utilisez un modèle avec une plus grande fenêtre de sortie.
- Si le JSON retourné est invalide, la réponse brute de l'IA est affichée pour faciliter le diagnostic.

## Base de données

Les données sont stockées dans SQLite à l'emplacement :
- **Linux** : `~/.config/chemindecroix/chemindecroix.db`
- **Windows** : `%APPDATA%/chemindecroix/chemindecroix.db`
- **macOS** : `~/Library/Application Support/chemindecroix/chemindecroix.db`

Le chemin exact est visible dans l'onglet **Documentation** de l'app.

## Stack technique

- Electron 31
- React 18 + TypeScript
- Vite 5
- TailwindCSS 3
- better-sqlite3 (base de données locale)
- exceljs (export Excel)
- electron-builder (packaging)
