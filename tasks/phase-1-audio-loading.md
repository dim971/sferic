# Phase 1 — Chargement audio + forme d'onde

## Objectif

Permettre à l'utilisateur d'ouvrir un fichier audio (WAV/MP3/FLAC/OGG/M4A), le décoder, et afficher sa forme d'onde dans une timeline interactive.

## Étapes

1. **Définir les types** dans `src/types/project.ts` :
   ```ts
   export type CurveType = 'linear' | 'easeIn' | 'easeOut' | 'easeInOut' | 'step';

   export interface SpatialKeyframe {
     id: string;
     time: number;
     position: { x: number; y: number; z: number };
     curve: CurveType;
     label?: string;
   }

   export interface ProjectSettings {
     panningModel: 'HRTF' | 'equalpower';
     distanceModel: 'linear' | 'inverse' | 'exponential';
     refDistance: number;
     rolloffFactor: number;
     reverb: { enabled: boolean; wet: number };
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

4. **Créer `src/components/layout/Topbar.tsx`** avec un bouton "Ouvrir" qui :
   - Utilise `@tauri-apps/plugin-dialog` → `open({ multiple: false, filters: [{ name: 'Audio', extensions: ['wav','mp3','flac','ogg','m4a','aac'] }] })`.
   - Lit le fichier avec `@tauri-apps/plugin-fs` → `readFile(path)` (retourne un `Uint8Array`).
   - Convertit en `ArrayBuffer` et appelle `loadAudioFile` du store.

5. **Créer `src/components/timeline/Waveform.tsx`** avec **wavesurfer.js v7** :
   ```bash
   pnpm add wavesurfer.js
   ```
   - Le composant prend `audioBuffer: AudioBuffer | null` en prop.
   - Initialise WaveSurfer avec `WaveSurfer.create({ container, waveColor, progressColor, height: 96 })`.
   - **Important** : pour passer un `AudioBuffer` déjà décodé, utiliser `ws.loadDecodedBuffer(audioBuffer)` ou en v7 : `ws.load(url)` avec un blob → préférer la première forme via la méthode `loadAudioBuffer` exposée par v7.
   - Démonter proprement (`ws.destroy()` dans le `useEffect` cleanup).

6. **Mettre à jour `src/App.tsx`** :
   ```tsx
   import { Topbar } from '@/components/layout/Topbar';
   import { Waveform } from '@/components/timeline/Waveform';
   import { useProjectStore } from '@/store/project-store';

   export default function App() {
     const audioBuffer = useProjectStore((s) => s.audioBuffer);
     return (
       <div className="h-screen w-screen flex flex-col bg-neutral-950 text-neutral-100">
         <Topbar />
         <main className="flex-1 flex flex-col">
           <div className="flex-1 flex items-center justify-center text-neutral-500">
             {audioBuffer ? `${audioBuffer.duration.toFixed(2)}s · ${audioBuffer.numberOfChannels}ch · ${audioBuffer.sampleRate}Hz` : 'Aucun fichier chargé'}
           </div>
           <div className="border-t border-neutral-800 p-3">
             <Waveform audioBuffer={audioBuffer} />
           </div>
         </main>
       </div>
     );
   }
   ```

## Critère d'acceptation

- Cliquer sur "Ouvrir" affiche un dialogue natif.
- Sélectionner un fichier audio → la forme d'onde s'affiche en bas, la durée/canaux/sample rate s'affichent au centre.
- Re-sélectionner un autre fichier remplace correctement la forme d'onde sans fuite mémoire.
- Pas de warning console.

## Commit

```
feat(phase-1): chargement et affichage de la forme d'onde
```
