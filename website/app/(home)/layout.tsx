import { HomeLayout } from 'fumadocs-ui/layouts/home';
import Link from 'next/link';
import { baseOptions } from '@/lib/layout.shared';
import { Logo } from '@/components/logo';
import { appName, githubUrl } from '@/lib/shared';

export default function Layout({ children }: LayoutProps<'/'>) {
  return (
    <HomeLayout {...baseOptions()}>
      {children}
      <Footer />
    </HomeLayout>
  );
}

function Footer() {
  return (
    <footer className="border-t border-fd-border bg-fd-card/40">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-10 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-2">
          <Logo />
          <p className="text-sm text-fd-muted-foreground">
            Self-hosted platform-as-a-service. Open source.
          </p>
        </div>
        <nav className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-fd-muted-foreground">
          <Link href="/docs" className="hover:text-fd-foreground">
            Documentation
          </Link>
          <Link href="/docs/quickstart" className="hover:text-fd-foreground">
            Quickstart
          </Link>
          <a
            href={githubUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-fd-foreground"
          >
            GitHub
          </a>
        </nav>
      </div>
      <div className="border-t border-fd-border">
        <div className="mx-auto max-w-6xl px-4 py-4 text-xs text-fd-muted-foreground">
          © {new Date().getFullYear()} {appName}. Released under an open source license.
        </div>
      </div>
    </footer>
  );
}
