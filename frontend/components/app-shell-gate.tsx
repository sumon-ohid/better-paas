"use client"

import { usePathname } from "next/navigation"
import { AuthGate } from "@/components/auth-gate"
import { OnboardingGate } from "@/components/onboarding-gate"
import { ServerProvider } from "@/components/server-context"

/** Skips dashboard auth/onboarding for public connect flows (CLI browser login). */
export function AppShellGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  if (pathname?.startsWith("/connect")) {
    return <>{children}</>
  }
  return (
    <AuthGate>
      <ServerProvider>
        <OnboardingGate>{children}</OnboardingGate>
      </ServerProvider>
    </AuthGate>
  )
}
