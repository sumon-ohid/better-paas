'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTheme } from 'next-themes';
import { useSearchContext } from 'fumadocs-ui/contexts/search';
import { ArrowRight, Menu, Moon, Search, Sun, X } from 'lucide-react';
import { Logo } from '@/components/logo';
import { GithubIcon } from '@/components/landing/github-icon';
import { githubUrl } from '@/lib/shared';

/* ──────────────────────────────────────────────────────────────────────────
 * SiteHeader — a custom, Linear-style top bar for the marketing pages.
 *
 * Replaces fumadocs' default HomeLayout nav (disabled via nav.enabled=false)
 * with a sticky header that:
 *   · starts transparent over the hero and gains a blurred fill + hairline
 *     border once the page is scrolled,
 *   · centers real nav links with an underline-on-hover treatment,
 *   · wires the ⌘K search trigger, theme toggle, GitHub, and a primary CTA,
 *   · collapses into an animated sheet menu on mobile.
 * ────────────────────────────────────────────────────────────────────────── */

const NAV_LINKS: { label: string; href: string }[] = [
  { label: 'Documentation', href: '/docs' },
  { label: 'Quickstart', href: '/docs/quickstart' },
  { label: 'Updates', href: '/docs/updates' },
];

function ThemeToggle({ className }: { className?: string }) {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  return (
    <button
      type="button"
      onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}
      aria-label="Toggle theme"
      className={`flex size-9 cursor-pointer items-center justify-center rounded-lg text-fd-muted-foreground transition-colors hover:bg-fd-accent hover:text-fd-foreground ${className ?? ''}`}
    >
      {/* Avoid hydration mismatch: render a neutral icon until mounted. */}
      {mounted && resolvedTheme === 'dark' ? (
        <Sun className="size-[18px]" />
      ) : (
        <Moon className="size-[18px]" />
      )}
    </button>
  );
}

export function SiteHeader() {
  const pathname = usePathname();
  const search = useSearchContext();
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  // Toggle the scrolled treatment once we leave the very top of the page.
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Close the mobile sheet whenever the route changes.
  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  // Lock body scroll while the mobile sheet is open.
  useEffect(() => {
    if (!menuOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [menuOpen]);

  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

  return (
    <header
      className={`sticky top-0 z-40 transition-colors duration-300 ${
        scrolled
          ? 'border-b border-fd-border bg-fd-background/80 backdrop-blur-xl'
          : 'border-b border-transparent bg-transparent'
      }`}
    >
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-4 px-6">
        {/* Brand */}
        <Link
          href="/"
          aria-label="Better-PaaS home"
          className="flex shrink-0 items-center transition-opacity hover:opacity-80"
        >
          <Logo className="text-base" />
        </Link>

        {/* Center nav — desktop */}
        <nav className="hidden flex-1 items-center justify-center gap-1 md:flex">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`relative rounded-lg px-3 py-2 text-sm transition-colors ${
                isActive(link.href)
                  ? 'text-fd-foreground'
                  : 'text-fd-muted-foreground hover:text-fd-foreground'
              }`}
            >
              {link.label}
              <span
                className={`absolute inset-x-3 -bottom-px h-px bg-fd-primary transition-transform duration-300 ${
                  isActive(link.href) ? 'scale-x-100' : 'scale-x-0'
                }`}
              />
            </Link>
          ))}
        </nav>

        {/* Right cluster */}
        <div className="ml-auto flex items-center gap-1.5 md:ml-0">
          {/* Search trigger (⌘K) */}
          {search.enabled && (
            <button
              type="button"
              onClick={() => search.setOpenSearch(true)}
              className="hidden h-9 items-center gap-2 rounded-lg border border-fd-border bg-fd-card/60 pl-2.5 pr-2 text-sm text-fd-muted-foreground transition-colors hover:bg-fd-accent hover:text-fd-foreground sm:flex"
            >
              <Search className="size-4" />
              <span>Search</span>
              <kbd className="ml-2 flex items-center gap-0.5 rounded border border-fd-border bg-fd-muted/60 px-1.5 py-0.5 font-mono text-[10px] leading-none text-fd-muted-foreground">
                ⌘K
              </kbd>
            </button>
          )}

          <ThemeToggle className="hidden sm:flex" />

          <a
            href={githubUrl}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Star on GitHub"
            className="hidden size-9 items-center justify-center rounded-lg text-fd-muted-foreground transition-colors hover:bg-fd-accent hover:text-fd-foreground sm:flex"
          >
            <GithubIcon className="size-[18px]" />
          </a>

          <span className="mx-1 hidden h-5 w-px bg-fd-border sm:block" />

          <Link
            href="/docs"
            className="bp-primary hidden h-9 items-center gap-1.5 rounded-lg px-4 text-sm font-medium sm:inline-flex"
          >
            Get started
            <ArrowRight className="size-4" />
          </Link>

          {/* Mobile controls */}
          {search.enabled && (
            <button
              type="button"
              onClick={() => search.setOpenSearch(true)}
              aria-label="Search"
              className="flex size-9 items-center justify-center rounded-lg text-fd-muted-foreground transition-colors hover:bg-fd-accent hover:text-fd-foreground sm:hidden"
            >
              <Search className="size-[18px]" />
            </button>
          )}
          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            aria-label={menuOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={menuOpen}
            className="flex size-9 items-center justify-center rounded-lg text-fd-muted-foreground transition-colors hover:bg-fd-accent hover:text-fd-foreground md:hidden"
          >
            {menuOpen ? <X className="size-[18px]" /> : <Menu className="size-[18px]" />}
          </button>
        </div>
      </div>

      {/* Mobile sheet */}
      {menuOpen && (
        <div className="md:hidden">
          <button
            type="button"
            aria-label="Close menu"
            onClick={() => setMenuOpen(false)}
            className="fixed inset-0 top-16 z-30 bg-fd-background/60 backdrop-blur-sm"
          />
          <div className="bp-fade-up relative z-40 border-b border-fd-border bg-fd-background px-6 pb-6 pt-2">
            <nav className="flex flex-col">
              {NAV_LINKS.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`flex items-center justify-between rounded-lg px-3 py-3 text-sm transition-colors ${
                    isActive(link.href)
                      ? 'bg-fd-accent text-fd-foreground'
                      : 'text-fd-muted-foreground hover:bg-fd-accent/60 hover:text-fd-foreground'
                  }`}
                >
                  {link.label}
                  <ArrowRight className="size-4 opacity-50" />
                </Link>
              ))}
            </nav>

            <div className="mt-4 flex items-center gap-2 border-t border-fd-border pt-4">
              <Link
                href="/docs"
                className="bp-primary inline-flex h-10 flex-1 items-center justify-center gap-1.5 rounded-lg px-4 text-sm font-medium"
              >
                Get started
                <ArrowRight className="size-4" />
              </Link>
              <a
                href={githubUrl}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Star on GitHub"
                className="bp-surface flex size-10 items-center justify-center rounded-lg text-fd-foreground"
              >
                <GithubIcon className="size-[18px]" />
              </a>
              <ThemeToggle className="bp-surface size-10" />
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
