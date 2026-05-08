# Phase 2 — Moteur audio Web Audio API

## Objectif

Construire le moteur audio temps réel avec lecture stéréo simple (sans encore la spatialisation automatisée — celle-ci viendra phase 5). Mettre en place le graphe complet pour pouvoir ensuite l'enrichir.

## Étapes

1. **Étendre `src/lib/audio-engine.ts`** :

   ```ts
   import type { ProjectSettings } from '@/types/project';

   class AudioEngineImpl {
     private ctx: AudioContext | null = null;
     private source: AudioBufferSourceNode | null = null;
     private gain: GainNode | null = null;
     private panner: PannerNode | null = null;
     private convolver: ConvolverNode | null = null;
     private buffer: AudioBuffer | null = null;
     private startedAt = 0;
     private pausedAt = 0;
     private isPlaying = false;

     getContext(): AudioContext {
       if (!this.ctx) this.ctx = new AudioContext();
       return this.ctx;
     }

     async decode(arrayBuffer: ArrayBuffer): Promise<AudioBuffer> {
       return this.getContext().decodeAudioData(arrayBuffer);
     }

     setBuffer(buffer: AudioBuffer): void {
       this.buffer = buffer;
       this.pausedAt = 0;
     }

     applySettings(s: ProjectSettings): void {
       if (!this.panner) return;
       this.panner.panningModel = s.panningModel;
       this.panner.distanceModel = s.distanceModel;
       this.panner.refDistance = s.refDistance;
       this.panner.rolloffFactor = s.rolloffFactor;
     }

     play(offsetSec = this.pausedAt): void {
       if (!this.buffer) return;
       const ctx = this.getContext();
       this.stopInternal();

       const source = ctx.createBufferSource();
       source.buffer = this.buffer;

       const gain = ctx.createGain();
       gain.gain.value = 1;

       const panner = ctx.createPanner();
       panner.panningModel = 'HRTF';
       panner.distanceModel = 'inverse';
       panner.refDistance = 1;
       panner.rolloffFactor = 1;
       panner.positionX.value = 0;
       panner.positionY.value = 0;
       panner.positionZ.value = -1; // devant l'auditeur par défaut

       // Auditeur fixe à l'origine, regardant vers -Z
       const listener = ctx.listener;
       if (listener.forwardX) {
         listener.forwardX.value = 0;
         listener.forwardY.value = 0;
         listener.forwardZ.value = -1;
         listener.upX.value = 0;
         listener.upY.value = 1;
         listener.upZ.value = 0;
         listener.positionX.value = 0;
         listener.positionY.value = 0;
         listener.positionZ.value = 0;
       }

       source.connect(gain).connect(panner).connect(ctx.destination);
       source.start(0, offsetSec);

       this.source = source;
       this.gain = gain;
       this.panner = panner;
       this.startedAt = ctx.currentTime - offsetSec;
       this.isPlaying = true;

       source.onended = () => {
         if (this.isPlaying) {
           this.isPlaying = false;
           this.pausedAt = 0;
         }
       };
     }

     pause(): void {
       if (!this.isPlaying) return;
       const ctx = this.getContext();
       this.pausedAt = ctx.currentTime - this.startedAt;
       this.stopInternal();
       this.isPlaying = false;
     }

     stop(): void {
       this.stopInternal();
       this.pausedAt = 0;
       this.isPlaying = false;
     }

     seek(timeSec: number): void {
       const wasPlaying = this.isPlaying;
       this.stopInternal();
       this.pausedAt = Math.max(0, Math.min(timeSec, this.buffer?.duration ?? 0));
       if (wasPlaying) this.play(this.pausedAt);
     }

     getCurrentTime(): number {
       if (!this.isPlaying) return this.pausedAt;
       const ctx = this.getContext();
       return Math.min(ctx.currentTime - this.startedAt, this.buffer?.duration ?? 0);
     }

     private stopInternal(): void {
       if (this.source) {
         try { this.source.stop(); } catch { /* déjà arrêté */ }
         this.source.disconnect();
         this.source = null;
       }
       if (this.gain) { this.gain.disconnect(); this.gain = null; }
       if (this.panner) { this.panner.disconnect(); this.panner = null; }
     }
   }

   export const AudioEngine = new AudioEngineImpl();
   ```

2. **Connecter le store au moteur** dans `project-store.ts` :
   - Quand `audioBuffer` change, appeler `AudioEngine.setBuffer(audioBuffer)`.
   - Ajouter actions : `play()`, `pause()`, `stop()`, `seek(time)`.
   - Ces actions appellent simplement `AudioEngine.<méthode>()` puis `set({ playback: { isPlaying, currentTime } })`.

3. **Créer une boucle de mise à jour `currentTime`** :
   - Dans un hook `useTransportSync()` dans `src/lib/use-transport-sync.ts` :
     ```ts
     export function useTransportSync(): void {
       const isPlaying = useProjectStore((s) => s.playback.isPlaying);
       const setCurrentTime = useProjectStore((s) => s.setCurrentTime);
       useEffect(() => {
         if (!isPlaying) return;
         let raf: number;
         const tick = () => {
           setCurrentTime(AudioEngine.getCurrentTime());
           raf = requestAnimationFrame(tick);
         };
         raf = requestAnimationFrame(tick);
         return () => cancelAnimationFrame(raf);
       }, [isPlaying, setCurrentTime]);
     }
     ```
   - Appeler ce hook une fois dans `App.tsx`.

4. **Créer `src/components/transport/TransportBar.tsx`** :
   - Boutons Play / Pause / Stop.
   - Affichage `mm:ss.cc / mm:ss.cc` (current / total).
   - Slider de seek.
   - Slider de volume (gain master, 0..1.5).

5. **Mettre à jour `App.tsx`** pour intégrer la `TransportBar` sous la `Waveform` et appeler `useTransportSync()`.

## Critère d'acceptation

- Charger un fichier puis cliquer Play → on entend le son en stéréo.
- Pause / Stop / Seek fonctionnent.
- Le compteur de temps avance en temps réel.
- Le slider de volume modifie réellement le niveau.

## Notes pour l'agent

- Le `PannerNode` est instancié dès maintenant pour préparer la phase 5, même si sa position reste fixe pour l'instant.
- Sur certains navigateurs (et la WebView Tauri), `AudioContext` doit être créé après une interaction utilisateur. Lance `getContext()` dans le handler du bouton "Ouvrir" si besoin.

## Commit

```
feat(phase-2): moteur audio Web Audio API avec transport play/pause/seek
```
