// src/components/ui/bbcode-renderer.tsx
import React, { useState } from 'react';
import { BBCODE_CONFIG, BbcodeTag } from '@/config/bbcode.config';

// ── Tokenizer ──────────────────────────────────────────────────────────────

type Token =
  | { type: 'text'; value: string }
  | { type: 'open'; tag: string; attr?: string }
  | { type: 'close'; tag: string };

function tokenize(input: string): Token[] {
  const tokens: Token[] = [];
  const regex = /\[(\/?[a-z]+)(?:=([^\]]{0,200}))?\]/gi;
  let last = 0;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(input)) !== null) {
    if (match.index > last) {
      tokens.push({ type: 'text', value: input.slice(last, match.index) });
    }
    const raw = match[1];
    if (raw.startsWith('/')) {
      tokens.push({ type: 'close', tag: raw.slice(1).toLowerCase() });
    } else {
      tokens.push({ type: 'open', tag: raw.toLowerCase(), attr: match[2] });
    }
    last = match.index + match[0].length;
  }
  if (last < input.length) {
    tokens.push({ type: 'text', value: input.slice(last) });
  }
  return tokens;
}

// ── Spoiler component (needs useState) ───────────────────────────────────

function SpoilerSpan({ children }: { children: React.ReactNode }) {
  const [revealed, setRevealed] = useState(false);
  return (
    <span
      data-spoiler
      data-revealed={String(revealed)}
      onClick={() => setRevealed(r => !r)}
      style={{
        background: revealed ? 'transparent' : 'currentColor',
        color: revealed ? 'inherit' : 'transparent',
        borderRadius: '3px',
        cursor: 'pointer',
        userSelect: 'none',
        padding: '0 2px',
      }}
    >
      {children}
    </span>
  );
}

// ── Tag → config key mapping ──────────────────────────────────────────────

const TAG_CONFIG_KEY: Record<string, BbcodeTag> = {
  b:       'bold',
  i:       'italic',
  u:       'underline',
  s:       'strikethrough',
  url:     'url',
  quote:   'quote',
  code:    'code',
  spoiler: 'spoiler',
};

// ── Tag wrappers ──────────────────────────────────────────────────────────

type Wrapper = (children: React.ReactNode, attr?: string) => React.ReactNode;

const TAG_WRAPPERS: Record<string, Wrapper> = {
  b:       ch => <strong>{ch}</strong>,
  i:       ch => <em>{ch}</em>,
  u:       ch => <u>{ch}</u>,
  s:       ch => <s>{ch}</s>,
  quote:   ch => (
    <blockquote className="border-l-4 border-orange-500 pl-3 text-muted-foreground italic my-2">
      {ch}
    </blockquote>
  ),
  code:    ch => (
    <code className="font-mono bg-muted px-1 py-0.5 rounded text-sm block my-1 p-2 whitespace-pre-wrap">
      {ch}
    </code>
  ),
  spoiler: ch => <SpoilerSpan>{ch}</SpoilerSpan>,
  url:     (ch, attr) =>
    attr ? (
      <a href={attr} rel="noopener noreferrer" target="_blank" className="text-blue-400 underline">
        {ch}
      </a>
    ) : <>{ch}</>,
};

// ── Recursive renderer ────────────────────────────────────────────────────

function renderTokens(
  tokens: Token[],
  pos: number,
  stopTag?: string
): [React.ReactNode[], number] {
  const nodes: React.ReactNode[] = [];
  let i = pos;

  while (i < tokens.length) {
    const token = tokens[i];

    if (token.type === 'close') {
      if (stopTag && token.tag === stopTag) {
        return [nodes, i + 1]; // consumed the closing tag
      }
      // Unmatched close — emit as literal text
      nodes.push(`[/${token.tag}]`);
      i++;
      continue;
    }

    if (token.type === 'open') {
      const configKey = TAG_CONFIG_KEY[token.tag];
      const enabled = configKey !== undefined && BBCODE_CONFIG[configKey];

      if (enabled && TAG_WRAPPERS[token.tag]) {
        const [children, nextPos] = renderTokens(tokens, i + 1, token.tag);
        nodes.push(TAG_WRAPPERS[token.tag](children, token.attr));
        i = nextPos;
      } else {
        // Disabled/unknown — emit as plain text, still recurse to consume the close tag
        const openText = token.attr
          ? `[${token.tag}=${token.attr}]`
          : `[${token.tag}]`;
        const [innerNodes, nextPos] = renderTokens(tokens, i + 1, token.tag);
        nodes.push(openText);
        nodes.push(...innerNodes);
        nodes.push(`[/${token.tag}]`);
        i = nextPos;
      }
      continue;
    }

    // text token — React renders strings as text nodes (XSS-safe, no dangerouslySetInnerHTML)
    nodes.push(token.value);
    i++;
  }

  return [nodes, i];
}

// ── Public component ──────────────────────────────────────────────────────

interface BbcodeRendererProps {
  content: string;
  className?: string;
}

export function BbcodeRenderer({ content, className }: BbcodeRendererProps) {
  const tokens = tokenize(content);
  const [nodes] = renderTokens(tokens, 0);
  return (
    <span className={className}>
      {nodes.map((node, i) => (
        <React.Fragment key={i}>{node}</React.Fragment>
      ))}
    </span>
  );
}
