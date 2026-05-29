// Centralized status vocabulary, colors, and iconography for app states.
//
// This is the single source of truth so every screen (dashboard, app detail,
// logs, health) renders identical labels, colors, and icons. Colors map to the
// shared `Badge` variants (success / warning / error / secondary), which are
// themselves driven by the semantic design tokens in globals.css — so theming
// stays consistent across light and dark modes without any hard-coded hex.

import type { BadgeProps } from "@/components/ui/badge"

export type AppStatus = "running" | "building" | "stopped" | "failed" | string

type NucleoStatusIcon =
  | "check-circle"
  | "loader"
  | "square"
  | "triangle-alert"
  | "circle-alert"

export interface StatusMeta {
  /** Human-facing label used across the UI. */
  label: string
  /** Badge variant (semantic token backed). */
  variant: NonNullable<BadgeProps["variant"]>
  /** Background class for the small status dot. */
  dot: string
  /** Nucleo icon name representing the state. */
  icon: NucleoStatusIcon
  /** Whether the indicator should pulse (in-progress states). */
  pulse: boolean
  /** Coarse priority bucket for sorting/attention (lower = more urgent). */
  priority: number
}

const RUNNING: StatusMeta = {
  label: "Running",
  variant: "success",
  dot: "bg-success",
  icon: "check-circle",
  pulse: false,
  priority: 2,
}

const BUILDING: StatusMeta = {
  label: "Building",
  variant: "warning",
  dot: "bg-warning",
  icon: "loader",
  pulse: true,
  priority: 0,
}

const STOPPED: StatusMeta = {
  label: "Paused",
  variant: "secondary",
  dot: "bg-muted-foreground/50",
  icon: "square",
  pulse: false,
  priority: 3,
}

const FAILED: StatusMeta = {
  label: "Failed",
  variant: "error",
  dot: "bg-destructive",
  icon: "triangle-alert",
  pulse: false,
  priority: 1,
}

export function getStatusMeta(status: AppStatus): StatusMeta {
  switch (status) {
    case "running":
      return RUNNING
    case "building":
      return BUILDING
    case "stopped":
      return STOPPED
    case "failed":
      return FAILED
    default:
      return {
        label: status ? status.charAt(0).toUpperCase() + status.slice(1) : "Unknown",
        variant: "secondary",
        dot: "bg-muted-foreground/50",
        icon: "circle-alert",
        pulse: false,
        priority: 4,
      }
  }
}

/** Sort apps so the states that need attention surface first. */
export function compareByStatusPriority(a: AppStatus, b: AppStatus): number {
  return getStatusMeta(a).priority - getStatusMeta(b).priority
}
