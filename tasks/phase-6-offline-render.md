# Phase 6 — Export offline (rendu WAV/MP3)

## Objectif

Exporter le morceau spatialisé en fichier audio stéréo avec l'effet "bakké" (l'utilisateur peut le partager / écouter dans n'importe quel lecteur).

## Étapes

1. **Créer `src/lib/wav-encoder.ts`** :
   ```ts
   export function encodeWav(buffer: AudioBuffer): Uint8Array {
     const numChannels = buffer.numberOfChannels;
     const sampleRate = buffer.sampleRate;
     const length = buffer.length * numChannels * 2 + 44;
     const out = new ArrayBuffer(length);
     const view = new DataView(out);

     // RIFF header
     writeString(view, 0, 'RIFF');
     view.setUint32(4, length - 8, true);
     writeString(view, 8, 'WAVE');
     writeString(view, 12, 'fmt ');
     view.setUint32(16, 16, true);
     view.setUint16(20, 1, true); // PCM
     view.setUint16(22, numChannels, true);
     view.setUint32(24, sampleRate, true);
     view.setUint32(28, sampleRate * numChannels * 2, true);
     view.setUint16(32, numChannels * 2, true);
     view.setUint16(34, 16, true);
     writeString(view, 36, 'data');
     view.setUint32(40, length - 44, true);

     // PCM 16-bit interleaved
     let offset = 44;
     const channels: Float32Array[] = [];
     for (let c = 0; c < numChannels; c++) channels.push(buffer.getChannelData(c));
     for (let i = 0; i < buffer.length; i++) {
       for (let c = 0; c < numChannels; c++) {
         const s = Math.max(-1, Math.min(1, channels[c][i]));
         view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
         offset += 2;
       }
     }
     return new Uint8Array(out);
   }

   function writeString(v: DataView, offset: number, s: string) {
     for (let i = 0; i < s.length; i++) v.setUint8(offset + i, s.charCodeAt(i));
   }
   ```

2. **Créer `src/lib/render-offline.ts`** :
   ```ts
   import type { Project } from '@/types/project';
   import type { SpatialKeyframe, CurveType } from '@/types/project';

   export async function renderProject(
     project: Project,
     audioBuffer: AudioBuffer
   ): Promise<AudioBuffer> {
     const offline = new OfflineAudioContext({
       numberOfChannels: 2, // stéréo HRTF
       length: Math.ceil(audioBuffer.duration * audioBuffer.sampleRate),
       sampleRate: audioBuffer.sampleRate,
     });

     const source = offline.createBufferSource();
     source.buffer = audioBuffer;

     const gain = offline.createGain();
     const panner = offline.createPanner();
     panner.panningModel = project.settings.panningModel;
     panner.distanceModel = project.settings.distanceModel;
     panner.refDistance = project.settings.refDistance;
     panner.rolloffFactor = project.settings.rolloffFactor;

     // Position initiale : premier keyframe ou (0,0,-1)
     const sorted = [...project.keyframes].sort((a, b) => a.time - b.time);
     const initial = sorted[0]?.position ?? { x: 0, y: 0, z: -1 };
     panner.positionX.value = initial.x;
     panner.positionY.value = initial.y;
     panner.positionZ.value = initial.z;

     // Programmation des automations à partir de t=0 dans l'OfflineAudioContext
     for (const kf of sorted) {
       schedule(panner.positionX, kf.position.x, kf.time, kf.curve);
       schedule(panner.positionY, kf.position.y, kf.time, kf.curve);
       schedule(panner.positionZ, kf.position.z, kf.time, kf.curve);
     }

     source.connect(gain).connect(panner).connect(offline.destination);
     source.start(0);

     return offline.startRendering();
   }

   function schedule(p: AudioParam, value: number, time: number, curve: CurveType) {
     if (curve === 'step') p.setValueAtTime(value, time);
     else if (curve === 'linear') p.linearRampToValueAtTime(value, time);
     else {
       const tau = curve === 'easeIn' ? 0.4 : curve === 'easeOut' ? 0.15 : 0.25;
       p.setTargetAtTime(value, time, tau);
     }
   }
   ```

3. **Ajouter encodage MP3 (optionnel)** :
   ```bash
   pnpm add @breezystack/lamejs
   ```
   Créer `src/lib/mp3-encoder.ts` qui prend un `AudioBuffer` stéréo et retourne un `Uint8Array` MP3 128kbps.

4. **Bouton "Exporter…"** dans la `Topbar` :
   - Ouvre un modal :
     - Format : WAV / MP3
     - Si MP3 : bitrate (128 / 192 / 320 kbps)
     - Bouton "Exporter".
   - Au clic :
     1. Affiche un spinner avec "Rendu en cours…"
     2. Appelle `renderProject(project, audioBuffer)`.
     3. Encode (`encodeWav` ou `encodeMp3`).
     4. Ouvre `dialog.save({ defaultPath: ${name}.wav })`.
     5. Écrit avec `fs.writeFile(path, bytes)` (plugin Tauri).
     6. Affiche une toast "Exporté ✓".

5. **Gérer la performance** :
   - Pour des fichiers > 5 min, le rendu offline peut prendre plusieurs secondes mais doit rester < durée du morceau (les implémentations Chromium tournent à ~5–20× temps réel).
   - Afficher une barre de progression si possible (`OfflineAudioContext` n'expose pas de progression — on peut afficher un spinner indéterminé).

## Critère d'acceptation

- Charger un fichier, ajouter quelques keyframes, exporter en WAV.
- Le WAV joué dans un autre lecteur (VLC, QuickTime…) au casque reproduit l'effet spatial entendu en preview.
- L'export MP3 fonctionne et donne un fichier lisible partout.
- Pas de freeze de l'UI pendant le rendu (le rendu offline ne bloque pas le main thread, mais l'encodage WAV est synchrone — pour > 100 MB, le faire dans un Worker est un plus mais pas obligatoire à ce stade).

## Commit

```
feat(phase-6): export offline WAV et MP3
```
