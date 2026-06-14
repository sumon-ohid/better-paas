"use client"

import React, { createContext, useContext } from "react"

// The page owns the stateful shape; feature files narrow it where they consume it.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AppDetailContextValue = Record<string, any>

const AppDetailContext = createContext<AppDetailContextValue | null>(null)

export function AppDetailProvider({
  value,
  children,
}: {
  value: AppDetailContextValue
  children: React.ReactNode
}) {
  return (
    <AppDetailContext.Provider value={value}>
      {children}
    </AppDetailContext.Provider>
  )
}

export function useAppDetail() {
  const context = useContext(AppDetailContext)
  if (!context) {
    throw new Error("useAppDetail must be used inside AppDetailProvider")
  }
  return context
}
