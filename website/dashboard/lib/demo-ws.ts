import {
  demoBuildLogsPayload,
  demoHostTerminalBanner,
  demoRuntimeLogsPayload,
  demoStatsPayload,
  demoTerminalBanner,
} from "./demo-api"

type Listener = ((ev: Event) => void) | null

/** Minimal WebSocket stand-in for read-only demo streams. */
export class DemoWebSocket {
  static readonly CONNECTING = 0
  static readonly OPEN = 1
  static readonly CLOSING = 2
  static readonly CLOSED = 3

  readonly CONNECTING = DemoWebSocket.CONNECTING
  readonly OPEN = DemoWebSocket.OPEN
  readonly CLOSING = DemoWebSocket.CLOSING
  readonly CLOSED = DemoWebSocket.CLOSED

  readyState = DemoWebSocket.CONNECTING
  binaryType: BinaryType = "blob"
  onopen: Listener = null
  onmessage: Listener = null
  onclose: Listener = null
  onerror: Listener = null

  private timer: ReturnType<typeof setInterval> | null = null
  private closed = false

  constructor(private readonly path: string) {
    queueMicrotask(() => {
      if (this.closed) return
      this.readyState = DemoWebSocket.OPEN
      this.onopen?.(new Event("open"))
      this.bootstrap()
    })
  }

  send(_data: string | ArrayBufferLike | Blob | ArrayBufferView): void {
    // Terminal echo - show that input is disabled in demo
    if (this.path.includes("terminal") && this.onmessage) {
      this.onmessage(
        new MessageEvent("message", {
          data: "\r\n\x1b[38;5;244m[read-only demo]\x1b[0m\r\n",
        }),
      )
    }
  }

  close(): void {
    this.closed = true
    if (this.timer) clearInterval(this.timer)
    this.readyState = DemoWebSocket.CLOSED
    this.onclose?.(new CloseEvent("close"))
  }

  private bootstrap(): void {
    if (this.path.includes("/ws/stats")) {
      const tick = () => {
        this.emit(JSON.stringify(demoStatsPayload()))
      }
      tick()
      this.timer = setInterval(tick, 2000)
      return
    }

    if (this.path.includes("/ws/runtime-logs")) {
      this.timer = setInterval(() => {
        this.emit(JSON.stringify(demoRuntimeLogsPayload()))
      }, 1500)
      return
    }

    if (this.path.includes("/ws/logs")) {
      this.timer = setInterval(() => {
        this.emit(JSON.stringify(demoBuildLogsPayload()))
      }, 1200)
      return
    }

    if (this.path.includes("/ws/host-terminal")) {
      this.emit(demoHostTerminalBanner() + "docker ps\r\n")
      this.emit(
        "CONTAINER ID   IMAGE                    STATUS\r\na1b2c3d4e5f6   storefront-web:latest    Up 2 hours\r\n",
      )
      this.emit("sumon@localhost:~$ ")
      return
    }

    if (this.path.includes("/ws/terminal")) {
      this.emit(demoTerminalBanner())
    }
  }

  private emit(data: string): void {
    if (this.closed || !this.onmessage) return
    this.onmessage(new MessageEvent("message", { data }))
  }
}

export function createDemoWebSocket(path: string): Promise<WebSocket> {
  return Promise.resolve(new DemoWebSocket(path) as unknown as WebSocket)
}
