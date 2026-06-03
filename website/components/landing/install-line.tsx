'use client';

import { useCallback, useState } from 'react';
import { Check, Copy, Terminal } from 'lucide-react';
import { DockerLogo } from './brand-logos';

/* The hero's one-line installer. Shows the full command (no truncation) and
 * copies it to the clipboard on click, with a brief "Copied" confirmation.
 * Supports toggling between the Shell installer and the Docker pull command,
 * with matching icons for each method. */

export function InstallLine() {
  const [method, setMethod] = useState<'curl' | 'docker'>('curl');
  const [copied, setCopied] = useState(false);

  const command = method === 'curl' 
    ? 'curl -fsSL https://raw.githubusercontent.com/sumon-ohid/better-paas/main/install.sh | bash'
    : 'docker pull ghcr.io/sumon-ohid/better-paas:latest && docker run -d --name better-paas --restart unless-stopped -v /var/run/docker.sock:/var/run/docker.sock -v $(pwd)/data:/app/data -v $(pwd)/builds:/app/builds -p 80:80 -p 443:443 -p 3000:3000 -p 8080:8080 -p 9000-9050:9000-9050 -e LISTEN_ADDR=:8080 -e FRONTEND_PORT=3000 -e TRUST_PROXY=true ghcr.io/sumon-ohid/better-paas:latest';

  const copy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(command);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API unavailable (e.g. insecure context) — fail silently.
    }
  }, [command]);

  return (
    <div className="flex flex-col gap-2.5 w-full">
      {/* Tabs Selector */}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => { setMethod('curl'); setCopied(false); }}
          className={`flex items-center gap-1.5 px-3 py-1 text-xs rounded-full font-medium transition-colors cursor-pointer border ${
            method === 'curl'
              ? 'bg-fd-primary/10 text-fd-primary border-fd-primary/30'
              : 'text-fd-muted-foreground hover:text-fd-foreground border-transparent'
          }`}
        >
          <Terminal className="size-3.5" />
          Shell Script
        </button>
        <button
          type="button"
          onClick={() => { setMethod('docker'); setCopied(false); }}
          className={`flex items-center gap-1.5 px-3 py-1 text-xs rounded-full font-medium transition-colors cursor-pointer border ${
            method === 'docker'
              ? 'bg-fd-primary/10 text-fd-primary border-fd-primary/30'
              : 'text-fd-muted-foreground hover:text-fd-foreground border-transparent'
          }`}
        >
          <DockerLogo className="size-3.5" />
          Docker
        </button>
      </div>

      {/* Code Box */}
      <div className="flex items-center gap-3 rounded-lg border border-fd-border bg-fd-card px-4 py-2.5 text-left font-mono text-sm w-full">
        <span className="select-none text-fd-primary">$</span>
        <code className="min-w-0 flex-1 overflow-x-auto whitespace-nowrap text-fd-foreground bp-scrollbar-none">
          {command}
        </code>
        <button
          type="button"
          onClick={copy}
          aria-label={copied ? 'Copied' : 'Copy command'}
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
    </div>
  );
}
