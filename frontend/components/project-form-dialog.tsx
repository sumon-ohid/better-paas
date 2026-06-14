"use client"

import { NucleoIcon } from "@/components/nucleo-icons"
import {
  FramedDialogActions,
  FRAMED_DIALOG_FRAME_CLASS,
} from "@/components/framed-dialog"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { IconFolder } from "nucleo-isometric"

export const PROJECT_DESCRIPTION_MAX = 100
export const PROJECT_NAME_MIN = 2
export const PROJECT_NAME_MAX = 40
export const PROJECT_FORM_DIALOG_FRAME_CLASS = FRAMED_DIALOG_FRAME_CLASS

export {
  FramedDialog as ProjectFormDialog,
  FramedDialogHeader as ProjectFormDialogHeader,
} from "@/components/framed-dialog"

const PROJECT_NAME_HINT =
  "Lowercase letters, digits, and hyphens · spaces become hyphens · 2–40 characters"

export function normalizeProjectNameInput(value: string): string {
  return value
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
}

export function isValidProjectName(name: string): boolean {
  return name.length >= PROJECT_NAME_MIN && name.length <= PROJECT_NAME_MAX
}

export function ProjectNameField({
  id,
  value,
  onChange,
  onSubmit,
  autoFocus,
}: {
  id: string
  value: string
  onChange: (value: string) => void
  onSubmit: () => void
  autoFocus?: boolean
}) {
  const hintId = `${id}-hint`
  const showInvalidHint = value.length > 0 && !isValidProjectName(value)

  return (
    <div className="space-y-2">
      <Label htmlFor={id} className="text-xs font-semibold text-muted-foreground">
        Project name
      </Label>
      <InputGroup>
        <InputGroupAddon align="inline-start">
          <IconFolder className="h-4 w-4 opacity-70" />
        </InputGroupAddon>
        <InputGroupInput
          id={id}
          value={value}
          onChange={(e) => onChange(normalizeProjectNameInput(e.target.value))}
          placeholder="my-app"
          className="font-mono text-sm"
          autoFocus={autoFocus}
          aria-invalid={showInvalidHint ? true : undefined}
          aria-describedby={hintId}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) onSubmit()
          }}
        />
      </InputGroup>
      <p id={hintId} className="text-[11px] text-muted-foreground">
        {PROJECT_NAME_HINT}
        {value.length > 0 ? (
          <span
            className={
              isValidProjectName(value)
                ? " text-foreground/70"
                : " text-destructive"
            }
          >
            {" "}
            · {value.length}/{PROJECT_NAME_MAX}
          </span>
        ) : null}
      </p>
    </div>
  )
}

export function ProjectDescriptionField({
  id,
  value,
  onChange,
}: {
  id: string
  value: string
  onChange: (value: string) => void
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id} className="text-xs font-semibold text-muted-foreground">
        Description
        <span className="ml-1 font-normal normal-case">(optional)</span>
      </Label>
      <Textarea
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="What is this project for?"
        rows={3}
        maxLength={PROJECT_DESCRIPTION_MAX}
        className="max-h-32 min-h-20 resize-y overflow-y-auto text-sm"
      />
      <p className="text-[11px] text-muted-foreground">
        Shown on the project card
        {value.length > 0
          ? ` · ${value.length}/${PROJECT_DESCRIPTION_MAX}`
          : ` · up to ${PROJECT_DESCRIPTION_MAX} characters`}
      </p>
    </div>
  )
}

export function ProjectCreateInfoCallout() {
  return (
    <div className="flex gap-2 rounded-lg border border-border/60 bg-muted/20 px-3 py-2.5 text-[11px] leading-snug text-muted-foreground">
      <NucleoIcon name="info" className="h-3.5 w-3.5 shrink-0 text-primary" />
      <span>
        After creating the project, add services from Git, Docker, or the catalog.
      </span>
    </div>
  )
}

export function ProjectFormDialogFooter({
  cancelDisabled,
  submitLabel,
  submitDisabled,
  submitLoading,
  onSubmit,
  submitClassName,
}: {
  cancelDisabled?: boolean
  submitLabel: string
  submitDisabled: boolean
  submitLoading?: boolean
  onSubmit: () => void
  submitClassName?: string
}) {
  return (
    <FramedDialogActions
      cancelDisabled={cancelDisabled}
      submitLabel={submitLabel}
      submitDisabled={submitDisabled}
      submitLoading={submitLoading}
      onSubmit={onSubmit}
      submitClassName={submitClassName}
    />
  )
}
