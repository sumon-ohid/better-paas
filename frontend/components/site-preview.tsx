"use client"

import React, { useEffect, useRef, useState } from "react"
import { NucleoIcon } from "@/components/nucleo-icons"
import { StatusDot } from "@/components/status-badge"
import { cn } from "@/lib/utils"

interface SitePreviewProps {
  /** Live URL of the deployed app. */
  url: string
  /** Current app status — drives the placeholder vs. live preview. */
  status: string
  className?: string
}

// The iframe is rendered at a fixed desktop viewport and scaled down to fit the
// container, so the embedded site lays out like a real browser window rather
// than a cramped mobile view. This mirrors the screenshot tiles Vercel shows.
const PREVIEW_VIEWPORT_WIDTH = 1280
const PREVIEW_VIEWPORT_HEIGHT = 800

export function SitePreview({ url, status, className }: SitePreviewProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const [scale, setScale] = useState(0)
  const [reloadToken, setReloadToken] = useState(0)
  // Track which url/reload combination has finished loading, so the spinner
  // clears only for the frame that's actually shown — no effect needed to reset.
  const [loadedKey, setLoadedKey] = useState("")

  const isRunning = status === "running"
  const isBuilding = status === "building"
  const displayUrl = url.replace(/^https?:\/\//, "").replace(/\/$/, "")
  const frameKey = `${url}#${reloadToken}`
  const loaded = loadedKey === frameKey

  // Keep the embedded viewport scaled to the available width.
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const update = () => setScale(el.clientWidth / PREVIEW_VIEWPORT_WIDTH)
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  return (
    <div
      className={cn(
        "overflow-hidden rounded-xl border border-border bg-card/72 backdrop-blur-xl",
        className,
      )}
    >
      {/* Browser chrome */}
      <div className="flex items-center gap-2 border-b border-border/70 bg-muted/30 px-3 py-2">
        <div className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-rose-400/80" />
          <span className="h-2.5 w-2.5 rounded-full bg-amber-400/80" />
          <span className="h-2.5 w-2.5 rounded-full bg-emerald-400/80" />
        </div>
        <div className="ml-1 flex min-w-0 flex-1 items-center gap-1.5 rounded-md border border-border/60 bg-background/60 px-2 py-1">
          <NucleoIcon name="lock" className="h-3 w-3 shrink-0 text-muted-foreground" />
          <span className="truncate text-[11px] font-mono text-muted-foreground">{displayUrl}</span>
        </div>
        <button
          onClick={() => setReloadToken((t) => t + 1)}
          disabled={!isRunning}
          title="Reload preview"
          className="shrink-0 rounded p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-40 disabled:pointer-events-none"
        >
          <NucleoIcon name="refresh" className="h-3 w-3" />
        </button>
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          title="Open in new tab"
          className="shrink-0 rounded p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <NucleoIcon name="external" className="h-3 w-3" />
        </a>
      </div>

      {/* Viewport */}
      <div ref={containerRef} className="relative aspect-16/10 w-full overflow-hidden bg-muted/10">
        {isRunning ? (
          <>
            {scale > 0 && (
              <iframe
                key={reloadToken}
                src={url}
                title="Live site preview"
                loading="lazy"
                sandbox="allow-scripts allow-same-origin allow-forms"
                referrerPolicy="no-referrer"
                onLoad={() => setLoadedKey(frameKey)}
                className="absolute left-0 top-0 origin-top-left border-0 bg-white"
                style={{
                  width: PREVIEW_VIEWPORT_WIDTH,
                  height: PREVIEW_VIEWPORT_HEIGHT,
                  transform: `scale(${scale})`,
                }}
              />
            )}
            {!loaded && (
              <div className="absolute inset-0 flex items-center justify-center bg-muted/20">
                <NucleoIcon name="loader" className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            )}
            {/* Click-through overlay → open the real site, and stops the iframe
                from stealing scroll/clicks while it acts as a thumbnail. */}
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="group absolute inset-0 flex items-end justify-end p-3"
              title="Open site"
            >
              <span className="inline-flex items-center gap-1 rounded-md bg-background/90 px-2 py-1 text-[11px] font-medium text-foreground opacity-0 shadow-sm backdrop-blur transition-opacity group-hover:opacity-100">
                <NucleoIcon name="external" className="h-3 w-3" />
                Open site
              </span>
            </a>
          </>
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-center">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted/40">
              <NucleoIcon
                name={isBuilding ? "loader" : "web"}
                className={cn("h-5 w-5 text-muted-foreground", isBuilding && "animate-spin")}
              />
            </div>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <StatusDot status={status} />
              {isBuilding ? "Building deployment…" : "Preview unavailable while stopped"}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
