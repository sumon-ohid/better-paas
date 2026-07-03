"use client"

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Button } from "@/dashboard/components/ui/button"
import { Input } from "@/dashboard/components/ui/input"
import { Badge } from "@/dashboard/components/ui/badge"
import { Spinner } from "@/dashboard/components/ui/spinner"
import { Checkbox } from "@/dashboard/components/ui/checkbox"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/dashboard/components/ui/menu"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/dashboard/components/ui/dialog"
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogClose,
} from "@/dashboard/components/ui/alert-dialog"
import { useToast } from "@/dashboard/components/app-shell"
import { api } from "@/dashboard/lib/api"
import type { Addon, DbQueryResult, DbColumn } from "@/dashboard/lib/types"
import { NucleoIcon } from "@/dashboard/components/nucleo-icons"

type IconProps = Omit<React.ComponentProps<typeof NucleoIcon>, "name">
const TableIcon = (props: IconProps) => <NucleoIcon {...props} name="grid" />
const QueryIcon = (props: IconProps) => <NucleoIcon {...props} name="terminal" />
const RefreshIcon = (props: IconProps) => <NucleoIcon {...props} name="refresh" />
const SearchIcon = (props: IconProps) => <NucleoIcon {...props} name="search" />
const CloseIcon = (props: IconProps) => <NucleoIcon {...props} name="x" />
const PlayIcon = (props: IconProps) => <NucleoIcon {...props} name="play" />
const ChevronLeft = (props: IconProps) => <NucleoIcon {...props} name="chevron-left" />
const ChevronRight = (props: IconProps) => <NucleoIcon {...props} name="chevron-right" />
const ChevronUp = (props: IconProps) => <NucleoIcon {...props} name="chevron-up" />
const ChevronDown = (props: IconProps) => <NucleoIcon {...props} name="chevron-down" />
const KeyIcon = (props: IconProps) => <NucleoIcon {...props} name="list" />
const PlusIcon = (props: IconProps) => <NucleoIcon {...props} name="plus" />
const TrashIcon = (props: IconProps) => <NucleoIcon {...props} name="trash" />
const CopyIcon = (props: IconProps) => <NucleoIcon {...props} name="copy" />
const MoreIcon = (props: IconProps) => <NucleoIcon {...props} name="more-horizontal" />

const PAGE_SIZE = 50

// Sort state for a browsed table.
interface SortState {
  col: string
  dir: "asc" | "desc"
}

// A loaded tab: either the query console or a specific table/key.
type TabKind = "query" | "table"
interface ExplorerTab {
  id: string // "query" or "table:<name>"
  kind: TabKind
  table?: string
}

function isRedis(addon: Addon) {
  return addon.type === "redis"
}

// queryHint returns placeholder/help text appropriate to the engine.
function queryHint(addon: Addon): string {
  if (isRedis(addon)) return "Enter a Redis command, e.g.  KEYS *   or   GET mykey"
  if (addon.type === "mysql") return "SELECT * FROM users LIMIT 100;"
  return "SELECT * FROM users LIMIT 100;"
}

// ── Results grid ──────────────────────────────────────────────────────────

function ResultsGrid({ result }: { result: DbQueryResult }) {
  const columns = result.columns ?? []
  const rows = result.rows ?? []

  if (result.error) {
    return (
      <div className="m-3 rounded-md border border-destructive/40 bg-destructive/5 p-3 font-mono text-xs text-destructive-foreground">
        {result.error}
      </div>
    )
  }
  if (result.message && columns.length === 0) {
    return (
      <div className="m-3 rounded-md border border-success/40 bg-success/5 p-3 font-mono text-xs text-foreground">
        {result.message}
      </div>
    )
  }
  if (columns.length === 0) {
    return <div className="p-6 text-center text-sm text-muted-foreground">No results.</div>
  }

  return (
    <div className="h-full overflow-auto">
      <table className="w-full border-collapse text-left text-xs">
        <thead className="sticky top-0 z-10">
          <tr className="bg-muted/80 backdrop-blur">
            <th className="w-10 border-b border-r border-border px-2 py-1.5 text-right font-mono text-[10px] font-normal text-muted-foreground/60">
              #
            </th>
            {columns.map((col, i) => (
              <th
                key={i}
                className="border-b border-r border-border px-2.5 py-1.5 font-mono font-semibold text-foreground/90"
              >
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td
                colSpan={columns.length + 1}
                className="px-2.5 py-8 text-center text-muted-foreground"
              >
                No rows.
              </td>
            </tr>
          ) : (
            rows.map((row, r) => (
              <tr key={r} className="hover:bg-muted/40">
                <td className="border-b border-r border-border/60 px-2 py-1.5 text-right font-mono text-[10px] text-muted-foreground/50">
                  {r + 1}
                </td>
                {columns.map((_, c) => {
                  const cell = row[c]
                  return (
                    <td
                      key={c}
                      className="max-w-[200px] truncate border-b border-r border-border/60 px-2.5 py-1.5 font-mono text-foreground/90 sm:max-w-[420px]"
                      title={cell === null ? "NULL" : cell}
                    >
                      {cell === null ? (
                        <span className="italic text-muted-foreground/50">NULL</span>
                      ) : cell === "" ? (
                        <span className="italic text-muted-foreground/40">empty</span>
                      ) : (
                        cell
                      )}
                    </td>
                  )
                })}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  )
}

// ── Main explorer ───────────────────────────────────────────────────────────

export function DbExplorer({ addon, onClose }: { addon: Addon; onClose: () => void }) {
  const { showToast } = useToast()
  const redis = isRedis(addon)

  const [tables, setTables] = useState<string[]>([])
  const [tablesLoading, setTablesLoading] = useState(true)
  const [tablesError, setTablesError] = useState<string | null>(null)
  const [filter, setFilter] = useState("")

  const [tabs, setTabs] = useState<ExplorerTab[]>([{ id: "query", kind: "query" }])
  const [activeTab, setActiveTab] = useState("query")

  // On mobile we show one panel at a time: the table list or the content.
  // On md+ both are visible side-by-side and this is ignored.
  const [mobileView, setMobileView] = useState<"list" | "content">("list")

  // Query console state
  const [queryText, setQueryText] = useState("")
  const [queryResult, setQueryResult] = useState<DbQueryResult | null>(null)
  const [running, setRunning] = useState(false)

  // Table view state, keyed by table name
  const [tableData, setTableData] = useState<Record<string, DbQueryResult>>({})
  const [tableLoading, setTableLoading] = useState<Record<string, boolean>>({})
  const [tablePage, setTablePage] = useState<Record<string, number>>({})
  const [tableSort, setTableSort] = useState<Record<string, SortState | null>>({})
  const [tableCols, setTableCols] = useState<Record<string, DbColumn[]>>({})

  const loadTables = useCallback(async () => {
    setTablesLoading(true)
    setTablesError(null)
    try {
      const res = await api.addons.dbTables(addon.id)
      setTables(res.tables || [])
    } catch (err) {
      setTablesError(err instanceof Error ? err.message : "Could not load tables.")
    } finally {
      setTablesLoading(false)
    }
  }, [addon.id])

  useEffect(() => {
    loadTables()
  }, [loadTables])

  // Close on Escape.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [onClose])

  const filtered = useMemo(() => {
    const f = filter.trim().toLowerCase()
    if (!f) return tables
    return tables.filter((t) => t.toLowerCase().includes(f))
  }, [tables, filter])

  const loadTable = useCallback(
    async (table: string, page: number, sort?: SortState | null) => {
      const effectiveSort = sort === undefined ? tableSort[table] : sort
      setTableLoading((m) => ({ ...m, [table]: true }))
      try {
        const res = await api.addons.dbTable(
          addon.id,
          table,
          PAGE_SIZE,
          page * PAGE_SIZE,
          effectiveSort?.col,
          effectiveSort?.dir,
        )
        setTableData((m) => ({ ...m, [table]: res }))
        setTablePage((m) => ({ ...m, [table]: page }))
      } catch (err) {
        setTableData((m) => ({
          ...m,
          [table]: { columns: [], rows: [], error: err instanceof Error ? err.message : "Failed to load." },
        }))
      } finally {
        setTableLoading((m) => ({ ...m, [table]: false }))
      }
    },
    [addon.id, tableSort],
  )

  // Lazily load column metadata for a SQL table (used by add/edit row).
  const loadColumns = useCallback(
    async (table: string) => {
      if (redis || tableCols[table]) return
      try {
        const res = await api.addons.dbColumns(addon.id, table)
        setTableCols((m) => ({ ...m, [table]: res.columns || [] }))
      } catch {
        // Non-fatal: editing falls back to a generic message if columns are missing.
      }
    },
    [addon.id, redis, tableCols],
  )

  // Toggle sort on a column: asc → desc → none, then reload from page 0.
  const toggleSort = useCallback(
    (table: string, col: string, forced?: "asc" | "desc") => {
      setTableSort((m) => {
        const cur = m[table]
        let next: SortState | null
        if (forced) {
          next = { col, dir: forced }
        } else if (!cur || cur.col !== col) {
          next = { col, dir: "asc" }
        } else if (cur.dir === "asc") {
          next = { col, dir: "desc" }
        } else {
          next = null
        }
        loadTable(table, 0, next)
        return { ...m, [table]: next }
      })
    },
    [loadTable],
  )

  const openTable = useCallback(
    (table: string) => {
      const id = `table:${table}`
      setTabs((prev) => (prev.some((t) => t.id === id) ? prev : [...prev, { id, kind: "table", table }]))
      setActiveTab(id)
      setMobileView("content")
      loadColumns(table)
      if (!tableData[table]) {
        loadTable(table, 0)
      }
    },
    [tableData, loadTable, loadColumns],
  )

  const closeTab = useCallback(
    (id: string) => {
      setTabs((prev) => {
        const next = prev.filter((t) => t.id !== id)
        return next.length ? next : [{ id: "query", kind: "query" }]
      })
      setActiveTab((cur) => {
        if (cur !== id) return cur
        return "query"
      })
    },
    [],
  )

  const runQuery = useCallback(async () => {
    const q = queryText.trim()
    if (!q) {
      showToast("Empty query", "Type a query to run.", "destructive")
      return
    }
    setRunning(true)
    setActiveTab("query")
    setMobileView("content")
    try {
      const res = await api.addons.dbQuery(addon.id, q)
      setQueryResult(res)
      if (res.error) {
        showToast("Query error", res.error, "destructive")
      }
    } catch (err) {
      setQueryResult({ columns: [], rows: [], error: err instanceof Error ? err.message : "Query failed." })
    } finally {
      setRunning(false)
    }
  }, [queryText, addon.id, showToast])

  // Cmd/Ctrl+Enter runs the query when the console is focused.
  const onQueryKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault()
      runQuery()
    }
  }

  const activeTabObj = tabs.find((t) => t.id === activeTab)

  // After a mutation, refresh the current page of a table and its row count.
  const refreshTable = useCallback(
    (table: string) => loadTable(table, tablePage[table] ?? 0),
    [loadTable, tablePage],
  )

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background animate-in fade-in-0 duration-150">
      {/* Top bar */}
      <header className="flex h-12 shrink-0 items-center justify-between gap-2 border-b border-border px-3">
        <div className="flex min-w-0 items-center gap-2 text-sm">
          <NucleoIcon name="server" className="h-4 w-4 shrink-0 text-primary" />
          <span className="truncate font-semibold">{addon.name}</span>
          <Badge variant="info" size="sm" className="shrink-0">
            {redis ? "Redis" : addon.type === "mysql" ? "MySQL" : "Postgres"}
          </Badge>
          <span className="hidden font-mono text-xs text-muted-foreground sm:inline">Studio</span>
        </div>
        <Button variant="ghost" size="icon-sm" onClick={onClose} aria-label="Close explorer" className="shrink-0">
          <CloseIcon className="h-4 w-4" />
        </Button>
      </header>

      <div className="flex min-h-0 flex-1">
        {/* Sidebar - full-width on mobile, fixed rail on md+. Hidden on mobile
            while viewing content. */}
        <aside
          className={`${
            mobileView === "content" ? "hidden md:flex" : "flex"
          } w-full shrink-0 flex-col border-r border-border bg-muted/20 md:w-60`}
        >
          <div className="flex items-center gap-1.5 border-b border-border p-2">
            <div className="relative flex-1">
              <SearchIcon className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                placeholder="Search"
                className="h-8 pl-7 text-xs"
              />
            </div>
            <Button
              variant="outline"
              size="icon-sm"
              onClick={loadTables}
              aria-label="Refresh tables"
              className="shrink-0"
            >
              <RefreshIcon className={`h-3.5 w-3.5 ${tablesLoading ? "animate-spin" : ""}`} />
            </Button>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto p-1.5">
            {tablesLoading ? (
              <div className="flex items-center justify-center gap-2 py-8 text-xs text-muted-foreground">
                <Spinner className="h-4 w-4" />
                Loading…
              </div>
            ) : tablesError ? (
              <div className="m-1 rounded-md border border-destructive/40 bg-destructive/5 p-2 text-xs text-destructive-foreground">
                {tablesError}
              </div>
            ) : filtered.length === 0 ? (
              <div className="py-8 text-center text-xs text-muted-foreground">
                {tables.length === 0 ? (redis ? "No keys found." : "No tables found.") : "No matches."}
              </div>
            ) : (
              <ul className="space-y-0.5">
                {filtered.map((t) => {
                  const id = `table:${t}`
                  const active = activeTab === id
                  return (
                    <li key={t}>
                      <button
                        type="button"
                        onClick={() => openTable(t)}
                        className={`flex w-full items-center gap-1.5 truncate rounded-md px-2 py-1.5 text-left text-xs transition-colors ${
                          active
                            ? "bg-primary/10 font-medium text-primary"
                            : "text-foreground/80 hover:bg-muted"
                        }`}
                        title={t}
                      >
                        {redis ? (
                          <KeyIcon className="h-3.5 w-3.5 shrink-0 opacity-60" />
                        ) : (
                          <TableIcon className="h-3.5 w-3.5 shrink-0 opacity-60" />
                        )}
                        <span className="truncate">{t}</span>
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>

          <div className="flex items-center justify-between gap-2 border-t border-border px-2.5 py-1.5">
            <span className="text-[11px] text-muted-foreground">
              {redis ? `${tables.length} keys` : `${tables.length} tables`}
            </span>
            <button
              type="button"
              onClick={() => {
                setActiveTab("query")
                setMobileView("content")
              }}
              className="inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-[11px] font-medium text-primary hover:bg-primary/10 md:hidden"
            >
              <QueryIcon className="h-3.5 w-3.5" />
              {redis ? "Command console" : "Query console"}
            </button>
          </div>
        </aside>

        {/* Main */}
        <main
          className={`${
            mobileView === "list" ? "hidden md:flex" : "flex"
          } min-w-0 flex-1 flex-col`}
        >
          {/* Tab strip - includes a back button on mobile to return to the list. */}
          <div className="flex h-9 shrink-0 items-stretch overflow-x-auto border-b border-border bg-muted/10">
            <button
              type="button"
              onClick={() => setMobileView("list")}
              className="flex shrink-0 items-center gap-1 border-r border-border px-2.5 text-xs text-muted-foreground hover:bg-muted/40 md:hidden"
              aria-label="Back to tables"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </button>
            {tabs.map((tab) => {
              const active = activeTab === tab.id
              const label = tab.kind === "query" ? "Query" : tab.table
              return (
                <div
                  key={tab.id}
                  className={`group flex shrink-0 cursor-pointer items-center gap-1.5 border-r border-border px-3 text-xs transition-colors ${
                    active ? "bg-background font-medium text-foreground" : "text-muted-foreground hover:bg-muted/40"
                  }`}
                  onClick={() => setActiveTab(tab.id)}
                >
                  {tab.kind === "query" ? (
                    <QueryIcon className="h-3.5 w-3.5 opacity-70" />
                  ) : (
                    <TableIcon className="h-3.5 w-3.5 opacity-70" />
                  )}
                  <span className="max-w-[160px] truncate">{label}</span>
                  {tab.kind === "table" && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        closeTab(tab.id)
                      }}
                      className="rounded p-0.5 opacity-40 hover:bg-muted hover:opacity-100"
                      aria-label={`Close ${label}`}
                    >
                      <CloseIcon className="h-3 w-3" />
                    </button>
                  )}
                </div>
              )
            })}
          </div>

          {/* Panel content */}
          <div className="flex min-h-0 flex-1 flex-col">
            {activeTabObj?.kind === "query" ? (
              <QueryConsole
                addon={addon}
                value={queryText}
                onChange={setQueryText}
                onRun={runQuery}
                onKeyDown={onQueryKeyDown}
                running={running}
                result={queryResult}
              />
            ) : activeTabObj?.table ? (
              <TableView
                addon={addon}
                table={activeTabObj.table}
                result={tableData[activeTabObj.table]}
                columns={tableCols[activeTabObj.table]}
                sort={tableSort[activeTabObj.table] ?? null}
                loading={!!tableLoading[activeTabObj.table]}
                page={tablePage[activeTabObj.table] ?? 0}
                onPage={(p) => loadTable(activeTabObj.table!, p)}
                onSort={(col, forced) => toggleSort(activeTabObj.table!, col, forced)}
                onRefresh={() => refreshTable(activeTabObj.table!)}
              />
            ) : null}
          </div>
        </main>
      </div>
    </div>
  )
}

// ── Query console panel ───────────────────────────────────────────────────

function QueryConsole({
  addon,
  value,
  onChange,
  onRun,
  onKeyDown,
  running,
  result,
}: {
  addon: Addon
  value: string
  onChange: (v: string) => void
  onRun: () => void
  onKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void
  running: boolean
  result: DbQueryResult | null
}) {
  const redis = isRedis(addon)
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex flex-col border-b border-border">
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={onKeyDown}
          spellCheck={false}
          placeholder={queryHint(addon)}
          className="h-32 w-full resize-none bg-background px-3 py-2.5 font-mono text-xs text-foreground outline-none placeholder:text-muted-foreground/50 sm:h-40"
        />
        <div className="flex flex-col gap-2 border-t border-border bg-muted/20 px-3 py-1.5 sm:flex-row sm:items-center sm:justify-between">
          <span className="text-[11px] text-muted-foreground">
            {redis ? "Runs against redis-cli." : "Read or write SQL."}{" "}
            <span className="whitespace-nowrap">
              <kbd className="rounded border border-border bg-background px-1 font-mono text-[10px]">⌘/Ctrl</kbd>
              +
              <kbd className="rounded border border-border bg-background px-1 font-mono text-[10px]">Enter</kbd> to run
            </span>
          </span>
          <Button size="sm" onClick={onRun} loading={running} className="gap-1.5 max-sm:w-full">
            <PlayIcon className="h-3.5 w-3.5" />
            Run
          </Button>
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-hidden">
        {result === null ? (
          <div className="flex h-full items-center justify-center px-6 text-center text-sm text-muted-foreground">
            {redis
              ? "Run a command to see results."
              : "Run a query to see results, or open a table to browse it."}
          </div>
        ) : (
          <div className="flex h-full flex-col">
            {!result.error && (result.columns?.length ?? 0) > 0 && (
              <div className="border-b border-border bg-muted/20 px-3 py-1 text-[11px] text-muted-foreground">
                {(result.rows?.length ?? 0)} row{(result.rows?.length ?? 0) === 1 ? "" : "s"}
              </div>
            )}
            <div className="min-h-0 flex-1">
              <ResultsGrid result={result} />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Table browse panel (editable for SQL) ───────────────────────────────────

function TableView({
  addon,
  table,
  result,
  columns,
  sort,
  loading,
  page,
  onPage,
  onSort,
  onRefresh,
}: {
  addon: Addon
  table: string
  result: DbQueryResult | undefined
  columns: DbColumn[] | undefined
  sort: SortState | null
  loading: boolean
  page: number
  onPage: (p: number) => void
  onSort: (col: string, forced?: "asc" | "desc") => void
  onRefresh: () => void
}) {
  const { showToast } = useToast()
  const redis = isRedis(addon)
  const total = result?.total ?? 0
  const hasMore = !redis && total > (page + 1) * PAGE_SIZE
  const rangeStart = total === 0 ? 0 : page * PAGE_SIZE + 1
  const rangeEnd = page * PAGE_SIZE + (result?.rows?.length ?? 0)

  // Row selection (by index on the current page) for bulk delete.
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [addOpen, setAddOpen] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [busy, setBusy] = useState(false)

  // Clear selection whenever the underlying rows change (page/sort/refresh).
  // Adjusting state during render per the React "reset on prop change" pattern.
  const rowsKey = `${table}:${page}:${result?.rows?.length ?? 0}`
  const [selKey, setSelKey] = useState(rowsKey)
  if (selKey !== rowsKey) {
    setSelKey(rowsKey)
    setSelected(new Set())
  }

  const cols = result?.columns ?? []
  const rows = result?.rows ?? []
  const editable = !redis && !result?.error && cols.length > 0

  const toggleRow = (i: number) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(i)) next.delete(i)
      else next.add(i)
      return next
    })
  }
  const toggleAll = () => {
    setSelected((prev) => (prev.size === rows.length ? new Set() : new Set(rows.map((_, i) => i))))
  }

  // Build a WHERE map identifying a row by all its original column values.
  const whereForRow = (row: (string | null)[]) => {
    const where: Record<string, string | null> = {}
    cols.forEach((c, i) => {
      where[c] = row[i] ?? null
    })
    return where
  }

  const saveCell = async (rowIdx: number, colIdx: number, value: string | null) => {
    const row = rows[rowIdx]
    if (!row) return
    if ((row[colIdx] ?? null) === value) return // no change
    setBusy(true)
    try {
      const res = await api.addons.dbUpdateRow(
        addon.id,
        table,
        { [cols[colIdx]]: value },
        whereForRow(row),
      )
      if (res.error) {
        showToast("Update failed", res.error, "destructive")
      } else {
        showToast("Row updated", "Saved successfully.", "success")
        onRefresh()
      }
    } catch (err) {
      showToast("Update failed", err instanceof Error ? err.message : "Could not update.", "destructive")
    } finally {
      setBusy(false)
    }
  }

  const deleteSelected = async () => {
    setConfirmDelete(false)
    const targets = [...selected].map((i) => rows[i]).filter(Boolean) as (string | null)[][]
    if (targets.length === 0) return
    setBusy(true)
    let failed = 0
    let lastErr = ""
    for (const row of targets) {
      try {
        const res = await api.addons.dbDeleteRow(addon.id, table, whereForRow(row))
        if (res.error) {
          failed++
          lastErr = res.error
        }
      } catch (err) {
        failed++
        lastErr = err instanceof Error ? err.message : "Delete failed."
      }
    }
    setBusy(false)
    setSelected(new Set())
    if (failed > 0) {
      showToast("Delete failed", `${failed} row(s) not deleted. ${lastErr}`, "destructive")
    } else {
      showToast("Rows deleted", `${targets.length} row(s) removed.`, "success")
    }
    onRefresh()
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* Toolbar */}
      <div className="flex h-10 shrink-0 items-center justify-between gap-2 border-b border-border bg-muted/20 px-2.5">
        <div className="flex items-center gap-1.5">
          {editable && (
            <>
              <Button variant="outline" size="sm" className="h-7 gap-1.5" onClick={() => setAddOpen(true)}>
                <PlusIcon className="h-3.5 w-3.5" />
                Add row
              </Button>
              <Button
                variant="destructive-outline"
                size="sm"
                className="h-7 gap-1.5"
                disabled={selected.size === 0 || busy}
                onClick={() => setConfirmDelete(true)}
              >
                <TrashIcon className="h-3.5 w-3.5" />
                Delete row{selected.size > 1 ? `s (${selected.size})` : ""}
              </Button>
            </>
          )}
          <div className="flex items-center gap-2 pl-1 text-xs text-muted-foreground">
            <span className="font-mono font-medium text-foreground/90">{table}</span>
            {!redis && total > 0 && <span className="hidden sm:inline">· {total.toLocaleString()} rows</span>}
          </div>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon-sm" onClick={onRefresh} aria-label="Refresh">
            <RefreshIcon className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
          </Button>
          {!redis && (
            <>
              <span className="px-1.5 font-mono text-[11px] text-muted-foreground">
                {rangeStart}–{rangeEnd}
              </span>
              <Button
                variant="outline"
                size="icon-sm"
                disabled={page === 0 || loading}
                onClick={() => onPage(page - 1)}
                aria-label="Previous page"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="outline"
                size="icon-sm"
                disabled={!hasMore || loading}
                onClick={() => onPage(page + 1)}
                aria-label="Next page"
              >
                <ChevronRight className="h-3.5 w-3.5" />
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Grid */}
      <div className="min-h-0 flex-1 overflow-hidden">
        {loading && !result ? (
          <div className="flex h-full items-center justify-center gap-2 text-sm text-muted-foreground">
            <Spinner className="h-4 w-4" />
            Loading…
          </div>
        ) : result && editable ? (
          <EditableGrid
            result={result}
            page={page}
            sort={sort}
            selected={selected}
            busy={busy}
            onToggleRow={toggleRow}
            onToggleAll={toggleAll}
            onSort={onSort}
            onSaveCell={saveCell}
          />
        ) : result ? (
          <ResultsGrid result={result} />
        ) : null}
      </div>

      {addOpen && (
        <AddRowDialog
          open={addOpen}
          onOpenChange={setAddOpen}
          addon={addon}
          table={table}
          columns={columns}
          onAdded={onRefresh}
        />
      )}

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {selected.size} row{selected.size > 1 ? "s" : ""}?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes the selected row{selected.size > 1 ? "s" : ""} from{" "}
              <span className="font-mono">{table}</span>. This can&apos;t be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogClose render={<Button variant="outline" />}>Cancel</AlertDialogClose>
            <Button variant="destructive" onClick={deleteSelected} loading={busy}>
              Delete
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

// ── Editable grid ───────────────────────────────────────────────────────────

function EditableGrid({
  result,
  page,
  sort,
  selected,
  busy,
  onToggleRow,
  onToggleAll,
  onSort,
  onSaveCell,
}: {
  result: DbQueryResult
  page: number
  sort: SortState | null
  selected: Set<number>
  busy: boolean
  onToggleRow: (i: number) => void
  onToggleAll: () => void
  onSort: (col: string, forced?: "asc" | "desc") => void
  onSaveCell: (rowIdx: number, colIdx: number, value: string | null) => void
}) {
  const { showToast } = useToast()
  const columns = result.columns ?? []
  const rows = result.rows ?? []

  // The cell currently being edited, plus its draft value.
  const [editing, setEditing] = useState<{ row: number; col: number } | null>(null)
  const [draft, setDraft] = useState("")
  const [draftNull, setDraftNull] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (editing) inputRef.current?.focus()
  }, [editing])

  const beginEdit = (row: number, col: number) => {
    const cell = rows[row]?.[col] ?? null
    setEditing({ row, col })
    setDraft(cell ?? "")
    setDraftNull(cell === null)
  }

  const commit = () => {
    if (!editing) return
    const value = draftNull ? null : draft
    onSaveCell(editing.row, editing.col, value)
    setEditing(null)
  }
  const cancel = () => setEditing(null)

  return (
    <div className="h-full overflow-auto">
      <table className="w-full border-collapse text-left text-xs">
        <thead className="sticky top-0 z-10">
          <tr className="bg-muted/80 backdrop-blur">
            <th className="w-9 border-b border-r border-border px-2 py-1.5 text-center">
              <Checkbox
                checked={rows.length > 0 && selected.size === rows.length}
                indeterminate={selected.size > 0 && selected.size < rows.length}
                onCheckedChange={onToggleAll}
                aria-label="Select all rows"
                disabled={busy}
              />
            </th>
            <th className="w-10 border-b border-r border-border px-2 py-1.5 text-right font-mono text-[10px] font-normal text-muted-foreground/60">
              #
            </th>
            {columns.map((col, i) => {
              const sorted = sort?.col === col ? sort.dir : null
              return (
                <th
                  key={i}
                  className="border-b border-r border-border p-0 font-mono font-semibold text-foreground/90"
                >
                  <DropdownMenu>
                    <DropdownMenuTrigger
                      render={
                        <button
                          type="button"
                          className="flex w-full items-center gap-1.5 px-2.5 py-1.5 text-left hover:bg-muted"
                        />
                      }
                    >
                      <span className="truncate">{col}</span>
                      {sorted === "asc" ? (
                        <ChevronUp className="h-3 w-3 shrink-0 text-primary" />
                      ) : sorted === "desc" ? (
                        <ChevronDown className="h-3 w-3 shrink-0 text-primary" />
                      ) : null}
                      <MoreIcon className="ml-auto h-3.5 w-3.5 shrink-0 opacity-40" />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start" className="min-w-44">
                      <DropdownMenuItem
                        onClick={() => {
                          navigator.clipboard?.writeText(col)
                          showToast("Copied", `Column name "${col}" copied.`, "success")
                        }}
                      >
                        <CopyIcon className="h-3.5 w-3.5" />
                        Copy column name
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={() => onSort(col, "asc")}>
                        <ChevronUp className="h-3.5 w-3.5" />
                        Sort A → Z
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => onSort(col, "desc")}>
                        <ChevronDown className="h-3.5 w-3.5" />
                        Sort Z → A
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </th>
              )
            })}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={columns.length + 2} className="px-2.5 py-8 text-center text-muted-foreground">
                No rows.
              </td>
            </tr>
          ) : (
            rows.map((row, r) => {
              const isSelected = selected.has(r)
              return (
                <tr key={r} className={isSelected ? "bg-primary/5" : "hover:bg-muted/40"}>
                  <td className="border-b border-r border-border/60 px-2 py-1.5 text-center">
                    <Checkbox
                      checked={isSelected}
                      onCheckedChange={() => onToggleRow(r)}
                      aria-label={`Select row ${r + 1}`}
                      disabled={busy}
                    />
                  </td>
                  <td className="border-b border-r border-border/60 px-2 py-1.5 text-right font-mono text-[10px] text-muted-foreground/50">
                    {page * PAGE_SIZE + r + 1}
                  </td>
                  {columns.map((_, c) => {
                    const cell = row[c]
                    const isEditing = editing?.row === r && editing?.col === c
                    return (
                      <td
                        key={c}
                        className="relative max-w-[200px] truncate border-b border-r border-border/60 p-0 font-mono text-foreground/90 sm:max-w-[420px]"
                        onDoubleClick={() => !busy && beginEdit(r, c)}
                        title={isEditing ? undefined : cell === null ? "NULL - double-click to edit" : "Double-click to edit"}
                      >
                        {/* Display content always renders so it drives the column
                            width; the editor overlays it absolutely so editing
                            never changes the cell's intrinsic size. */}
                        <div className="flex h-[31px] cursor-text items-center px-2.5">
                          {cell === null ? (
                            <span className="italic text-muted-foreground/50">NULL</span>
                          ) : cell === "" ? (
                            <span className="italic text-muted-foreground/40">empty</span>
                          ) : (
                            <span className="truncate">{cell}</span>
                          )}
                        </div>
                        {isEditing && (
                          <div className="absolute inset-0 z-10 flex h-[31px] items-center gap-1 bg-background px-1.5 ring-2 ring-inset ring-primary">
                            <input
                              ref={inputRef}
                              size={1}
                              value={draftNull ? "" : draft}
                              disabled={draftNull}
                              onChange={(e) => setDraft(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                  e.preventDefault()
                                  commit()
                                } else if (e.key === "Escape") {
                                  e.preventDefault()
                                  cancel()
                                }
                              }}
                              onBlur={() => {
                                // Delay so a click on the NULL button registers first.
                                setTimeout(() => {
                                  setEditing((cur) => {
                                    if (cur && cur.row === r && cur.col === c) {
                                      const value = draftNull ? null : draft
                                      onSaveCell(r, c, value)
                                      return null
                                    }
                                    return cur
                                  })
                                }, 120)
                              }}
                              placeholder={draftNull ? "NULL" : ""}
                              className="h-full w-full min-w-0 bg-transparent font-mono text-xs leading-none outline-none placeholder:italic placeholder:text-muted-foreground/50"
                            />
                            <button
                              type="button"
                              onMouseDown={(e) => {
                                e.preventDefault()
                                setDraftNull((v) => !v)
                              }}
                              className={`shrink-0 rounded px-1 py-0.5 text-[10px] font-medium ${
                                draftNull ? "bg-primary/15 text-primary" : "text-muted-foreground hover:bg-muted"
                              }`}
                              title="Toggle SQL NULL"
                            >
                              NULL
                            </button>
                          </div>
                        )}
                      </td>
                    )
                  })}
                </tr>
              )
            })
          )}
        </tbody>
      </table>
      {rows.length > 0 && (
        <div className="px-3 py-2 text-[11px] text-muted-foreground/70">
          Double-click a cell to edit. Press Enter to save, Esc to cancel.
        </div>
      )}
    </div>
  )
}

// ── Add row dialog ──────────────────────────────────────────────────────────

function AddRowDialog({
  open,
  onOpenChange,
  addon,
  table,
  columns,
  onAdded,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  addon: Addon
  table: string
  columns: DbColumn[] | undefined
  onAdded: () => void
}) {
  const { showToast } = useToast()
  const [values, setValues] = useState<Record<string, string>>({})
  const [nulls, setNulls] = useState<Record<string, boolean>>({})
  const [omit, setOmit] = useState<Record<string, boolean>>({})
  const [saving, setSaving] = useState(false)

  // Default: omit columns that have a DB default (serial PKs, timestamps) so
  // they populate themselves. Initialized during render the first time columns
  // arrive, using the column-name signature as a reset key.
  const colsKey = (columns ?? []).map((c) => c.name).join(",")
  const [initKey, setInitKey] = useState<string | null>(null)
  if (columns && initKey !== colsKey) {
    setInitKey(colsKey)
    const initialOmit: Record<string, boolean> = {}
    for (const c of columns) {
      if (c.default !== null && c.default !== "") initialOmit[c.name] = true
    }
    setOmit(initialOmit)
    setValues({})
    setNulls({})
  }

  const submit = async () => {
    if (!columns) return
    const payload: Record<string, string | null> = {}
    for (const c of columns) {
      if (omit[c.name]) continue
      payload[c.name] = nulls[c.name] ? null : values[c.name] ?? ""
    }
    setSaving(true)
    try {
      const res = await api.addons.dbInsertRow(addon.id, table, payload)
      if (res.error) {
        showToast("Insert failed", res.error, "destructive")
      } else {
        showToast("Row added", "Inserted successfully.", "success")
        onAdded()
        onOpenChange(false)
      }
    } catch (err) {
      showToast("Insert failed", err instanceof Error ? err.message : "Could not insert.", "destructive")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Add row</DialogTitle>
          <DialogDescription>
            Insert a new row into <span className="font-mono">{table}</span>.
          </DialogDescription>
        </DialogHeader>
        <div className="max-h-[55vh] space-y-3 overflow-y-auto px-6 py-1">
          {!columns ? (
            <div className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
              <Spinner className="h-4 w-4" />
              Loading columns…
            </div>
          ) : (
            columns.map((c) => {
              const isOmitted = !!omit[c.name]
              const isNull = !!nulls[c.name]
              return (
                <div key={c.name} className="space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <label className="flex items-center gap-1.5 font-mono text-xs font-medium">
                      {c.name}
                      {c.primaryKey && (
                        <Badge variant="outline" size="sm" className="font-sans">
                          PK
                        </Badge>
                      )}
                      <span className="font-sans font-normal text-[10px] text-muted-foreground">{c.type}</span>
                    </label>
                    <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                      {(c.default !== null || c.primaryKey) && (
                        <label className="flex items-center gap-1">
                          <Checkbox
                            checked={isOmitted}
                            onCheckedChange={(v) => setOmit((m) => ({ ...m, [c.name]: !!v }))}
                          />
                          default
                        </label>
                      )}
                      {c.nullable && (
                        <label className="flex items-center gap-1">
                          <Checkbox
                            checked={isNull}
                            disabled={isOmitted}
                            onCheckedChange={(v) => setNulls((m) => ({ ...m, [c.name]: !!v }))}
                          />
                          NULL
                        </label>
                      )}
                    </div>
                  </div>
                  <Input
                    value={isOmitted ? "" : isNull ? "" : values[c.name] ?? ""}
                    disabled={isOmitted || isNull}
                    placeholder={
                      isOmitted
                        ? `default${c.default ? ` (${c.default})` : ""}`
                        : isNull
                          ? "NULL"
                          : ""
                    }
                    onChange={(e) => setValues((m) => ({ ...m, [c.name]: e.target.value }))}
                    className="h-8 font-mono text-xs"
                  />
                </div>
              )
            })
          )}
        </div>
        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>Cancel</DialogClose>
          <Button onClick={submit} loading={saving} disabled={!columns}>
            Add row
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
