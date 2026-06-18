import { useRef } from 'react';

interface Props {
  /** Called with the new pixel width during drag (for live preview). */
  onDrag: (width: number) => void;
  /** Called once with the final pixel width when the user releases. */
  onCommit: (width: number) => void;
  /** Called on double-click to auto-fit the column to its widest content. */
  onAutoFit: () => void;
  /** Minimum allowed width in pixels. */
  min?: number;
  /** Maximum allowed width in pixels. */
  max?: number;
}

export function ColumnResizer({ onDrag, onCommit, onAutoFit, min = 60, max = 720 }: Props) {
  const start = useRef({ x: 0, w: 0 });

  function onMouseDown(e: React.MouseEvent<HTMLDivElement>) {
    e.preventDefault();
    e.stopPropagation();
    const th = e.currentTarget.closest('th') as HTMLElement | null;
    if (!th) return;
    start.current = { x: e.clientX, w: th.offsetWidth };
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';

    let last = start.current.w;
    const move = (ev: MouseEvent) => {
      const delta = ev.clientX - start.current.x;
      last = Math.max(min, Math.min(max, start.current.w + delta));
      onDrag(last);
    };
    const up = () => {
      window.removeEventListener('mousemove', move);
      window.removeEventListener('mouseup', up);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      onCommit(last);
    };
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
  }

  return (
    <div
      onMouseDown={onMouseDown}
      onDoubleClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onAutoFit();
      }}
      title="Тянуть для изменения ширины. Двойной клик — авто-ширина."
      className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize z-[6] group/resizer"
    >
      <div className="absolute right-0 top-0 bottom-0 w-px bg-transparent group-hover/resizer:bg-ink-400 group-active/resizer:bg-ink-700 transition-colors" />
    </div>
  );
}
