import type { ReactNode, SVGProps } from "react"

type NucleoIconName =
  | "activity"
  | "branch"
  | "check"
  | "check-circle"
  | "chevron-down"
  | "chevron-left"
  | "chevron-right"
  | "chevron-up"
  | "chevrons-up-down"
  | "copy"
  | "cpu"
  | "external"
  | "grid"
  | "help"
  | "keyboard"
  | "layers"
  | "list"
  | "loader"
  | "minus"
  | "more-horizontal"
  | "plus"
  | "play"
  | "refresh"
  | "search"
  | "server"
  | "sidebar"
  | "settings"
  | "square"
  | "terminal"
  | "trash"
  | "triangle-alert"
  | "web"
  | "x"
  | "circle-alert"
  | "info"

type NucleoIconProps = SVGProps<SVGSVGElement> & {
  name: NucleoIconName
}

const paths: Record<NucleoIconName, ReactNode> = {
  activity: (
    <>
      <path d="M4 14.5h3.2l2.1-5 3.4 8 2.4-6H20" />
      <path d="M4 5.5h16" opacity=".38" />
    </>
  ),
  branch: (
    <>
      <path d="M7 5v7a5 5 0 0 0 5 5h5" />
      <path d="M14 7h1a4 4 0 0 1 4 4v6" opacity=".42" />
      <circle cx="7" cy="5" r="2" />
      <circle cx="17" cy="17" r="2" />
    </>
  ),
  check: <path d="m5 12.5 4.2 4.2L19 7" />,
  "check-circle": (
    <>
      <circle cx="12" cy="12" r="8" />
      <path d="m8.5 12.2 2.3 2.3 4.9-5" />
    </>
  ),
  "chevron-down": <path d="m7 10 5 5 5-5" />,
  "chevron-left": <path d="m14 7-5 5 5 5" />,
  "chevron-right": <path d="m10 7 5 5-5 5" />,
  "chevron-up": <path d="m7 14 5-5 5 5" />,
  "chevrons-up-down": (
    <>
      <path d="m8 9 4-4 4 4" />
      <path d="m16 15-4 4-4-4" />
    </>
  ),
  "circle-alert": (
    <>
      <circle cx="12" cy="12" r="8" />
      <path d="M12 7.5v5.2M12 16.5v.1" />
    </>
  ),
  copy: (
    <>
      <rect x="8" y="8" width="10" height="10" rx="2" />
      <path d="M6 14H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v1" opacity=".42" />
    </>
  ),
  cpu: (
    <>
      <rect x="7" y="7" width="10" height="10" rx="2.4" />
      <rect x="10" y="10" width="4" height="4" rx="1" opacity=".42" />
      <path d="M4 9h3M4 15h3M17 9h3M17 15h3M9 4v3M15 4v3M9 17v3M15 17v3" />
    </>
  ),
  external: (
    <>
      <path d="M10 6H6a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-4" />
      <path d="M13 4h7v7M12 12l8-8" />
    </>
  ),
  grid: (
    <>
      <rect x="4" y="4" width="6" height="6" rx="1.5" />
      <rect x="14" y="4" width="6" height="6" rx="1.5" opacity=".5" />
      <rect x="4" y="14" width="6" height="6" rx="1.5" opacity=".5" />
      <rect x="14" y="14" width="6" height="6" rx="1.5" />
    </>
  ),
  help: (
    <>
      <circle cx="12" cy="12" r="8" />
      <path d="M9.8 9.5a2.4 2.4 0 0 1 4.6 1c0 1.9-2.4 2-2.4 3.8" />
      <path d="M12 17.4v.1" />
    </>
  ),
  keyboard: (
    <>
      <rect x="3" y="6" width="18" height="12" rx="2.5" />
      <path d="M7 10h.1M10.5 10h.1M14 10h.1M17.5 10h.1M7 14h7.5M17.5 14h.1" />
    </>
  ),
  layers: (
    <>
      <path d="m12 3.5 8 4.5-8 4.5L4 8l8-4.5Z" />
      <path d="m4 12 8 4.5L20 12" opacity=".48" />
      <path d="m4 16 8 4.5 8-4.5" opacity=".32" />
    </>
  ),
  list: (
    <>
      <path d="M8 6h12M8 12h12M8 18h12" />
      <path d="M4 6h.1M4 12h.1M4 18h.1" />
    </>
  ),
  loader: (
    <>
      <path d="M12 4v3" />
      <path d="M12 17v3" opacity=".45" />
      <path d="m17.7 6.3-2.1 2.1" opacity=".85" />
      <path d="m8.4 15.6-2.1 2.1" opacity=".35" />
      <path d="M20 12h-3" opacity=".7" />
      <path d="M7 12H4" opacity=".25" />
      <path d="m17.7 17.7-2.1-2.1" opacity=".55" />
      <path d="M8.4 8.4 6.3 6.3" opacity=".15" />
    </>
  ),
  minus: <path d="M6 12h12" />,
  "more-horizontal": <path d="M7 12h.1M12 12h.1M17 12h.1" />,
  plus: <path d="M12 5v14M5 12h14" />,
  play: <path d="M8 5.5v13l10-6.5-10-6.5Z" />,
  refresh: (
    <>
      <path d="M19 8a7 7 0 0 0-12.2-2.4L5 8" />
      <path d="M5 4v4h4M5 16a7 7 0 0 0 12.2 2.4L19 16" />
      <path d="M19 20v-4h-4" />
    </>
  ),
  search: (
    <>
      <circle cx="11" cy="11" r="6" />
      <path d="m16 16 4 4" />
    </>
  ),
  server: (
    <>
      <rect x="4" y="5" width="16" height="5.5" rx="2" />
      <rect x="4" y="13.5" width="16" height="5.5" rx="2" opacity=".58" />
      <path d="M8 8h.1M8 16.5h.1M12 8h4M12 16.5h4" />
    </>
  ),
  sidebar: (
    <>
      <rect x="4" y="5" width="16" height="14" rx="2.5" />
      <path d="M9 5v14" opacity=".48" />
    </>
  ),
  settings: (
    <>
      <path d="M12 8.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7Z" />
      <path d="M4.8 14.4 3.8 12l1-2.4 2.1-.5 1-1.7-.6-2 2.4-1h2.6l2.4 1-.6 2 1 1.7 2.1.5 1 2.4-1 2.4-2.1.5-1 1.7.6 2-2.4 1H9.7l-2.4-1 .6-2-1-1.7-2.1-.5Z" opacity=".45" />
    </>
  ),
  square: <rect x="7" y="7" width="10" height="10" rx="1.5" />,
  terminal: (
    <>
      <rect x="3.5" y="5" width="17" height="14" rx="2.5" />
      <path d="m7 10 2.5 2L7 14M12 14h5" />
    </>
  ),
  trash: (
    <>
      <path d="M5 7h14M10 4h4M8 7l.7 12h6.6L16 7" />
      <path d="M10.5 10.5v5M13.5 10.5v5" opacity=".48" />
    </>
  ),
  "triangle-alert": (
    <>
      <path d="M11 4.8 3.9 17a2 2 0 0 0 1.7 3h12.8a2 2 0 0 0 1.7-3L13 4.8a1.2 1.2 0 0 0-2 0Z" />
      <path d="M12 9v4M12 16.5v.1" />
    </>
  ),
  web: (
    <>
      <circle cx="12" cy="12" r="8" />
      <path d="M4 12h16M12 4a11 11 0 0 1 0 16M12 4a11 11 0 0 0 0 16" opacity=".5" />
    </>
  ),
  info: (
    <>
      <circle cx="12" cy="12" r="8" />
      <path d="M12 11v5M12 8v.1" />
    </>
  ),
  x: <path d="m6 6 12 12M18 6 6 18" />,
}

export function NucleoIcon({ name, className, ...props }: NucleoIconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.8"
      className={className}
      aria-hidden="true"
      {...props}
    >
      {paths[name]}
    </svg>
  )
}
