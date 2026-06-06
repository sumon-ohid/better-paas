"use client"

import { useEffect, useRef, useState } from "react"
import { NucleoIcon } from "@/components/nucleo-icons"
import { StatusDot } from "@/components/status-badge"
import { cn } from "@/lib/utils"

interface SitePreviewProps {
  /** Live URL of the deployed app. */
  url?: string
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
  const [isMixedContent, setIsMixedContent] = useState(false)

  const isRunning = status === "running"
  const isBuilding = status === "building"
  const displayUrl = url ? url.replace(/^https?:\/\//, "").replace(/\/$/, "") : "no-public-url"
  const frameKey = `${url || ""}#${reloadToken}`
  const loaded = loadedKey === frameKey

  // Detect mixed content blocking (HTTPS hosting HTTP iframe)
  useEffect(() => {
    if (typeof window !== "undefined" && window.location.protocol === "https:" && url?.startsWith("http://")) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setIsMixedContent(true)
    } else {
      setIsMixedContent(false)
    }
  }, [url])

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
      <div className="flex items-center gap-2 bg-muted/30 px-3 py-2">
        <div className="ml-1 flex min-w-0 flex-1 items-center gap-1.5 rounded-md border border-border/60 bg-background/60 px-2 py-1">
          <NucleoIcon name="lock" className="h-3 w-3 shrink-0 text-muted-foreground" />
          <span className="truncate text-[11px] font-mono text-muted-foreground">{displayUrl}</span>
        </div>
        <button
          onClick={() => setReloadToken((t) => t + 1)}
          disabled={!isRunning || !url}
          title="Reload preview"
          className="shrink-0 rounded p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-40 disabled:pointer-events-none"
        >
          <NucleoIcon name="refresh" className="h-3 w-3" />
        </button>
        {url && (
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            title="Open in new tab"
            className="shrink-0 rounded p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <NucleoIcon name="external" className="h-3 w-3" />
          </a>
        )}
      </div>

      {/* Viewport */}
      <div ref={containerRef} className="relative rounded-2xl border-y aspect-16/10 w-full overflow-hidden bg-muted/10">
        {isRunning ? (
          !url ? (
            /* No URL configured (Empty preview) */
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-center p-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted/40">
                <NucleoIcon name="link-2-off" className="h-5 w-5 text-muted-foreground" />
              </div>
              <div className="space-y-1">
                <p className="text-sm font-semibold text-foreground">No preview available</p>
                <p className="max-w-[280px] text-xs text-muted-foreground leading-normal">
                  This application has no public web URL configured (e.g. database or worker).
                </p>
              </div>
            </div>
          ) : isMixedContent ? (
            /* Mixed Content Blocked preview */
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-center p-6 bg-card/50">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-500/10 text-amber-500">
                <NucleoIcon name="triangle-alert" className="h-5 w-5" />
              </div>
              <div className="space-y-1">
                <p className="text-sm font-semibold text-foreground">Preview Insecure Blocked</p>
                <p className="max-w-[320px] text-xs text-muted-foreground leading-normal">
                  Your dashboard runs securely over HTTPS, but this app is served over HTTP. Modern browsers block mixed content previews.
                </p>
              </div>
              <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-1 inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground shadow transition-colors hover:bg-primary/90"
              >
                <NucleoIcon name="external" className="h-3 w-3" />
                Open App in New Tab
              </a>
            </div>
          ) : (
            /* Standard Iframe Preview */
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
          )
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
