'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { useTheme } from 'next-themes';

/**
 * Renders a Mermaid diagram on the client.
 * Usage in MDX:
 *
 * ```mermaid
 * flowchart LR
 *   A --> B
 * ```
 *
 * The rehype plugin converts ```mermaid code fences into <Mermaid chart="..." />.
 */
export function Mermaid({ chart }: { chart: string }) {
  const id = useId();
  const [svg, setSvg] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const { resolvedTheme } = useTheme();

  useEffect(() => {
    let cancelled = false;

    async function render() {
      const { default: mermaid } = await import('mermaid');

      mermaid.initialize({
        startOnLoad: false,
        securityLevel: 'loose',
        fontFamily: 'inherit',
        theme: resolvedTheme === 'dark' ? 'dark' : 'default',
      });

      // Mermaid requires a valid CSS id; useId() produces ":r0:"-style ids.
      const renderId = `mermaid-${id.replace(/[^a-zA-Z0-9]/g, '')}`;

      try {
        const { svg } = await mermaid.render(renderId, chart.trim());
        if (!cancelled) setSvg(svg);
      } catch {
        // If a diagram fails to parse, fall back to showing the source.
        if (!cancelled) setSvg('');
      }
    }

    void render();
    return () => {
      cancelled = true;
    };
  }, [chart, id, resolvedTheme]);

  if (!svg) {
    return (
      <pre className="overflow-x-auto text-sm">
        <code>{chart.trim()}</code>
      </pre>
    );
  }

  return (
    <div
      ref={containerRef}
      className="my-4 flex justify-center [&_svg]:max-w-full"
      // eslint-disable-next-line react/no-danger
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
