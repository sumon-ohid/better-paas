"use client"

import React from "react"
import { Badge, type BadgeProps } from "@/components/ui/badge"
import { NucleoIcon } from "@/components/nucleo-icons"
import { getStatusMeta, type AppStatus } from "@/lib/status"
import { cn } from "@/lib/utils"

interface StatusBadgeProps {
  status: AppStatus
  /** Show the textual label next to the icon. */
  showLabel?: boolean
  size?: BadgeProps["size"]
  className?: string
}

/**
 * Single, consistent status pill used across every screen. Built on the shared
 * `Badge` primitive so colors stay on the semantic design tokens, with label
 * and icon pulled from the centralized status registry. Keeps the vocabulary
 * from drifting between pages.
 */
export function StatusBadge({
  status,
  showLabel = true,
  size = "sm",
  className,
}: StatusBadgeProps) {
  const meta = getStatusMeta(status)
  return (
    <Badge variant={meta.variant} size={size} className={cn("rounded-lg py-2.5 px-1.5 border-input", className)}>
      <NucleoIcon name={meta.icon} className={cn(meta.pulse && "animate-spin")} />
      {showLabel && meta.label}
    </Badge>
  )
}

interface StatusDotProps {
  status: AppStatus
  className?: string
}

/** Bare status dot with state-aware pulse, for compact contexts. */
export function StatusDot({ status, className }: StatusDotProps) {
  const meta = getStatusMeta(status)
  return (
    <span className={cn("relative flex h-2 w-2 shrink-0", className)}>
      {meta.pulse && (
        <span
          className={cn(
            "absolute inline-flex h-full w-full animate-ping rounded-full opacity-60",
            meta.dot,
          )}
        />
      )}
      <span className={cn("relative inline-flex h-2 w-2 rounded-full", meta.dot)} />
    </span>
  )
}
