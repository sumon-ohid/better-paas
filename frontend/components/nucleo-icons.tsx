import type { SVGProps } from "react"
import React from "react"
import {
  Activity,
  Archive,
  BarChart3,
  Clock3,
  Database,
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
  Link2Off,
  List,
  Loader,
  Lock,
  LogOut,
  Minus,
  Ellipsis,
  Eye,
  EyeOff,
  Moon,
  Pencil,
  Sun,
  Play,
  Plus,
  RefreshCw,
  Search,
  Server,
  Settings,
  Sparkles,
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
  | "archive"
  | "bar-chart"
  | "branch"
  | "clock"
  | "database"
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
  | "link-2-off"
  | "list"
  | "loader"
  | "lock"
  | "logout"
  | "minus"
  | "eye"
  | "eye-off"
  | "moon"
  | "edit"
  | "sun"
  | "more-horizontal"
  | "plus"
  | "play"
  | "refresh"
  | "search"
  | "server"
  | "settings"
  | "sparkles"
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
  archive: Archive,
  "bar-chart": BarChart3,
  branch: GitBranch,
  clock: Clock3,
  database: Database,
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
  "link-2-off": Link2Off,
  list: List,
  loader: Loader,
  lock: Lock,
  logout: LogOut,
  minus: Minus,
  eye: Eye,
  "eye-off": EyeOff,
  moon: Moon,
  edit: Pencil,
  sun: Sun,
  "more-horizontal": Ellipsis,
  play: Play,
  plus: Plus,
  refresh: RefreshCw,
  search: Search,
  server: Server,
  settings: Settings,
  sparkles: Sparkles,
  sidebar: PanelLeft,
  square: Square,
  terminal: Terminal,
  trash: Trash2,
  "triangle-alert": TriangleAlert,
  web: Globe,
  cloud: Cloud,
  x: X,
}

export function NucleoIcon({
  name,
  className,
  style,
  ...props
}: NucleoIconProps) {
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
