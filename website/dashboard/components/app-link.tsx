'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { demoRoute } from '@/dashboard/lib/demo';
import type { ComponentProps } from 'react';

type AppLinkProps = Omit<ComponentProps<typeof Link>, 'href'> & {
  href: string;
};

export function AppLink({ href, ...props }: AppLinkProps) {
  const pathname = usePathname();
  return <Link href={demoRoute(href, pathname)} {...props} />;
}
