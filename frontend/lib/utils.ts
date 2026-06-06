import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

export async function copyText(text: string): Promise<void> {
  if (navigator.clipboard && window.isSecureContext) {
    await navigator.clipboard.writeText(text);
    return;
  }

  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.left = "-9999px";
  textarea.style.top = "0";
  document.body.appendChild(textarea);
  textarea.focus();
  textarea.select();

  try {
    const ok = document.execCommand("copy");
    if (!ok) throw new Error("Copy command failed");
  } finally {
    document.body.removeChild(textarea);
  }
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
