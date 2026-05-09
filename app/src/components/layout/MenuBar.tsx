import { useEffect, useMemo, useRef, useState } from 'react';
import { useProjectStore } from '@/store/project-store';

type Item =
  | {
      kind: 'item';
      label: string;
      accel?: string;
      disabled?: boolean;
      onClick: () => void;
      check?: 'check' | 'radio';
      checked?: boolean;
    }
  | { kind: 'separator' }
  | { kind: 'submenu'; label: string; items: Item[] };

type Menu = { label: string; items: Item[] };

export function MenuBar() {
  const project = useProjectStore((s) => s.project);
  const audioBuffer = useProjectStore((s) => s.audioBuffer);
  const selectedKeyframeId = useProjectStore((s) => s.selectedKeyframeId);
  const viewMode = useProjectStore((s) => s.viewMode);
  const orbitEnabled = useProjectStore((s) => s.orbitEnabled);
  const loopEnabled = useProjectStore((s) => s.loopEnabled);
  const monitoring = useProjectStore((s) => s.monitoring);

  const loadAudioFromDialog = useProjectStore((s) => s.loadAudioFromDialog);
  const openAnyFromDialog = useProjectStore((s) => s.openAnyFromDialog);
  const saveCurrentProject = useProjectStore((s) => s.saveCurrentProject);
  const saveCurrentProjectAs = useProjectStore((s) => s.saveCurrentProjectAs);
  const setRenderModalOpen = useProjectStore((s) => s.setRenderModalOpen);
  const removeKeyframe = useProjectStore((s) => s.removeKeyframe);
  const selectKeyframe = useProjectStore((s) => s.selectKeyframe);
  const insertKeyframeAtCurrent = useProjectStore((s) => s.insertKeyframeAtCurrent);
  const setViewMode = useProjectStore((s) => s.setViewMode);
  const setOrbitEnabled = useProjectStore((s) => s.setOrbitEnabled);
  const setLoopEnabled = useProjectStore((s) => s.setLoopEnabled);
  const setMonitoring = useProjectStore((s) => s.setMonitoring);
  const setShortcutsOpen = useProjectStore((s) => s.setShortcutsOpen);
  const undo = useProjectStore((s) => s.undo);
  const redo = useProjectStore((s) => s.redo);
  const canUndo = useProjectStore((s) => s.historyPast.length > 0);
  const canRedo = useProjectStore((s) => s.historyFuture.length > 0);

  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const rootRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (openIndex === null) return;
    const onDocMouseDown = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpenIndex(null);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpenIndex(null);
    };
    document.addEventListener('mousedown', onDocMouseDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocMouseDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [openIndex]);

  const close = () => setOpenIndex(null);
  const fire = (fn: () => unknown) => () => {
    close();
    void fn();
  };

  const menus: Menu[] = useMemo(() => {
    return [
      {
        label: 'File',
        items: [
          { kind: 'item', label: 'Open…', accel: '⌘O', onClick: fire(openAnyFromDialog) },
          { kind: 'item', label: 'Open audio…', accel: '⌘I', onClick: fire(loadAudioFromDialog) },
          { kind: 'separator' },
          { kind: 'item', label: 'Save', accel: '⌘S', disabled: !project, onClick: fire(saveCurrentProject) },
          { kind: 'item', label: 'Save as…', accel: '⇧⌘S', disabled: !project, onClick: fire(saveCurrentProjectAs) },
          { kind: 'separator' },
          { kind: 'item', label: 'Render…', accel: '⌘R', disabled: !audioBuffer, onClick: fire(() => setRenderModalOpen(true)) },
        ],
      },
      {
        label: 'Edit',
        items: [
          {
            kind: 'item',
            label: 'Undo',
            accel: '⌘Z',
            disabled: !canUndo,
            onClick: fire(undo),
          },
          {
            kind: 'item',
            label: 'Redo',
            accel: '⇧⌘Z',
            disabled: !canRedo,
            onClick: fire(redo),
          },
          { kind: 'separator' },
          {
            kind: 'item',
            label: 'Delete keyframe',
            accel: 'Del',
            disabled: !selectedKeyframeId,
            onClick: fire(() => {
              if (selectedKeyframeId) removeKeyframe(selectedKeyframeId);
            }),
          },
          {
            kind: 'item',
            label: 'Deselect',
            accel: 'Esc',
            disabled: !selectedKeyframeId,
            onClick: fire(() => selectKeyframe(null)),
          },
        ],
      },
      {
        label: 'Project',
        items: [
          {
            kind: 'item',
            label: 'Insert keyframe',
            accel: '⌘K',
            disabled: !audioBuffer,
            onClick: fire(insertKeyframeAtCurrent),
          },
        ],
      },
      {
        label: 'Render',
        items: [
          {
            kind: 'item',
            label: 'Render…',
            accel: '⌘R',
            disabled: !audioBuffer,
            onClick: fire(() => setRenderModalOpen(true)),
          },
        ],
      },
      {
        label: 'View',
        items: [
          {
            kind: 'submenu',
            label: 'View mode',
            items: [
              {
                kind: 'item',
                label: '2D',
                check: 'radio',
                checked: viewMode === '2d',
                onClick: fire(() => setViewMode('2d')),
              },
              {
                kind: 'item',
                label: '3D',
                check: 'radio',
                checked: viewMode === '3d',
                onClick: fire(() => setViewMode('3d')),
              },
            ],
          },
          { kind: 'separator' },
          {
            kind: 'item',
            label: 'Orbit',
            check: 'check',
            checked: orbitEnabled,
            disabled: viewMode !== '3d',
            onClick: fire(() => setOrbitEnabled(!orbitEnabled)),
          },
          {
            kind: 'item',
            label: 'Loop',
            check: 'check',
            checked: loopEnabled,
            onClick: fire(() => setLoopEnabled(!loopEnabled)),
          },
          { kind: 'separator' },
          {
            kind: 'submenu',
            label: 'Monitoring',
            items: [
              {
                kind: 'item',
                label: 'Binaural',
                check: 'radio',
                checked: monitoring === 'binaural',
                onClick: fire(() => setMonitoring('binaural')),
              },
              {
                kind: 'item',
                label: 'Stereo',
                check: 'radio',
                checked: monitoring === 'stereo',
                onClick: fire(() => setMonitoring('stereo')),
              },
            ],
          },
          { kind: 'separator' },
          {
            kind: 'item',
            label: 'Toggle BINAURAL / STEREO',
            accel: '⌘M',
            onClick: fire(() => setMonitoring(monitoring === 'binaural' ? 'stereo' : 'binaural')),
          },
        ],
      },
      {
        label: 'Help',
        items: [
          {
            kind: 'item',
            label: 'Keyboard shortcuts',
            onClick: fire(() => setShortcutsOpen(true)),
          },
        ],
      },
    ];
  }, [
    project,
    audioBuffer,
    selectedKeyframeId,
    viewMode,
    orbitEnabled,
    loopEnabled,
    monitoring,
    loadAudioFromDialog,
    openAnyFromDialog,
    saveCurrentProject,
    saveCurrentProjectAs,
    setRenderModalOpen,
    removeKeyframe,
    selectKeyframe,
    insertKeyframeAtCurrent,
    setViewMode,
    setOrbitEnabled,
    setLoopEnabled,
    setMonitoring,
    setShortcutsOpen,
    undo,
    redo,
    canUndo,
    canRedo,
  ]);

  return (
    <nav ref={rootRef} className="flex items-center relative">
      {menus.map((menu, idx) => {
        const isOpen = openIndex === idx;
        return (
          <div key={menu.label} className="relative">
            <button
              type="button"
              onClick={() => setOpenIndex(isOpen ? null : idx)}
              onMouseEnter={() => {
                if (openIndex !== null && openIndex !== idx) setOpenIndex(idx);
              }}
              className={`text-[12px] px-2.5 py-1 rounded transition-colors ${
                isOpen
                  ? 'bg-[var(--bg-panel-elev)] text-[var(--text-primary)]'
                  : 'text-[var(--text-secondary)] hover:bg-[var(--bg-panel-elev)] hover:text-[var(--text-primary)]'
              }`}
            >
              {menu.label}
            </button>
            {isOpen && <DropdownPanel items={menu.items} />}
          </div>
        );
      })}
    </nav>
  );
}

function DropdownPanel({ items, nested = false }: { items: Item[]; nested?: boolean }) {
  const [nestedOpen, setNestedOpen] = useState<number | null>(null);
  const positionClasses = nested
    ? 'absolute left-full top-0 -mt-1 ml-0.5'
    : 'absolute top-full left-0 mt-1';
  return (
    <div
      className={`${positionClasses} bg-[var(--bg-panel-elev)] border border-[var(--border-strong)] rounded-md shadow-lg py-1 min-w-[220px] z-50`}
    >
      {items.map((item, i) => {
        if (item.kind === 'separator') {
          return <div key={`sep-${i}`} className="my-1 h-px bg-[var(--border-strong)]" />;
        }
        if (item.kind === 'submenu') {
          const open = nestedOpen === i;
          return (
            <div
              key={`sub-${i}`}
              className="relative"
              onMouseEnter={() => setNestedOpen(i)}
            >
              <div
                className={`flex items-center px-2 py-1 cursor-default ${
                  open ? 'bg-[var(--accent)] text-white' : 'text-[var(--text-primary)] hover:bg-[var(--accent)] hover:text-white'
                }`}
              >
                <span className="w-4 flex-shrink-0" />
                <span className="flex-1 text-[12px]">{item.label}</span>
                <span className="text-[11px] ml-2">›</span>
              </div>
              {open && <DropdownPanel items={item.items} nested />}
            </div>
          );
        }
        const disabled = item.disabled === true;
        return (
          <button
            key={`it-${i}`}
            type="button"
            disabled={disabled}
            onMouseEnter={() => setNestedOpen(null)}
            onClick={item.onClick}
            className={`w-full flex items-center px-2 py-1 text-left ${
              disabled
                ? 'opacity-40 cursor-not-allowed text-[var(--text-primary)]'
                : 'text-[var(--text-primary)] hover:bg-[var(--accent)] hover:text-white'
            }`}
          >
            <span className="w-4 flex-shrink-0 text-[11px]">
              {item.check && item.checked ? (item.check === 'radio' ? '•' : '✓') : ''}
            </span>
            <span className="flex-1 text-[12px]">{item.label}</span>
            {item.accel && (
              <span className="text-[10px] text-[var(--text-dim)] font-mono ml-3">{item.accel}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}
