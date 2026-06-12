"use client"

import React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { FoldersIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import { Menu, MenuItem, MenuPopup, MenuTrigger } from "@/components/ui/menu"
import type { ProjectSummary } from "@/lib/types"

export function BreadcrumbHeaderRow({
  trailing,
  children,
}: {
  trailing?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-2 sm:gap-x-3">
      <div className="min-w-0">{children}</div>
      {trailing ? (
        <div className="flex shrink-0 items-center gap-1.5">{trailing}</div>
      ) : null}
    </div>
  )
}

export const BreadcrumbRenameInput = React.forwardRef<
  HTMLInputElement,
  React.ComponentProps<typeof Input>
>(function BreadcrumbRenameInput({ className, ...props }, ref) {
  return (
    <Input
      ref={ref}
      unstyled
      size="sm"
      {...props}
      className={cn(
        "inline-flex h-auto w-auto min-w-[6ch] max-w-[min(52vw,280px)] border-0 border-b border-border bg-transparent px-0 shadow-none rounded-none ring-0 focus-within:border-foreground focus-within:ring-0 [&_[data-slot=input]]:h-5 [&_[data-slot=input]]:min-h-0 [&_[data-slot=input]]:px-0 [&_[data-slot=input]]:py-0 [&_[data-slot=input]]:text-sm [&_[data-slot=input]]:font-normal [&_[data-slot=input]]:leading-none",
        className,
      )}
    />
  )
})

export function BreadcrumbRenameIconButton({
  onClick,
  disabled,
  label,
  variant = "default",
  children,
}: {
  onClick: () => void
  disabled?: boolean
  label: string
  variant?: "default" | "success"
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className={cn(
        "flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors disabled:cursor-not-allowed disabled:opacity-50",
        variant === "success"
          ? "hover:bg-success/10 hover:text-success"
          : "hover:bg-muted hover:text-foreground",
      )}
    >
      {children}
    </button>
  )
}

export function ProjectBreadcrumb({
  projects,
  currentProjectId,
  projectCrumb,
  serviceCrumb,
}: {
  projects: ProjectSummary[]
  currentProjectId: string
  projectCrumb: React.ReactNode
  serviceCrumb?: React.ReactNode
}) {
  const router = useRouter()
  const otherProjects = projects.filter((p) => p.id !== currentProjectId)

  return (
    <Breadcrumb>
      <BreadcrumbList>
        <BreadcrumbItem>
          <BreadcrumbLink render={<Link href="/" />}>Projects</BreadcrumbLink>
        </BreadcrumbItem>
        {otherProjects.length > 0 && (
          <>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <Menu>
                <MenuTrigger
                  aria-label="Switch project"
                  render={
                    <Button
                      className="-m-1.5 text-muted-foreground"
                      size="icon-sm"
                      variant="ghost"
                    />
                  }
                >
                  <FoldersIcon aria-hidden="true" className="h-4 w-4" />
                </MenuTrigger>
                <MenuPopup align="start">
                  {otherProjects.map((p) => (
                    <MenuItem
                      key={p.id}
                      onClick={() => router.push(`/project/${p.id}`)}
                    >
                      {p.name}
                    </MenuItem>
                  ))}
                </MenuPopup>
              </Menu>
            </BreadcrumbItem>
          </>
        )}
        <BreadcrumbSeparator />
        <BreadcrumbItem>{projectCrumb}</BreadcrumbItem>
        {serviceCrumb ? (
          <>
            <BreadcrumbSeparator />
            <BreadcrumbItem>{serviceCrumb}</BreadcrumbItem>
          </>
        ) : null}
      </BreadcrumbList>
    </Breadcrumb>
  )
}
