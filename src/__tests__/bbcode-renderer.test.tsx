import { describe, it, expect } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import { BbcodeRenderer } from '@/components/ui/bbcode-renderer';

describe('BbcodeRenderer — enabled tags', () => {
  it('renders [b] as <strong>', () => {
    const { container } = render(<BbcodeRenderer content="[b]hello[/b]" />);
    const strong = container.querySelector('strong');
    expect(strong).not.toBeNull();
    expect(strong!.textContent).toBe('hello');
  });

  it('renders [i] as <em>', () => {
    const { container } = render(<BbcodeRenderer content="[i]world[/i]" />);
    expect(container.querySelector('em')).not.toBeNull();
  });

  it('renders [s] as <s>', () => {
    const { container } = render(<BbcodeRenderer content="[s]deleted[/s]" />);
    expect(container.querySelector('s')).not.toBeNull();
  });

  it('renders [quote] as <blockquote>', () => {
    const { container } = render(<BbcodeRenderer content="[quote]cited[/quote]" />);
    expect(container.querySelector('blockquote')).not.toBeNull();
  });

  it('renders [spoiler] as hidden span revealed on click', () => {
    const { container } = render(<BbcodeRenderer content="[spoiler]secret[/spoiler]" />);
    const span = container.querySelector('[data-spoiler]') as HTMLElement;
    expect(span).not.toBeNull();
    expect(span.getAttribute('data-revealed')).toBe('false');
    fireEvent.click(span);
    expect(span.getAttribute('data-revealed')).toBe('true');
  });
});

describe('BbcodeRenderer — disabled tags', () => {
  it('renders [u] as plain text (not <u>)', () => {
    const { container } = render(<BbcodeRenderer content="[u]underline[/u]" />);
    expect(container.querySelector('u')).toBeNull();
    expect(container.textContent).toContain('[u]underline[/u]');
  });

  it('renders [code] as plain text', () => {
    const { container } = render(<BbcodeRenderer content="[code]snippet[/code]" />);
    expect(container.querySelector('code')).toBeNull();
    expect(container.textContent).toContain('[code]snippet[/code]');
  });

  it('renders [url=...] as plain text', () => {
    const { container } = render(<BbcodeRenderer content="[url=https://example.com]click[/url]" />);
    expect(container.querySelector('a')).toBeNull();
    expect(container.textContent).toContain('[url=https://example.com]click[/url]');
  });
});

describe('BbcodeRenderer — XSS safety', () => {
  it('does not inject <script> tags', () => {
    const { container } = render(
      <BbcodeRenderer content="<script>alert(1)</script>" />
    );
    expect(container.querySelector('script')).toBeNull();
    expect(container.textContent).toContain('<script>');
  });

  it('does not execute HTML inside a BB tag', () => {
    const { container } = render(
      <BbcodeRenderer content="[b]<img onerror='alert(1)' src=x>[/b]" />
    );
    const img = container.querySelector('img');
    expect(img).toBeNull();
  });
});
