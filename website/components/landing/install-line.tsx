'use client';

import { useCallback, useState } from 'react';
import { Check, Copy, Terminal } from 'lucide-react';
import { DockerLogo } from './brand-logos';

/* The hero's one-line installer. Shows the full command (no truncation) and
 * copies it to the clipboard on click, with a brief "Copied" confirmation.
 * Supports toggling between the Shell installer and the Docker pull command,
 * with matching icons for each method. */

export function InstallLine() {
  const [method, setMethod] = useState<'curl' | 'docker' | 'cli'>('curl');
  const [copied, setCopied] = useState(false);

  const command =
    method === 'curl'
      ? 'curl -fsSL https://raw.githubusercontent.com/sumon-ohid/better-paas/main/install.sh | sudo bash'
      : method === 'docker'
        ? 'docker pull ghcr.io/sumon-ohid/better-paas:latest && docker run -d --name better-paas --restart unless-stopped -v /var/run/docker.sock:/var/run/docker.sock -v $(pwd)/data:/app/data -v $(pwd)/builds:/app/builds -p 80:80 -p 443:443 -p 3000:3000 -p 8080:8080 -p 9000-9050:9000-9050 -e LISTEN_ADDR=:8080 -e FRONTEND_PORT=3000 -e TRUST_PROXY=true ghcr.io/sumon-ohid/better-paas:latest'
        : 'go install github.com/sumon-ohid/better-paas/backend/cmd/paas@latest && paas connect https://your-dashboard-url';

  const copy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(command);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API unavailable (e.g. insecure context) - fail silently.
    }
  }, [command]);

  return (
    <div className="flex flex-col gap-3 w-full">
      {/* Tabs Selector */}
      <div className="inline-flex items-center p-[3px] rounded-lg bg-[#121722]/5 dark:bg-white/[0.03] border border-black/5 dark:border-white/10 w-fit">
        <button
          type="button"
          onClick={() => { setMethod('curl'); setCopied(false); }}
          className={`flex items-center gap-1.5 px-3.5 py-1.5 text-xs rounded-md font-medium transition-all duration-200 cursor-pointer border ${
            method === 'curl'
              ? 'bg-white dark:bg-white/[0.08] text-[#121722] dark:text-[#f4f4f5] border-black/5 dark:border-white/10 shadow-[0_1.5px_3px_rgba(0,0,0,0.06)]'
              : 'text-[#66758e] dark:text-[#929297] hover:text-[#121722] dark:hover:text-[#f4f4f5] border-transparent'
          }`}
        >
          <Terminal className="size-3.5" />
          Shell Script
        </button>
        <button
          type="button"
          onClick={() => {
            setMethod('docker');
            setCopied(false);
          }}
          className={`flex items-center gap-1.5 px-3.5 py-1.5 text-xs rounded-md font-medium transition-all duration-200 cursor-pointer border ${
            method === 'docker'
              ? 'bg-white dark:bg-white/[0.08] text-[#121722] dark:text-[#f4f4f5] border-black/5 dark:border-white/10 shadow-[0_1.5px_3px_rgba(0,0,0,0.06)]'
              : 'text-[#66758e] dark:text-[#929297] hover:text-[#121722] dark:hover:text-[#f4f4f5] border-transparent'
          }`}
        >
          <DockerLogo className="size-3.5" />
          Docker
        </button>
        <button
          type="button"
          onClick={() => {
            setMethod('cli');
            setCopied(false);
          }}
          className={`flex items-center gap-1.5 px-3.5 py-1.5 text-xs rounded-md font-medium transition-all duration-200 cursor-pointer border ${
            method === 'cli'
              ? 'bg-white dark:bg-white/[0.08] text-[#121722] dark:text-[#f4f4f5] border-black/5 dark:border-white/10 shadow-[0_1.5px_3px_rgba(0,0,0,0.06)]'
              : 'text-[#66758e] dark:text-[#929297] hover:text-[#121722] dark:hover:text-[#f4f4f5] border-transparent'
          }`}
        >
          <Terminal className="size-3.5" />
          CLI
        </button>
      </div>

      {/* Code Box */}
      <div className="flex items-center gap-3 rounded-lg border border-black/5 dark:border-white/10 bg-white/60 dark:bg-white/[0.03] px-4 py-2.5 text-left font-mono text-sm w-full shadow-[0_2px_8px_-3px_rgba(0,0,0,0.05)]">
        <span className="select-none text-[#4c69ff] font-semibold">$</span>
        <code className="min-w-0 flex-1 overflow-x-auto whitespace-nowrap text-[#121722] dark:text-[#f4f4f5] bp-scrollbar-none">
          {command}
        </code>
        <button
          type="button"
          onClick={copy}
          aria-label={copied ? 'Copied' : 'Copy command'}
          className="flex shrink-0 cursor-pointer items-center gap-1.5 rounded-md px-2.5 py-1 text-xs text-[#394355] dark:text-[#929297] transition-colors hover:text-[#121722] dark:hover:text-white"
        >
          {copied ? (
            <>
              <Check className="size-3.5 text-emerald-500 dark:text-emerald-400" />
              <span className="hidden text-emerald-500 dark:text-emerald-400 sm:block font-medium">Copied</span>
            </>
          ) : (
            <>
              <Copy className="size-3.5" />
              <span className="hidden sm:block font-medium">Copy</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}
