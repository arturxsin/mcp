import { useState } from 'react';
import { ChevronDown, Plus, Trash2, Check } from 'lucide-react';
import { Popover } from './Popover';
import { createBoard, deleteBoard, setCurrentBoard } from '../db';
import type { Board } from '../types';

interface Props {
  boards: Board[];
  currentBoardId: string;
  onSwitch: (id: string) => void;
}

export function BoardSwitcher({ boards, currentBoardId, onSwitch }: Props) {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');

  const current = boards.find((b) => b.id === currentBoardId);

  async function create() {
    const n = name.trim();
    if (!n) return;
    const id = await createBoard(n);
    await setCurrentBoard(id);
    onSwitch(id);
    setName('');
    setCreating(false);
    setOpen(false);
  }

  return (
    <>
      <button
        ref={setAnchor}
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md hover:bg-ink-100 transition-colors text-[15px] font-medium text-ink-900"
      >
        <span className="max-w-[200px] truncate">{current?.name ?? 'Доска'}</span>
        <ChevronDown size={14} className="text-ink-400" />
      </button>
      <Popover anchor={anchor} open={open} onClose={() => setOpen(false)} width={260}>
        <div className="px-2 py-1.5 text-[11px] uppercase tracking-wider text-ink-400 font-medium">
          Списки
        </div>
        {boards.map((b) => (
          <div key={b.id} className="group flex items-center">
            <button
              type="button"
              onClick={async () => {
                await setCurrentBoard(b.id);
                onSwitch(b.id);
                setOpen(false);
              }}
              className="flex-1 flex items-center justify-between px-2 py-1.5 hover:bg-ink-100 rounded-md text-left transition-colors text-sm"
            >
              <span className="truncate">{b.name}</span>
              {b.id === currentBoardId && <Check size={14} className="text-ink-700 shrink-0" />}
            </button>
            {boards.length > 1 && (
              <button
                type="button"
                onClick={async () => {
                  if (
                    confirm(
                      `Удалить список «${b.name}»? Все клиенты, статусы и поля этого списка будут удалены.`,
                    )
                  ) {
                    await deleteBoard(b.id);
                    if (b.id === currentBoardId) {
                      const next = boards.find((x) => x.id !== b.id);
                      if (next) {
                        await setCurrentBoard(next.id);
                        onSwitch(next.id);
                      }
                    }
                  }
                }}
                className="opacity-0 group-hover:opacity-100 p-1.5 text-ink-400 hover:text-red-500 transition-all"
                aria-label="Удалить список"
              >
                <Trash2 size={12} />
              </button>
            )}
          </div>
        ))}
        <div className="border-t border-ink-200 mt-1 pt-1">
          {creating ? (
            <div className="px-2 py-1.5 flex items-center gap-1.5">
              <input
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') create();
                  else if (e.key === 'Escape') {
                    setCreating(false);
                    setName('');
                  }
                }}
                placeholder="Название списка"
                className="flex-1 min-w-0 px-2 py-1 text-sm border border-ink-300 rounded-md"
              />
              <button
                type="button"
                onClick={create}
                disabled={!name.trim()}
                className="px-2 py-1 text-xs font-medium bg-ink-900 text-white rounded-md hover:bg-ink-700 disabled:opacity-40"
              >
                Создать
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setCreating(true)}
              className="w-full flex items-center gap-1.5 px-2 py-1.5 hover:bg-ink-100 rounded-md text-left text-xs text-ink-600 transition-colors"
            >
              <Plus size={12} /> Новый список
            </button>
          )}
        </div>
      </Popover>
    </>
  );
}
