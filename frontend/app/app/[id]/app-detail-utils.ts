// timeAgo renders a short, human-friendly relative time like "11d ago" or
// "just now". Falls back to an empty string for invalid dates.
export function timeAgo(date: string | number | Date): string {
  const then = new Date(date).getTime()
  if (Number.isNaN(then)) return ""
  const secs = Math.round((Date.now() - then) / 1000)
  if (secs < 45) return "just now"
  const mins = Math.round(secs / 60)
  if (mins < 60) return `${mins}m ago`
  const hours = Math.round(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.round(hours / 24)
  if (days < 30) return `${days}d ago`
  const months = Math.round(days / 30)
  if (months < 12) return `${months}mo ago`
  return `${Math.round(months / 12)}y ago`
}

// githubCommitUrl builds a link to a specific commit on GitHub from the app's
// git repo URL. Returns "" for non-GitHub remotes or when the SHA is missing.
export function githubCommitUrl(gitRepo: string, commit: string): string {
  if (!commit || !gitRepo.includes("github.com")) return ""
  const repoPath = gitRepo
    .replace(/\.git$/, "")
    .replace(/^git@github\.com:/, "")
    .replace(/^https?:\/\/github\.com\//, "")
    .replace(/^github\.com\//, "")
  return `https://github.com/${repoPath}/commit/${commit}`
}

export type EnvVar = { key: string; value: string }

export const serializeEnvVars = (
  vars: { key: string; value: string }[]
): string => {
  return vars
    .filter((v) => v.key.trim())
    .map((v) => `${v.key}=${v.value}`)
    .join("\n")
}

export const parseEnvBlock = (
  text: string
): Array<{ key: string; value: string }> => {
  const result: Array<{ key: string; value: string }> = []
  const seen = new Set<string>()

  for (const rawLine of text.split(/\r?\n/)) {
    let line = rawLine.trim()
    if (!line || line.startsWith("#")) continue

    // Strip "export " prefix
    if (line.startsWith("export ")) {
      line = line.slice(7).trim()
    }

    const eqIdx = line.indexOf("=")
    if (eqIdx === -1) continue

    const key = line.slice(0, eqIdx).trim()
    let value = line.slice(eqIdx + 1).trim()

    // Strip surrounding quotes
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }

    if (!key || !/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) continue
    if (seen.has(key)) continue
    seen.add(key)

    result.push({ key, value })
  }

  return result
}

export const lineColor = (msg: string) => {
  if (msg.startsWith("✖") || msg.includes(" Error") || msg.includes("failed"))
    return "text-destructive"
  if (
    msg.startsWith("✅") ||
    msg.startsWith("✔") ||
    msg.includes("successfully")
  )
    return "text-success"
  if (
    msg.startsWith("📦") ||
    msg.startsWith("🔍") ||
    msg.startsWith("🚀") ||
    msg.startsWith("🧹") ||
    msg.startsWith("✨") ||
    msg.startsWith("💡") ||
    msg.startsWith("⚠️") ||
    msg.startsWith("📂")
  )
    return "text-warning"
  return "text-foreground dark:text-slate-200"
}
