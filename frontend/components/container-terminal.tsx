"use client"

import React, { useEffect, useRef, useState } from "react"
import { useTheme } from "next-themes"
import { Terminal, type ITheme } from "@xterm/xterm"
import { FitAddon } from "@xterm/addon-fit"
import "@xterm/xterm/css/xterm.css"
import { createTerminalWs, createHostTerminalWs } from "@/lib/api"
import { NucleoIcon } from "@/components/nucleo-icons"

type IconProps = Omit<React.ComponentProps<typeof NucleoIcon>, "name">
const TerminalIcon = (props: IconProps) => <NucleoIcon {...props} name="terminal" />

// Shared ANSI palette. Background stays transparent so the container surface
// shows through; only the foreground/cursor differ per light/dark mode so the
// text stays legible on either backdrop.
const ANSI_COLORS = {
  red: "#f1542e",
  green: "#3c9f7a",
  yellow: "#d6a34a",
  blue: "#5aa9f6",
  magenta: "#8b7ff6",
  cyan: "#3c9f7a",
  brightRed: "#f1542e",
  brightGreen: "#5fe0a0",
  brightYellow: "#f5d04a",
  brightBlue: "#88a2f6",
  brightMagenta: "#b3aaf9",
  brightCyan: "#5fe0a0",
}

const DARK_THEME: ITheme = {
  background: "rgba(0,0,0,0)",
  foreground: "#ededed",
  cursor: "#8b7ff6",
  cursorAccent: "#121214",
  selectionBackground: "rgba(139, 127, 246, 0.35)",
  black: "#1b1b1d",
  white: "#ededed",
  brightBlack: "rgba(255,255,255,0.5)",
  brightWhite: "#ffffff",
  ...ANSI_COLORS,
}

const LIGHT_THEME: ITheme = {
  background: "rgba(0,0,0,0)",
  foreground: "#20212b",
  cursor: "#5e6ad2",
  cursorAccent: "#ffffff",
  selectionBackground: "rgba(94, 106, 210, 0.25)",
  black: "#20212b",
  white: "#5c5f6e",
  brightBlack: "rgba(20,21,31,0.55)",
  brightWhite: "#20212b",
  ...ANSI_COLORS,
}

interface XtermShellProps {
  /** Factory that opens the backing WebSocket for this shell session. */
  connect: () => WebSocket
  /** Label shown in the terminal chrome header, e.g. "web — shell". */
  title: string
  /** Bumping this value forces a reconnect (used by the Reconnect button). */
  reconnectToken: number
  /** Re-create the socket whenever these change (alongside reconnectToken). */
  sessionKey?: string
}

/**
 * The shared xterm.js shell surface. Renders the terminal chrome + xterm host
 * and bridges keystrokes/resize to a WebSocket-backed PTY. Both the per-app
 * container terminal and the host (server) terminal render through this so the
 * UI/UX stays identical.
 */
function XtermShell({ connect, title, reconnectToken, sessionKey }: XtermShellProps) {
  const hostRef = useRef<HTMLDivElement | null>(null)
  const termRef = useRef<Terminal | null>(null)
  const [connected, setConnected] = useState(false)
  const { resolvedTheme } = useTheme()

  useEffect(() => {
    const host = hostRef.current
    if (!host) return

    const term = new Terminal({
      cursorBlink: true,
      fontFamily:
        'var(--font-mono), ui-monospace, SFMono-Regular, Menlo, Monaco, "Cascadia Code", monospace',
      fontSize: 13,
      lineHeight: 1.4,
      theme: resolvedTheme === "light" ? LIGHT_THEME : DARK_THEME,
      allowTransparency: true,
      allowProposedApi: true,
      scrollback: 5000,
    })
    termRef.current = term
    const fitAddon = new FitAddon()
    term.loadAddon(fitAddon)
    term.open(host)

    // Initial fit, after layout settles.
    const safeFit = () => {
      try {
        fitAddon.fit()
      } catch {
        // host not measurable yet; ignore
      }
    }
    safeFit()
    term.focus()

    const ws = connect()
    ws.binaryType = "arraybuffer"

    const sendResize = () => {
      if (ws.readyState !== WebSocket.OPEN) return
      ws.send(JSON.stringify({ type: "resize", cols: term.cols, rows: term.rows }))
    }

    ws.onopen = () => {
      setConnected(true)
      safeFit()
      sendResize()
    }

    ws.onmessage = (event) => {
      if (typeof event.data === "string") {
        term.write(event.data)
      } else {
        term.write(new Uint8Array(event.data as ArrayBuffer))
      }
    }

    ws.onclose = () => {
      setConnected(false)
      term.write("\r\n\x1b[38;5;244m[session closed]\x1b[0m\r\n")
    }
    ws.onerror = () => setConnected(false)

    // Forward keystrokes to the PTY.
    const dataDisposable = term.onData((data) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: "input", data }))
      }
    })

    // Keep the PTY size in sync with the rendered terminal.
    const handleResize = () => {
      safeFit()
      sendResize()
    }
    window.addEventListener("resize", handleResize)

    // ResizeObserver catches container size changes (sidebar toggle, etc.).
    const ro = new ResizeObserver(() => handleResize())
    ro.observe(host)

    return () => {
      window.removeEventListener("resize", handleResize)
      ro.disconnect()
      dataDisposable.dispose()
      ws.onopen = null
      ws.onmessage = null
      ws.onclose = null
      ws.onerror = null
      ws.close()
      term.dispose()
      termRef.current = null
    }
    // resolvedTheme is intentionally omitted: it's only used for the initial
    // palette here, and the effect below live-updates it without reconnecting.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionKey, reconnectToken])

  // Live-update the terminal palette when the app theme changes, without
  // tearing down the active shell session.
  useEffect(() => {
    if (termRef.current) {
      termRef.current.options.theme = resolvedTheme === "light" ? LIGHT_THEME : DARK_THEME
    }
  }, [resolvedTheme])

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-lg border border-border/80 bg-transparent">
      {/* Terminal chrome header */}
      <div className="flex items-center gap-2 border-b border-border/60 px-4 py-2 shrink-0 select-none">
        <div className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-destructive/70" />
          <span className="h-2.5 w-2.5 rounded-full bg-warning/70" />
          <span className="h-2.5 w-2.5 rounded-full bg-success/70" />
        </div>
        <span className="ml-1.5 flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <TerminalIcon className="h-3 w-3" />
          {title}
        </span>
        <span className="ml-auto flex items-center gap-1.5 text-[10px] uppercase tracking-wider">
          <span
            className={`h-1.5 w-1.5 rounded-full ${connected ? "bg-success animate-pulse" : "bg-muted-foreground/30"}`}
          />
          <span className={connected ? "text-success" : "text-muted-foreground"}>
            {connected ? "Connected" : "Disconnected"}
          </span>
        </span>
      </div>

      {/* xterm host — padded so output doesn't hug the border */}
      <div ref={hostRef} className="min-h-0 flex-1 overflow-hidden px-3 py-2" />
    </div>
  )
}

interface ContainerTerminalProps {
  appId: string
  appName: string
  /** Bumping this value forces a reconnect (used by the Reconnect button). */
  reconnectToken: number
}

/**
 * A real PTY-backed terminal rendered with xterm.js, bridged to the backend
 * `/ws/terminal` WebSocket. Handles input, resize, and clean teardown.
 */
export function ContainerTerminal({ appId, appName, reconnectToken }: ContainerTerminalProps) {
  return (
    <XtermShell
      connect={() => createTerminalWs(appId)}
      title={`${appName} — shell`}
      reconnectToken={reconnectToken}
      sessionKey={appId}
    />
  )
}

import { useActiveServer } from "@/components/server-context"

interface HostTerminalProps {
  /** Bumping this value forces a reconnect (used by the Reconnect button). */
  reconnectToken: number
}

/**
 * A real PTY-backed terminal bridged to the backend `/ws/host-terminal`
 * WebSocket, giving the operator a shell on the server itself. Renders through
 * the same XtermShell surface as the per-container terminal so the UI matches.
 */
export function HostTerminal({ reconnectToken }: HostTerminalProps) {
  const { activeServerId, servers } = useActiveServer()

  if (activeServerId === "all") {
    return (
      <div className="flex h-full min-h-[300px] flex-col items-center justify-center rounded-lg border border-border bg-[#090a0f] text-sm text-slate-400 p-8 text-center space-y-4 font-mono select-none">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary mx-auto">
          <TerminalIcon className="h-6 w-6" />
        </div>
        <div className="space-y-1.5 max-w-sm">
          <p className="font-semibold text-slate-200">Terminal Context Required</p>
          <p className="text-xs text-slate-400 leading-relaxed">
            Please select a specific server context (e.g. Localhost or a remote VPS) from the top header selector to access its host terminal.
          </p>
        </div>
      </div>
    )
  }

  const serverName = activeServerId === "localhost" ? "localhost" : (servers.find((s) => s.id === activeServerId)?.name ?? "server")

  return (
    <XtermShell
      connect={() => createHostTerminalWs(activeServerId)}
      title={`${serverName} — host shell`}
      reconnectToken={reconnectToken}
      sessionKey={`host-${activeServerId}`}
    />
  )
}

export default ContainerTerminal
