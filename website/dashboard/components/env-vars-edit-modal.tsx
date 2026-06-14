"use client"

import React, { useEffect, useRef, useState } from "react"
import {
  Dialog,
  DialogPopup,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogPanel,
  DialogFooter,
  DialogClose,
} from "@/dashboard/components/ui/dialog"
import { Button } from "@/dashboard/components/ui/button"
import { Input } from "@/dashboard/components/ui/input"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupText,
  InputGroupTextarea,
} from "@/dashboard/components/ui/input-group"
import { Label } from "@/dashboard/components/ui/label"
import { Badge } from "@/dashboard/components/ui/badge"
import { NucleoIcon } from "@/dashboard/components/nucleo-icons"
import { parseEnvBlock, serializeEnvVars } from "@/dashboard/lib/app-detail-utils"

type EnvVarItem = { key: string; value: string; isSecret: boolean }

function buildInitialItems(
  envVars: Record<string, string>,
  secretKeys: string[]
): EnvVarItem[] {
  const secretSet = new Set(secretKeys)
  const loaded = Object.entries(envVars)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => ({
      key,
      value,
      isSecret: secretSet.has(key),
    }))
  return loaded.length > 0 ? loaded : [{ key: "", value: "", isSecret: false }]
}

interface EnvVarsEditModalProps {
  isOpen: boolean
  onClose: () => void
  envVars: Record<string, string>
  secretKeys?: string[]
  onSave: (envVars: Record<string, string>) => Promise<void>
  isSaving?: boolean
}

export function EnvVarsEditModal({
  isOpen,
  onClose,
  envVars,
  secretKeys = [],
  onSave,
  isSaving = false,
}: EnvVarsEditModalProps) {
  const [items, setItems] = useState<EnvVarItem[]>([])
  const [showBulk, setShowBulk] = useState(false)
  const [bulkText, setBulkText] = useState("")
  const secretSetRef = useRef(new Set<string>())

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (!isOpen) return
    const secretSet = new Set(secretKeys)
    secretSetRef.current = secretSet
    const loaded = buildInitialItems(envVars, secretKeys)
    setItems(loaded)
    setShowBulk(false)
    setBulkText("")
  }, [isOpen, envVars, secretKeys])
  /* eslint-enable react-hooks/set-state-in-effect */

  const addItem = () =>
    setItems((prev) => [...prev, { key: "", value: "", isSecret: false }])

  const removeItem = (index: number) =>
    setItems((prev) => prev.filter((_, i) => i !== index))

  const updateItem = (index: number, patch: Partial<EnvVarItem>) => {
    setItems((prev) => {
      const next = [...prev]
      next[index] = { ...next[index], ...patch }
      return next
    })
  }

  const toggleBulk = () => {
    setShowBulk((prev) => {
      const next = !prev
      if (next) {
        const text = serializeEnvVars(items.filter((i) => i.key.trim()))
        setBulkText(text)
      } else {
        setBulkText("")
      }
      return next
    })
  }

  const handleApplyBulk = () => {
    const parsed = parseEnvBlock(bulkText)
    const secrets = secretSetRef.current

    const nextItems: EnvVarItem[] = parsed.map((p) => ({
      key: p.key,
      value: p.value,
      isSecret: secrets.has(p.key),
    }))

    setItems(
      nextItems.length > 0
        ? nextItems
        : [{ key: "", value: "", isSecret: false }]
    )
    setShowBulk(false)
    setBulkText("")
  }

  const handleSave = async () => {
    const record: Record<string, string> = {}
    items.forEach((item) => {
      if (item.key.trim()) {
        record[item.key.trim()] = item.value.trim()
      }
    })
    await onSave(record)
    onClose()
  }

  const parsedCount = bulkText.trim() ? parseEnvBlock(bulkText).length : 0

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogPopup className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-base">
            Edit Environment Variables
          </DialogTitle>
          <DialogDescription className="text-xs">
            Update key-value pairs for this application. Empty keys are ignored.
          </DialogDescription>
        </DialogHeader>
        <DialogPanel>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Variables
              </Label>
              <div className="flex items-center gap-1.5">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={toggleBulk}
                  className="h-7 gap-1 text-xs"
                >
                  {showBulk ? (
                    <>
                      <NucleoIcon name="x" className="h-3 w-3" />
                      Cancel
                    </>
                  ) : (
                    <>
                      <NucleoIcon name="copy" className="h-3 w-3" />
                      Bulk .env
                    </>
                  )}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={addItem}
                  className="h-7 gap-1 text-xs"
                >
                  <NucleoIcon name="plus" className="h-3 w-3" />
                  Add
                </Button>
              </div>
            </div>

            {/* Bulk paste textarea */}
            {showBulk && (
              <div className="animate-in fade-in-50 duration-200">
                <InputGroup>
                  <InputGroupTextarea
                    value={bulkText}
                    onChange={(e) => setBulkText(e.target.value)}
                    placeholder={`KEY=value\nDATABASE_URL="postgres://..."\n# comments are ignored\nexport API_KEY=secret`}
                    className="min-h-[160px] text-xs font-mono placeholder:text-muted-foreground/50 resize-none"
                  />
                  <InputGroupAddon align="block-end">
                    <InputGroupText className="text-muted-foreground text-xs">
                      {parsedCount > 0
                        ? `${parsedCount} variable${parsedCount !== 1 ? "s" : ""} detected`
                        : "Type KEY=value pairs"}
                    </InputGroupText>
                    <Button
                      type="button"
                      size="sm"
                      className="ml-auto gap-1 text-xs"
                      disabled={parsedCount === 0}
                      onClick={handleApplyBulk}
                    >
                      <NucleoIcon name="check" className="h-3.5 w-3.5" />
                      Apply
                    </Button>
                  </InputGroupAddon>
                </InputGroup>
              </div>
            )}

            {!showBulk && (
              <div className="max-h-[280px] space-y-2 overflow-y-auto pr-1">
                {items.map((item, index) => (
                  <div key={index} className="flex gap-2 items-start">
                    <div className="flex-1">
                      <Input
                        value={item.key}
                        onChange={(e) =>
                          updateItem(index, { key: e.target.value })
                        }
                        placeholder="KEY"
                        className="h-8 border-border bg-background text-xs font-mono"
                      />
                    </div>
                    <div className="flex-[1.5]">
                      <Input
                        value={item.value}
                        onChange={(e) =>
                          updateItem(index, { value: e.target.value })
                        }
                        placeholder="value"
                        className="h-8 border-border bg-background text-xs font-mono"
                      />
                    </div>
                    <div className="flex items-center gap-1 pt-0.5">
                      {item.isSecret && (
                        <Badge
                          variant="secondary"
                          size="sm"
                          className="h-7 gap-1 text-[10px]"
                        >
                          <NucleoIcon name="lock" className="h-2.5 w-2.5" />
                          Secret
                        </Badge>
                      )}
                      <Button
                        type="button"
                        size="icon-xs"
                        variant="ghost"
                        onClick={() => removeItem(index)}
                        className="h-7 w-7 text-rose-400 hover:bg-rose-500/10"
                      >
                        <NucleoIcon name="trash" className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </DialogPanel>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onClose}
            disabled={isSaving}
          >
            Cancel
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={handleSave}
            disabled={isSaving || showBulk}
          >
            {isSaving ? (
              <>
                <NucleoIcon
                  name="refresh"
                  className="mr-1 h-3 w-3 animate-spin"
                />
                Saving...
              </>
            ) : (
              "Save Changes"
            )}
          </Button>
        </DialogFooter>
        <DialogClose className="sr-only">Close</DialogClose>
      </DialogPopup>
    </Dialog>
  )
}
