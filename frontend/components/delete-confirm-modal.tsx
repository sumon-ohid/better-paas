"use client"

import React, { useState, useEffect, useRef } from "react"
import { NucleoIcon } from "@/components/nucleo-icons"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogDescription,
} from "@/components/ui/alert-dialog"
import { cn, copyText } from "@/lib/utils"

type IconProps = Omit<React.ComponentProps<typeof NucleoIcon>, "name">
const Trash2Icon = (props: IconProps) => <NucleoIcon {...props} name="trash" />
const CopyIcon = (props: IconProps) => <NucleoIcon {...props} name="copy" />
const CheckIcon = (props: IconProps) => <NucleoIcon {...props} name="check" />
const AlertIcon = (props: IconProps) => <NucleoIcon {...props} name="triangle-alert" />

interface DeleteConfirmModalProps {
  isOpen: boolean
  appName: string
  onConfirm: () => Promise<void>
  onCancel: () => void
}

/**
 * Type-to-confirm destructive modal built on the shared AlertDialog primitive.
 * Uses semantic destructive tokens (not raw hex) for consistent theming, and
 * surfaces a clear icon + validation state so users understand the stakes.
 */
export function DeleteConfirmModal({
  isOpen,
  appName,
  onConfirm,
  onCancel,
}: DeleteConfirmModalProps) {
  const [inputValue, setInputValue] = useState("")
  const [isDeleting, setIsDeleting] = useState(false)
  const [copied, setCopied] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (isOpen) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setInputValue("")
      setIsDeleting(false)
      setCopied(false)
      setTimeout(() => inputRef.current?.focus(), 80)
    }
  }, [isOpen])

  const isMatch = inputValue.trim() === appName.trim()

  const handleCopy = async () => {
    try {
      await copyText(appName)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      inputRef.current?.focus()
    }
  }

  const handleConfirm = async () => {
    if (!isMatch || isDeleting) return
    setIsDeleting(true)
    try {
      await onConfirm()
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <AlertDialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open && !isDeleting) onCancel()
      }}
    >
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10 ring-1 ring-inset ring-destructive/20 sm:mx-0">
            <AlertIcon className="h-5 w-5 text-destructive" />
          </div>
          <AlertDialogTitle>Delete {appName}?</AlertDialogTitle>
          <AlertDialogDescription>
            This permanently destroys the application, removes all containers, and deletes its
            configuration. This action cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="space-y-3 px-6 mb-4">
          {/* Project name - neutral, copyable chip */}
          <Button
            type="button"
            variant={"ghost"}
            onClick={handleCopy}
            className="group flex w-full items-center justify-between gap-2 rounded-lg bg-muted/30 px-3 py-2 text-left transition-colors hover:bg-muted/50 cursor-pointer"
            aria-label="Copy project name"
          >
            <span className="truncate font-mono text-sm font-semibold text-foreground">
              {appName}
            </span>
            {copied ? (
              <CheckIcon className="h-3.5 w-3.5 shrink-0 text-success" />
            ) : (
              <CopyIcon className="h-3.5 w-3.5 shrink-0 text-muted-foreground transition-colors group-hover:text-foreground" />
            )}
          </Button>

          {/* Confirmation input */}
          <div className="space-y-1.5">
            <Label htmlFor="delete-confirm-input" className="text-xs pb-2 font-semibold text-muted-foreground">
              Type the project name to confirm
            </Label>
            <Input
              id="delete-confirm-input"
              ref={inputRef}
              size={"sm"}
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleConfirm()}
              placeholder={appName}
              disabled={isDeleting}
              className={cn(
                "h-8 font-mono",
                inputValue.length > 0 &&
                  (isMatch
                    ? "border-success focus:border-success"
                    : "border-destructive focus:border-destructive"),
              )}
            />
            {inputValue.length > 0 && !isMatch && (
              <p className="text-xs font-medium text-destructive-foreground">
                Name doesn&apos;t match - check for typos.
              </p>
            )}
          </div>
        </div>

        <AlertDialogFooter>
          <Button variant="outline" onClick={onCancel} disabled={isDeleting}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleConfirm}
            disabled={!isMatch}
            loading={isDeleting}
            className="gap-1.5"
          >
            <Trash2Icon className="h-3.5 w-3.5" />
            {isDeleting ? "Deleting..." : "Delete project"}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
