"use client"

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from "react"
import { api } from "@/lib/api"
import type { Server } from "@/lib/types"

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
  const [activeServerId, setActiveServerIdState] = useState<string>("all")
  const [servers, setServers] = useState<Server[]>([])
  const [isLoading, setIsLoading] = useState(true)

  // Load selected server from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem("active-server-id")
    if (saved) {
      setActiveServerIdState(saved)
    }
  }, [])

  const setActiveServerId = useCallback((id: string) => {
    setActiveServerIdState(id)
    localStorage.setItem("active-server-id", id)
  }, [])

  const refreshServers = useCallback(async () => {
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
    refreshServers()
    const interval = setInterval(refreshServers, 5000)
    return () => clearInterval(interval)
  }, [refreshServers])

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
