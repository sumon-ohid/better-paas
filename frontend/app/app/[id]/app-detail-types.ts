export type AppTab =
  | "overview"
  | "config"
  | "domains"
  | "logs"
  | "terminal"
  | "deployments"
  | "vulnerabilities"

export type BuildMethod = "nixpacks" | "dockerfile" | "compose"
export type FixOption = "git" | "local"
