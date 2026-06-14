"use client"

import React, { useState } from "react"
import { NucleoIcon } from "@/dashboard/components/nucleo-icons"
import { cn } from "@/dashboard/lib/utils"

const ICON_SLUG: Record<string, string> = {
  postgres: "postgresql",
  mysql: "mysql",
  redis: "redis",
}

function iconUrl(type: string): string {
  const slug = ICON_SLUG[type] ?? type
  return `https://cdn.jsdelivr.net/gh/homarr-labs/dashboard-icons/svg/${slug}.svg`
}

export function DatabaseTypeLogo({
  type,
  className,
  label,
}: {
  type: string
  className?: string
  label?: string
}) {
  const [failed, setFailed] = useState(false)

  if (failed) {
    return (
      <NucleoIcon
        name="database"
        className={cn("text-muted-foreground", className)}
        aria-hidden={!label}
      />
    )
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={iconUrl(type)}
      alt={label ?? `${type} logo`}
      className={cn("object-contain", className)}
      loading="lazy"
      onError={() => setFailed(true)}
    />
  )
}
