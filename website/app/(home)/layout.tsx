import { HomeLayout } from 'fumadocs-ui/layouts/home';
import Link from 'next/link';
import { baseOptions } from '@/lib/layout.shared';
import { Logo } from '@/components/logo';
import { appName, githubUrl } from '@/lib/shared';
import { GithubIcon } from '@/components/landing/github-icon';

export default function Layout({ children }: LayoutProps<'/'>) {
  return (
    <HomeLayout {...baseOptions()}>
      {children}
      <Footer />
    </HomeLayout>
  );
}

const footerNav: { heading: string; links: { label: string; href: string; external?: boolean }[] }[] = [
  {
    heading: 'Product',
    links: [
      { label: 'Documentation', href: '/docs' },
      { label: 'Quickstart', href: '/docs/quickstart' },
      { label: 'Configuration', href: '/docs/configuration' },
      { label: 'Updates', href: '/docs/updates' },
    ],
  },
  {
    heading: 'Resources',
    links: [
      { label: 'Security model', href: '/docs/security' },
      { label: 'Troubleshooting', href: '/docs/troubleshooting' },
      { label: 'Guides', href: '/docs/guides' },
    ],
  },
  {
    heading: 'Project',
    links: [
      { label: 'GitHub', href: githubUrl, external: true },
      { label: 'Releases', href: `${githubUrl}/releases`, external: true },
      { label: 'Issues', href: `${githubUrl}/issues`, external: true },
    ],
  },
];

function Footer() {
  return (
    <footer className="border-t border-fd-border bg-fd-card/30">
      <div className="mx-auto max-w-6xl px-6 py-16">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-[1.5fr_repeat(3,1fr)]">
          <div className="flex flex-col gap-4">
            <Logo />
            <p className="max-w-xs text-sm leading-relaxed text-fd-muted-foreground">
              The self-hosted platform-as-a-service. Deploy from Git, on infrastructure you own.
            </p>
            <a
              href={githubUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex w-fit items-center gap-2 rounded-lg border border-fd-border bg-fd-card px-3 py-1.5 text-sm text-fd-muted-foreground transition-colors hover:text-fd-foreground"
            >
              <GithubIcon className="size-4" />
              Star on GitHub
            </a>
          </div>

          {footerNav.map((col) => (
            <div key={col.heading}>
              <h3 className="text-xs font-semibold uppercase tracking-[0.12em] text-fd-foreground">
                {col.heading}
              </h3>
              <ul className="mt-4 space-y-2.5">
                {col.links.map((link) => (
                  <li key={link.label}>
                    {link.external ? (
                      <a
                        href={link.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-fd-muted-foreground transition-colors hover:text-fd-foreground"
                      >
                        {link.label}
                      </a>
                    ) : (
                      <Link
                        href={link.href}
                        className="text-sm text-fd-muted-foreground transition-colors hover:text-fd-foreground"
                      >
                        {link.label}
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-14 flex flex-col items-center justify-between gap-3 border-t border-fd-border pt-6 text-xs text-fd-muted-foreground sm:flex-row">
          <span>
            © {new Date().getFullYear()} {appName}. Released under an open source license.
          </span>
          <span className="flex items-center gap-1.5">
            <span className="size-1.5 rounded-full bg-(--bp-success) bp-pulse-dot" />
            All systems operational
          </span>
        </div>
      </div>
    </footer>
  );
}
