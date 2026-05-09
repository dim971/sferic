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


export function Inspector() {
  const project = useProjectStore((s) => s.project);
  const selectedId = useProjectStore((s) => s.selectedKeyframeId);

  if (!project) {
    return (
      <div className="h-full p-3 flex flex-col gap-2 items-center justify-center text-[var(--text-dim)] text-[12px]">
        <span className="text-[10px] tracking-widest uppercase">Inspector</span>
        <span>No project loaded</span>
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
      <h3 className="text-[10px] tracking-widest uppercase text-[var(--text-dim)]">{children}</h3>
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
    <div className="space-y-5">
      <p className="text-[11px] text-[var(--text-dim)] leading-snug -mt-2">
        No keyframe selected. Click in a scene or use{' '}
        <kbd className="font-mono text-[var(--text-secondary)]">⌘K</kbd> to insert one at the
        current time.
      </p>

      <section className="space-y-2">
        <SectionHeader>Routing</SectionHeader>
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
          <NumInput value={s.refDistance} step={0.1} onChange={(v) => updateSettings({ refDistance: v })} />
        </Field>
        <Field label="Rolloff">
          <NumInput value={s.rolloffFactor} step={0.1} onChange={(v) => updateSettings({ rolloffFactor: v })} />
        </Field>
      </section>

      <section className="space-y-2">
        <SectionHeader>Reverb</SectionHeader>
        <Field label="Enabled">
          <Toggle checked={s.reverb.enabled} onChange={(v) => updateSettings({ reverb: { ...s.reverb, enabled: v } })} />
        </Field>
        <Field label="Wet">
          <SliderInput
            value={s.reverb.wet}
            min={0}
            max={1}
            step={0.01}
            disabled={!s.reverb.enabled}
            onChange={(v) => updateSettings({ reverb: { ...s.reverb, wet: Math.max(0, Math.min(1, v)) } })}
          />
        </Field>
      </section>

      <section className="space-y-2">
        <SectionHeader>Spatial enhance</SectionHeader>
        <Field label="Enabled">
          <Toggle
            checked={s.spatialEnhancement.enabled}
            onChange={(v) =>
              updateSettings({ spatialEnhancement: { ...s.spatialEnhancement, enabled: v } })
            }
          />
        </Field>
        <Field label="Amount">
          <SliderInput
            value={s.spatialEnhancement.amount}
            min={0}
            max={1}
            step={0.01}
            disabled={!s.spatialEnhancement.enabled}
            onChange={(v) =>
              updateSettings({
                spatialEnhancement: {
                  ...s.spatialEnhancement,
                  amount: Math.max(0, Math.min(1, v)),
                },
              })
            }
          />
        </Field>
      </section>

      <section className="space-y-2">
        <SectionHeader>Defaults</SectionHeader>
        <Field label="Snap to ⊙">
          <Toggle checked={s.snapToSphere} onChange={(v) => updateSettings({ snapToSphere: v })} />
        </Field>
      </section>
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
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <span className="w-6 h-6 flex items-center justify-center rounded-md bg-[var(--accent-soft)]">
              <Diamond size={11} className="text-[var(--accent)]" fill="currentColor" />
            </span>
            <div className="flex flex-col">
              <span className="text-[13px] text-[var(--text-primary)] font-medium leading-tight">
                Keyframe {(index + 1).toString().padStart(2, '0')}
                {kf.label && (
                  <span className="ml-2 text-[var(--text-secondary)] font-normal">— {kf.label}</span>
                )}
              </span>
              <span className="font-mono text-[11px] text-[var(--text-dim)] tabular-nums leading-tight">
                {formatTime(kf.time)}
              </span>
            </div>
          </div>
          <Paginator
            index={index}
            total={total}
            onPrev={prevId ? () => selectKeyframe(prevId) : null}
            onNext={nextId ? () => selectKeyframe(nextId) : null}
          />
        </div>
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
                      ? 'text-[var(--accent)] bg-[var(--accent-soft)]'
                      : 'text-[var(--text-dim)] hover:text-[var(--text-secondary)]'
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
          <div className="grid grid-cols-[20px_1fr] gap-x-2 gap-y-1 items-center">
            <Label>X</Label>
            <NumInput
              value={kf.position.x}
              step={0.01}
              precision={3}
              onChange={(v) => updateKeyframe(kf.id, { position: { ...kf.position, x: v } })}
            />
            <Label>Y</Label>
            <NumInput
              value={kf.position.y}
              step={0.01}
              precision={3}
              onChange={(v) => updateKeyframe(kf.id, { position: { ...kf.position, y: v } })}
            />
            <Label>Z</Label>
            <NumInput
              value={kf.position.z}
              step={0.01}
              precision={3}
              onChange={(v) => updateKeyframe(kf.id, { position: { ...kf.position, z: v } })}
            />
            <Label>Az</Label>
            <Readout>{`${sph.az >= 0 ? '+' : ''}${sph.az.toFixed(1)}°`}</Readout>
            <Label>El</Label>
            <Readout>{`${sph.el >= 0 ? '+' : ''}${sph.el.toFixed(1)}°`}</Readout>
            <Label>Dist</Label>
            <Readout>{sph.r.toFixed(2)}</Readout>
          </div>
        ) : (
          <div className="grid grid-cols-[28px_1fr] gap-x-2 gap-y-1 items-center">
            <Label>Az</Label>
            <NumInput
              value={sph.az}
              step={1}
              precision={1}
              suffix="°"
              onChange={(v) => updateKeyframe(kf.id, { position: sphericalToCartesian({ ...sph, az: v }) })}
            />
            <Label>El</Label>
            <NumInput
              value={sph.el}
              step={1}
              precision={1}
              suffix="°"
              onChange={(v) =>
                updateKeyframe(kf.id, {
                  position: sphericalToCartesian({ ...sph, el: Math.max(-90, Math.min(90, v)) }),
                })
              }
            />
            <Label>Dist</Label>
            <NumInput
              value={sph.r}
              step={0.05}
              precision={2}
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
        <Field label="Duration">
          <Readout>
            {dur !== null
              ? `+${dur.toFixed(3)} s`
              : '— (last)'}
          </Readout>
        </Field>
        <Field label="Tension">
          <SliderInput
            value={kf.tension}
            min={0}
            max={1}
            step={0.01}
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
            precision={1}
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
                  ? 'text-[var(--accent)] bg-[var(--accent-soft)]'
                  : 'text-[var(--text-dim)] hover:text-[var(--text-secondary)]'
              }`}
            >
              <RotateCcw size={10} className="inline mr-1" />
              auto
            </button>
          </div>
        </Field>
        <Field label="Air absorb">
          <NumInput
            value={kf.airAbsorption}
            step={0.01}
            precision={2}
            onChange={(v) => updateKeyframe(kf.id, { airAbsorption: Math.max(0, Math.min(1, v)) })}
          />
        </Field>
      </section>

      <button
        type="button"
        onClick={() => removeKeyframe(kf.id)}
        className="mt-2 flex items-center gap-1.5 self-start text-[11px] text-[var(--text-dim)] hover:text-[var(--vu-red)] px-2 py-1 rounded-md transition-colors"
      >
        <Trash2 size={11} strokeWidth={1.75} />
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
      {enabled ? (
        <div className="flex items-center justify-end gap-2 group">
          <button
            type="button"
            onClick={() => onChange(null)}
            title="Bypass"
            className="text-[10px] text-[var(--text-dim)] hover:text-[var(--text-secondary)] uppercase tracking-widest opacity-0 group-hover:opacity-100"
          >
            bypass
          </button>
          <NumInput
            value={value as number}
            step={step}
            precision={value && value >= 1000 ? 1 : 0}
            suffix={value && value >= 1000 ? 'kHz' : 'Hz'}
            onChange={(v) => onChange(Math.max(20, Math.min(22050, v)))}
          />
        </div>
      ) : (
        <button
          type="button"
          onClick={() => onChange(fallback)}
          className="text-[12px] text-[var(--text-dim)] hover:text-[var(--text-primary)] w-full text-right pr-1.5"
        >
          bypass
        </button>
      )}
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
  return <span className="text-[11px] text-[var(--text-secondary)]">{children}</span>;
}

function Readout({ children }: { children: React.ReactNode }) {
  return (
    <span className="font-mono text-[12px] text-[var(--text-secondary)] tabular-nums">{children}</span>
  );
}

interface NumInputProps {
  value: number;
  step?: number;
  precision?: number;
  onChange: (v: number) => void;
  suffix?: string;
  disabled?: boolean;
}

function NumInput({ value, step = 0.01, precision = 2, onChange, suffix, disabled }: NumInputProps) {
  const safe = Number.isFinite(value) ? value : 0;
  const display = parseFloat(safe.toFixed(precision));
  return (
    <div className="flex items-center justify-end gap-1 group">
      <input
        type="number"
        value={display}
        step={step}
        disabled={disabled}
        onChange={(e) => {
          const n = parseFloat(e.currentTarget.value);
          if (Number.isFinite(n)) onChange(n);
        }}
        className="bg-transparent text-[12px] font-mono tabular-nums px-1.5 py-0.5 rounded outline-none w-full text-right text-[var(--text-primary)] hover:bg-[var(--bg-input)]/40 focus:bg-[var(--bg-input)] focus:outline focus:outline-1 focus:outline-[var(--accent)] disabled:opacity-40"
      />
      {suffix && (
        <span className="text-[10px] text-[var(--text-dim)] flex-shrink-0 select-none">
          {suffix}
        </span>
      )}
    </div>
  );
}

interface SliderInputProps {
  value: number;
  min?: number;
  max?: number;
  step?: number;
  onChange: (v: number) => void;
  disabled?: boolean;
}

function SliderInput({ value, min = 0, max = 1, step = 0.01, onChange, disabled }: SliderInputProps) {
  return (
    <div className="flex items-center gap-2">
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(parseFloat(e.currentTarget.value))}
        style={{ accentColor: '#F87328' }}
        className="flex-1 disabled:opacity-40"
      />
      <span className="font-mono text-[11px] text-[var(--text-secondary)] tabular-nums w-10 text-right">
        {value.toFixed(2)}
      </span>
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
        checked ? 'bg-[var(--accent)]' : 'bg-[var(--bg-input)]'
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
          ? 'bg-[var(--accent-soft)] border border-[var(--accent)] text-[var(--accent)]'
          : 'border border-[var(--border-strong)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
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
    <div className="flex items-center gap-1 text-[11px] font-mono tabular-nums text-[var(--accent)]">
      <button
        type="button"
        onClick={onPrev ?? undefined}
        disabled={!onPrev}
        className="hover:text-[var(--accent-hot)] disabled:opacity-30"
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
        className="hover:text-[var(--accent-hot)] disabled:opacity-30"
        aria-label="Next keyframe"
      >
        <ChevronRight size={12} />
      </button>
    </div>
  );
}
