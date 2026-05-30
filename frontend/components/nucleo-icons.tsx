import type { SVGProps } from "react"
import React from "react"
import {
  Activity,
  GitBranch,
  GitCommitHorizontal,
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
  Folder,
  Home,
  LayoutGrid,
  HelpCircle,
  Info,
  Keyboard,
  Layers,
  Link,
  List,
  Loader,
  Lock,
  Minus,
  Ellipsis,
  Eye,
  Moon,
  Sun,
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
  Cloud,
  X,
} from "lucide-react"

type NucleoIconName =
  | "activity"
  | "branch"
  | "git-commit"
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
  | "folder"
  | "grid"
  | "help"
  | "house"
  | "keyboard"
  | "layers"
  | "link"
  | "list"
  | "loader"
  | "lock"
  | "minus"
  | "eye"
  | "moon"
  | "sun"
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
  | "cloud"
  | "x"
  | "circle-alert"
  | "info"

type NucleoIconProps = SVGProps<SVGSVGElement> & {
  name: NucleoIconName
}

const iconMap: Record<NucleoIconName, React.FC<SVGProps<SVGSVGElement>>> = {
  activity: Activity,
  branch: GitBranch,
  "git-commit": GitCommitHorizontal,
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
  folder: Folder,
  grid: LayoutGrid,
  house: Home,
  help: HelpCircle,
  info: Info,
  keyboard: Keyboard,
  layers: Layers,
  link: Link,
  list: List,
  loader: Loader,
  lock: Lock,
  minus: Minus,
  eye: Eye,
  moon: Moon,
  sun: Sun,
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
  cloud: Cloud,
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
