# Phase 5 — Lecture temps réel avec spatialisation HRTF

## Objectif

Lier les keyframes au `PannerNode` HRTF du moteur audio pour que la lecture **soit** spatialisée. C'est le cœur de l'effet "8D".

## Étapes

1. **Ajouter une méthode `applyKeyframeAutomation` dans `AudioEngine`** :
   ```ts
   applyKeyframeAutomation(keyframes: SpatialKeyframe[], startOffsetSec: number): void {
     if (!this.panner || !this.ctx) return;
     const ctx = this.ctx;
     const t0 = ctx.currentTime; // au démarrage de la lecture

     // On programme toutes les transitions
     this.panner.positionX.cancelScheduledValues(t0);
     this.panner.positionY.cancelScheduledValues(t0);
     this.panner.positionZ.cancelScheduledValues(t0);

     const sorted = [...keyframes].sort((a, b) => a.time - b.time);
     // Pour chaque keyframe à un temps >= startOffsetSec, on programme la valeur
     for (const kf of sorted) {
       if (kf.time < startOffsetSec) continue;
       const audioTime = t0 + (kf.time - startOffsetSec);
       const ramp = this.curveToRampMethod(kf.curve);
       // setTargetAtTime pour easeOut, linearRampToValueAtTime pour linear, etc.
       if (ramp === 'step') {
         this.panner.positionX.setValueAtTime(kf.position.x, audioTime);
         this.panner.positionY.setValueAtTime(kf.position.y, audioTime);
         this.panner.positionZ.setValueAtTime(kf.position.z, audioTime);
       } else if (ramp === 'linear') {
         this.panner.positionX.linearRampToValueAtTime(kf.position.x, audioTime);
         this.panner.positionY.linearRampToValueAtTime(kf.position.y, audioTime);
         this.panner.positionZ.linearRampToValueAtTime(kf.position.z, audioTime);
       } else {
         // approximation des courbes ease* avec setTargetAtTime
         const tau = ramp === 'easeIn' ? 0.4 : ramp === 'easeOut' ? 0.15 : 0.25;
         this.panner.positionX.setTargetAtTime(kf.position.x, audioTime, tau);
         this.panner.positionY.setTargetAtTime(kf.position.y, audioTime, tau);
         this.panner.positionZ.setTargetAtTime(kf.position.z, audioTime, tau);
       }
     }
   }

   private curveToRampMethod(c: CurveType): 'linear' | 'step' | 'easeIn' | 'easeOut' | 'easeInOut' {
     return c;
   }
   ```

2. **Modifier `play(offsetSec)`** :
   - Après la création du graphe, appeler `applyKeyframeAutomation(currentProject.keyframes, offsetSec)`.
   - Recevoir les keyframes en paramètre depuis le store, OU exposer un setter `setKeyframes(kfs[])` que le store appelle quand `project.keyframes` change.
   - **Préférer** : passer `keyframes` à `play(offsetSec, keyframes)` pour rester explicite.

3. **Re-programmer l'automation à chaque modification de keyframes pendant la lecture** :
   - Dans le store, après `addKeyframe` / `updateKeyframe` / `removeKeyframe`, si `playback.isPlaying`, appeler `AudioEngine.applyKeyframeAutomation(keyframes, AudioEngine.getCurrentTime())`.

4. **Implémenter la réverb optionnelle** :
   - Charger un IR (impulse response) court depuis `src/assets/ir/room.wav` (en placer un libre de droit, ex : Freesound CC0, ou générer via code un IR synthétique très court).
   - Si `settings.reverb.enabled`, brancher : `panner → convolver → wetGain → destination` en parallèle de `panner → dryGain → destination` (cross-fade dry/wet).

5. **Vérifier le comportement avec écouteurs/casque** :
   - Ajouter 4 keyframes formant un cercle horizontal (gauche, devant, droite, derrière) sur 8 secondes.
   - Au casque, on doit clairement entendre le son tourner autour de la tête.

## Critère d'acceptation

- Avec ≥ 2 keyframes à des positions différentes, la lecture spatialise effectivement le son (testable au casque).
- Modifier un keyframe pendant la lecture met à jour la trajectoire en moins de ~100 ms.
- Le seek fonctionne toujours et reprogramme correctement les automations restantes.
- Pas de glitch audio audible aux transitions de keyframes.

## Commit

```
feat(phase-5): spatialisation HRTF temps réel via automation PannerNode
```
