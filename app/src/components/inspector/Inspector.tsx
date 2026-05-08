import { useState } from 'react';
import { ChevronLeft, ChevronRight, Diamond, RotateCcw, Trash2 } from 'lucide-react';
import type { CurveType, SpatialKeyframe } from '@/types/project';
import { useProjectStore } from '@/store/project-store';
import { cartesianToSpherical, sphericalToCartesian } from '@/lib/math3d';

const CURVES: { id: CurveType; label: string }[] = [
  { id: 'hold', label: 'hold' },
  { id: 'linear', label: 'linear' },
  { id: 'ease-out', label: 'ease-out' },
  { id: 'cubic', label: 'cubic' },
];

function formatTime(sec: number): string {
  if (!isFinite(sec) || sec < 0) sec = 0;
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  const ms = Math.floor((sec % 1) * 1000)
    .toString()
    .padStart(3, '0');
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}.${ms}`;
}

function formatHz(hz: number | null): string {
  if (hz === null) return 'bypass';
  return hz >= 1000 ? `${(hz / 1000).toFixed(1)} kHz` : `${Math.round(hz)} Hz`;
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

function SectionHeader({
  children,
  trailing,
}: {
  children: React.ReactNode;
  trailing?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between">
      <h3 className="text-[10px] tracking-widest uppercase text-[--text-dim]">{children}</h3>
      {trailing}
    </div>
  );
}

function ProjectPanel({
  project,
}: {
  project: NonNullable<ReturnType<typeof useProjectStore.getState>['project']>;
}) {
  const updateSettings = useProjectStore((s) => s.updateSettings);
  const s = project.settings;
  return (
    <div className="space-y-4">
      <SectionHeader>Project</SectionHeader>
      <Field label="Panning">
        <div className="flex gap-1">
          {(['HRTF', 'equalpower'] as const).map((m) => (
            <Chip key={m} active={s.panningModel === m} onClick={() => updateSettings({ panningModel: m })}>
              {m}
            </Chip>
          ))}
        </div>
      </Field>
      <Field label="Distance">
        <div className="flex gap-1">
          {(['linear', 'inverse', 'exponential'] as const).map((m) => (
            <Chip key={m} active={s.distanceModel === m} onClick={() => updateSettings({ distanceModel: m })}>
              {m}
            </Chip>
          ))}
        </div>
      </Field>
      <Field label="Ref dist.">
        <NumInput value={s.refDistance} step={0.1} onChange={(v) => updateSettings({ refDistance: v })} />
      </Field>
      <Field label="Rolloff">
        <NumInput value={s.rolloffFactor} step={0.1} onChange={(v) => updateSettings({ rolloffFactor: v })} />
      </Field>
      <Field label="Reverb">
        <Toggle checked={s.reverb.enabled} onChange={(v) => updateSettings({ reverb: { ...s.reverb, enabled: v } })} />
      </Field>
      <Field label="Wet">
        <NumInput
          value={s.reverb.wet}
          step={0.05}
          onChange={(v) => updateSettings({ reverb: { ...s.reverb, wet: Math.max(0, Math.min(1, v)) } })}
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

  const [posMode, setPosMode] = useState<'cart' | 'polar'>('cart');
  const sph = cartesianToSpherical(kf.position);
  const next = allKeyframes[index + 1];
  const dur = next ? next.time - kf.time : null;

  return (
    <div className="space-y-5">
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Diamond size={10} className="text-[--accent]" fill="currentColor" />
            <span className="text-[13px] text-[--text-primary] font-medium">
              k{(index + 1).toString().padStart(2, '0')}
            </span>
            <input
              type="text"
              value={kf.label ?? ''}
              placeholder="label"
              onChange={(e) => updateKeyframe(kf.id, { label: e.currentTarget.value })}
              className="bg-transparent text-[12px] text-[--text-secondary] focus:text-[--text-primary] outline-none w-24"
            />
          </div>
          <Paginator
            index={index}
            total={total}
            onPrev={prevId ? () => selectKeyframe(prevId) : null}
            onNext={nextId ? () => selectKeyframe(nextId) : null}
          />
        </div>
        <div className="font-mono text-[12px] text-[--text-secondary] tabular-nums">{formatTime(kf.time)}</div>
      </div>

      <section className="space-y-2">
        <SectionHeader
          trailing={
            <div className="flex gap-0.5">
              {(['cart', 'polar'] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setPosMode(m)}
                  className={`text-[10px] px-1.5 py-0.5 rounded ${
                    posMode === m
                      ? 'text-[--accent] bg-[--accent-soft]'
                      : 'text-[--text-dim] hover:text-[--text-secondary]'
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>
          }
        >
          Position
        </SectionHeader>
        {posMode === 'cart' ? (
          <div className="grid grid-cols-[20px_1fr] gap-x-2 gap-y-1.5 items-center">
            <Label>X</Label>
            <NumInput
              value={kf.position.x}
              step={0.01}
              onChange={(v) => updateKeyframe(kf.id, { position: { ...kf.position, x: v } })}
            />
            <Label>Y</Label>
            <NumInput
              value={kf.position.y}
              step={0.01}
              onChange={(v) => updateKeyframe(kf.id, { position: { ...kf.position, y: v } })}
            />
            <Label>Z</Label>
            <NumInput
              value={kf.position.z}
              step={0.01}
              onChange={(v) => updateKeyframe(kf.id, { position: { ...kf.position, z: v } })}
            />
          </div>
        ) : (
          <div className="grid grid-cols-[28px_1fr] gap-x-2 gap-y-1.5 items-center">
            <Label>Az</Label>
            <NumInput
              value={sph.az}
              step={1}
              suffix="°"
              onChange={(v) => updateKeyframe(kf.id, { position: sphericalToCartesian({ ...sph, az: v }) })}
            />
            <Label>El</Label>
            <NumInput
              value={sph.el}
              step={1}
              suffix="°"
              onChange={(v) =>
                updateKeyframe(kf.id, {
                  position: sphericalToCartesian({ ...sph, el: Math.max(-90, Math.min(90, v)) }),
                })
              }
            />
            <Label>R</Label>
            <NumInput
              value={sph.r}
              step={0.05}
              onChange={(v) =>
                updateKeyframe(kf.id, { position: sphericalToCartesian({ ...sph, r: Math.max(0, v) }) })
              }
            />
          </div>
        )}
      </section>

      <section className="space-y-2">
        <SectionHeader>Motion</SectionHeader>
        <Field label="Curve">
          <div className="flex gap-1">
            {CURVES.map((c) => (
              <Chip key={c.id} active={kf.curve === c.id} onClick={() => updateKeyframe(kf.id, { curve: c.id })}>
                {c.label}
              </Chip>
            ))}
          </div>
        </Field>
        <Field label="Time">
          <NumInput
            value={kf.time}
            step={0.01}
            suffix="s"
            onChange={(v) => updateKeyframe(kf.id, { time: Math.max(0, v) })}
          />
        </Field>
        <Field label="Duration">
          <Readout>{dur !== null ? `+${dur.toFixed(3)} s → k${(index + 2).toString().padStart(2, '0')}` : '— (last)'}</Readout>
        </Field>
        <Field label="Tension">
          <NumInput
            value={kf.tension}
            step={0.05}
            disabled={kf.curve !== 'cubic'}
            onChange={(v) => updateKeyframe(kf.id, { tension: Math.max(0, Math.min(1, v)) })}
          />
        </Field>
      </section>

      <section className="space-y-2">
        <SectionHeader>Gain &amp; Filter</SectionHeader>
        <Field label="Gain">
          <NumInput
            value={kf.gain}
            step={0.5}
            suffix="dB"
            onChange={(v) => updateKeyframe(kf.id, { gain: Math.max(-60, Math.min(12, v)) })}
          />
        </Field>
        <FilterField
          label="LPF"
          value={kf.lpf}
          step={50}
          fallback={22000}
          onChange={(v) => updateKeyframe(kf.id, { lpf: v })}
        />
        <FilterField
          label="HPF"
          value={kf.hpf}
          step={5}
          fallback={120}
          onChange={(v) => updateKeyframe(kf.id, { hpf: v })}
        />
        <Field label="Doppler">
          <Toggle checked={kf.doppler} onChange={(v) => updateKeyframe(kf.id, { doppler: v })} />
        </Field>
      </section>

      <section className="space-y-2">
        <SectionHeader>Send</SectionHeader>
        <Field label="Reverb">
          <div className="flex items-center gap-2">
            <NumInput
              value={kf.reverbSend === null ? 0 : Math.round(kf.reverbSend * 100)}
              step={1}
              suffix="%"
              onChange={(v) =>
                updateKeyframe(kf.id, { reverbSend: Math.max(0, Math.min(100, v)) / 100 })
              }
            />
            <button
              type="button"
              onClick={() => updateKeyframe(kf.id, { reverbSend: null })}
              title="Use project setting"
              className={`text-[10px] uppercase tracking-widest px-1.5 py-0.5 rounded ${
                kf.reverbSend === null
                  ? 'text-[--accent] bg-[--accent-soft]'
                  : 'text-[--text-dim] hover:text-[--text-secondary]'
              }`}
            >
              <RotateCcw size={10} className="inline mr-1" />
              auto
            </button>
          </div>
        </Field>
        <Field label="Air abs.">
          <NumInput
            value={kf.airAbsorption}
            step={0.01}
            onChange={(v) => updateKeyframe(kf.id, { airAbsorption: Math.max(0, Math.min(1, v)) })}
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

interface FilterFieldProps {
  label: string;
  value: number | null;
  step: number;
  fallback: number;
  onChange: (v: number | null) => void;
}

function FilterField({ label, value, step, fallback, onChange }: FilterFieldProps) {
  const enabled = value !== null;
  return (
    <Field label={label}>
      <div className="flex items-center gap-2">
        <Toggle checked={enabled} onChange={(on) => onChange(on ? fallback : null)} />
        {enabled ? (
          <NumInput
            value={value as number}
            step={step}
            suffix="Hz"
            onChange={(v) => onChange(Math.max(20, Math.min(22050, v)))}
          />
        ) : (
          <Readout>{formatHz(value)}</Readout>
        )}
      </div>
    </Field>
  );
}

interface FieldProps {
  label: string;
  children: React.ReactNode;
}

function Field({ label, children }: FieldProps) {
  return (
    <div className="grid grid-cols-[60px_1fr] gap-2 items-center">
      <Label>{label}</Label>
      <div>{children}</div>
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return <span className="text-[11px] text-[--text-secondary]">{children}</span>;
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
  disabled?: boolean;
}

function NumInput({ value, step = 0.01, onChange, suffix, disabled }: NumInputProps) {
  return (
    <div className="relative">
      <input
        type="number"
        value={Number.isFinite(value) ? value : 0}
        step={step}
        disabled={disabled}
        onChange={(e) => {
          const n = parseFloat(e.currentTarget.value);
          if (Number.isFinite(n)) onChange(n);
        }}
        className="bg-[--bg-input] text-[12px] font-mono tabular-nums px-2 py-1 rounded-md border border-transparent focus:border-[--accent] focus:outline-none w-full disabled:opacity-40"
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
