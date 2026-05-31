"use client"

import React, { useState, useEffect, useCallback } from "react"
import dynamic from "next/dynamic"
import { AppShell } from "@/components/app-shell"
import { NucleoIcon } from "@/components/nucleo-icons"
import { api } from "@/lib/api"
import type { App } from "@/lib/types"

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

  return (
    <AppShell appCount={appCount}>
      <div className="flex h-full min-h-0 flex-col p-4 md:p-6">
        {/* Page header */}
        <div className="flex shrink-0 items-center gap-2.5">
          <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <TerminalIcon className="h-6 w-6" />
          </div>
          <div>
            <h2>Server Terminal</h2>
            <p className="text-sm text-muted-foreground">
              An interactive shell on the host machine running Better-PaaS.
            </p>
          </div>
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
