import { useEffect, useRef, useState } from 'react';
import type { FieldType } from '../types';
import { formatPhone, inputTypeFor, looksLikeUrl, parseLinkValue, placeholderFor } from '../utils';

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

  // Link type: display as clickable anchor, editing done in ContactCard
  if (type === 'link') {
    const { url, label } = parseLinkValue(value);
    if (!url) {
      return (
        <div className={`min-h-[28px] px-2 py-1 text-sm text-ink-300 ${className ?? ''}`}>
          —
        </div>
      );
    }
    return (
      <div className={`min-h-[28px] px-2 py-1 text-sm ${className ?? ''}`}>
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="text-indigo-600 hover:text-indigo-800 hover:underline truncate block"
        >
          {label || url}
        </a>
      </div>
    );
  }

  if (!editing) {
    const raw = value || '';
    const display = type === 'phone' && raw ? formatPhone(raw) : raw;
    const isEmail = type === 'email' && value;
    const isPhone = type === 'phone' && value;
    const isAutoUrl = type === 'text' && looksLikeUrl(value);
    return (
      <div
        onClick={() => !isAutoUrl && setEditing(true)}
        className={`min-h-[28px] px-2 py-1 rounded text-sm truncate transition-colors ${isAutoUrl ? '' : 'cursor-text hover:bg-ink-100'} ${className ?? ''}`}
      >
        {display ? (
          isAutoUrl ? (
            <a
              href={value.trim()}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="text-indigo-600 hover:text-indigo-800 hover:underline"
            >
              {value}
            </a>
          ) : (
            <span className={isEmail || isPhone ? 'text-ink-700' : 'text-ink-900'}>{display}</span>
          )
        ) : (
          <span
            className="text-ink-300 cursor-text"
            onClick={() => setEditing(true)}
          >
            {placeholder ?? placeholderFor(type) ?? '—'}
          </span>
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
