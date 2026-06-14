'use client';

import { usePathname } from 'next/navigation';
import { useEffect } from 'react';

/** Clears document scroll locks when leaving /demo (dialogs, inline styles). */
export function DocumentScrollGuard() {
  const pathname = usePathname();
  const onDemo = pathname.startsWith('/demo');

  useEffect(() => {
    if (onDemo) return;

    const html = document.documentElement;
    const body = document.body;

    body.style.removeProperty('overflow');
    body.style.removeProperty('height');
    body.style.removeProperty('padding-right');
    body.style.removeProperty('margin-right');
    html.style.removeProperty('overflow');
    html.style.removeProperty('height');
    body.removeAttribute('data-scroll-locked');
  }, [onDemo, pathname]);

  return null;
}
