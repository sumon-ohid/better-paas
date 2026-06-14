/** Demo routes always live under `/demo` on the marketing site. */
export const DEMO_BASE = '/demo';

export function isDemoPath(pathname: string): boolean {
  return pathname === DEMO_BASE || pathname.startsWith(`${DEMO_BASE}/`);
}

export function isDemoMode(_pathname?: string): boolean {
  return true;
}

/** Map an internal dashboard path to the public demo URL. */
export function demoRoute(path: string, pathname?: string): string {
  const current =
    pathname ?? (typeof window !== 'undefined' ? window.location.pathname : DEMO_BASE);
  if (!isDemoPath(current)) return path;

  const qIndex = path.indexOf('?');
  const hashIndex = path.indexOf('#');
  let pathPart = path;
  let suffix = '';
  if (qIndex !== -1) {
    pathPart = path.slice(0, qIndex);
    suffix = path.slice(qIndex);
  } else if (hashIndex !== -1) {
    pathPart = path.slice(0, hashIndex);
    suffix = path.slice(hashIndex);
  }

  if (pathPart === DEMO_BASE || pathPart.startsWith(`${DEMO_BASE}/`)) return path;
  const prefixed = pathPart === '/' ? DEMO_BASE : `${DEMO_BASE}${pathPart}`;
  return prefixed + suffix;
}

export function exitDemo(): void {
  window.location.href = '/';
}

export const DEMO_READONLY_MESSAGE =
  'This is a read-only demo. Install Better-PaaS on your own server to deploy for real.';
