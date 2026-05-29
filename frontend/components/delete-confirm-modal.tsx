"use client"

import React, { useState, useEffect, useRef } from "react"
import { NucleoIcon } from "@/components/nucleo-icons"

type IconProps = Omit<React.ComponentProps<typeof NucleoIcon>, "name">
const Trash2Icon = (props: IconProps) => <NucleoIcon {...props} name="trash" />
const CopyIcon = (props: IconProps) => <NucleoIcon {...props} name="copy" />
const CheckIcon = (props: IconProps) => <NucleoIcon {...props} name="check" />

interface DeleteConfirmModalProps {
  isOpen: boolean
  appName: string
  onConfirm: () => Promise<void>
  onCancel: () => void
}

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

  // Reset state when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      // Resets the confirmation form each time the modal opens.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setInputValue("")
      setIsDeleting(false)
      setCopied(false)
      // Focus the input after mount
      setTimeout(() => inputRef.current?.focus(), 80)
    }
  }, [isOpen])

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !isDeleting) onCancel()
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [isOpen, isDeleting, onCancel])

  if (!isOpen) return null

  const isMatch = inputValue.trim() === appName.trim()

  const handleCopy = () => {
    navigator.clipboard.writeText(appName)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
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
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/55 backdrop-blur-sm"
        onClick={() => !isDeleting && onCancel()}
      />

      {/* Modal */}
      <div className="relative z-10 w-full max-w-md rounded-xl border border-border bg-card shadow-2xl animate-in fade-in-0 zoom-in-95 duration-150">
        {/* Header */}
        <div className="p-6 pb-4 space-y-4">
          {/* Icon */}
          <div className="flex items-center justify-center w-11 h-11 rounded-full bg-rose-500/10 border border-rose-500/20 mx-auto">
            <Trash2Icon className="h-5 w-5 text-rose-500" />
          </div>

          {/* Copy */}
          <div className="text-center space-y-1.5">
            <h3 className="text-base font-semibold text-foreground">Purge Application</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              This will permanently destroy the application, remove all containers, and delete its
              configuration. This action{" "}
              <span className="text-rose-500 font-semibold">cannot be undone</span>.
            </p>
          </div>

          {/* Project name badge with copy */}
          <div className="rounded-lg bg-muted/50 border border-border px-3 py-2.5 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <span className="h-1.5 w-1.5 rounded-full bg-rose-500 shrink-0" />
              <span className="text-sm font-mono font-semibold text-foreground truncate">
                {appName}
              </span>
            </div>
            <button
              onClick={handleCopy}
              className="h-6 w-6 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors shrink-0 cursor-pointer"
              title="Copy project name"
            >
              {copied ? (
                <CheckIcon className="h-3 w-3 text-emerald-500" />
              ) : (
                <CopyIcon className="h-3 w-3" />
              )}
            </button>
          </div>
        </div>

        {/* Confirmation input */}
        <div className="px-6 pb-2 space-y-1.5">
          <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground block">
            Type the project name to confirm
          </label>
          <input
            ref={inputRef}
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleConfirm()}
            placeholder={appName}
            disabled={isDeleting}
            className={`w-full h-10 rounded-md border px-3 text-sm font-mono bg-background text-foreground placeholder:text-muted-foreground/40 outline-none transition-colors disabled:opacity-50 ${
              inputValue.length > 0
                ? isMatch
                  ? "border-emerald-500/60 focus:border-emerald-500"
                  : "border-rose-500/50 focus:border-rose-500"
                : "border-border focus:border-primary"
            }`}
          />
          {inputValue.length > 0 && !isMatch && (
            <p className="text-xs text-rose-500 font-medium">
              Name doesn&apos;t match — check for typos.
            </p>
          )}
        </div>

        {/* Footer actions */}
        <div className="p-6 pt-4 flex gap-2">
          <button
            onClick={onCancel}
            disabled={isDeleting}
            className="flex-1 h-10 rounded-md border border-border bg-background text-sm font-semibold text-foreground hover:bg-muted/60 transition-colors disabled:opacity-50 cursor-pointer"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={!isMatch || isDeleting}
            className="flex-1 h-10 rounded-md bg-rose-500 hover:bg-rose-600 text-white text-sm font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer flex items-center justify-center gap-1.5"
          >
            {isDeleting ? (
              <>
                <svg className="h-3.5 w-3.5 animate-spin" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Purging...
              </>
            ) : (
              "Confirm Purge"
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
