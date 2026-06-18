import { useEffect, useRef, useState } from 'react';
import type { FieldType } from '../types';
import { inputTypeFor, placeholderFor } from '../utils';

interface Props {
  value: string;
  type: FieldType;
  onCommit: (v: string) => void;
  placeholder?: string;
  className?: string;
}

export function InlineCell({ value, type, onCommit, placeholder, className }: Props) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!editing) setDraft(value);
  }, [value, editing]);

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus();
      if (inputRef.current && 'select' in inputRef.current) {
        (inputRef.current as HTMLInputElement).select();
      }
    }
  }, [editing]);

  function commit() {
    if (draft !== value) onCommit(draft);
    setEditing(false);
  }

  if (!editing) {
    const display = value || '';
    const isEmail = type === 'email' && value;
    const isPhone = type === 'phone' && value;
    return (
      <div
        onClick={() => setEditing(true)}
        className={`min-h-[28px] px-2 py-1 rounded cursor-text text-sm truncate hover:bg-ink-100 transition-colors ${className ?? ''}`}
      >
        {display ? (
          <span className={isEmail || isPhone ? 'text-ink-700' : 'text-ink-900'}>{display}</span>
        ) : (
          <span className="text-ink-300">{placeholder ?? placeholderFor(type) ?? '—'}</span>
        )}
      </div>
    );
  }

  const sharedProps = {
    value: draft,
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setDraft(e.target.value),
    onBlur: commit,
    onKeyDown: (e: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !(e.shiftKey && type === 'note')) {
        e.preventDefault();
        commit();
      } else if (e.key === 'Escape') {
        setDraft(value);
        setEditing(false);
      }
    },
    placeholder: placeholder ?? placeholderFor(type),
    className: `w-full px-2 py-1 text-sm bg-white border border-ink-400 rounded outline-none ${className ?? ''}`,
  };

  if (type === 'note') {
    return (
      <textarea
        ref={inputRef as React.RefObject<HTMLTextAreaElement>}
        rows={1}
        {...sharedProps}
      />
    );
  }
  return (
    <input
      ref={inputRef as React.RefObject<HTMLInputElement>}
      type={inputTypeFor(type)}
      {...sharedProps}
    />
  );
}
