"use client"

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from "react"
import { api } from "@/dashboard/lib/api"
import type { Server } from "@/dashboard/lib/types"
import { isDemoMode } from "@/dashboard/lib/demo"
import { DEMO_SERVERS } from "@/dashboard/lib/demo-data"

interface ServerContextType {
  activeServerId: string
  setActiveServerId: (id: string) => void
  servers: Server[]
  activeServer: Server | null
  isLoading: boolean
  refreshServers: () => Promise<void>
}

const ServerContext = createContext<ServerContextType | undefined>(undefined)

export function ServerProvider({ children }: { children: React.ReactNode }) {
  const [activeServerId, setActiveServerIdState] = useState<string>(() => {
    if (typeof window === "undefined") return "all"
    return localStorage.getItem("active-server-id") || "all"
  })
  const [servers, setServers] = useState<Server[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const setActiveServerId = useCallback((id: string) => {
    setActiveServerIdState(id)
    localStorage.setItem("active-server-id", id)
  }, [])

  const refreshServers = useCallback(async () => {
    if (isDemoMode()) {
      setServers(DEMO_SERVERS)
      setIsLoading(false)
      return
    }
    try {
      const list = await api.servers.list()
      setServers(list || [])
    } catch (err) {
      console.error("Failed to fetch servers list", err)
    } finally {
      setIsLoading(false)
    }
  }, [])

  // Initial load and periodic polling (every 5 seconds) to catch status transitions
  useEffect(() => {
    if (isDemoMode()) {
      setServers(DEMO_SERVERS)
      setIsLoading(false)
      return
    }
    const initial = setTimeout(refreshServers, 0)
    const interval = setInterval(refreshServers, 5000)
    return () => {
      clearTimeout(initial)
      clearInterval(interval)
    }
  }, [refreshServers])

  useEffect(() => {
    if (isLoading || activeServerId === "all" || activeServerId === "localhost") return
    if (servers.some((s) => s.id === activeServerId)) return
    const timeout = setTimeout(() => setActiveServerId("all"), 0)
    return () => clearTimeout(timeout)
  }, [activeServerId, isLoading, servers, setActiveServerId])

  const activeServer = useMemo(() => {
    if (activeServerId === "all" || activeServerId === "localhost") return null
    return servers.find((s) => s.id === activeServerId) ?? null
  }, [activeServerId, servers])

  return (
    <ServerContext.Provider
      value={{
        activeServerId,
        setActiveServerId,
        servers,
        activeServer,
        isLoading,
        refreshServers,
      }}
    >
      {children}
    </ServerContext.Provider>
  )
}

export function useActiveServer() {
  const context = useContext(ServerContext)
  if (context === undefined) {
    throw new Error("useActiveServer must be used within a ServerProvider")
  }
  return context
}
