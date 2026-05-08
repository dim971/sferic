# Phase 5 — Lecture temps réel avec spatialisation HRTF

## Objectif

Lier les keyframes au `PannerNode` HRTF du moteur audio pour que la lecture **soit** spatialisée. C'est le cœur de l'effet "8D".

## Étapes

1. **Ajouter une méthode `applyKeyframeAutomation` dans `AudioEngine`** qui automatise position **et** gain par keyframe :
   ```ts
   applyKeyframeAutomation(keyframes: SpatialKeyframe[], startOffsetSec: number): void {
     if (!this.panner || !this.gain || !this.ctx) return;
     const ctx = this.ctx;
     const t0 = ctx.currentTime; // au démarrage de la lecture

     // Reset des automations programmées
     [this.panner.positionX, this.panner.positionY, this.panner.positionZ, this.gain.gain]
       .forEach(p => p.cancelScheduledValues(t0));

     const sorted = [...keyframes].sort((a, b) => a.time - b.time);
     for (const kf of sorted) {
       if (kf.time < startOffsetSec) continue;
       const audioTime = t0 + (kf.time - startOffsetSec);
       const tension = kf.tension ?? 0.5;

       schedulePos(this.panner.positionX, kf.position.x, audioTime, kf.curve, tension);
       schedulePos(this.panner.positionY, kf.position.y, audioTime, kf.curve, tension);
       schedulePos(this.panner.positionZ, kf.position.z, audioTime, kf.curve, tension);

       // Gain par-keyframe (gainDb → linéaire)
       const linGain = Math.pow(10, (kf.gainDb ?? 0) / 20);
       schedulePos(this.gain.gain, linGain, audioTime, kf.curve, tension);
     }
   }
   ```

   Avec un helper local :
   ```ts
   function schedulePos(
     p: AudioParam, value: number, time: number,
     curve: CurveType, tension: number
   ): void {
     switch (curve) {
       case 'step':   p.setValueAtTime(value, time); return;
       case 'linear': p.linearRampToValueAtTime(value, time); return;
       case 'eaze':   p.setTargetAtTime(value, time, 0.25); return;            // ease-in-out approx
       case 'smooth': p.setTargetAtTime(value, time, 0.05 + tension * 0.4); return; // tension contrôle l'adoucissement
     }
   }
   ```

   > Les champs `hpfHz`, `lpfHz`, `doppler`, `velocity`, `dopplerIntensity` du keyframe restent **stubs en v1** — leurs valeurs sont stockées et lues par l'inspecteur, mais pas appliquées au graphe audio. Voir `DESIGN.md §9`.

2. **Modifier `play(offsetSec)`** :
   - Après la création du graphe, appeler `applyKeyframeAutomation(currentProject.keyframes, offsetSec)`.
   - Recevoir les keyframes en paramètre depuis le store, OU exposer un setter `setKeyframes(kfs[])` que le store appelle quand `project.keyframes` change.
   - **Préférer** : passer `keyframes` à `play(offsetSec, keyframes)` pour rester explicite.

3. **Re-programmer l'automation à chaque modification de keyframes pendant la lecture** :
   - Dans le store, après `addKeyframe` / `updateKeyframe` / `removeKeyframe`, si `playback.isPlaying`, appeler `AudioEngine.applyKeyframeAutomation(keyframes, AudioEngine.getCurrentTime())`.

4. **Implémenter la réverb optionnelle** :
   - Charger un IR (impulse response) court depuis `src/assets/ir/room.wav` (en placer un libre de droit, ex : Freesound CC0, ou générer via code un IR synthétique très court).
   - Si `settings.reverb.enabled`, brancher : `panner → convolver → wetGain → destination` en parallèle de `panner → dryGain → destination` (cross-fade dry/wet).

5. **Brancher les VU mètres du Topbar** (cf. `DESIGN.md §3` point 6) :
   - Insérer un `AnalyserNode` (fftSize=256) entre le `panner` et `ctx.destination`.
   - Créer `src/components/layout/VuMeter.tsx` qui prend l'analyser en prop, lit `getByteTimeDomainData` à chaque `requestAnimationFrame`, calcule la peak L et R, et rend deux colonnes de 14 segments (`--vu-green` × 10, `--vu-yellow` × 3, `--vu-red` × 1) allumés/éteints selon le niveau.
   - Si le moteur n'est pas démarré, les VU restent éteints (pas d'erreur).

6. **Vérifier le comportement avec écouteurs/casque** :
   - Ajouter 4 keyframes formant un cercle horizontal (gauche, devant, droite, derrière) sur 8 secondes.
   - Au casque, on doit clairement entendre le son tourner autour de la tête.

## Design

Réf : `DESIGN.md §3` (VU mètres dans le Topbar) et `§5.4` (Vol fonctionnel). À cette phase, ce qui était stub visuel devient **vivant** : les VU bougent à la lecture, le `Vol` par-keyframe modifie réellement le niveau audio. Vérifier que les VU ne saturent pas trop facilement (calibrer les seuils green/yellow/red) et que les transitions de gain ne provoquent pas de pops.

## Critère d'acceptation

- Avec ≥ 2 keyframes à des positions différentes, la lecture spatialise effectivement le son (testable au casque).
- Modifier un keyframe pendant la lecture met à jour la trajectoire en moins de ~100 ms.
- Le seek fonctionne toujours et reprogramme correctement les automations restantes.
- Le `Vol` (gainDb) par-keyframe agit réellement sur le niveau audio.
- Les VU mètres du Topbar bougent en temps réel pendant la lecture, et restent éteints à l'arrêt.
- Pas de glitch audio audible aux transitions de keyframes.

## Commit

```
feat(phase-5): spatialisation HRTF temps réel via automation PannerNode
```
