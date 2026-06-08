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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogPanel,
} from "@/components/ui/dialog"
import { NucleoIcon } from "@/components/nucleo-icons"
import { useAuth } from "@/components/auth-gate"
import { api } from "@/lib/api"
import { cleanVersion } from "@/lib/utils"
import { toastManager } from "@/components/ui/toast"
import {
  CommandDialog,
  CommandDialogPopup,
  Command,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandPanel,
  CommandGroup,
  CommandGroupLabel,
  CommandCollection,
  CommandItem,
  CommandShortcut,
  CommandFooter,
} from "@/components/ui/command"
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip"
import {
  IconAlarmClockFillDuo18,
  IconArrowDoorOut3FillDuo18,
  IconBoxArchiveFillDuo18,
  IconChartBarTrendUpFillDuo18,
  IconCloudFillDuo18,
  IconDarkLightFillDuo18,
  IconEarthFillDuo18,
  IconGauge3FillDuo18,
  IconGear2FillDuo18,
  IconKeyboardFillDuo18,
  IconLayers3FillDuo18,
  IconMagnifierFillDuo18,
  IconRocketFillDuo18,
  IconUnorderedListFillDuo18,
  IconVault3FillDuo18,
  IconWindowExpandBottomRightFillDuo18,
} from "nucleo-ui-essential-fill-duo-18"

import { useActiveServer } from "@/components/server-context"
import {
  Select,
  SelectTrigger,
  SelectPopup,
  SelectItem,
} from "@/components/ui/select"
import { Search } from "lucide-react";

type NucleoIconProps = Omit<React.ComponentProps<typeof NucleoIcon>, "name">
const SpinIcon = (props: NucleoIconProps) => <NucleoIcon {...props} name="refresh" />

type FillIconProps = React.ComponentProps<typeof IconRocketFillDuo18>
const GlobeIcon = (props: FillIconProps) => <IconEarthFillDuo18 {...props} />
const ActivityIcon = (props: FillIconProps) => <IconGauge3FillDuo18 {...props} />
const TerminalIcon = (props: FillIconProps) => <IconWindowExpandBottomRightFillDuo18 {...props} />
const SettingsIcon = (props: FillIconProps) => <IconGear2FillDuo18 {...props} />
const KeyboardIcon = (props: FillIconProps) => <IconKeyboardFillDuo18 {...props} />
const ListIcon = (props: FillIconProps) => <IconUnorderedListFillDuo18 {...props} />
const DatabaseIcon = (props: FillIconProps) => <IconVault3FillDuo18 {...props} />
const ClockIcon = (props: FillIconProps) => <IconAlarmClockFillDuo18 {...props} />
const ArchiveIcon = (props: FillIconProps) => <IconBoxArchiveFillDuo18 {...props} />
const ChartIcon = (props: FillIconProps) => <IconChartBarTrendUpFillDuo18 {...props} />
const DarkLightIcon = (props: FillIconProps) => <IconDarkLightFillDuo18 {...props} />
const StoreIcon = (props: FillIconProps) => <IconLayers3FillDuo18 {...props} />
const SignOutIcon = (props: FillIconProps) => <IconArrowDoorOut3FillDuo18 {...props} />
const ServerStackIcon = (props: FillIconProps) => <IconCloudFillDuo18 {...props} />
const RocketIcon = (props: FillIconProps) => <IconRocketFillDuo18 {...props} />

// ── Server Selector ───────────────────────────────────────────────────────────

function ServerSelector() {
  const { activeServerId, setActiveServerId, servers } = useActiveServer()
  const activeServerLabel =
    activeServerId === "all"
      ? "All servers"
      : activeServerId === "localhost"
        ? "Localhost"
        : servers.find((server) => server.id === activeServerId)?.name ?? "Unknown server"

  return (
    <Select value={activeServerId} onValueChange={(v) => v && setActiveServerId(v)}>
      <SelectTrigger
        aria-label="Filter by server"
        className="h-9 w-32 sm:w-60 border bg-muted/10 px-2 sm:px-2.5 text-xs hover:bg-muted/20"
      >
        <span className="flex min-w-0 flex-1 items-center gap-1.5 sm:gap-2">
          <ServerStackIcon className="h-3.5 w-3.5 shrink-0 text-amber-400" />
          <span className="hidden sm:inline shrink-0 font-medium text-muted-foreground">Server</span>
          <span className="truncate text-foreground">{activeServerLabel}</span>
        </span>
      </SelectTrigger>
      <SelectPopup alignItemWithTrigger={false}>
        <SelectItem value="all">
          <span className="flex items-center gap-2 text-xs">
            <span className="h-1.5 w-1.5 rounded-full bg-primary/60" />
            <span>All Servers</span>
          </span>
        </SelectItem>
        <SelectItem value="localhost">
          <span className="flex items-center gap-2 text-xs">
            <span className="h-1.5 w-1.5 rounded-full bg-success" />
            <span>Localhost</span>
            <span className="rounded-sm bg-primary/10 px-1 py-0.2 text-[9px] font-mono text-primary leading-none">local</span>
          </span>
        </SelectItem>
        {servers.filter((server) => server.id !== "localhost").map((server) => {
          const isConnected = server.status === "connected"
          const isError = server.status === "error"
          const dotColor = isConnected ? "bg-success" : isError ? "bg-destructive" : "bg-muted-foreground/45"
          return (
            <SelectItem key={server.id} value={server.id}>
              <span className="flex items-center gap-2 text-xs">
                <span className={`h-1.5 w-1.5 rounded-full ${dotColor}`} />
                <span className="truncate">{server.name}</span>
              </span>
            </SelectItem>
          )
        })}
      </SelectPopup>
    </Select>
  )
}


interface NavItem {
  id: string
  label: string
  icon: React.ReactNode
  href: string
  badge?: string | number
}

interface NavSection {
  label: string
  items: NavItem[]
}

// Static reference for the keyboard-shortcuts cheat sheet. Mirrors the bindings
// implemented in the keydown handler below. Kept as plain data (label + keys)
// because this dialog is a read-only guide, not a launcher — the command
// palette (⌘K) is the searchable "do things" surface.
const SHORTCUT_SECTIONS: { heading: string; items: [string, string[]][] }[] = [
  {
    heading: "Navigation",
    items: [
      ["Applications", ["g", "a"]],
      ["Node Health", ["g", "m"]],
      ["Live Logs", ["g", "l"]],
      ["Server Terminal", ["g", "t"]],
      ["Settings", ["g", "s"]],
    ],
  },
  {
    heading: "Actions",
    items: [
      ["Deploy service", ["n"]],
      ["Command palette", ["⌘", "k"]],
      ["Toggle dark mode", ["d"]],
      ["Shortcuts guide", ["?"]],
    ],
  },
]

interface AppShellProps {
  children: React.ReactNode
  appCount?: number
  hasActiveLogs?: boolean
}

// Global cache to persist version across route changes without page unmount/remount flickering
let cachedVersion: string | null = null
let cachedUpdateAvailable = false
let lastFetchTime = 0
const CACHE_TTL = 300000 // 5 minutes

export function AppShell({ children, appCount, hasActiveLogs }: AppShellProps) {
  const router = useRouter()
  const pathname = usePathname()
  const { resolvedTheme, setTheme } = useTheme()
  const { signOut } = useAuth()

  // Build version shown in the sidebar header. We also surface whether a newer
  // release exists so the operator notices updates without visiting Settings.
  const [version, setVersion] = useState<string | null>(cachedVersion)
  const [updateAvailable, setUpdateAvailable] = useState(cachedUpdateAvailable)

  useEffect(() => {
    const now = Date.now()
    if (cachedVersion && (now - lastFetchTime < CACHE_TTL)) {
      return
    }

    let cancelled = false
    api.system
      .version()
      .then((v) => {
        cachedVersion = v.version
        lastFetchTime = Date.now()
        if (!cancelled) setVersion(v.version)
      })
      .catch(() => {})
    // Non-blocking update check; cached server-side for 30 min so this is cheap.
    api.system
      .updateCheck()
      .then((s) => {
        const hasUpdate = s.configured && s.hasUpdate
        cachedUpdateAvailable = hasUpdate
        if (!cancelled) setUpdateAvailable(hasUpdate)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])

  const [showShortcuts, setShowShortcuts] = useState(false)
  const [showCommandPalette, setShowCommandPalette] = useState(false)
  const [pendingKey, setPendingKey] = useState<string | null>(null)
  const baseNavIconClass = "h-4 w-4 text-sidebar-foreground/70"

  const navSections: NavSection[] = [
    {
      label: "Deploy",
      items: [
        {
          id: "apps",
          label: "Applications",
          icon: <GlobeIcon className="h-4 w-4 text-primary" />,
          href: "/",
          badge: appCount,
        },
        {
          id: "catalog",
          label: "App Catalog",
          icon: <StoreIcon className={baseNavIconClass} />,
          href: "/catalog",
        },
      ],
    },
    {
      label: "Operate",
      items: [
        {
          id: "servers",
          label: "Servers",
          icon: <ServerStackIcon className={baseNavIconClass} />,
          href: "/servers",
        },
        {
          id: "health",
          label: "Node Health",
          icon: <ActivityIcon className="h-4 w-4 text-success" />,
          href: "/health",
        },
        {
          id: "logs",
          label: "Live Logs",
          icon: <ListIcon className={baseNavIconClass} />,
          href: "/logs",
          badge: hasActiveLogs ? "●" : undefined,
        },
        {
          id: "terminal",
          label: "Server Terminal",
          icon: <TerminalIcon className={baseNavIconClass} />,
          href: "/terminal",
        },
        {
          id: "cron",
          label: "Scheduled Jobs",
          icon: <ClockIcon className="h-4 w-4 text-warning" />,
          href: "/cron",
        },
      ],
    },
    {
      label: "Data",
      items: [
        {
          id: "addons",
          label: "Databases",
          icon: <DatabaseIcon className="h-4 w-4 text-chart-3" />,
          href: "/addons",
        },
        {
          id: "backups",
          label: "Backups",
          icon: <ArchiveIcon className={baseNavIconClass} />,
          href: "/backups",
        },
      ],
    },
    {
      label: "Insights",
      items: [
        {
          id: "analytics",
          label: "Web Analytics",
          icon: <ChartIcon className="h-4 w-4 text-primary" />,
          href: "/analytics",
        },
      ],
    },
    {
      label: "Admin",
      items: [
        {
          id: "settings",
          label: "Settings",
          icon: <SettingsIcon className={baseNavIconClass} />,
          href: "/settings",
        },
      ],
    },
  ]

  type CommandAction = {
    id: string
    label: string
    shortcut: string
    icon: React.ReactNode
    action: () => void
  }
  type CommandGroupData = { heading: string; items: CommandAction[] }

  const commandGroups: CommandGroupData[] = React.useMemo(
    () => [
      {
        heading: "Actions",
        items: [
          {
            id: "deploy",
            label: "Deploy new service",
            shortcut: "N",
            icon: <RocketIcon className="h-4 w-4 text-primary" />,
            action: () => router.push("/deploy"),
          },
          {
            id: "theme",
            label: "Toggle Dark/Light Mode",
            shortcut: "D",
            icon: <DarkLightIcon className="h-4 w-4 text-primary" />,
            action: () => setTheme(resolvedTheme === "dark" ? "light" : "dark"),
          },
          {
            id: "shortcuts",
            label: "Open Keyboard Shortcuts",
            shortcut: "?",
            icon: <KeyboardIcon className="h-4 w-4 text-muted-foreground" />,
            action: () => setShowShortcuts(true),
          },
        ],
      },
      {
        heading: "Navigation",
        items: [
          {
            id: "nav-apps",
            label: "Go to Applications",
            shortcut: "G A",
            icon: <GlobeIcon className="h-4 w-4 text-primary" />,
            action: () => router.push("/"),
          },
          {
            id: "nav-catalog",
            label: "Go to App Catalog",
            shortcut: "",
            icon: <StoreIcon className="h-4 w-4 text-muted-foreground" />,
            action: () => router.push("/catalog"),
          },
          {
            id: "nav-health",
            label: "Go to Node Health",
            shortcut: "G M",
            icon: <ActivityIcon className="h-4 w-4 text-success" />,
            action: () => router.push("/health"),
          },
          {
            id: "nav-logs",
            label: "Go to Live Logs",
            shortcut: "G L",
            icon: <ListIcon className="h-4 w-4 text-muted-foreground" />,
            action: () => router.push("/logs"),
          },
          {
            id: "nav-terminal",
            label: "Go to Server Terminal",
            shortcut: "G T",
            icon: <TerminalIcon className="h-4 w-4 text-muted-foreground" />,
            action: () => router.push("/terminal"),
          },
          {
            id: "nav-analytics",
            label: "Go to Web Analytics",
            shortcut: "",
            icon: <ChartIcon className="h-4 w-4 text-primary" />,
            action: () => router.push("/analytics"),
          },
          {
            id: "nav-settings",
            label: "Go to Settings",
            shortcut: "G S",
            icon: <SettingsIcon className="h-4 w-4 text-muted-foreground" />,
            action: () => router.push("/settings"),
          },
        ],
      },
    ],
    [resolvedTheme, setTheme, router],
  )

  const runCommand = useCallback((action: () => void) => {
    setShowCommandPalette(false)
    action()
  }, [])

  // Keyboard shortcuts engine
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement
      const isInput =
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target.isContentEditable

      // ⌘K / Ctrl+K toggles the palette from anywhere (incl. inputs).
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault()
        setShowCommandPalette((prev) => !prev)
        return
      }

      // While typing in any field (including the palette's own input), let the
      // field handle the keystroke — the Command component manages its own
      // arrow/enter/escape navigation internally.
      if (isInput || showCommandPalette) return

      if (e.key === "Escape") {
        setShowShortcuts(false)
        setPendingKey(null)
        return
      }

      if (pendingKey === "g") {
        e.preventDefault()
        setPendingKey(null)
        const map: Record<string, string> = {
          a: "/",
          m: "/health",
          l: "/logs",
          t: "/terminal",
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
      <div className="relative flex h-screen w-full overflow-hidden text-foreground transition-colors duration-200 selection:bg-primary/20">
        {/* Navigation Sidebar */}
        <Sidebar variant="inset" className="">
          <SidebarHeader className="relative flex flex-row items-center justify-between overflow-hidden px-4 py-3">
            <div className="relative flex items-center gap-2.5">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img 
                  src="/logo.svg"
                  alt="Better-PaaS Logo"
                  className="size-6"
              />
              <div className="flex items-center gap-2">
                <span className="font-bold text-base leading-none text-sidebar-foreground">
                  Better-PaaS
                </span>
                {version && (
                  <Tooltip>
                    <TooltipTrigger
                      render={
                        updateAvailable ? (
                          <button
                            onClick={() => router.push("/settings")}
                            className="flex items-center gap-1 rounded-sm bg-warning/10 px-1.5 py-0.5 text-[10px] font-mono leading-none text-warning hover:bg-warning/20 cursor-pointer whitespace-nowrap"
                          >
                            <span className="h-1.5 w-1.5 rounded-full bg-warning animate-pulse" />
                            {cleanVersion(version)}
                          </button>
                        ) : (
                          <span 
                            className="rounded-sm bg-muted/50 px-1.5 py-0.5 text-[10px] font-mono leading-none text-muted-foreground/80 whitespace-nowrap cursor-default"
                          >
                            {cleanVersion(version)}
                          </span>
                        )
                      }
                    />
                    <TooltipContent side="right" className="flex flex-col gap-1 max-w-[180px] select-none text-[11px] font-sans">
                      <div className="flex items-center justify-between gap-4">
                        <span className="font-semibold text-foreground">Better-PaaS</span>
                        <span className="font-mono text-[10px] text-muted-foreground/80">{version}</span>
                      </div>
                      <div className="h-px bg-border/40 my-0.5" />
                      {updateAvailable ? (
                        <div className="flex items-center gap-1.5 text-warning font-medium leading-normal">
                          <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-warning animate-pulse" />
                          <span>Update available</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5 text-success font-medium leading-normal">
                          <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-success" />
                          <span>Up to date</span>
                        </div>
                      )}
                    </TooltipContent>
                  </Tooltip>
                )}
              </div>
            </div>
          </SidebarHeader>

          <SidebarContent className="p-2 space-y-4">
            <div className="pt-2">
              <button
                onClick={() => setShowCommandPalette(true)}
                className="flex w-full cursor-pointer items-center justify-between rounded-md border border-sidebar-border px-3 py-1.5 text-sm text-sidebar-foreground/75 transition-all duration-150 hover:border-primary/35 hover:bg-sidebar-accent hover:text-sidebar-foreground"
              >
                <div className="flex items-center gap-1.5">
                  <Search className="h-3.5 w-3.5" />
                  <span>Search commands...</span>
                </div>
                <Kbd className="flex items-center gap-0.5 text-xs font-mono text-muted-foreground bg-muted/40 px-1 rounded">
                  <span>⌘</span>
                  <span>K</span>
                </Kbd>
              </button>
            </div>

            <div className="space-y-4">
              {navSections.map((section) => (
                <div key={section.label} className="space-y-1.5">
                  <div className="px-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-sidebar-foreground/50">
                    {section.label}
                  </div>
                  <SidebarMenu className="space-y-0.5">
                    {section.items.map((item) => (
                      <SidebarMenuItem key={item.id}>
                        <SidebarMenuButton
                          isActive={isActive(item.href)}
                          onClick={() => router.push(item.href)}
                          className={`flex items-center justify-between px-3 py-1.5 w-full rounded-md text-sm transition-all cursor-pointer ${
                            isActive(item.href)
                              ? "bg-sidebar-accent text-sidebar-accent-foreground font-semibold]"
                              : "text-sidebar-foreground/80 hover:bg-sidebar-accent/65 hover:text-sidebar-foreground"
                          }`}
                        >
                          <div className="flex min-w-0 items-center gap-2">
                            {item.icon}
                            <span className="truncate">{item.label}</span>
                          </div>
                          {item.badge !== undefined && (
                            <span className="text-xs font-mono bg-sidebar-accent px-1 rounded-sm text-sidebar-foreground/75">
                              {item.badge}
                            </span>
                          )}
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    ))}
                  </SidebarMenu>
                </div>
              ))}
            </div>
          </SidebarContent>

          {/* Sidebar Footer */}
          <div className="mt-auto space-y-1 p-3">
            <button
              onClick={signOut}
              className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm text-sidebar-foreground/75 transition-colors duration-150 hover:bg-destructive/10 hover:text-destructive-foreground cursor-pointer"
            >
              <SignOutIcon className="h-3.5 w-3.5" />
              <span>Sign out</span>
            </button>
            <div className="flex items-center justify-between px-2 pt-1 text-sm text-sidebar-foreground/60">
              <button
                onClick={() => setShowShortcuts(true)}
                className="flex items-center gap-1.5 hover:text-sidebar-foreground cursor-pointer transition-colors duration-150"
              >
                <KeyboardIcon className="h-3.5 w-3.5" />
                <span>Keyboard shortcuts</span>
              </button>
              <span className="font-mono text-xs bg-sidebar-accent px-1 rounded">?</span>
            </div>
          </div>
        </Sidebar>

        {/* Main Content Frame */}
        <SidebarInset className="du-card relative z-10 m-0 md:m-2 md:ml-0 flex min-w-0 flex-1 flex-col overflow-hidden rounded-xl border bg-card text-card-foreground shadow-xs/5">
          {/* Header Bar — pinned, never scrolls */}
          <header className="shrink-0 flex h-14 items-center justify-between bg-transparent px-4 select-none">
            <div className="flex items-center gap-2.5">
              <SidebarTrigger className="h-7 w-7 text-muted-foreground hover:text-foreground cursor-pointer" />
              <div className="h-4 w-px bg-border" />
              <ServerSelector />
            </div>
            <div className="flex items-center gap-2">
              <Button
                onClick={() => router.push("/deploy")}
                className="flex h-8 cursor-pointer items-center gap-1.5 rounded-md border border-primary/35 bg-primary px-3 text-xs font-semibold text-primary-foreground shadow-sm hover:bg-primary/90"
              >
                <RocketIcon className="h-3.5 w-3.5 shrink-0" />
                <span>Deploy<span className="hidden sm:inline"> service</span></span>
                <Kbd className="ml-1 h-4 py-2.5 rounded-sm border-0 bg-background/20 px-1 font-mono text-[11px] text-primary-foreground hidden md:inline-flex">
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

      {/* Keyboard Shortcuts — read-only reference (the palette is the launcher) */}
      <Dialog open={showShortcuts} onOpenChange={setShowShortcuts}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <KeyboardIcon className="h-4 w-4 text-muted-foreground" />
              Keyboard Shortcuts
            </DialogTitle>
            <DialogDescription>
              Press these keys anywhere to navigate and act without reaching for the mouse.
            </DialogDescription>
          </DialogHeader>
          <DialogPanel>
            <div className="grid grid-cols-1 gap-x-8 gap-y-6 sm:grid-cols-2">
              {SHORTCUT_SECTIONS.map((section) => (
                <div key={section.heading} className="space-y-3">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground/70">
                    {section.heading}
                  </span>
                  <div className="space-y-2.5">
                    {section.items.map(([label, keys]) => (
                      <div key={label} className="flex items-center justify-between gap-3 text-sm">
                        <span className="text-muted-foreground">{label}</span>
                        <div className="flex items-center gap-1">
                          {keys.map((k, i) => (
                            <Kbd key={i}>{k}</Kbd>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <p className="mt-6 border-t border-border/40 pt-3 text-xs text-muted-foreground">
              Tip: chord shortcuts like <Kbd>g</Kbd> <Kbd>a</Kbd> mean press{" "}
              <span className="font-medium text-foreground">g</span> then{" "}
              <span className="font-medium text-foreground">a</span>. Use{" "}
              <Kbd>⌘</Kbd> <Kbd>k</Kbd> for the searchable command palette.
            </p>
          </DialogPanel>
        </DialogContent>
      </Dialog>

      {/* Command Palette */}
      <CommandDialog open={showCommandPalette} onOpenChange={setShowCommandPalette}>
        <CommandDialogPopup>
          <Command
            items={commandGroups}
            itemToStringValue={(item) => (item as CommandAction).label}
          >
            <CommandInput placeholder="Type a command or search..." />
            <CommandPanel>
              <CommandEmpty>No commands matching your query.</CommandEmpty>
              <CommandList>
                {(group: CommandGroupData) => (
                  <CommandGroup key={group.heading} items={group.items}>
                    <CommandGroupLabel>{group.heading}</CommandGroupLabel>
                    <CommandCollection>
                      {(cmd: CommandAction) => (
                        <CommandItem
                          key={cmd.id}
                          value={cmd}
                          onClick={() => runCommand(cmd.action)}
                          className="gap-2.5"
                        >
                          <span className="flex h-5 w-5 shrink-0 items-center justify-center">
                            {cmd.icon}
                          </span>
                          <span className="flex-1 truncate">{cmd.label}</span>
                          <CommandShortcut>{cmd.shortcut}</CommandShortcut>
                        </CommandItem>
                      )}
                    </CommandCollection>
                  </CommandGroup>
                )}
              </CommandList>
            </CommandPanel>
            <CommandFooter>
              <div className="flex items-center gap-1.5">
                <Kbd>↑</Kbd>
                <Kbd>↓</Kbd>
                <span>navigate</span>
                <span className="mx-1 h-3 w-px bg-border" />
                <Kbd>↵</Kbd>
                <span>select</span>
              </div>
              <span>Command Palette</span>
            </CommandFooter>
          </Command>
        </CommandDialogPopup>
      </CommandDialog>
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
    <svg
      className="overflow-visible w-full h-10 max-w-[120px]"
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
    >
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
