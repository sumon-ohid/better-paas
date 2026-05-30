"use client"

import React, { useState, useEffect, useRef, useCallback } from "react"
import { useRouter, usePathname } from "next/navigation"
import { useTheme } from "next-themes"
import {
  SidebarProvider,
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarInset,
  SidebarTrigger,
} from "@/components/ui/sidebar"
import { Button } from "@/components/ui/button"
import { Kbd } from "@/components/ui/kbd"
import { NucleoIcon } from "@/components/nucleo-icons"
import { toastManager } from "@/components/ui/toast"
import Image from "next/image"

type IconProps = Omit<React.ComponentProps<typeof NucleoIcon>, "name">
const PlusIcon = (props: IconProps) => <NucleoIcon {...props} name="plus" />
const GlobeIcon = (props: IconProps) => <NucleoIcon {...props} name="web" />
const ActivityIcon = (props: IconProps) => <NucleoIcon {...props} name="activity" />
const TerminalIcon = (props: IconProps) => <NucleoIcon {...props} name="terminal" />
const SettingsIcon = (props: IconProps) => <NucleoIcon {...props} name="settings" />
const SearchIcon = (props: IconProps) => <NucleoIcon {...props} name="search" />
const KeyboardIcon = (props: IconProps) => <NucleoIcon {...props} name="keyboard" />
const XIcon = (props: IconProps) => <NucleoIcon {...props} name="x" />
const HelpCircleIcon = (props: IconProps) => <NucleoIcon {...props} name="help" />
const SpinIcon = (props: IconProps) => <NucleoIcon {...props} name="refresh" />
const DatabaseIcon = (props: IconProps) => <NucleoIcon {...props} name="server" />
const ClockIcon = (props: IconProps) => <NucleoIcon {...props} name="activity" />
const ArchiveIcon = (props: IconProps) => <NucleoIcon {...props} name="folder" />

interface NavItem {
  id: string
  label: string
  icon: React.ReactNode
  href: string
  badge?: string | number
}

interface AppShellProps {
  children: React.ReactNode
  appCount?: number
  hasActiveLogs?: boolean
}

export function AppShell({ children, appCount, hasActiveLogs }: AppShellProps) {
  const router = useRouter()
  const pathname = usePathname()
  const { resolvedTheme, setTheme } = useTheme()

  const [showShortcuts, setShowShortcuts] = useState(false)
  const [showCommandPalette, setShowCommandPalette] = useState(false)
  const [commandQuery, setCommandQuery] = useState("")
  const [activeCommandIndex, setActiveCommandIndex] = useState(0)
  const [pendingKey, setPendingKey] = useState<string | null>(null)

  const runFilteredCommandRef = useRef<() => void>(() => {})
  const filteredCommandCountRef = useRef(1)

  const navItems: NavItem[] = [
    {
      id: "apps",
      label: "Applications",
      icon: <GlobeIcon className="h-3.5 w-3.5 text-chart-1" />,
      href: "/",
      badge: appCount,
    },
    {
      id: "health",
      label: "Node Health",
      icon: <ActivityIcon className="h-3.5 w-3.5 text-chart-3" />,
      href: "/health",
    },
    {
      id: "logs",
      label: "Live Logs",
      icon: <TerminalIcon className="h-3.5 w-3.5 text-chart-2" />,
      href: "/logs",
      badge: hasActiveLogs ? "●" : undefined,
    },
    {
      id: "addons",
      label: "Databases",
      icon: <DatabaseIcon className="h-3.5 w-3.5 text-chart-4" />,
      href: "/addons",
    },
    {
      id: "cron",
      label: "Scheduled Jobs",
      icon: <ClockIcon className="h-3.5 w-3.5 text-chart-5" />,
      href: "/cron",
    },
    {
      id: "backups",
      label: "Backups",
      icon: <ArchiveIcon className="h-3.5 w-3.5 text-chart-2" />,
      href: "/backups",
    },
    {
      id: "settings",
      label: "Settings",
      icon: <SettingsIcon className="h-3.5 w-3.5 text-muted-foreground" />,
      href: "/settings",
    },
  ]

  const allCommands = React.useMemo(
    () => [
      { label: "Deploy new service", shortcut: "N", action: () => router.push("/deploy") },
      { label: "Go to Applications", shortcut: "G A", action: () => router.push("/") },
      { label: "Go to Node Health", shortcut: "G M", action: () => router.push("/health") },
      { label: "Go to Live Logs", shortcut: "G L", action: () => router.push("/logs") },
      { label: "Go to Settings", shortcut: "G S", action: () => router.push("/settings") },
      {
        label: "Toggle Dark/Light Mode",
        shortcut: "D",
        action: () => setTheme(resolvedTheme === "dark" ? "light" : "dark"),
      },
      { label: "Open Keyboard Shortcuts", shortcut: "?", action: () => setShowShortcuts(true) },
    ],
    [resolvedTheme, setTheme, router],
  )

  const filteredCommands = React.useMemo(
    () => allCommands.filter((c) => c.label.toLowerCase().includes(commandQuery.toLowerCase())),
    [allCommands, commandQuery],
  )

  const runFilteredCommand = useCallback(() => {
    const cmd = filteredCommands[activeCommandIndex]
    if (cmd) {
      cmd.action()
      setShowCommandPalette(false)
    }
  }, [activeCommandIndex, filteredCommands])

  useEffect(() => {
    filteredCommandCountRef.current = filteredCommands.length
    runFilteredCommandRef.current = runFilteredCommand
  }, [filteredCommands.length, runFilteredCommand])

  // Keyboard shortcuts engine
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement
      const isInput =
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target.isContentEditable

      if (isInput) {
        if (showCommandPalette && e.key === "Enter") {
          e.preventDefault()
          runFilteredCommandRef.current()
        }
        if (showCommandPalette && e.key === "ArrowDown") {
          e.preventDefault()
          setActiveCommandIndex((prev) => (prev + 1) % Math.max(filteredCommandCountRef.current, 1))
        }
        if (showCommandPalette && e.key === "ArrowUp") {
          e.preventDefault()
          setActiveCommandIndex(
            (prev) =>
              (prev - 1 + filteredCommandCountRef.current) %
              Math.max(filteredCommandCountRef.current, 1),
          )
        }
        if (e.key === "Escape") setShowCommandPalette(false)
        return
      }

      if (e.key === "Escape") {
        setShowShortcuts(false)
        setShowCommandPalette(false)
        setPendingKey(null)
        return
      }

      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault()
        setShowCommandPalette((prev) => !prev)
        setCommandQuery("")
        setActiveCommandIndex(0)
        return
      }

      if (pendingKey === "g") {
        e.preventDefault()
        setPendingKey(null)
        const map: Record<string, string> = {
          a: "/",
          m: "/health",
          l: "/logs",
          s: "/settings",
        }
        const dest = map[e.key.toLowerCase()]
        if (dest) router.push(dest)
        return
      }

      if (e.key.toLowerCase() === "g") {
        setPendingKey("g")
        return
      }
      if (e.key.toLowerCase() === "n") {
        e.preventDefault()
        router.push("/deploy")
        return
      }
      if (e.key === "?") {
        e.preventDefault()
        setShowShortcuts((prev) => !prev)
        return
      }
      if (e.key.toLowerCase() === "d") {
        e.preventDefault()
        setTheme(resolvedTheme === "dark" ? "light" : "dark")
        return
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [pendingKey, resolvedTheme, showCommandPalette, setTheme, router])

  const isActive = (href: string) => {
    if (href === "/") return pathname === "/"
    return pathname.startsWith(href)
  }

  return (
    <SidebarProvider className="h-screen overflow-hidden">
      <div className="relative flex h-screen w-full overflow-hidden bg-transparent text-foreground transition-colors duration-200 selection:bg-primary/20">
        {/* Navigation Sidebar */}
        <Sidebar variant="inset" className="bg-transparent">
          <SidebarHeader className="relative flex flex-row items-center justify-between overflow-hidden px-4 py-3">
            <div className="pointer-events-none absolute inset-0 bg-pixel-grid opacity-60 mask-fade-b" />
            <div className="relative flex items-center gap-2.5">
              <Image 
                  width={8340}
                  height={840}
                  src="/logo.svg"
                  alt="Better-PaaS Logo"
                  className="size-8"
              />
              <div className="flex flex-col">
                <span className="font-bold text-base leading-none text-foreground">
                  Better-PaaS
                </span>
              </div>
            </div>
          </SidebarHeader>

          <SidebarContent className="p-2 space-y-4">
            <div className="px-2 pt-2">
              <button
                onClick={() => setShowCommandPalette(true)}
                className="flex w-full cursor-pointer items-center justify-between rounded-md border border-border/80 bg-muted/20 px-3 py-1.5 text-sm text-muted-foreground/80 transition-all duration-150 hover:border-primary/30 hover:bg-accent/50 hover:text-foreground"
              >
                <div className="flex items-center gap-1.5">
                  <SearchIcon className="h-3.5 w-3.5" />
                  <span>Search commands...</span>
                </div>
                <div className="flex items-center gap-0.5 text-xs font-mono text-muted-foreground bg-muted/40 px-1 rounded">
                  <span>⌘</span>
                  <span>K</span>
                </div>
              </button>
            </div>

            <SidebarMenu className="space-y-0.5">
              {navItems.map((item) => (
                <SidebarMenuItem key={item.id}>
                  <SidebarMenuButton
                    isActive={isActive(item.href)}
                    onClick={() => router.push(item.href)}
                    className={`flex items-center justify-between px-3 py-1.5 w-full rounded text-sm transition-all cursor-pointer ${
                      isActive(item.href)
                        ? "bg-accent text-foreground font-medium"
                        : "text-muted-foreground hover:bg-muted/20 hover:text-foreground"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      {item.icon}
                      <span>{item.label}</span>
                    </div>
                    {item.badge !== undefined && (
                      <span className="text-xs font-mono bg-muted/40 px-1 rounded-sm text-muted-foreground/80">
                        {item.badge}
                      </span>
                    )}
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarContent>

          {/* Sidebar Footer */}
          <div className="mt-auto p-4 flex items-center justify-between text-sm text-muted-foreground/60">
            <button
              onClick={() => setShowShortcuts(true)}
              className="flex items-center gap-1.5 hover:text-foreground cursor-pointer transition-colors duration-150"
            >
              <KeyboardIcon className="h-3.5 w-3.5" />
              <span>Keyboard shortcuts</span>
            </button>
            <span className="font-mono text-xs bg-muted/40 px-1 rounded">?</span>
          </div>
        </Sidebar>

        {/* Main Content Frame */}
        <SidebarInset className="du-card relative z-10 m-0 md:m-2 md:ml-0 flex min-w-0 flex-1 flex-col overflow-hidden rounded-xl border bg-card text-card-foreground shadow-xs/5">
          {/* Header Bar — pinned, never scrolls */}
          <header className="shrink-0 flex h-14 items-center justify-between border-b border-border bg-transparent px-4 select-none">
            <div className="flex items-center gap-2">
              <SidebarTrigger className="h-7 w-7 text-muted-foreground hover:text-foreground cursor-pointer" />
              <div className="h-3.5 w-px bg-border" />
              <span className="text-sm font-mono text-muted-foreground flex items-center gap-1.5 font-medium">
                <span className="h-1.5 w-1.5 rounded-full bg-success animate-pulse" />
                Active Node: vps-us-east-1
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Button
                onClick={() => router.push("/deploy")}
                className="flex h-8 cursor-pointer items-center gap-1.5 rounded-md border border-primary/30 bg-primary px-3 text-xs font-medium text-primary-foreground hover:bg-primary/90"
              >
                <PlusIcon className="h-3.5 w-3.5" />
                <span>Deploy service</span>
                <Kbd className="ml-1 h-4 py-2.5 rounded-sm border-0 bg-background/20 px-1 font-mono text-[11px] text-primary-foreground">
                  N
                </Kbd>
              </Button>
            </div>
          </header>

          {/* Page Content — scrolls independently */}
          <main className="relative flex-1 overflow-y-auto min-h-0">{children}</main>
        </SidebarInset>
      </div>

      {/* ── Modals ────────────────────────────────────────────────────── */}

      {/* Keyboard Shortcuts */}
      {showShortcuts && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="fixed inset-0 cursor-pointer" onClick={() => setShowShortcuts(false)} />
          <div className="relative w-full max-w-lg overflow-hidden rounded-lg border border-border bg-card/95 shadow-2xl backdrop-blur-xl animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between p-4 border-b border-border">
              <div className="flex items-center gap-1.5">
                <KeyboardIcon className="h-4 w-4 text-muted-foreground" />
                <span className="font-semibold text-base">Keyboard Shortcuts</span>
              </div>
              <button
                onClick={() => setShowShortcuts(false)}
                className="h-6 w-6 rounded hover:bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground cursor-pointer"
              >
                <XIcon className="h-4 w-4" />
              </button>
            </div>
            <div className="p-4 grid grid-cols-2 gap-x-6 gap-y-4 max-h-[400px] overflow-y-auto">
              <div className="space-y-3.5">
                <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground/80">
                  Navigation
                </span>
                {[
                  ["Applications", "g a"],
                  ["Node Health", "g m"],
                  ["Live Logs", "g l"],
                  ["Settings", "g s"],
                ].map(([label, keys]) => (
                  <div key={label} className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">{label}</span>
                    <div className="flex items-center gap-0.5">
                      {keys.split(" ").map((k, i) => (
                        <Kbd key={i}>{k}</Kbd>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
              <div className="space-y-3.5">
                <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground/80">
                  Actions
                </span>
                {[
                  ["Deploy Service", "n"],
                  ["Command Palette", "⌘ k"],
                  ["Toggle Dark Mode", "d"],
                  ["Shortcuts Guide", "?"],
                ].map(([label, keys]) => (
                  <div key={label} className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">{label}</span>
                    <div className="flex items-center gap-0.5">
                      {keys.split(" ").map((k, i) => (
                        <Kbd key={i}>{k}</Kbd>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="bg-muted/30 px-4 py-3 border-t border-border flex items-center justify-between text-xs text-muted-foreground">
              <span>
                Press <kbd className="font-mono bg-muted px-1 rounded text-foreground">Esc</kbd> to
                close
              </span>
              <HelpCircleIcon className="h-3.5 w-3.5 opacity-55" />
            </div>
          </div>
        </div>
      )}

      {/* Command Palette */}
      {showCommandPalette && (
        <div className="fixed inset-0 z-50 flex items-start justify-center p-4 pt-[10vh] bg-black/60 backdrop-blur-sm">
          <div
            className="fixed inset-0 cursor-pointer"
            onClick={() => setShowCommandPalette(false)}
          />
          <div className="relative w-full max-w-lg overflow-hidden rounded-lg border border-border bg-popover/95 shadow-2xl backdrop-blur-xl animate-in zoom-in-98 duration-150">
            <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
              <SearchIcon className="h-4 w-4 text-muted-foreground" />
              <input
                autoFocus
                value={commandQuery}
                onChange={(e) => {
                  setCommandQuery(e.target.value)
                  setActiveCommandIndex(0)
                }}
                placeholder="Type a command or search..."
                className="w-full bg-transparent border-0 outline-none text-sm placeholder:text-muted-foreground/60 text-foreground"
              />
              <div className="flex h-5 w-5 items-center justify-center rounded border border-border text-[9px] text-muted-foreground font-mono bg-muted/40 select-none">
                Esc
              </div>
            </div>
            <div className="py-2 max-h-[280px] overflow-y-auto">
              {filteredCommands.length === 0 ? (
                <div className="px-4 py-6 text-center text-xs text-muted-foreground">
                  No commands matching your query.
                </div>
              ) : (
                filteredCommands.map((cmd, idx) => (
                  <button
                    key={idx}
                    onClick={() => {
                      cmd.action()
                      setShowCommandPalette(false)
                    }}
                    className={`w-full flex items-center justify-between px-4 py-2 text-xs text-left cursor-pointer transition-colors ${
                      idx === activeCommandIndex
                        ? "bg-muted text-foreground font-semibold"
                        : "text-muted-foreground hover:bg-muted/30 hover:text-foreground"
                    }`}
                  >
                    <span>{cmd.label}</span>
                    <span className="font-mono text-[9px] text-muted-foreground/80 bg-muted/50 border border-border/80 px-1 rounded">
                      {cmd.shortcut}
                    </span>
                  </button>
                ))
              )}
            </div>
            <div className="bg-muted/30 px-4 py-2 border-t border-border flex items-center justify-between text-[10px] text-muted-foreground select-none">
              <div className="flex items-center gap-1.5">
                <span>↑↓ navigate</span>
                <span className="h-3 w-px bg-border" />
                <span>Enter select</span>
              </div>
              <span>Command Palette</span>
            </div>
          </div>
        </div>
      )}
    </SidebarProvider>
  )
}

// ── Toast System ──────────────────────────────────────────────────────────────
//
// Thin wrapper over the shared base-ui toast manager (components/ui/toast.tsx).
// Keeps the existing `useToast()` / `showToast(title, desc, type)` call sites
// working while delegating rendering, stacking, swipe-to-dismiss, a11y, and the
// success/error replay animations to the design-system primitive.

export type ToastType = "default" | "destructive" | "success" | "warning"

export interface Toast {
  id: string
  title: string
  description: string
  type?: ToastType
}

function mapType(type?: ToastType) {
  switch (type) {
    case "destructive":
      return "error" as const
    case "success":
      return "success" as const
    case "warning":
      return "warning" as const
    default:
      return "info" as const
  }
}

interface ToastContainerProps {
  toasts?: Toast[]
  onDismiss?: (id: string) => void
}

/**
 * Rendering now lives in the global <ToastProvider> (app/layout.tsx), so this
 * is a no-op kept only for backward compatibility with any external imports.
 */
export function ToastContainer(_props: ToastContainerProps) {
  void _props
  return null
}

export function useToast() {
  const showToast = useCallback(
    (title: string, description: string, type: ToastType = "default") => {
      return toastManager.add({
        title,
        description,
        type: mapType(type),
        timeout: 4000,
      })
    },
    [],
  )

  const dismissToast = useCallback((id: string) => {
    toastManager.close(id)
  }, [])

  // `toasts` retained for API compatibility; the provider owns the real list.
  return { toasts: [] as Toast[], showToast, dismissToast }
}

// ── Status Dot ────────────────────────────────────────────────────────────────
// Re-exported from the centralized status component so existing imports
// (`import { StatusDot } from "@/components/app-shell"`) keep working while the
// implementation lives in one place.
export { StatusDot } from "@/components/status-badge"

// ── Sparkline ─────────────────────────────────────────────────────────────────

export function Sparkline({
  data,
  colorStart,
  colorEnd,
}: {
  data: number[]
  colorStart: string
  colorEnd: string
}) {
  const width = 120
  const height = 40
  const padding = 2
  const id = `grad-${colorStart.replace("#", "")}-${colorEnd.replace("#", "")}`

  const points = data
    .map((val, index) => {
      const x = (index / (data.length - 1)) * (width - padding * 2) + padding
      const y = height - (val / 100) * (height - padding * 2) - padding
      return `${x},${y}`
    })
    .join(" ")

  return (
    <svg className="overflow-visible" width={width} height={height}>
      <polyline
        fill="none"
        stroke={`url(#${id})`}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={points}
      />
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor={colorStart} />
          <stop offset="100%" stopColor={colorEnd} />
        </linearGradient>
      </defs>
    </svg>
  )
}

// ── Log Terminal ──────────────────────────────────────────────────────────────

export function LogTerminal({
  logs,
  connected,
  label,
}: {
  logs: { message: string; timestamp: string }[]
  connected: boolean
  label?: string
}) {
  const endRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [logs])

  return (
    <div className="h-full bg-[#090a0f] font-mono text-xs text-slate-100 overflow-y-auto p-4 space-y-1.5 leading-relaxed">
      {logs.length === 0 ? (
        <div className="text-slate-400 italic h-full flex flex-col items-center justify-center gap-2 select-none">
          <TerminalIcon className={`h-6 w-6 opacity-45 ${connected ? "animate-pulse" : ""}`} />
          {connected ? (
            <span>Connected — waiting for log output...</span>
          ) : (
            <span className="flex items-center gap-1.5">
              <SpinIcon className="h-3.5 w-3.5 animate-spin" />
              Connecting to {label ?? "log stream"}...
            </span>
          )}
        </div>
      ) : (
        logs.map((log, i) => (
          <div key={i} className="flex gap-4">
            <span className="text-slate-500 select-none shrink-0">
              [{new Date(log.timestamp).toLocaleTimeString()}]
            </span>
            <span
              className={
                (log.message || "").startsWith("✖") || (log.message || "").includes("Error")
                  ? "text-rose-400 font-semibold"
                  : (log.message || "").startsWith("✅") || (log.message || "").startsWith("✔")
                    ? "text-[#93e0c0] font-semibold"
                    : "text-slate-100"
              }
            >
              {log.message}
            </span>
          </div>
        ))
      )}
      <div ref={endRef} />
    </div>
  )
}
