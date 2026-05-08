import { ChevronLeft, ChevronRight, Diamond, Trash2 } from 'lucide-react';
import type { CurveType, SpatialKeyframe } from '@/types/project';
import { useProjectStore } from '@/store/project-store';
import { cartesianToSpherical } from '@/lib/math3d';

const CURVES: { id: CurveType; label: string }[] = [
  { id: 'linear', label: 'Linear' },
  { id: 'eaze', label: 'Eaze' },
  { id: 'smooth', label: 'Smooth' },
  { id: 'step', label: 'Step' },
];

function formatTime(sec: number): string {
  if (!isFinite(sec) || sec < 0) sec = 0;
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  const cs = Math.floor((sec % 1) * 1000)
    .toString()
    .padStart(3, '0');
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}.${cs}`;
}

function computeSpeed(keyframes: SpatialKeyframe[], id: string): number {
  const sorted = [...keyframes].sort((a, b) => a.time - b.time);
  const idx = sorted.findIndex((k) => k.id === id);
  if (idx === -1) return 0;
  const cur = sorted[idx];
  const speeds: number[] = [];
  const prev = sorted[idx - 1];
  if (prev && cur.time > prev.time) {
    const d = Math.hypot(
      cur.position.x - prev.position.x,
      cur.position.y - prev.position.y,
      cur.position.z - prev.position.z,
    );
    speeds.push(d / (cur.time - prev.time));
  }
  const next = sorted[idx + 1];
  if (next && next.time > cur.time) {
    const d = Math.hypot(
      next.position.x - cur.position.x,
      next.position.y - cur.position.y,
      next.position.z - cur.position.z,
    );
    speeds.push(d / (next.time - cur.time));
  }
  if (speeds.length === 0) return 0;
  return speeds.reduce((a, b) => a + b, 0) / speeds.length;
}

export function Inspector() {
  const project = useProjectStore((s) => s.project);
  const selectedId = useProjectStore((s) => s.selectedKeyframeId);

  if (!project) {
    return (
      <div className="h-full p-3 flex items-center justify-center text-[--text-dim] text-[12px]">
        Charge un projet
      </div>
    );
  }

  const sorted = [...project.keyframes].sort((a, b) => a.time - b.time);
  const selectedIdx = sorted.findIndex((k) => k.id === selectedId);
  const selected = selectedIdx >= 0 ? sorted[selectedIdx] : null;

  return (
    <div className="h-full overflow-y-auto p-3 flex flex-col gap-4 text-[12px]">
      <SectionHeader>Inspector</SectionHeader>
      {selected ? (
        <KeyframePanel
          keyframe={selected}
          index={selectedIdx}
          total={sorted.length}
          prevId={sorted[selectedIdx - 1]?.id ?? null}
          nextId={sorted[selectedIdx + 1]?.id ?? null}
          allKeyframes={sorted}
        />
      ) : (
        <ProjectPanel project={project} />
      )}
    </div>
  );
}

function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-[10px] tracking-widest uppercase text-[--text-dim]">{children}</h3>
  );
}

function ProjectPanel({ project }: { project: NonNullable<ReturnType<typeof useProjectStore.getState>['project']> }) {
  const updateSettings = useProjectStore((s) => s.updateSettings);
  const s = project.settings;
  return (
    <div className="space-y-4">
      <SectionHeader>Project</SectionHeader>
      <Field label="Panning">
        <div className="flex gap-1">
          {(['HRTF', 'equalpower'] as const).map((m) => (
            <Chip
              key={m}
              active={s.panningModel === m}
              onClick={() => updateSettings({ panningModel: m })}
            >
              {m}
            </Chip>
          ))}
        </div>
      </Field>
      <Field label="Distance">
        <div className="flex gap-1">
          {(['linear', 'inverse', 'exponential'] as const).map((m) => (
            <Chip
              key={m}
              active={s.distanceModel === m}
              onClick={() => updateSettings({ distanceModel: m })}
            >
              {m}
            </Chip>
          ))}
        </div>
      </Field>
      <Field label="Ref dist.">
        <NumInput
          value={s.refDistance}
          step={0.1}
          onChange={(v) => updateSettings({ refDistance: v })}
        />
      </Field>
      <Field label="Rolloff">
        <NumInput
          value={s.rolloffFactor}
          step={0.1}
          onChange={(v) => updateSettings({ rolloffFactor: v })}
        />
      </Field>
      <Field label="Reverb">
        <Toggle
          checked={s.reverb.enabled}
          onChange={(v) => updateSettings({ reverb: { ...s.reverb, enabled: v } })}
        />
      </Field>
      <Field label="Wet">
        <NumInput
          value={s.reverb.wet}
          step={0.05}
          onChange={(v) =>
            updateSettings({ reverb: { ...s.reverb, wet: Math.max(0, Math.min(1, v)) } })
          }
        />
      </Field>
      <Field label="Snap">
        <Toggle checked={s.snapToSphere} onChange={(v) => updateSettings({ snapToSphere: v })} />
      </Field>
    </div>
  );
}

interface KeyframePanelProps {
  keyframe: SpatialKeyframe;
  index: number;
  total: number;
  prevId: string | null;
  nextId: string | null;
  allKeyframes: SpatialKeyframe[];
}

function KeyframePanel({ keyframe: kf, index, total, prevId, nextId, allKeyframes }: KeyframePanelProps) {
  const updateKeyframe = useProjectStore((s) => s.updateKeyframe);
  const removeKeyframe = useProjectStore((s) => s.removeKeyframe);
  const selectKeyframe = useProjectStore((s) => s.selectKeyframe);

  const sph = cartesianToSpherical(kf.position);
  const speed = computeSpeed(allKeyframes, kf.id);

  const setPos = (axis: 'x' | 'y' | 'z') => (v: number) =>
    updateKeyframe(kf.id, { position: { ...kf.position, [axis]: v } });

  return (
    <div className="space-y-5">
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Diamond size={10} className="text-[--accent]" fill="currentColor" />
            <span className="text-[13px] text-[--text-primary] font-medium">
              Keyframe {(index + 1).toString().padStart(2, '0')}
            </span>
          </div>
          <Paginator
            index={index}
            total={total}
            onPrev={prevId ? () => selectKeyframe(prevId) : null}
            onNext={nextId ? () => selectKeyframe(nextId) : null}
          />
        </div>
        <div className="font-mono text-[12px] text-[--text-secondary] tabular-nums">
          {formatTime(kf.time)}
        </div>
      </div>

      <section className="space-y-2">
        <SectionHeader>Position</SectionHeader>
        <div className="grid grid-cols-[20px_1fr] gap-x-2 gap-y-1.5 items-center">
          <Label>X</Label>
          <NumInput value={kf.position.x} step={0.01} onChange={setPos('x')} />
          <Label>Y</Label>
          <NumInput value={kf.position.y} step={0.01} onChange={setPos('y')} />
          <Label>Z</Label>
          <NumInput value={kf.position.z} step={0.01} onChange={setPos('z')} />
        </div>
        <div className="grid grid-cols-[20px_1fr] gap-x-2 gap-y-0.5 items-center text-[--text-secondary]">
          <Label>Az</Label>
          <Readout>{`${sph.az >= 0 ? '+' : ''}${sph.az.toFixed(1)}°`}</Readout>
          <Label>El</Label>
          <Readout>{`${sph.el >= 0 ? '+' : ''}${sph.el.toFixed(1)}°`}</Readout>
          <Label>R</Label>
          <Readout>{sph.r.toFixed(2)}</Readout>
        </div>
      </section>

      <section className="space-y-2">
        <SectionHeader>Motion</SectionHeader>
        <Field label="Curve">
          <div className="flex gap-1">
            {CURVES.map((c) => (
              <Chip
                key={c.id}
                active={kf.curve === c.id}
                onClick={() => updateKeyframe(kf.id, { curve: c.id })}
              >
                {c.label}
              </Chip>
            ))}
          </div>
        </Field>
        <Field label="Time">
          <NumInput
            value={kf.time}
            step={0.01}
            onChange={(v) => updateKeyframe(kf.id, { time: Math.max(0, v) })}
          />
        </Field>
        <Field label="Tension">
          <NumInput
            value={kf.tension ?? 0.5}
            step={0.05}
            onChange={(v) => updateKeyframe(kf.id, { tension: Math.max(0, Math.min(1, v)) })}
          />
        </Field>
      </section>

      <section className="space-y-2">
        <SectionHeader>Gain &amp; Fades</SectionHeader>
        <Field label="Vol">
          <NumInput
            value={kf.gainDb ?? 0}
            step={0.5}
            onChange={(v) => updateKeyframe(kf.id, { gainDb: Math.max(-24, Math.min(6, v)) })}
            suffix="dB"
          />
        </Field>
        <Field label="HPF" stub>
          <NumInput
            value={kf.hpfHz ?? 20}
            step={1}
            onChange={(v) => updateKeyframe(kf.id, { hpfHz: Math.max(20, Math.min(2000, v)) })}
            suffix="Hz"
          />
        </Field>
        <Field label="LPF" stub>
          <NumInput
            value={kf.lpfHz ?? 20000}
            step={50}
            onChange={(v) => updateKeyframe(kf.id, { lpfHz: Math.max(200, Math.min(20000, v)) })}
            suffix="Hz"
          />
        </Field>
        <Field label="Snap">
          <Toggle
            checked={kf.snap ?? false}
            onChange={(v) => updateKeyframe(kf.id, { snap: v })}
          />
        </Field>
      </section>

      <section className="space-y-2">
        <SectionHeader>Dopp</SectionHeader>
        <Field label="Speed">
          <Readout>{`${speed.toFixed(2)} u/s`}</Readout>
        </Field>
        <Field label="Doppler" stub>
          <Toggle
            checked={kf.doppler ?? false}
            onChange={(v) => updateKeyframe(kf.id, { doppler: v })}
          />
        </Field>
        <Field label="Velocity" stub>
          <Toggle
            checked={kf.velocity ?? false}
            onChange={(v) => updateKeyframe(kf.id, { velocity: v })}
          />
        </Field>
        <Field label="Intensity" stub>
          <NumInput
            value={kf.dopplerIntensity ?? 0.5}
            step={0.05}
            onChange={(v) =>
              updateKeyframe(kf.id, { dopplerIntensity: Math.max(0, Math.min(1, v)) })
            }
          />
        </Field>
      </section>

      <button
        type="button"
        onClick={() => removeKeyframe(kf.id)}
        className="mt-2 flex items-center gap-1.5 self-start text-[12px] text-[--vu-red] hover:text-white hover:bg-[--vu-red] px-2 py-1 rounded-md border border-[--border-strong] hover:border-[--vu-red] transition-colors"
      >
        <Trash2 size={12} strokeWidth={1.75} />
        Delete keyframe
      </button>
    </div>
  );
}

interface FieldProps {
  label: string;
  stub?: boolean;
  children: React.ReactNode;
}

function Field({ label, stub, children }: FieldProps) {
  return (
    <div className="grid grid-cols-[60px_1fr] gap-2 items-center">
      <Label stub={stub}>{label}</Label>
      <div>{children}</div>
    </div>
  );
}

function Label({ children, stub }: { children: React.ReactNode; stub?: boolean }) {
  return (
    <span
      className="text-[11px] text-[--text-secondary]"
      title={stub ? 'v1 stub : valeur stockée mais non câblée à l’audio' : undefined}
    >
      {children}
      {stub && <span className="text-[--text-dim]"> *</span>}
    </span>
  );
}

function Readout({ children }: { children: React.ReactNode }) {
  return (
    <span className="font-mono text-[12px] text-[--text-secondary] tabular-nums">{children}</span>
  );
}

interface NumInputProps {
  value: number;
  step?: number;
  onChange: (v: number) => void;
  suffix?: string;
}

function NumInput({ value, step = 0.01, onChange, suffix }: NumInputProps) {
  return (
    <div className="relative">
      <input
        type="number"
        value={Number.isFinite(value) ? value : 0}
        step={step}
        onChange={(e) => {
          const n = parseFloat(e.currentTarget.value);
          if (Number.isFinite(n)) onChange(n);
        }}
        className="bg-[--bg-input] text-[12px] font-mono tabular-nums px-2 py-1 rounded-md border border-transparent focus:border-[--accent] focus:outline-none w-full"
      />
      {suffix && (
        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-[--text-dim] pointer-events-none">
          {suffix}
        </span>
      )}
    </div>
  );
}

interface ToggleProps {
  checked: boolean;
  onChange: (v: boolean) => void;
}

function Toggle({ checked, onChange }: ToggleProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-3 w-6 rounded-full transition-colors ${
        checked ? 'bg-[--accent]' : 'bg-[--bg-input]'
      }`}
    >
      <span
        className={`absolute top-0.5 h-2 w-2 rounded-full bg-white transition-transform ${
          checked ? 'translate-x-3.5' : 'translate-x-0.5'
        }`}
      />
    </button>
  );
}

interface ChipProps {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}

function Chip({ active, onClick, children }: ChipProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex-1 px-2 py-1 text-[11px] rounded-md transition-colors ${
        active
          ? 'bg-[--accent-soft] border border-[--accent] text-[--accent]'
          : 'border border-[--border-strong] text-[--text-secondary] hover:text-[--text-primary]'
      }`}
    >
      {children}
    </button>
  );
}

interface PaginatorProps {
  index: number;
  total: number;
  onPrev: (() => void) | null;
  onNext: (() => void) | null;
}

function Paginator({ index, total, onPrev, onNext }: PaginatorProps) {
  return (
    <div className="flex items-center gap-1 text-[11px] font-mono tabular-nums text-[--accent]">
      <button
        type="button"
        onClick={onPrev ?? undefined}
        disabled={!onPrev}
        className="hover:text-[--accent-hot] disabled:opacity-30"
        aria-label="Previous keyframe"
      >
        <ChevronLeft size={12} />
      </button>
      <span>
        {index + 1} of {total}
      </span>
      <button
        type="button"
        onClick={onNext ?? undefined}
        disabled={!onNext}
        className="hover:text-[--accent-hot] disabled:opacity-30"
        aria-label="Next keyframe"
      >
        <ChevronRight size={12} />
      </button>
    </div>
  );
}
