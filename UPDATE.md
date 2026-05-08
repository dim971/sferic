# UPDATE — Addendum design v1.4

Cet addendum complète le kit initial pour couvrir les fonctionnalités du design retenu (référence : maquette Spatialize 1.4.2). Décompresse cette archive **dans le même dossier que le kit principal** : les fichiers s'ajoutent à côté et ne remplacent rien physiquement, mais ils **changent l'ordre d'exécution** du roadmap.

## Comment intégrer ce changement

1. Décompresse `spatialize-kit-addendum.zip` à la racine du kit. Tu obtiendras :
   ```
   spatialize-kit/
   ├── UPDATE.md                                          ← ce fichier
   ├── tasks/
   │   ├── phase-3b-dual-orthographic-views.md            ← REMPLACE phase 3
   │   ├── phase-9-extended-keyframe-properties.md        ← NOUVEAU
   │   └── phase-10-audio-analysis-monitoring.md          ← NOUVEAU
   └── (fichiers existants inchangés)
   ```
2. Avant de lancer Claude Code / Codex, **modifie `ROADMAP.md`** pour utiliser la nouvelle séquence (cf. section suivante).
3. Le prompt de délégation reste valable, mais ajoute en préambule :
   > **Important** : lis `UPDATE.md` avant tout. Il modifie le roadmap initial. Suis l'ordre d'exécution donné dans `UPDATE.md`, pas celui de `ROADMAP.md`.

## Nouveau roadmap (à appliquer)

| # | Phase | Statut | Fichier |
|---|---|---|---|
| 0 | Bootstrap Tauri + React + TS + Tailwind | inchangé | `tasks/phase-0-bootstrap.md` |
| 1 | Chargement audio + waveform | inchangé | `tasks/phase-1-audio-loading.md` |
| 2 | Moteur audio Web Audio API | inchangé | `tasks/phase-2-audio-engine.md` |
| **3b** | **Vues orthographiques TOP + SIDE** | **NOUVEAU — remplace 3** | `tasks/phase-3b-dual-orthographic-views.md` |
| 4 | Timeline avec marqueurs et inspecteur | inchangé | `tasks/phase-4-timeline-keyframes.md` |
| 5 | Spatialisation HRTF temps réel | inchangé | `tasks/phase-5-realtime-preview.md` |
| **9** | **Propriétés étendues des keyframes** (gain, filtres, send, doppler, courbe cubic) | **NOUVEAU** | `tasks/phase-9-extended-keyframe-properties.md` |
| **10** | **Analyse audio + monitoring** (BPM, key, CPU, vu-mètres) | **NOUVEAU** | `tasks/phase-10-audio-analysis-monitoring.md` |
| 6 | Export offline WAV/MP3 | **à étendre** (cf. ci-dessous) | `tasks/phase-6-offline-render.md` |
| 7 | Sauvegarde / chargement projets | **à étendre** (migration v1 → v2) | `tasks/phase-7-project-persistence.md` |
| 8 | Build cross-platform et CI | inchangé | `tasks/phase-8-distribution.md` |

**Justification de l'ordre** : les phases 9 et 10 doivent être faites **avant** la phase 6 (export). Sinon le rendu offline ne saurait pas appliquer les filtres, gains et envois par keyframe — il faudrait y revenir et tout refactorer. De même la phase 7 (persistence) doit gérer le format projet enrichi.

## Adaptations à apporter aux phases existantes

### Phase 0 — Bootstrap

Ajouter ces dépendances dès le bootstrap :
```bash
pnpm add web-audio-beat-detector
# Optionnel pour la détection de tonalité — peut être différé en phase 10
# pnpm add essentia.js
```

### Phase 4 — Timeline et inspecteur

L'**inspector** dans cette phase ne reste plus minimal. Il doit être structuré dès maintenant en sections collapsibles :
- `POSITION` (coordonnées cartésiennes ET polaires avec toggle)
- `MOTION` (placeholder pour la phase 9 : courbes hold/linear/ease-out/cubic + tension)
- `GAIN & FILTER` (sections vides à ce stade, remplies en phase 9)
- `SEND` (idem)

Ajouter un en-tête keyframe avec :
- Numéro stable (`k01`, `k02`, etc.) calculé dynamiquement à partir de l'index temporel
- Label éditable
- Navigation `‹ N of M ›`
- Boutons dupliquer / supprimer

### Phase 6 — Export offline (extension)

Quand l'agent attaque cette phase :
1. Le `OfflineAudioContext` doit reproduire **exactement** le graphe complet de la phase 9 (panner + filtres + gain + reverb send), pas juste le panner.
2. La fonction `renderProject` doit programmer toutes les automations : position, gain, lpf, hpf, send.
3. Ajouter une boîte de dialogue **Render** (et non plus simple Export) avec :
   - Format : WAV / MP3 / FLAC (FLAC = bonus, peut être différé)
   - Profondeur : 16 / 24 / 32-bit float (WAV)
   - Bitrate : 192 / 256 / 320 kbps (MP3)
   - Plage temporelle : tout / loop region / sélection
   - Dithering : on / off (pour 16-bit)
   - Barre de progression
   - Bouton « Annuler »

### Phase 7 — Persistence (extension)

Le format projet passe à `version: 2`.

Implémenter une fonction `migrateV1ToV2(p1: ProjectV1): ProjectV2` qui :
- Conserve position, time, curve (mappe `easeIn` → `ease-in`, `step` → `hold`)
- Initialise les nouvelles propriétés keyframe : `gain: 0, lpf: null, hpf: null, doppler: true, airAbsorption: 0.18, reverbSend: null, tension: 0.5`
- Initialise `audioMeta: { bpm: null, key: null }` (sera rempli au prochain chargement)

## Adaptations à la barre de menu (Topbar)

Le design final montre une **vraie barre de menu native** (`File / Edit / Project / Render / View / Help`). Implémenter via l'API `tauri::menu` côté Rust :

```rust
// dans src-tauri/src/main.rs
use tauri::menu::{Menu, MenuItem, Submenu};

let file_menu = Submenu::new("File", Menu::new()
    .add_item(MenuItem::new("Open project…", "open_project", true, Some("CmdOrCtrl+O")))
    .add_item(MenuItem::new("Save", "save", true, Some("CmdOrCtrl+S")))
    .add_item(MenuItem::new("Save as…", "save_as", true, Some("CmdOrCtrl+Shift+S")))
    .add_separator()
    .add_item(MenuItem::new("Import audio…", "import_audio", true, Some("CmdOrCtrl+I")))
    .add_separator()
    .add_item(MenuItem::new("Render…", "render", true, Some("CmdOrCtrl+R"))));
// idem Edit / Project / Render / View / Help
```

Émettre un event Tauri (`emit_all("menu", id)`) au clic, écouté côté React via `listen('menu', ...)`. Cette tâche est **petite** (≈ 30 min) et peut être faite en fin de phase 4 ou en parallèle.

## Vérifications globales additionnelles

À la fin de la phase 10, l'app doit afficher en topbar :
- Nom du projet et fichier audio source ✅
- Sample rate + bit depth ✅ (depuis `AudioBuffer.sampleRate` et métadonnée fichier via Rust)
- Indicateur UNSAVED si dirty ✅
- CPU % (depuis tauri-plugin-sysinfo ou approximation `audioContext` callback) ✅
- Buffer size (`audioContext.outputLatency * sampleRate` arrondi) ✅
- Vu-mètres L/R ✅

Et en bas (transport bar) :
- Position courante en `m:ss.mmm` ✅
- BAR / Beat / Sixteenth dérivés du BPM ✅
- BPM + tonalité détectés ✅
- Mode monitoring (BINAURAL / STEREO BYPASS) ✅
