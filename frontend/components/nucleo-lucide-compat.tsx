import type { ComponentProps } from "react"
import { NucleoIcon } from "@/components/nucleo-icons"

type IconProps = Omit<ComponentProps<typeof NucleoIcon>, "name">

export const ChevronDownIcon = (props: IconProps) => <NucleoIcon {...props} name="chevron-down" />
export const ChevronLeftIcon = (props: IconProps) => <NucleoIcon {...props} name="chevron-left" />
export const ChevronRight = (props: IconProps) => <NucleoIcon {...props} name="chevron-right" />
export const ChevronRightIcon = (props: IconProps) => <NucleoIcon {...props} name="chevron-right" />
export const ChevronUpIcon = (props: IconProps) => <NucleoIcon {...props} name="chevron-up" />
export const ChevronsUpDownIcon = (props: IconProps) => <NucleoIcon {...props} name="chevrons-up-down" />
export const CircleAlertIcon = (props: IconProps) => <NucleoIcon {...props} name="circle-alert" />
export const CircleCheckIcon = (props: IconProps) => <NucleoIcon {...props} name="check-circle" />
export const InfoIcon = (props: IconProps) => <NucleoIcon {...props} name="info" />
export const Loader2Icon = (props: IconProps) => <NucleoIcon {...props} name="loader" />
export const LoaderCircleIcon = (props: IconProps) => <NucleoIcon {...props} name="loader" />
export const MinusIcon = (props: IconProps) => <NucleoIcon {...props} name="minus" />
export const MoreHorizontal = (props: IconProps) => <NucleoIcon {...props} name="more-horizontal" />
export const MoreHorizontalIcon = (props: IconProps) => <NucleoIcon {...props} name="more-horizontal" />
export const PlusIcon = (props: IconProps) => <NucleoIcon {...props} name="plus" />
export const SearchIcon = (props: IconProps) => <NucleoIcon {...props} name="search" />
export const TriangleAlertIcon = (props: IconProps) => <NucleoIcon {...props} name="triangle-alert" />
export const XIcon = (props: IconProps) => <NucleoIcon {...props} name="x" />
