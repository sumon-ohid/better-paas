"use client"

import type React from "react"
import { Button } from "@/components/ui/button"
import { Card, CardFooter, CardHeader, CardPanel } from "@/components/ui/card"
import {
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog"
import { Frame } from "@/components/ui/frame"
import { cn } from "@/lib/utils"

export const FRAMED_DIALOG_FRAME_CLASS = "bg-background/50"

export function FramedDialog({
  children,
  contentClassName = "max-w-lg",
  frameClassName = FRAMED_DIALOG_FRAME_CLASS,
  scrollable = false,
}: {
  children: React.ReactNode
  contentClassName?: string
  frameClassName?: string
  scrollable?: boolean
}) {
  return (
    <DialogContent
      className={cn(
        "border-0 bg-transparent p-0 shadow-none before:hidden [&::after]:hidden",
        scrollable && "max-h-[min(90dvh,720px)]",
        contentClassName,
      )}
      closeProps={{ className: "absolute end-3.5 top-3.5 z-10" }}
    >
      <Frame
        className={cn(
          "w-full border border-border/80 p-1 shadow-xs/5 dark:border-border/35 dark:bg-muted/25 dark:shadow-none",
          scrollable && "flex min-h-0 max-h-full flex-col",
          frameClassName,
        )}
      >
        <Card
          className={cn(
            "border-0 bg-background shadow-none before:hidden after:hidden dark:bg-card",
            scrollable && "flex min-h-0 flex-1 flex-col overflow-hidden",
          )}
        >
          {children}
        </Card>
      </Frame>
    </DialogContent>
  )
}

export function FramedDialogHeader({
  icon,
  title,
  description,
  descriptionClassName,
}: {
  icon: React.ReactNode
  title: React.ReactNode
  description?: React.ReactNode
  descriptionClassName?: string
}) {
  return (
    <CardHeader className="shrink-0">
      <div className="flex items-start gap-3 pr-8">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border border-border bg-muted/30">
          {icon}
        </div>
        <div className="min-w-0 space-y-0.5">
          <DialogTitle className="text-lg font-semibold leading-snug">
            {title}
          </DialogTitle>
          {description ? (
            <DialogDescription
              className={cn("text-sm leading-relaxed", descriptionClassName)}
            >
              {description}
            </DialogDescription>
          ) : null}
        </div>
      </div>
    </CardHeader>
  )
}

export function FramedDialogBody({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <CardPanel
      className={cn("min-h-0 flex-1 overflow-y-auto py-2", className)}
    >
      {children}
    </CardPanel>
  )
}

export function FramedDialogFooter({
  children,
  className,
  pinned = false,
}: {
  children: React.ReactNode
  className?: string
  pinned?: boolean
}) {
  return (
    <CardFooter
      className={cn(
        "mt-4 justify-end gap-2",
        pinned && "mt-0 shrink-0 border-t border-border/40 pt-4",
        className,
      )}
    >
      {children}
    </CardFooter>
  )
}

export function FramedDialogActions({
  cancelDisabled,
  submitLabel,
  submitDisabled,
  submitLoading,
  onSubmit,
  submitClassName,
  cancelLabel = "Cancel",
}: {
  cancelDisabled?: boolean
  cancelLabel?: string
  submitLabel: string
  submitDisabled: boolean
  submitLoading?: boolean
  onSubmit: () => void
  submitClassName?: string
}) {
  return (
    <FramedDialogFooter>
      <DialogClose
        render={
          <Button variant="ghost" disabled={cancelDisabled}>
            {cancelLabel}
          </Button>
        }
      />
      <Button
        onClick={onSubmit}
        disabled={submitDisabled}
        loading={submitLoading}
        className={submitClassName}
      >
        {submitLabel}
      </Button>
    </FramedDialogFooter>
  )
}
