import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

export function cleanVersion(ver: string | null | undefined): string {
  if (!ver) return "";
  // Strip git describe count and commit suffix: v1.2.0-3-g3d2200a -> v1.2.0
  const match = ver.match(/^(v?\d+\.\d+\.\d+)-\d+-g([0-9a-f]+)$/i);
  if (match) {
    return match[1];
  }
  // Strip leading 'g' if it is a standalone 8-character commit hash (e.g. g3d2200a -> 3d2200a)
  if (/^g[0-9a-f]{7,40}$/i.test(ver)) {
    return ver.substring(1);
  }
  return ver;
}

