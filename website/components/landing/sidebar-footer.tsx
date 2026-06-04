'use client';

import { useEffect, useState } from 'react';
import { useTheme } from 'next-themes';
import { Sun, Moon } from 'lucide-react';
import { GithubIcon } from '@/components/landing/github-icon';
import { DiscordIcon } from '@/components/landing/discord-icon';
import { githubUrl } from '@/lib/shared';

export function SidebarFooter() {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  
  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <div className="flex flex-col gap-2 p-3 w-full">
      <div className="flex items-center justify-between rounded-lg border border-fd-border bg-fd-card/50 p-1">
        <div className="flex items-center gap-1 pl-1">
          <a
            href={githubUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex size-7 items-center justify-center rounded-md text-fd-muted-foreground transition-colors hover:bg-fd-accent hover:text-fd-foreground"
            aria-label="Star on GitHub"
          >
            <GithubIcon className="size-4" />
          </a>
          <a
            href="https://discord.com/invite/9TP4xEs2"
            target="_blank"
            rel="noopener noreferrer"
            className="flex size-7 items-center justify-center rounded-md text-fd-muted-foreground transition-colors hover:bg-fd-accent hover:text-fd-foreground"
            aria-label="Join Discord Community"
          >
            <DiscordIcon className="size-4" />
          </a>
        </div>

        <div className="flex items-center gap-1.5 pr-0.5">
          <span className="h-4 w-px bg-fd-border" />
          {mounted && (
            <div className="flex items-center gap-0.5">
              <button
                type="button"
                onClick={() => setTheme('light')}
                className={`flex size-7 items-center justify-center rounded-md transition-colors cursor-pointer ${
                  resolvedTheme === 'light'
                    ? 'bg-fd-accent text-fd-foreground'
                    : 'text-fd-muted-foreground hover:bg-fd-accent/60 hover:text-fd-foreground'
                }`}
                aria-label="Light mode"
              >
                <Sun className="size-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setTheme('dark')}
                className={`flex size-7 items-center justify-center rounded-md transition-colors cursor-pointer ${
                  resolvedTheme === 'dark'
                    ? 'bg-fd-accent text-fd-foreground'
                    : 'text-fd-muted-foreground hover:bg-fd-accent/60 hover:text-fd-foreground'
                }`}
                aria-label="Dark mode"
              >
                <Moon className="size-3.5" />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
