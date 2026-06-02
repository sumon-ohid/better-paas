"use client"

import React, { useState, useEffect, useCallback } from "react"
import dynamic from "next/dynamic"
import { useSearchParams } from "next/navigation"
import { AppShell } from "@/components/app-shell"
import { NucleoIcon } from "@/components/nucleo-icons"
import { api } from "@/lib/api"
import type { App } from "@/lib/types"
import { useActiveServer } from "@/components/server-context"

// xterm.js touches the DOM on import, so load the terminal client-side only.
const HostTerminal = dynamic(
  () => import("@/components/container-terminal").then((m) => m.HostTerminal),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full min-h-0 items-center justify-center rounded-lg border border-border/80 bg-card text-xs text-muted-foreground">
        Loading terminal…
      </div>
    ),
  },
)

type IconProps = Omit<React.ComponentProps<typeof NucleoIcon>, "name">
const TerminalIcon = (props: IconProps) => <NucleoIcon {...props} name="terminal" />
const RefreshIcon = (props: IconProps) => <NucleoIcon {...props} name="refresh" />

export default function TerminalPage() {
  // A token here lets the Reconnect button force the shell to re-mount.
  const [reconnectToken, setReconnectToken] = useState(0)
  const [appCount, setAppCount] = useState<number | undefined>(undefined)

  // If navigated from a server card with ?server=<id>, auto-select that server.
  const searchParams = useSearchParams()
  const { setActiveServerId, servers } = useActiveServer()

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
  const serverName =
    serverParam === "localhost" || !serverParam
      ? "host"
      : (servers.find((s) => s.id === serverParam)?.name ?? "server")

  return (
    <AppShell appCount={appCount}>
      <div className="flex h-full min-h-0 flex-col p-4 md:p-6">
        {/* Page header */}
        <div className="space-y-1 shrink-0">
          <h2 className="text-lg sm:text-xl font-bold tracking-tight text-foreground">
            {serverParam && serverParam !== "localhost"
              ? `Terminal — ${serverName}`
              : "Server Terminal"}
          </h2>
          <p className="text-xs sm:text-sm text-muted-foreground">
            {serverParam && serverParam !== "localhost"
              ? `Interactive shell on ${serverName}.`
              : "An interactive shell on the host machine running Better-PaaS."}
          </p>
        </div>

        {/* Terminal toolbar */}
        <div className="mt-6 flex shrink-0 items-center justify-between">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <TerminalIcon className="h-3.5 w-3.5" />
            <span>Host Shell</span>
          </div>
          <button
            onClick={() => setReconnectToken((t) => t + 1)}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
          >
            <RefreshIcon className="h-3 w-3" />
            Reconnect
          </button>
        </div>

        {/* Terminal surface */}
        <div className="mt-4 min-h-0 flex-1">
          <HostTerminal reconnectToken={reconnectToken} />
        </div>
      </div>
    </AppShell>
  )
}
