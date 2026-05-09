import { useEffect } from 'react';
import { AlertCircle, CheckCircle, Info, X } from 'lucide-react';
import { useProjectStore } from '@/store/project-store';

export function Toast() {
  const toast = useProjectStore((s) => s.toast);
  const dismissToast = useProjectStore((s) => s.dismissToast);

  useEffect(() => {
    if (!toast) return;
    const timeout = window.setTimeout(() => dismissToast(), toast.kind === 'error' ? 8000 : 4000);
    return () => window.clearTimeout(timeout);
  }, [toast, dismissToast]);

  if (!toast) return null;

  const Icon = toast.kind === 'error' ? AlertCircle : toast.kind === 'success' ? CheckCircle : Info;
  const color =
    toast.kind === 'error'
      ? '#E0533C'
      : toast.kind === 'success'
        ? '#22A858'
        : '#F87328';

  return (
    <div className="fixed bottom-8 right-4 z-50 max-w-md">
      <div
        className="flex items-start gap-2 px-3 py-2 rounded-md bg-[var(--bg-panel-elev)] border shadow-xl text-[12px]"
        style={{ borderColor: color }}
      >
        <Icon size={14} style={{ color, flexShrink: 0, marginTop: 2 }} />
        <div className="flex-1 text-[var(--text-primary)] whitespace-pre-line">{toast.message}</div>
        <button
          type="button"
          onClick={dismissToast}
          className="text-[var(--text-dim)] hover:text-[var(--text-primary)] flex-shrink-0"
          aria-label="Dismiss"
        >
          <X size={12} />
        </button>
      </div>
    </div>
  );
}
