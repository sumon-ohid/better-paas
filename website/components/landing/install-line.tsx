'use client';

import { useCallback, useState } from 'react';
import { Check, Copy } from 'lucide-react';

/* The hero's one-line installer. Shows the full command (no truncation) and
 * copies it to the clipboard on click, with a brief "Copied" confirmation. */

const INSTALL_COMMAND = 'curl -fsSL better-paas.com/install.sh | bash';

export function InstallLine() {
  const [copied, setCopied] = useState(false);

  const copy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(INSTALL_COMMAND);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API unavailable (e.g. insecure context) — fail silently.
    }
  }, []);

  return (
    <div className="flex items-center gap-3 rounded-lg border border-fd-border bg-fd-card px-4 py-2.5 text-left font-mono text-sm">
      <span className="select-none text-fd-primary">$</span>
      <code className="min-w-0 flex-1 overflow-x-auto whitespace-nowrap text-fd-foreground bp-scrollbar-none">
        {INSTALL_COMMAND}
      </code>
      <button
        type="button"
        onClick={copy}
        aria-label={copied ? 'Copied' : 'Copy install command'}
        className="flex shrink-0 cursor-pointer items-center gap-1.5 rounded-md px-1.5 py-1 text-xs text-fd-muted-foreground transition-colors hover:text-fd-foreground"
      >
        {copied ? (
          <>
            <Check className="size-3.5 text-(--bp-success)" />
            <span className="hidden text-(--bp-success) sm:block">Copied</span>
          </>
        ) : (
          <>
            <Copy className="size-3.5" />
            <span className="hidden sm:block">Copy</span>
          </>
        )}
      </button>
    </div>
  );
}
