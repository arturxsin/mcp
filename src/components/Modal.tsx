import { useEffect, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

interface Props {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  children: ReactNode;
  width?: number;
}

export function Modal({ open, onClose, title, children, width = 560 }: Props) {
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;
  return createPortal(
    <div className="fixed inset-0 z-40 flex items-start justify-center pt-20 px-4 bg-ink-900/30 backdrop-blur-[2px]" onMouseDown={onClose}>
      <div
        style={{ width }}
        className="bg-white rounded-xl shadow-xl border border-ink-200 max-w-[calc(100vw-2rem)] max-h-[calc(100vh-6rem)] flex flex-col"
        onMouseDown={(e) => e.stopPropagation()}
      >
        {title && (
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-ink-200">
            <div className="text-[15px] font-medium text-ink-900">{title}</div>
            <button
              type="button"
              onClick={onClose}
              className="text-ink-400 hover:text-ink-700 transition-colors p-1 -m-1 rounded-md hover:bg-ink-100"
              aria-label="Закрыть"
            >
              <X size={18} />
            </button>
          </div>
        )}
        <div className="overflow-y-auto">{children}</div>
      </div>
    </div>,
    document.body,
  );
}
