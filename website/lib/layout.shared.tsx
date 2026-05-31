import type { BaseLayoutProps } from 'fumadocs-ui/layouts/shared';
import { Logo } from '@/components/logo';
import { githubUrl } from './shared';

export function baseOptions(): BaseLayoutProps {
  return {
    nav: {
      title: <Logo />,
      transparentMode: 'top',
    },
    links: [
      // `on: 'nav'` keeps these in the top navbar only. Without it they also
      // render into the docs sidebar, where they just duplicate the page tree
      // (which already lists Documentation, Quickstart, etc.).
      {
        text: 'Documentation',
        url: '/docs',
        active: 'none',
        on: 'nav',
      },
      {
        text: 'Quickstart',
        url: '/docs/quickstart',
        active: 'none',
        on: 'nav',
      },
      {
        type: 'button',
        text: 'Get started',
        url: '/docs',
        active: 'none',
        on: 'nav',
      },
    ],
    githubUrl,
  };
}
