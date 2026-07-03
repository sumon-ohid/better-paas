import { NextResponse } from "next/server"

function trimSlash(url: string): string {
  return url.replace(/\/$/, "")
}

function manifestUrls(request: Request): { apiUrl: string; uiUrl: string } {
  const reqURL = new URL(request.url)
  const origin = reqURL.origin
  const hostname = reqURL.hostname
  const isLocal = hostname === "localhost" || hostname === "127.0.0.1"

  const explicitAPI = process.env.NEXT_PUBLIC_API_URL?.trim()
  let apiUrl = explicitAPI ? trimSlash(explicitAPI) : ""
  if (!apiUrl) {
    if (isLocal) {
      apiUrl = `${reqURL.protocol}//${hostname}:8080`
    } else if (
      reqURL.port !== "3000" &&
      reqURL.port !== "3001"
    ) {
      apiUrl = origin
    } else {
      apiUrl = `${reqURL.protocol}//${hostname}:8080`
    }
  }

  const explicitUI = process.env.NEXT_PUBLIC_PAAS_UI_URL?.trim()
  const uiUrl = explicitUI ? trimSlash(explicitUI) : origin

  return { apiUrl, uiUrl }
}

export function GET(request: Request) {
  return NextResponse.json(manifestUrls(request), {
    headers: {
      "Cache-Control": "public, max-age=300",
    },
  })
}
