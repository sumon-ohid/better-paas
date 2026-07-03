"use client"

import React, { useState, useEffect, useCallback } from "react"
import dynamic from "next/dynamic"
import { useSearchParams } from "next/navigation"
import { AppShell } from "@/dashboard/components/app-shell"
import { Button } from "@/dashboard/components/ui/button"
import {
  Frame,
  FramePanel,
  FrameTitle,
  FrameDescription,
} from "@/dashboard/components/ui/frame"
import { NucleoIcon } from "@/dashboard/components/nucleo-icons"
import { api } from "@/dashboard/lib/api"
import type { App } from "@/dashboard/lib/types"
import { useActiveServer } from "@/dashboard/components/server-context"

// xterm.js touches the DOM on import, so load the terminal client-side only.
const HostTerminal = dynamic(
  () => import("@/dashboard/components/container-terminal").then((m) => m.HostTerminal),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full min-h-0 items-center justify-center text-xs text-muted-foreground">
        Loading terminal…
      </div>
    ),
  },
)

type IconProps = Omit<React.ComponentProps<typeof NucleoIcon>, "name">
const RefreshIcon = (props: IconProps) => <NucleoIcon {...props} name="refresh" />

export default function TerminalPage() {
  // A token here lets the Reconnect button force the shell to re-mount.
  const [reconnectToken, setReconnectToken] = useState(0)
  const [appCount, setAppCount] = useState<number | undefined>(undefined)

  // If navigated from a server card with ?server=<id>, auto-select that server.
  const searchParams = useSearchParams()
  const { activeServerId, setActiveServerId, servers } = useActiveServer()

  useEffect(() => {
    const serverId = searchParams.get("server")
    if (!serverId) return
    // Wait until the server list has loaded before switching, so the context
    // can validate the ID exists.
    if (servers.length === 0) return
    setActiveServerId(serverId)
  }, [searchParams, servers, setActiveServerId])

  const fetchApps = useCallback(async () => {
    try {
      const apps: App[] = await api.apps.list()
      setAppCount(apps.length)
    } catch {
      // Non-critical: the sidebar badge just won't show a count.
    }
  }, [])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchApps()
  }, [fetchApps])

  const serverParam = searchParams.get("server")
  const isRemote = !!serverParam && serverParam !== "localhost"
  const serverName = isRemote
    ? (servers.find((s) => s.id === serverParam)?.name ?? "server")
    : "host"

  // Connection signal for the status dot: localhost is always reachable; remote
  // servers report a status through the server context.
  const activeServer = servers.find((s) => s.id === activeServerId)
  const noContext = activeServerId === "all"
  const connected = noContext
    ? false
    : activeServerId === "localhost" || activeServer?.status === "connected"

  return (
    <AppShell appCount={appCount}>
      <div className="animate-in fade-in-50 flex h-full min-h-0 flex-1 flex-col p-4 duration-200 md:p-6">
        <Frame className="h-full w-full">
          {/* Header */}
          <FramePanel className="shrink-0">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <FrameTitle className="flex items-center gap-2">
                  <span className="truncate">
                    {isRemote ? `Terminal - ${serverName}` : "Host Shell"}
                  </span>
                  <span
                    className={`inline-block h-1.5 w-1.5 shrink-0 rounded-full ${
                      connected ? "bg-success" : "bg-muted-foreground/30"
                    }`}
                  />
                </FrameTitle>
                <FrameDescription className="text-xs sm:text-sm">
                  {noContext
                    ? "Select a server to open a shell"
                    : isRemote
                      ? `Interactive shell on ${serverName}`
                      : "Interactive shell on the host machine running Better-PaaS"}
                </FrameDescription>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setReconnectToken((t) => t + 1)}
                className="h-7 shrink-0 gap-1.5 text-xs"
              >
                <RefreshIcon className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Reconnect</span>
              </Button>
            </div>
          </FramePanel>

          {/* Terminal surface */}
          <FramePanel className="relative flex min-h-0 flex-1 flex-col overflow-hidden !p-0">
            <HostTerminal reconnectToken={reconnectToken} />
          </FramePanel>
        </Frame>
      </div>
    </AppShell>
  )
}
