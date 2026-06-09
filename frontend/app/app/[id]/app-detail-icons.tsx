import React from "react"
import { NucleoIcon } from "@/components/nucleo-icons"

export type IconProps = Omit<React.ComponentProps<typeof NucleoIcon>, "name">
export const ChevronLeftIcon = (props: IconProps) => (
  <NucleoIcon {...props} name="chevron-left" />
)
export const PlayIcon = (props: IconProps) => (
  <NucleoIcon {...props} name="play" />
)
export const SquareIcon = (props: IconProps) => (
  <NucleoIcon {...props} name="square" />
)
export const RefreshIcon = (props: IconProps) => (
  <NucleoIcon {...props} name="refresh" />
)
export const ChevronDownIcon = (props: IconProps) => (
  <NucleoIcon {...props} name="chevron-down" />
)
export const LoaderIcon = (props: IconProps) => (
  <NucleoIcon {...props} name="loader" />
)
export const TerminalIcon = (props: IconProps) => (
  <NucleoIcon {...props} name="terminal" />
)
export const Trash2Icon = (props: IconProps) => (
  <NucleoIcon {...props} name="trash" />
)
export const ExternalIcon = (props: IconProps) => (
  <NucleoIcon {...props} name="external" />
)
export const CopyIcon = (props: IconProps) => (
  <NucleoIcon {...props} name="copy" />
)
export const CheckIcon = (props: IconProps) => (
  <NucleoIcon {...props} name="check" />
)
export const EditIcon = (props: IconProps) => (
  <NucleoIcon {...props} name="edit" />
)
export const GitBranchIcon = (props: IconProps) => (
  <NucleoIcon {...props} name="branch" />
)
export const GitCommitIcon = (props: IconProps) => (
  <NucleoIcon {...props} name="git-commit" />
)
export const PlusIcon = (props: IconProps) => (
  <NucleoIcon {...props} name="plus" />
)
export const XIcon = (props: IconProps) => <NucleoIcon {...props} name="x" />
export const FolderIcon = (props: IconProps) => (
  <NucleoIcon {...props} name="folder" />
)
export const ChevronRightIcon = (props: IconProps) => (
  <NucleoIcon {...props} name="chevron-right" />
)
export const CircleAlertIcon = (props: IconProps) => (
  <NucleoIcon {...props} name="circle-alert" />
)
export const SearchIcon = (props: IconProps) => (
  <NucleoIcon {...props} name="search" />
)
