'use client';

import { useRouter as useNextRouter, usePathname } from 'next/navigation';
import { useCallback, useMemo } from 'react';
import { demoRoute } from '@/dashboard/lib/demo';

type NextRouter = ReturnType<typeof useNextRouter>;

/** Drop-in for `useRouter` that keeps navigation under `/demo/*`. */
export function useAppRouter(): NextRouter {
  const router = useNextRouter();
  const pathname = usePathname();

  const push = useCallback(
    (href: string, options?: Parameters<NextRouter['push']>[1]) =>
      router.push(demoRoute(href, pathname), options),
    [router, pathname],
  );

  const replace = useCallback(
    (href: string, options?: Parameters<NextRouter['replace']>[1]) =>
      router.replace(demoRoute(href, pathname), options),
    [router, pathname],
  );

  return useMemo(() => ({ ...router, push, replace }), [router, push, replace]);
}
