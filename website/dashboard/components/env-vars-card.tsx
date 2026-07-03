"use client"

import React, { useMemo, useState } from "react"
import {
  Frame,
  FramePanel,
  FrameTitle,
  FrameDescription,
} from "@/dashboard/components/ui/frame"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/dashboard/components/ui/table"
import { Badge } from "@/dashboard/components/ui/badge"
import { Button } from "@/dashboard/components/ui/button"
import { Input } from "@/dashboard/components/ui/input"
import { NucleoIcon } from "@/dashboard/components/nucleo-icons"
import { cn } from "@/dashboard/lib/utils"

interface EnvVarsCardProps {
  /** Map of env var name → value. Secret values arrive pre-redacted as "***". */
  envVars: Record<string, string>
  /** Keys whose values are managed secrets (redacted server-side). */
  secretKeys?: string[]
  className?: string
  /** Callback triggered when clicking the edit button */
  onEdit?: () => void
}

interface EnvVarEntry {
  key: string
  value: string
  isSecret: boolean
}

function ValueCell({
  value,
  isSecret,
  revealed,
}: {
  value: string
  isSecret: boolean
  revealed: boolean
}) {
  const isEmpty = value === ""

  if (isEmpty) {
    return (
      <span className="font-mono text-xs text-muted-foreground">-</span>
    )
  }

  if (isSecret) {
    return (
      <span className="font-mono text-xs text-muted-foreground">
        ••••••••
      </span>
    )
  }

  if (revealed) {
    return (
      <span
        className="truncate font-mono text-xs text-foreground"
        title={value}
      >
        {value}
      </span>
    )
  }

  return (
    <span className="font-mono text-xs text-muted-foreground">
      {"•".repeat(Math.min(value.length, 12))}
    </span>
  )
}

function ActionsCell({
  isSecret,
  isEmpty,
  revealed,
  onToggleReveal,
  value,
}: {
  isSecret: boolean
  isEmpty: boolean
  revealed: boolean
  onToggleReveal: () => void
  value: string
}) {
  const [copied, setCopied] = useState(false)

  const copy = () => {
    if (isSecret || isEmpty) return
    navigator.clipboard.writeText(value)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  if (isSecret || isEmpty) {
    return <span className="inline-block h-4 w-4" />
  }

  return (
    <div className="flex items-center justify-end gap-0.5">
      <Button
        size="icon-xs"
        variant="ghost"
        onClick={onToggleReveal}
        title={revealed ? "Hide value" : "Reveal value"}
      >
        <NucleoIcon
          name={revealed ? "eye-off" : "eye"}
          className="h-3.5 w-3.5"
        />
      </Button>
      <Button
        size="icon-xs"
        variant="ghost"
        onClick={copy}
        title="Copy value"
      >
        <NucleoIcon
          name={copied ? "check" : "copy"}
          className={cn("h-3.5 w-3.5", copied && "text-success")}
        />
      </Button>
    </div>
  )
}

export function EnvVarsCard({
  envVars,
  secretKeys = [],
  className,
  onEdit,
}: EnvVarsCardProps) {
  const [query, setQuery] = useState("")
  const [revealed, setRevealed] = useState<Record<string, boolean>>({})
  const [allRevealed, setAllRevealed] = useState(false)

  const secretSet = useMemo(() => new Set(secretKeys), [secretKeys])

  const entries: EnvVarEntry[] = useMemo(
    () =>
      Object.entries(envVars)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, value]) => ({
          key,
          value,
          isSecret: secretSet.has(key),
        })),
    [envVars, secretSet],
  )

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return entries
    return entries.filter((e) => e.key.toLowerCase().includes(q))
  }, [entries, query])

  const hasRevealable = entries.some((e) => !e.isSecret && e.value !== "")

  const toggleAll = () => {
    const next = !allRevealed
    setAllRevealed(next)
    if (next) {
      const all: Record<string, boolean> = {}
      for (const e of entries) {
        if (!e.isSecret && e.value !== "") all[e.key] = true
      }
      setRevealed(all)
    } else {
      setRevealed({})
    }
  }

  return (
    <Frame className={cn("w-full", className)}>
      {/* Header card */}
      <FramePanel>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <FrameTitle>Environment Variables</FrameTitle>
            <FrameDescription>
              {entries.length} variable{entries.length !== 1 ? "s" : ""}{" "}
              configured
            </FrameDescription>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {entries.length > 4 && (
              <div className="relative">
                <NucleoIcon
                  name="search"
                  className="pointer-events-none absolute left-2.5 top-1/2 h-3 w-3 -translate-y-1/2 text-muted-foreground"
                />
                <Input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Filter variables…"
                  className="h-7 w-36 pl-6 text-xs sm:w-44"
                />
              </div>
            )}
            {hasRevealable && (
              <Button
                size="sm"
                variant="outline"
                onClick={toggleAll}
                className="gap-1.5 text-xs"
              >
                <NucleoIcon
                  name={allRevealed ? "eye-off" : "eye"}
                  className="h-3.5 w-3.5"
                />
                {allRevealed ? "Hide all" : "Reveal all"}
              </Button>
            )}
            {onEdit && (
              <Button
                size="sm"
                variant="outline"
                onClick={onEdit}
                className="gap-1.5 text-xs"
              >
                <NucleoIcon name="edit" className="h-3.5 w-3.5" />
                Edit
              </Button>
            )}
          </div>
        </div>
      </FramePanel>

      {/* Data table */}
      {filtered.length === 0 ? (
        <FramePanel className="flex flex-col items-center justify-center gap-2 py-10 text-center text-xs text-muted-foreground">
          <NucleoIcon name="search" className="h-5 w-5 opacity-40" />
          <p>No variables match &ldquo;{query}&rdquo;.</p>
        </FramePanel>
      ) : (
        <Table variant="card">
          <TableHeader>
            <TableRow>
              <TableHead className="w-[40%]">Key</TableHead>
              <TableHead className="w-[45%]">Value</TableHead>
              <TableHead className="w-[15%] text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((entry) => {
              const isRevealed = !!revealed[entry.key]
              return (
                <TableRow key={entry.key}>
                  <TableCell>
                    <div className="flex min-w-0 items-center gap-2">
                      <span
                        className="truncate font-mono text-xs font-semibold text-foreground"
                        title={entry.key}
                      >
                        {entry.key}
                      </span>
                      {entry.isSecret && (
                        <Badge
                          variant="secondary"
                          size="sm"
                          className="shrink-0 gap-1"
                        >
                          <NucleoIcon name="lock" className="h-2.5 w-2.5" />
                          <span className="hidden sm:inline">Secret</span>
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <ValueCell
                      value={entry.value}
                      isSecret={entry.isSecret}
                      revealed={isRevealed}
                    />
                  </TableCell>
                  <TableCell className="text-right">
                    <ActionsCell
                      isSecret={entry.isSecret}
                      isEmpty={entry.value === ""}
                      revealed={isRevealed}
                      onToggleReveal={() =>
                        setRevealed((prev) => ({
                          ...prev,
                          [entry.key]: !prev[entry.key],
                        }))
                      }
                      value={entry.value}
                    />
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      )}
    </Frame>
  )
}
