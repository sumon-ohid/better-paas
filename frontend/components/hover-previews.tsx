"use client"

import React from "react"
import { StatusBadge, StatusDot } from "@/components/status-badge"
import {
  PreviewCard,
  PreviewCardPopup,
  PreviewCardTrigger,
} from "@/components/ui/preview-card"
import {
  compareByStatusPriority,
  getStatusMeta,
  type AppStatus,
} from "@/lib/status"
import { cn } from "@/lib/utils"

const STATUS_LABEL_CLASS: Record<string, string> = {
  running: "text-success-foreground",
  building: "text-warning-foreground",
  stopped: "text-muted-foreground",
  failed: "text-destructive",
}

export interface ServiceStatusItem {
  id: string
  name: string
  status: AppStatus
}

function formatFullDateTime(dateStr: string): string {
  return new Date(dateStr).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  })
}

function stopCardClick(e: React.SyntheticEvent) {
  e.stopPropagation()
}

function ServiceStatusRow({ service }: { service: ServiceStatusItem }) {
  const meta = getStatusMeta(service.status)

  return (
    <li className="flex w-full min-w-0 items-center justify-between gap-3 py-1.5">
      <div className="flex min-w-0 flex-1 items-center gap-2 overflow-hidden">
        <StatusDot status={service.status} className="shrink-0" />
        <span className="min-w-0 truncate text-sm" title={service.name}>
          {service.name}
        </span>
      </div>
      <span
        className={cn(
          "shrink-0 pl-2 text-xs",
          STATUS_LABEL_CLASS[service.status] ?? "text-muted-foreground",
        )}
      >
        {meta.label}
      </span>
    </li>
  )
}

function ServiceStatusList({ services }: { services: ServiceStatusItem[] }) {
  if (services.length === 0) {
    return (
      <p className="py-1 text-muted-foreground text-xs">No services yet.</p>
    )
  }

  const sorted = [...services].sort((a, b) =>
    compareByStatusPriority(a.status, b.status),
  )

  return (
    <ul className="flex w-full min-w-0 max-h-44 flex-col divide-y divide-border/40 overflow-x-hidden overflow-y-auto">
      {sorted.map((service) => (
        <ServiceStatusRow key={service.id} service={service} />
      ))}
    </ul>
  )
}

export function StatusBadgeHover({
  status,
  services,
  title = "Services",
  className,
}: {
  status: AppStatus
  services?: ServiceStatusItem[]
  title?: string
  className?: string
}) {
  const serviceList = services ?? []
  const countLabel =
    serviceList.length === 0
      ? "No services"
      : `${serviceList.length} ${
          serviceList.length === 1 ? "service" : "services"
        }`

  return (
    <PreviewCard>
      <PreviewCardTrigger
        render={
          <span
            className={cn("inline-flex cursor-default", className)}
            onClick={stopCardClick}
            onPointerDown={stopCardClick}
          />
        }
      >
        <StatusBadge status={status} />
      </PreviewCardTrigger>
      <PreviewCardPopup className="flex w-56 min-w-0 flex-col p-3 shadow-md/10">
        <div className="flex w-full min-w-0 flex-col gap-1.5 overflow-hidden">
          <p className="truncate text-xs text-muted-foreground">
            {title} · {countLabel}
          </p>
          <ServiceStatusList services={serviceList} />
        </div>
      </PreviewCardPopup>
    </PreviewCard>
  )
}

export function DeployedTimeHover({
  dateStr,
  label,
  relative,
  description,
  size = "xs",
  className,
  children,
}: {
  dateStr: string
  label: string
  relative: string
  description?: string
  size?: "xs" | "sm"
  className?: string
  children?: React.ReactNode
}) {
  const full = formatFullDateTime(dateStr)
  const detail =
    description ??
    (label === "Last service"
      ? "When the most recent service in this project was added."
      : label === "Created"
        ? "When this project was created."
        : "When this service was first deployed.")

  const textClass = size === "sm" ? "text-sm" : "text-xs"
  const isLastService = label === "Last service"
  const hoverHintClass = isLastService
    ? "cursor-help underline-offset-2 hover:underline hover:decoration-dotted hover:decoration-muted-foreground/70"
    : "cursor-default"

  return (
    <PreviewCard>
      <PreviewCardTrigger
        render={
          <span
            className={cn("inline-flex tabular-nums", hoverHintClass, className)}
            onClick={stopCardClick}
            onPointerDown={stopCardClick}
          />
        }
      >
        {children ?? (
          <span className={cn(textClass, "text-muted-foreground")}>
            <span className="text-muted-foreground/70">{label}</span> {relative}
          </span>
        )}
      </PreviewCardTrigger>
      <PreviewCardPopup>
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1">
            <h4 className="font-medium text-sm">{label}</h4>
            <p className="text-muted-foreground text-sm">{detail}</p>
          </div>
          <p className="text-muted-foreground text-xs">{full}</p>
        </div>
      </PreviewCardPopup>
    </PreviewCard>
  )
}
