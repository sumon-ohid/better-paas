import { cn } from "@/dashboard/lib/utils"

export function LogoMark({
  className,
  "aria-label": ariaLabel,
}: {
  className?: string
  "aria-label"?: string
}) {
  return (
    <svg
      viewBox="0 0 108.89 108.89"
      xmlns="http://www.w3.org/2000/svg"
      className={cn("text-foreground", className)}
      aria-hidden={ariaLabel ? undefined : true}
      aria-label={ariaLabel}
      role={ariaLabel ? "img" : undefined}
    >
      <g fill="currentColor">
        <rect x="18.15" width="18.15" height="18.15" />
        <rect x="18.15" y="36.3" width="18.15" height="36.3" />
        <rect x="18.15" y="90.74" width="18.15" height="18.15" />
        <rect x="72.6" width="18.15" height="18.15" />
        <rect x="72.6" y="36.3" width="18.15" height="36.3" />
        <rect x="72.6" y="90.74" width="18.15" height="18.15" />
        <rect x="0" y="18.15" width="18.15" height="18.15" />
        <rect x="36.3" y="18.15" width="36.3" height="18.15" />
        <rect x="90.74" y="18.15" width="18.15" height="18.15" />
        <rect x="0" y="72.6" width="18.15" height="18.15" />
        <rect x="36.3" y="72.6" width="36.3" height="18.15" />
        <rect x="90.74" y="72.6" width="18.15" height="18.15" />
      </g>
    </svg>
  )
}
