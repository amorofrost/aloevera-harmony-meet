import React, { useEffect, useRef, useState } from 'react';
import { BBCODE_CONFIG, BbcodeTag } from '@/config/bbcode.config';

interface BbcodeToolbarProps {
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
}

interface Position {
  visible: boolean;
  top: number;
  left: number;
}

interface ButtonDef {
  tag: string;
  configKey: BbcodeTag;
  label: string;
  style?: React.CSSProperties;
}

const BUTTONS: ButtonDef[] = [
  { tag: 'b',       configKey: 'bold',          label: 'B',   style: { fontWeight: 'bold' } },
  { tag: 'i',       configKey: 'italic',        label: 'I',   style: { fontStyle: 'italic' } },
  { tag: 's',       configKey: 'strikethrough', label: 'S',   style: { textDecoration: 'line-through' } },
  { tag: 'u',       configKey: 'underline',     label: 'U',   style: { textDecoration: 'underline' } },
  { tag: 'quote',   configKey: 'quote',         label: '❝' },
  { tag: 'spoiler', configKey: 'spoiler',       label: '👁' },
  { tag: 'code',    configKey: 'code',          label: '</>' },
  { tag: 'url',     configKey: 'url',           label: '🔗' },
];

export function BbcodeToolbar({ textareaRef }: BbcodeToolbarProps) {
  const [pos, setPos] = useState<Position>({ visible: false, top: 0, left: 0 });

  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;

    function checkSelection() {
      const el = textareaRef.current;
      if (!el) return;
      if (el.selectionStart === el.selectionEnd) {
        setPos(p => ({ ...p, visible: false }));
        return;
      }
      const rect = el.getBoundingClientRect();
      setPos({ visible: true, top: rect.top - 44, left: rect.left });
    }

    ta.addEventListener('mouseup', checkSelection);
    ta.addEventListener('keyup', checkSelection);
    return () => {
      ta.removeEventListener('mouseup', checkSelection);
      ta.removeEventListener('keyup', checkSelection);
    };
  }, [textareaRef]);

  function wrapSelection(tag: string) {
    const ta = textareaRef.current;
    if (!ta) return;
    const { selectionStart: start, selectionEnd: end, value } = ta;
    if (start === end) return;
    const selected = value.slice(start, end);
    const wrapped = `[${tag}]${selected}[/${tag}]`;
    const next = value.slice(0, start) + wrapped + value.slice(end);

    // Trigger React's synthetic onChange via native value setter
    const setter = Object.getOwnPropertyDescriptor(
      window.HTMLTextAreaElement.prototype, 'value'
    )?.set;
    setter?.call(ta, next);
    ta.dispatchEvent(new Event('input', { bubbles: true }));
    ta.setSelectionRange(start, start + wrapped.length);
    setPos(p => ({ ...p, visible: false }));
  }

  const enabledButtons = BUTTONS.filter(b => BBCODE_CONFIG[b.configKey]);

  if (!pos.visible || enabledButtons.length === 0) return null;

  return (
    <div
      style={{
        position: 'fixed',
        top: pos.top,
        left: pos.left,
        zIndex: 50,
        display: 'flex',
        gap: '2px',
        background: 'hsl(var(--card))',
        border: '1px solid hsl(var(--border))',
        borderRadius: '6px',
        padding: '3px 6px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
      }}
    >
      {enabledButtons.map(b => (
        <button
          key={b.tag}
          type="button"
          title={b.configKey}
          style={b.style}
          onMouseDown={e => e.preventDefault()} // prevent textarea blur on click
          onClick={() => wrapSelection(b.tag)}
          className="px-2 py-0.5 text-sm rounded hover:bg-muted transition-colors text-foreground"
        >
          {b.label}
        </button>
      ))}
    </div>
  );
}
