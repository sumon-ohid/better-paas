import type { SVGProps } from "react"
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight as ChevronRightIconComp,
  ChevronUp,
  ChevronsUpDown,
  CircleAlert,
  CircleCheck,
  Info,
  Loader,
  Minus,
  Ellipsis,
  Plus,
  Search,
  TriangleAlert,
  X,
} from "lucide-react"

type IconProps = SVGProps<SVGSVGElement>

export const ChevronDownIcon = (props: IconProps) => <ChevronDown {...props} />
export const ChevronLeftIcon = (props: IconProps) => <ChevronLeft {...props} />
export const ChevronRight = (props: IconProps) => <ChevronRightIconComp {...props} />
export const ChevronRightIcon = (props: IconProps) => <ChevronRightIconComp {...props} />
export const ChevronUpIcon = (props: IconProps) => <ChevronUp {...props} />
export const ChevronsUpDownIcon = (props: IconProps) => <ChevronsUpDown {...props} />
export const CircleAlertIcon = (props: IconProps) => <CircleAlert {...props} />
export const CircleCheckIcon = (props: IconProps) => <CircleCheck {...props} />
export const InfoIcon = (props: IconProps) => <Info {...props} />
export const Loader2Icon = (props: IconProps) => <Loader {...props} />
export const LoaderCircleIcon = (props: IconProps) => <Loader {...props} />
export const MinusIcon = (props: IconProps) => <Minus {...props} />
export const MoreHorizontal = (props: IconProps) => <Ellipsis {...props} />
export const MoreHorizontalIcon = (props: IconProps) => <Ellipsis {...props} />
export const PlusIcon = (props: IconProps) => <Plus {...props} />
export const SearchIcon = (props: IconProps) => <Search {...props} />
export const TriangleAlertIcon = (props: IconProps) => <TriangleAlert {...props} />
export const XIcon = (props: IconProps) => <X {...props} />
