import type { SVGProps } from "react";

// Nixpacks mark: a 3D package/box (Nixpacks "packs" a source dir into an OCI
// image). Drawn as an isometric cube with a visible top and two side faces.
// Uses currentColor so it adapts to light/dark; callers can override via
// className/style.
const Nix = (props: SVGProps<SVGSVGElement>) => (
  <svg
    {...props}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.6"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    {/* Outer box outline */}
    <path d="M12 2.5 21 7v10l-9 4.5L3 17V7l9-4.5Z" />
    {/* Top edges meeting at the front-top vertex */}
    <path d="M3 7l9 4.5L21 7" />
    {/* Vertical front seam */}
    <path d="M12 11.5V21.5" />
  </svg>
);

export { Nix };
