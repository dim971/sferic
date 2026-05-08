# Phase 1 — Chargement audio + forme d'onde

## Objectif

Permettre à l'utilisateur d'ouvrir un fichier audio (WAV/MP3/FLAC/OGG/M4A), le décoder, et afficher sa forme d'onde dans une timeline interactive.

## Étapes

1. **Définir les types** dans `src/types/project.ts` (cf. `ARCHITECTURE.md §2`) :
   ```ts
   export type CurveType = 'linear' | 'eaze' | 'smooth' | 'step';
   // 'eaze' = ease-in-out classique ; 'smooth' = setTargetAtTime adouci paramétré par tension.

   export interface SpatialKeyframe {
     id: string;
     time: number;
     position: { x: number; y: number; z: number };
     curve: CurveType;
     label?: string;

     // Motion (phase 5)
     duration?: number;
     tension?: number;

     // Gain & Fades (gainDb fonctionnel phase 5 ; HPF/LPF stubs UI v1, cf. DESIGN §9)
     gainDb?: number;
     snap?: boolean;
     hpfHz?: number;
     lpfHz?: number;

     // Doppler (stubs UI v1)
     doppler?: boolean;
     velocity?: boolean;
     dopplerIntensity?: number;
   }

   export interface ProjectSettings {
     panningModel: 'HRTF' | 'equalpower';
     distanceModel: 'linear' | 'inverse' | 'exponential';
     refDistance: number;
     rolloffFactor: number;
     reverb: { enabled: boolean; wet: number };
     snapToSphere: boolean;
     doppler: { enabled: boolean; intensity: number };
   }

   export interface AudioFileMeta {
     originalPath: string;
     embeddedSampleRate: number;
     durationSec: number;
     channels: number;
   }

   export interface Project {
     version: 1;
     audioFile: AudioFileMeta;
     keyframes: SpatialKeyframe[];
     settings: ProjectSettings;
     meta: { createdAt: string; updatedAt: string; name: string };
   }
   ```

2. **Créer le store Zustand** dans `src/store/project-store.ts` :
   - State : `project`, `audioBuffer` (le `AudioBuffer` Web Audio décodé, hors du JSON sauvegardé), `selectedKeyframeId`, `playback: { isPlaying, currentTime }`.
   - Actions de cette phase : `loadAudioFile(path: string, arrayBuffer: ArrayBuffer)`.
   - Pour décoder : utiliser un `AudioContext` partagé exposé par `audio-engine.ts`.

3. **Implémenter `src/lib/audio-engine.ts`** (squelette pour cette phase) :
   ```ts
   class AudioEngineImpl {
     private ctx: AudioContext | null = null;
     getContext(): AudioContext {
       if (!this.ctx) this.ctx = new AudioContext();
       return this.ctx;
     }
     async decode(arrayBuffer: ArrayBuffer): Promise<AudioBuffer> {
       return this.getContext().decodeAudioData(arrayBuffer);
     }
   }
   export const AudioEngine = new AudioEngineImpl();
   ```

4. **Installer les dépendances visuelles communes** (utilisées dès le Topbar et partout ensuite) :
   ```bash
   pnpm add lucide-react @fontsource/inter @fontsource/jetbrains-mono
   ```
   Importer les fontes dans `src/main.tsx` :
   ```ts
   import "@fontsource/inter/400.css";
   import "@fontsource/inter/500.css";
   import "@fontsource/jetbrains-mono/400.css";
   ```
   Configurer la famille par défaut dans `index.css` (couche `@theme` Tailwind 4 ou `body { font-family: ... }`) selon `DESIGN.md §1.2`.

5. **Créer `src/components/layout/Topbar.tsx`** en suivant `DESIGN.md §3` (logo orange + texte, menus File/Edit/Project/Render/View/Help, métadonnées audio au centre, chip UNSAVED, boutons Save/Open outline orange, placeholder VU mètres, bouton Render plein orange). Pour cette phase, **seuls** les boutons "Open" et le rendu des métadonnées du fichier chargé sont fonctionnels — Save / Render / VU restent visuels (handlers vides ou `disabled`), les phases 5/6/7 les câbleront.

   Le bouton **Open** (icône `FolderOpen` + label) :
   - Utilise `@tauri-apps/plugin-dialog` → `open({ multiple: false, filters: [{ name: 'Audio', extensions: ['wav','mp3','flac','ogg','m4a','aac'] }] })`.
   - Lit le fichier avec `@tauri-apps/plugin-fs` → `readFile(path)` (retourne un `Uint8Array`).
   - Convertit en `ArrayBuffer` et appelle `loadAudioFile` du store.

   Une fois l'audio chargé, la zone centrale du Topbar affiche : nom du morceau (en `--accent`), `${sampleRate / 1000}k`, puis nom du fichier en `--text-secondary`. Avant chargement : zone vide.

6. **Créer `src/components/timeline/Waveform.tsx`** avec **wavesurfer.js v7** :
   ```bash
   pnpm add wavesurfer.js
   ```
   - Le composant prend `audioBuffer: AudioBuffer | null` en prop.
   - Initialise WaveSurfer avec les couleurs du design (cf. `DESIGN.md §6.2`) :
     ```ts
     WaveSurfer.create({
       container,
       waveColor: '#F87328',
       progressColor: '#FF8A3D',
       cursorColor: '#FFFFFF',
       cursorWidth: 1,
       barWidth: 1,
       barGap: 1,
       barRadius: 0,
       height: 96,
     });
     ```
   - Le conteneur a `bg-[--waveform-bg]`.
   - **Important** : pour passer un `AudioBuffer` déjà décodé, utiliser `ws.loadDecodedBuffer(audioBuffer)` ou en v7 : `ws.load(url)` avec un blob → préférer la première forme via la méthode `loadAudioBuffer` exposée par v7.
   - Démonter proprement (`ws.destroy()` dans le `useEffect` cleanup).

7. **Mettre à jour `src/App.tsx`** avec la grille définie dans `DESIGN.md §2`. À cette phase, la zone centrale (qui hébergera la `<DualScene />` + l'`<Inspector />` en phase 3-4) reste un placeholder vide aux bonnes proportions :
   ```tsx
   import { Topbar } from '@/components/layout/Topbar';
   import { Waveform } from '@/components/timeline/Waveform';
   import { useProjectStore } from '@/store/project-store';

   export default function App() {
     const audioBuffer = useProjectStore((s) => s.audioBuffer);
     return (
       <div className="h-screen w-screen grid grid-rows-[44px_1fr_180px] grid-cols-[1fr_320px] bg-[--bg-base] text-[--text-primary]">
         <div className="col-span-2 border-b border-[--border-subtle]">
           <Topbar />
         </div>
         <div className="bg-[--bg-panel] border-r border-[--border-subtle] flex items-center justify-center text-[--text-dim] text-[12px]">
           {audioBuffer ? `${audioBuffer.duration.toFixed(2)}s · ${audioBuffer.numberOfChannels}ch · ${audioBuffer.sampleRate}Hz` : 'Aucun fichier chargé'}
         </div>
         <div className="bg-[--bg-panel]" />{/* Inspector, vide pour l'instant */}
         <div className="col-span-2 bg-[--bg-panel] border-t border-[--border-subtle] p-3">
           <Waveform audioBuffer={audioBuffer} />
         </div>
       </div>
     );
   }
   ```

## Design

Réfs : `DESIGN.md §3` (Topbar) et `§6.2` (waveform). Ouvrir le screenshot pour calibrer la densité du Topbar (gap `gap-3`, valeurs `text-[12px]`) et le ton de la waveform (orange chaud sur fond brun très sombre). Les contrôles non-fonctionnels en phase 1 (Save, Render, VU) sont rendus dans leur état visuel correct mais désactivés ou inertes — **pas de placeholder grossier** type "TODO" affiché dans la barre.

## Critère d'acceptation

- Cliquer sur "Open" affiche un dialogue natif.
- Sélectionner un fichier audio → la forme d'onde s'affiche en bas avec les couleurs du design, le nom du fichier + sample rate apparaissent dans le Topbar.
- Re-sélectionner un autre fichier remplace correctement la forme d'onde sans fuite mémoire.
- La grille du layout (44px / 1fr / 180px × 1fr / 320px) est en place même si Inspector et zone scènes sont vides.
- Pas de warning console.

## Commit

```
feat(phase-1): chargement et affichage de la forme d'onde
```
