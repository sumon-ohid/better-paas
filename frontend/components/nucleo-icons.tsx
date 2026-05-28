import type { SVGProps } from "react"
import React from "react"
import {
  IconCheckFillDuo18,
  IconCircleHalfDottedCheckFillDuo18,
  IconChevronDownFillDuo18,
  IconChevronLeftFillDuo18,
  IconChevronRightFillDuo18,
  IconChevronUpFillDuo18,
  IconChevronExpandYFillDuo18,
  IconCircleInfoFillDuo18,
  IconClipboardFillDuo18,
  IconClipboardCheckFillDuo18,
  IconGauge3FillDuo18,
  IconSquareDottedArrowBottomRightFillDuo18,
  IconLayers3FillDuo18,
  IconKeyboardFillDuo18,
  IconLoaderFillDuo18,
  IconMinusFillDuo18,
  IconSlidersFillDuo18,
  IconPlusFillDuo18,
  IconHalfDottedCirclePlayFillDuo18,
  IconRefresh2FillDuo18,
  IconMagnifierFillDuo18,
  IconStackPerspectiveFillDuo18,
  IconWindowExpandBottomRightFillDuo18,
  IconGear2FillDuo18,
  IconSquareMinusFillDuo18,
  IconWindowChartLineFillDuo18,
  IconTrashFillDuo18,
  IconTriangleWarningFillDuo18,
  IconGlobePointerFillDuo18,
  IconXmarkFillDuo18,
  IconNodesFillDuo18,
  IconBoltFillDuo18,
  IconBoltLightningFillDuo18,
  IconGridCirclePlusFillDuo18,
  IconUnorderedListFillDuo18,
  IconArrowDottedRotateAnticlockwiseFillDuo18,
  type IconProps as NucleoIconPackProps,
} from "nucleo-ui-essential-fill-duo-18"

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
  | "sidebar"
  | "settings"
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

// Maps the existing logical icon names to the new fill-duo-18 components
const iconMap: Record<NucleoIconName, React.FC<NucleoIconPackProps>> = {
  activity:         IconGauge3FillDuo18,
  branch:           IconNodesFillDuo18,
  check:            IconCheckFillDuo18,
  "check-circle":   IconCircleHalfDottedCheckFillDuo18,
  "chevron-down":   IconChevronDownFillDuo18,
  "chevron-left":   IconChevronLeftFillDuo18,
  "chevron-right":  IconChevronRightFillDuo18,
  "chevron-up":     IconChevronUpFillDuo18,
  "chevrons-up-down": IconChevronExpandYFillDuo18,
  "circle-alert":   IconCircleInfoFillDuo18,
  copy:             IconClipboardFillDuo18,
  cpu:              IconBoltLightningFillDuo18,
  external:         IconSquareDottedArrowBottomRightFillDuo18,
  grid:             IconGridCirclePlusFillDuo18,
  help:             IconCircleInfoFillDuo18,
  info:             IconCircleInfoFillDuo18,
  keyboard:         IconKeyboardFillDuo18,
  layers:           IconLayers3FillDuo18,
  list:             IconUnorderedListFillDuo18,
  loader:           IconLoaderFillDuo18,
  minus:            IconMinusFillDuo18,
  "more-horizontal": IconSlidersFillDuo18,
  play:             IconHalfDottedCirclePlayFillDuo18,
  plus:             IconPlusFillDuo18,
  refresh:          IconRefresh2FillDuo18,
  search:           IconMagnifierFillDuo18,
  server:           IconStackPerspectiveFillDuo18,
  settings:         IconGear2FillDuo18,
  sidebar:          IconWindowExpandBottomRightFillDuo18,
  square:           IconSquareMinusFillDuo18,
  terminal:         IconWindowChartLineFillDuo18,
  trash:            IconTrashFillDuo18,
  "triangle-alert": IconTriangleWarningFillDuo18,
  web:              IconGlobePointerFillDuo18,
  x:                IconXmarkFillDuo18,
}

export function NucleoIcon({ name, className, style, ...props }: NucleoIconProps) {
  const IconComponent = iconMap[name]
  if (!IconComponent) return null
  return (
    <IconComponent
      className={className}
      style={style}
      aria-hidden="true"
      {...(props as NucleoIconPackProps)}
    />
  )
}
