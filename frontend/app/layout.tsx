import { Geist_Mono, Inter } from "next/font/google"

import "./globals.css"
import { ThemeProvider } from "@/components/theme-provider"
import { ToastProvider } from "@/components/ui/toast"
import { AppShellGate } from "@/components/app-shell-gate"
import { cn } from "@/lib/utils";

const interHeading = Inter({subsets:['latin'],variable:'--font-heading'});

const inter = Inter({subsets:['latin'],variable:'--font-sans'})

const geistMono = Geist_Mono({subsets:['latin'],variable:'--font-mono'})

export const metadata = {
  title: "Better-PaaS",
  description: "A clean deployment control surface for local worker nodes.",
  manifest: "/site.webmanifest",
  icons: {
    icon: [
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
    ],
    apple: "/apple-touch-icon.png",
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={cn("antialiased", "font-sans", inter.variable, interHeading.variable, geistMono.variable)}
    >
      <body>
        <ThemeProvider>
          <ToastProvider>
            <AppShellGate>{children}</AppShellGate>
          </ToastProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
