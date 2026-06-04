import { source } from '@/lib/source';
import { DocsLayout } from 'fumadocs-ui/layouts/docs';
import { baseOptions } from '@/lib/layout.shared';
import { DiscordIcon } from '@/components/landing/discord-icon';

export default function Layout({ children }: LayoutProps<'/docs'>) {
  return (
    <DocsLayout
      tree={source.getPageTree()}
      {...baseOptions()}
      sidebar={{
        footer: (
          <div className="flex flex-col gap-2 p-3">
            <a
              href="https://discord.com/invite/9TP4xEs2"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 rounded-lg border border-fd-border bg-fd-card/50 px-3 py-2.5 text-xs font-semibold text-fd-muted-foreground transition-colors hover:bg-fd-accent hover:text-fd-foreground w-full"
            >
              <DiscordIcon className="size-4 text-[#5865F2]" />
              Join Discord Community
            </a>
          </div>
        ),
      }}
    >
      {children}
    </DocsLayout>
  );
}
