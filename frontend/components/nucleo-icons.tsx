import type { SVGProps } from "react"
import React from "react"
import {
  Activity,
  GitBranch,
  Check,
  CircleCheck,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  ChevronsUpDown,
  CircleAlert,
  Copy,
  Cpu,
  ExternalLink,
  LayoutGrid,
  HelpCircle,
  Info,
  Keyboard,
  Layers,
  List,
  Loader,
  Minus,
  Ellipsis,
  Play,
  Plus,
  RefreshCw,
  Search,
  Server,
  Settings,
  PanelLeft,
  Square,
  Terminal,
  Trash2,
  TriangleAlert,
  Globe,
  X,
} from "lucide-react"

type NucleoIconName =
  | "activity"
  | "branch"
  | "check"
  | "check-circle"
  | "chevron-down"
  | "chevron-left"
  | "chevron-right"
  | "chevron-up"
  | "chevrons-up-down"
  | "copy"
  | "cpu"
  | "external"
  | "grid"
  | "help"
  | "keyboard"
  | "layers"
  | "list"
  | "loader"
  | "minus"
  | "more-horizontal"
  | "plus"
  | "play"
  | "refresh"
  | "search"
  | "server"
  | "settings"
  | "sidebar"
  | "square"
  | "terminal"
  | "trash"
  | "triangle-alert"
  | "web"
  | "x"
  | "circle-alert"
  | "info"

type NucleoIconProps = SVGProps<SVGSVGElement> & {
  name: NucleoIconName
}

const iconMap: Record<NucleoIconName, React.FC<any>> = {
  activity: Activity,
  branch: GitBranch,
  check: Check,
  "check-circle": CircleCheck,
  "chevron-down": ChevronDown,
  "chevron-left": ChevronLeft,
  "chevron-right": ChevronRight,
  "chevron-up": ChevronUp,
  "chevrons-up-down": ChevronsUpDown,
  "circle-alert": CircleAlert,
  copy: Copy,
  cpu: Cpu,
  external: ExternalLink,
  grid: LayoutGrid,
  help: HelpCircle,
  info: Info,
  keyboard: Keyboard,
  layers: Layers,
  list: List,
  loader: Loader,
  minus: Minus,
  "more-horizontal": Ellipsis,
  play: Play,
  plus: Plus,
  refresh: RefreshCw,
  search: Search,
  server: Server,
  settings: Settings,
  sidebar: PanelLeft,
  square: Square,
  terminal: Terminal,
  trash: Trash2,
  "triangle-alert": TriangleAlert,
  web: Globe,
  x: X,
}

export function NucleoIcon({ name, className, style, ...props }: NucleoIconProps) {
  const IconComponent = iconMap[name]
  if (!IconComponent) return null
  return (
    <IconComponent
      className={className}
      style={style}
      aria-hidden="true"
      {...props}
    />
  )
}
