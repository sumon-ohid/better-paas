"use client"

import React, { useMemo, useState } from "react"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { NucleoIcon } from "@/components/nucleo-icons"
import { cn } from "@/lib/utils"

interface EnvVarsCardProps {
  /** Map of env var name → value. Secret values arrive pre-redacted as "***". */
  envVars: Record<string, string>
  /** Keys whose values are managed secrets (redacted server-side). */
  secretKeys?: string[]
  className?: string
}

// A single env var row: monospace key on the left, masked value on the right
// with per-row reveal + copy affordances. Secret values can't be revealed since
// the server never sends them in cleartext.
function EnvVarRow({
  name,
  value,
  isSecret,
  revealed,
  onToggleReveal,
}: {
  name: string
  value: string
  isSecret: boolean
  revealed: boolean
  onToggleReveal: () => void
}) {
  const [copied, setCopied] = useState(false)
  const isEmpty = value === ""

  const copy = () => {
    if (isSecret || isEmpty) return
    navigator.clipboard.writeText(value)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <div className="group grid grid-cols-[minmax(0,2fr)_minmax(0,3fr)] items-center gap-3 px-3 py-2 transition-colors hover:bg-muted/40">
      {/* Key */}
      <div className="flex min-w-0 items-center gap-2">
        <span className="truncate font-mono text-xs font-semibold text-foreground" title={name}>
          {name}
        </span>
        {isSecret && (
          <Badge variant="secondary" size="sm" className="shrink-0 gap-1">
            <NucleoIcon name="lock" className="h-2.5 w-2.5" />
            Secret
          </Badge>
        )}
      </div>

      {/* Value */}
      <div className="flex min-w-0 items-center justify-end gap-1.5">
        <span
          className={cn(
            "truncate font-mono text-xs",
            isSecret || !revealed ? "text-muted-foreground" : "text-foreground",
          )}
          title={isSecret ? "Managed secret — hidden" : revealed ? value : undefined}
        >
          {isEmpty
            ? "—"
            : isSecret
              ? "••••••••"
              : revealed
                ? value
                : "•".repeat(Math.min(value.length, 12))}
        </span>

        {/* Per-row actions — only meaningful for revealable, non-empty values */}
        {!isSecret && !isEmpty && (
          <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
            <button
              type="button"
              onClick={onToggleReveal}
              title={revealed ? "Hide value" : "Reveal value"}
              className="flex h-6 w-6 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <NucleoIcon name={revealed ? "eye-off" : "eye"} className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={copy}
              title="Copy value"
              className="flex h-6 w-6 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <NucleoIcon
                name={copied ? "check" : "copy"}
                className={cn("h-3.5 w-3.5", copied && "text-success")}
              />
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

export function EnvVarsCard({ envVars, secretKeys = [], className }: EnvVarsCardProps) {
  const [query, setQuery] = useState("")
  const [revealed, setRevealed] = useState<Record<string, boolean>>({})
  const [allRevealed, setAllRevealed] = useState(false)

  const secretSet = useMemo(() => new Set(secretKeys), [secretKeys])

  const entries = useMemo(
    () => Object.entries(envVars).sort(([a], [b]) => a.localeCompare(b)),
    [envVars],
  )

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return entries
    return entries.filter(([k]) => k.toLowerCase().includes(q))
  }, [entries, query])

  // Whether there's at least one value we're actually allowed to reveal.
  const hasRevealable = entries.some(([k, v]) => !secretSet.has(k) && v !== "")

  const toggleAll = () => {
    const next = !allRevealed
    setAllRevealed(next)
    if (next) {
      const all: Record<string, boolean> = {}
      for (const [k, v] of entries) {
        if (!secretSet.has(k) && v !== "") all[k] = true
      }
      setRevealed(all)
    } else {
      setRevealed({})
    }
  }

  return (
    <Card className={cn("border-border bg-card/72 backdrop-blur-xl p-4 space-y-3", className)}>
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            Environment Variables
          </span>
          <Badge variant="secondary" size="sm">
            {entries.length}
          </Badge>
        </div>

        <div className="flex items-center gap-2">
          {entries.length > 6 && (
            <div className="relative">
              <NucleoIcon
                name="search"
                className="pointer-events-none absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-muted-foreground"
              />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Filter…"
                className="h-7 w-32 pl-7 text-xs sm:w-40"
              />
            </div>
          )}
          {hasRevealable && (
            <button
              type="button"
              onClick={toggleAll}
              className="inline-flex shrink-0 items-center gap-1 rounded-md border border-border bg-muted/20 px-2 py-1 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-muted/40 hover:text-foreground"
            >
              <NucleoIcon name={allRevealed ? "eye-off" : "eye"} className="h-3 w-3" />
              {allRevealed ? "Hide all" : "Reveal all"}
            </button>
          )}
        </div>
      </div>

      {/* Rows */}
      <div className="overflow-hidden rounded-md border border-border bg-muted/10 divide-y divide-border/60">
        {filtered.length === 0 ? (
          <div className="px-3 py-6 text-center text-xs text-muted-foreground">
            No variables match “{query}”.
          </div>
        ) : (
          filtered.map(([k, v]) => (
            <EnvVarRow
              key={k}
              name={k}
              value={v}
              isSecret={secretSet.has(k)}
              revealed={!!revealed[k]}
              onToggleReveal={() =>
                setRevealed((prev) => ({ ...prev, [k]: !prev[k] }))
              }
            />
          ))
        )}
      </div>
    </Card>
  )
}
