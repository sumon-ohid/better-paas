"use client"

import { useEffect } from "react"
import { useTheme } from "next-themes"
import { logoIconSvg } from "@/lib/logo-icon-svg"

export function ThemeFavicon() {
  const { resolvedTheme } = useTheme()

  useEffect(() => {
    if (!resolvedTheme) {
      return
    }

    const fill = resolvedTheme === "dark" ? "#ffffff" : "#000000"
    const href = `data:image/svg+xml,${encodeURIComponent(logoIconSvg(fill))}`
    let link = document.querySelector<HTMLLinkElement>('link[rel="icon"]')

    if (!link) {
      link = document.createElement("link")
      link.rel = "icon"
      document.head.appendChild(link)
    }

    link.href = href
  }, [resolvedTheme])

  return null
}
