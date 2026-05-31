package main

import (
	"bytes"
	"context"
	"fmt"
	"net/http"
	"os/exec"
	"strconv"
	"strings"
	"time"
)

// ---------------------------------------------------------------------------
// Database explorer
// ---------------------------------------------------------------------------
//
// A lightweight, built-in "studio" for managed databases: list tables, browse
// their contents page-by-page, and run ad-hoc queries. Everything runs by
// shelling into the add-on's own container with its CLI client
// (psql / mysql / redis-cli), so no extra ports are exposed and the database
// stays on its private network.
//
// Credentials come from dbGetAddon (which returns the *unredacted* ConnEnv),
// and are passed to the client via environment variables on `docker exec` so
// they never appear in the container's process list. SQL/commands are passed
// as a single argv element to the client (never through a shell), so there is
// no shell-injection surface — the admin is intentionally running SQL here.
//
// These endpoints sit behind the same admin auth gate as the rest of the API.

// dbQueryResult is the uniform shape returned for every explorer operation.
//
// A row's cells are *string so a real SQL NULL (nil) is distinguishable from an
// empty string ("").
type dbQueryResult struct {
	Columns []string    `json:"columns"`
	Rows    [][]*string `json:"rows"`
	Message string      `json:"message,omitempty"` // for non-row statements (INSERT/UPDATE/…)
	Error   string      `json:"error,omitempty"`
	Total   int         `json:"total,omitempty"` // total row count when browsing a table
}

// normalized guarantees Columns/Rows are non-nil so they marshal as JSON
// arrays ([]) rather than null — the frontend contract expects arrays even for
// error/empty results.
func (r dbQueryResult) normalized() dbQueryResult {
	if r.Columns == nil {
		r.Columns = []string{}
	}
	if r.Rows == nil {
		r.Rows = [][]*string{}
	}
	return r
}

// Field/record separators for psql unaligned output. These are the ASCII
// "unit separator" / "record separator" control chars — chosen because they
// effectively never appear in real text data.
const (
	pgFieldSep = "\x1f"
	pgRecSep   = "\x1e"
	pgNullMark = "\u2400" // ␀ SYMBOL FOR NULL — used as psql's NULL display string
)

// addonExecTimeout bounds a single explorer operation so a runaway query can't
// hang the request forever.
const addonExecTimeout = 30 * time.Second

// ---------------------------------------------------------------------------
// Credentials
// ---------------------------------------------------------------------------

func firstNonEmpty(vals ...string) string {
	for _, v := range vals {
		if v != "" {
			return v
		}
	}
	return ""
}

// addonCreds extracts the (user, password, database) an explorer client needs
// from the add-on's stored connection env.
func addonCreds(a *Addon) (user, pass, dbname string) {
	ce := a.ConnEnv
	switch a.Type {
	case "postgres":
		return firstNonEmpty(ce["PGUSER"], "appuser"), ce["PGPASSWORD"], firstNonEmpty(ce["PGDATABASE"], "appdb")
	case "mysql":
		return firstNonEmpty(ce["MYSQL_USER"], "appuser"),
			firstNonEmpty(ce["MYSQL_PASSWORD"], ce["MYSQL_ROOT_PASSWORD"]),
			firstNonEmpty(ce["MYSQL_DATABASE"], "appdb")
	case "redis":
		return "", ce["REDIS_PASSWORD"], ""
	}
	return "", "", ""
}

// ---------------------------------------------------------------------------
// Low-level exec
// ---------------------------------------------------------------------------

// dockerExec runs a client inside the add-on container with the given extra
// environment variables and arguments, returning stdout/stderr separately.
func dockerExec(env []string, container string, args ...string) (string, string, error) {
	ctx, cancel := context.WithTimeout(context.Background(), addonExecTimeout)
	defer cancel()

	full := []string{"exec"}
	for _, e := range env {
		full = append(full, "-e", e)
	}
	full = append(full, container)
	full = append(full, args...)

	cmd := exec.CommandContext(ctx, "docker", full...)
	var stdout, stderr bytes.Buffer
	cmd.Stdout = &stdout
	cmd.Stderr = &stderr
	err := cmd.Run()
	if ctx.Err() == context.DeadlineExceeded {
		return stdout.String(), "Query timed out after 30s.", ctx.Err()
	}
	return stdout.String(), stderr.String(), err
}

// ---------------------------------------------------------------------------
// SQL: Postgres + MySQL
// ---------------------------------------------------------------------------

// runSQL executes an arbitrary SQL statement and parses its result.
func runSQL(a *Addon, sql string) dbQueryResult {
	user, pass, dbname := addonCreds(a)
	switch a.Type {
	case "postgres":
		out, errOut, err := dockerExec(
			[]string{"PGPASSWORD=" + pass},
			a.ContainerName,
			"psql", "-U", user, "-d", dbname,
			"-X", "-A",
			"-F", pgFieldSep,
			"-R", pgRecSep,
			"-P", "null="+pgNullMark,
			"-v", "ON_ERROR_STOP=1",
			"-c", sql,
		)
		if err != nil {
			return dbQueryResult{Error: cleanDBError(errOut, err)}
		}
		if !isRowReturning(sql) {
			return dbQueryResult{Message: firstNonEmpty(strings.TrimSpace(out), "Statement executed successfully.")}
		}
		return parsePsql(out)

	case "mysql":
		out, errOut, err := dockerExec(
			[]string{"MYSQL_PWD=" + pass},
			a.ContainerName,
			"mysql", "-u", user, dbname,
			"--batch", "--default-character-set=utf8mb4",
			"-e", sql,
		)
		if err != nil {
			return dbQueryResult{Error: cleanDBError(errOut, err)}
		}
		return parseMySQL(out)
	}
	return dbQueryResult{Error: "Querying is only supported for Postgres and MySQL."}
}

// isRowReturning reports whether a statement is expected to yield a result set.
// Used for Postgres, where DML statements print a command tag ("INSERT 0 1")
// to stdout rather than a table.
func isRowReturning(sql string) bool {
	s := strings.ToLower(strings.TrimLeft(strings.TrimSpace(sql), "( \t\r\n"))
	for _, kw := range []string{"select", "with", "show", "table", "values", "explain"} {
		if s == kw || strings.HasPrefix(s, kw+" ") || strings.HasPrefix(s, kw+"\n") {
			return true
		}
	}
	// INSERT/UPDATE/DELETE … RETURNING also yields rows.
	return strings.Contains(s, " returning ")
}

// parsePsql turns psql's unaligned, separator-delimited output into a result.
func parsePsql(out string) dbQueryResult {
	out = strings.Trim(out, "\n")
	out = strings.TrimSuffix(out, pgRecSep)
	if strings.TrimSpace(out) == "" {
		return dbQueryResult{Columns: []string{}, Rows: [][]*string{}}
	}
	records := strings.Split(out, pgRecSep)
	if len(records) == 0 {
		return dbQueryResult{Columns: []string{}, Rows: [][]*string{}}
	}
	cols := strings.Split(records[0], pgFieldSep)
	res := dbQueryResult{Columns: cols, Rows: [][]*string{}}
	for _, rec := range records[1:] {
		if rec == "" {
			continue
		}
		fields := strings.Split(rec, pgFieldSep)
		row := make([]*string, len(cols))
		for i := range cols {
			if i < len(fields) {
				v := fields[i]
				if v == pgNullMark {
					row[i] = nil
				} else {
					vv := v
					row[i] = &vv
				}
			}
		}
		res.Rows = append(res.Rows, row)
	}
	return res
}

// parseMySQL parses mysql --batch (tab-separated, escaped) output.
func parseMySQL(out string) dbQueryResult {
	out = strings.TrimRight(out, "\n")
	if out == "" {
		// No result set: a successful DML/DDL statement.
		return dbQueryResult{Message: "Statement executed successfully.", Columns: []string{}, Rows: [][]*string{}}
	}
	lines := strings.Split(out, "\n")
	cols := mysqlHeaderCols(lines[0])
	res := dbQueryResult{Columns: cols, Rows: [][]*string{}}
	for _, line := range lines[1:] {
		fields := splitMySQLRow(line)
		row := make([]*string, len(cols))
		for i := range cols {
			if i < len(fields) {
				row[i] = fields[i]
			}
		}
		res.Rows = append(res.Rows, row)
	}
	return res
}

// mysqlHeaderCols parses the header line of mysql --batch output into column
// names (the header has no NULL tokens, but may have escaped characters).
func mysqlHeaderCols(line string) []string {
	cells := splitMySQLRow(line)
	cols := make([]string, len(cells))
	for i, c := range cells {
		if c != nil {
			cols[i] = *c
		}
	}
	return cols
}

// splitMySQLRow splits one batch-mode line into cells, handling MySQL's
// backslash escaping and its unquoted NULL token (rendered as a nil *string).
func splitMySQLRow(line string) []*string {
	var cells []*string
	var b strings.Builder
	escaped := false
	raw := strings.Builder{} // tracks the un-decoded token, to detect literal NULL
	flush := func() {
		token := raw.String()
		if token == "NULL" {
			cells = append(cells, nil)
		} else {
			s := b.String()
			cells = append(cells, &s)
		}
		b.Reset()
		raw.Reset()
	}
	for _, r := range line {
		if escaped {
			switch r {
			case 'n':
				b.WriteRune('\n')
			case 't':
				b.WriteRune('\t')
			case '0':
				b.WriteRune(0)
			case '\\':
				b.WriteRune('\\')
			default:
				b.WriteRune(r)
			}
			raw.WriteRune('\\')
			raw.WriteRune(r)
			escaped = false
			continue
		}
		switch r {
		case '\\':
			escaped = true
		case '\t':
			flush()
		default:
			b.WriteRune(r)
			raw.WriteRune(r)
		}
	}
	flush()
	return cells
}

// cleanDBError trims a client's stderr into a single useful line.
func cleanDBError(stderr string, err error) string {
	stderr = strings.TrimSpace(stderr)
	if stderr == "" {
		if err != nil {
			return err.Error()
		}
		return "Unknown error."
	}
	// Prefer the first non-empty, meaningful line.
	for _, line := range strings.Split(stderr, "\n") {
		line = strings.TrimSpace(line)
		if line == "" {
			continue
		}
		return line
	}
	return stderr
}

// ---------------------------------------------------------------------------
// Table listing + browsing
// ---------------------------------------------------------------------------

func pgQuoteIdent(s string) string { return `"` + strings.ReplaceAll(s, `"`, `""`) + `"` }
func myQuoteIdent(s string) string { return "`" + strings.ReplaceAll(s, "`", "``") + "`" }

// listTables returns the table names for a SQL add-on, or the keys for Redis.
func listTables(a *Addon) ([]string, error) {
	switch a.Type {
	case "postgres":
		res := runSQL(a, "SELECT table_name FROM information_schema.tables WHERE table_schema='public' ORDER BY table_name")
		if res.Error != "" {
			return nil, fmt.Errorf("%s", res.Error)
		}
		return flattenFirstColumn(res), nil
	case "mysql":
		res := runSQL(a, "SELECT table_name FROM information_schema.tables WHERE table_schema=DATABASE() ORDER BY table_name")
		if res.Error != "" {
			return nil, fmt.Errorf("%s", res.Error)
		}
		return flattenFirstColumn(res), nil
	case "redis":
		return redisKeys(a, 1000)
	}
	return nil, fmt.Errorf("unsupported add-on type")
}

func flattenFirstColumn(res dbQueryResult) []string {
	out := make([]string, 0, len(res.Rows))
	for _, row := range res.Rows {
		if len(row) > 0 && row[0] != nil {
			out = append(out, *row[0])
		}
	}
	return out
}

// browseTable returns one page of rows from a table plus the total row count.
// The table name is validated against the live table list to keep it from
// being anything other than a real identifier.
func browseTable(a *Addon, table string, limit, offset int) dbQueryResult {
	if limit <= 0 || limit > 1000 {
		limit = 50
	}
	if offset < 0 {
		offset = 0
	}

	if a.Type == "redis" {
		return redisBrowseKey(a, table)
	}

	tables, err := listTables(a)
	if err != nil {
		return dbQueryResult{Error: err.Error()}
	}
	if !containsString(tables, table) {
		return dbQueryResult{Error: "Table not found."}
	}

	var dataSQL, countSQL string
	switch a.Type {
	case "postgres":
		ident := pgQuoteIdent(table)
		dataSQL = fmt.Sprintf("SELECT * FROM %s LIMIT %d OFFSET %d", ident, limit, offset)
		countSQL = fmt.Sprintf("SELECT count(*) FROM %s", ident)
	case "mysql":
		ident := myQuoteIdent(table)
		dataSQL = fmt.Sprintf("SELECT * FROM %s LIMIT %d OFFSET %d", ident, limit, offset)
		countSQL = fmt.Sprintf("SELECT count(*) FROM %s", ident)
	default:
		return dbQueryResult{Error: "Unsupported add-on type."}
	}

	res := runSQL(a, dataSQL)
	if res.Error != "" {
		return res
	}
	if cnt := runSQL(a, countSQL); cnt.Error == "" && len(cnt.Rows) == 1 && len(cnt.Rows[0]) == 1 && cnt.Rows[0][0] != nil {
		if n, e := strconv.Atoi(strings.TrimSpace(*cnt.Rows[0][0])); e == nil {
			res.Total = n
		}
	}
	return res
}

// ---------------------------------------------------------------------------
// Redis
// ---------------------------------------------------------------------------

// redisKeys returns up to max keys via a non-blocking SCAN.
func redisKeys(a *Addon, max int) ([]string, error) {
	_, pass, _ := addonCreds(a)
	out, errOut, err := dockerExec(
		[]string{"REDISCLI_AUTH=" + pass},
		a.ContainerName,
		"redis-cli", "--scan",
	)
	if err != nil {
		return nil, fmt.Errorf("%s", cleanDBError(errOut, err))
	}
	var keys []string
	for _, line := range strings.Split(strings.TrimSpace(out), "\n") {
		line = strings.TrimSpace(line)
		if line == "" {
			continue
		}
		keys = append(keys, line)
		if len(keys) >= max {
			break
		}
	}
	return keys, nil
}

// redisBrowseKey inspects a key's type and returns its value as rows.
func redisBrowseKey(a *Addon, key string) dbQueryResult {
	_, pass, _ := addonCreds(a)
	env := []string{"REDISCLI_AUTH=" + pass}

	typeOut, errOut, err := dockerExec(env, a.ContainerName, "redis-cli", "TYPE", key)
	if err != nil {
		return dbQueryResult{Error: cleanDBError(errOut, err)}
	}
	kind := strings.TrimSpace(typeOut)

	str := func(s string) *string { v := s; return &v }

	switch kind {
	case "string":
		out, e, er := dockerExec(env, a.ContainerName, "redis-cli", "GET", key)
		if er != nil {
			return dbQueryResult{Error: cleanDBError(e, er)}
		}
		return dbQueryResult{Columns: []string{"value"}, Rows: [][]*string{{str(strings.TrimRight(out, "\n"))}}}
	case "list":
		out, e, er := dockerExec(env, a.ContainerName, "redis-cli", "LRANGE", key, "0", "-1")
		if er != nil {
			return dbQueryResult{Error: cleanDBError(e, er)}
		}
		return linesToRows(out, "value")
	case "set":
		out, e, er := dockerExec(env, a.ContainerName, "redis-cli", "SMEMBERS", key)
		if er != nil {
			return dbQueryResult{Error: cleanDBError(e, er)}
		}
		return linesToRows(out, "member")
	case "hash":
		out, e, er := dockerExec(env, a.ContainerName, "redis-cli", "HGETALL", key)
		if er != nil {
			return dbQueryResult{Error: cleanDBError(e, er)}
		}
		return pairsToRows(out, "field", "value")
	case "zset":
		out, e, er := dockerExec(env, a.ContainerName, "redis-cli", "ZRANGE", key, "0", "-1", "WITHSCORES")
		if er != nil {
			return dbQueryResult{Error: cleanDBError(e, er)}
		}
		return pairsToRows(out, "member", "score")
	case "none":
		return dbQueryResult{Error: "Key does not exist."}
	default:
		return dbQueryResult{Message: fmt.Sprintf("Key %q has type %q, which isn't previewable here. Use the query console.", key, kind)}
	}
}

func linesToRows(out, col string) dbQueryResult {
	res := dbQueryResult{Columns: []string{col}, Rows: [][]*string{}}
	for _, line := range strings.Split(strings.TrimRight(out, "\n"), "\n") {
		v := line
		res.Rows = append(res.Rows, []*string{&v})
	}
	return res
}

func pairsToRows(out, c1, c2 string) dbQueryResult {
	res := dbQueryResult{Columns: []string{c1, c2}, Rows: [][]*string{}}
	lines := strings.Split(strings.TrimRight(out, "\n"), "\n")
	for i := 0; i+1 < len(lines); i += 2 {
		a, b := lines[i], lines[i+1]
		res.Rows = append(res.Rows, []*string{&a, &b})
	}
	return res
}

// runRedisCommand executes an arbitrary redis-cli command line.
func runRedisCommand(a *Addon, command string) dbQueryResult {
	_, pass, _ := addonCreds(a)
	args := tokenizeCommand(command)
	if len(args) == 0 {
		return dbQueryResult{Error: "Enter a command."}
	}
	cliArgs := append([]string{"redis-cli"}, args...)
	out, errOut, err := dockerExec([]string{"REDISCLI_AUTH=" + pass}, a.ContainerName, cliArgs...)
	if err != nil {
		return dbQueryResult{Error: cleanDBError(errOut, err)}
	}
	trimmed := strings.TrimRight(out, "\n")
	if trimmed == "" {
		return dbQueryResult{Message: "OK"}
	}
	return linesToRows(out, "result")
}

// tokenizeCommand splits a command line into args, honoring single/double
// quotes so values with spaces survive intact.
func tokenizeCommand(s string) []string {
	var args []string
	var cur strings.Builder
	var quote rune
	inWord := false
	flush := func() {
		if inWord {
			args = append(args, cur.String())
			cur.Reset()
			inWord = false
		}
	}
	for _, r := range s {
		switch {
		case quote != 0:
			if r == quote {
				quote = 0
			} else {
				cur.WriteRune(r)
			}
		case r == '\'' || r == '"':
			quote = r
			inWord = true
		case r == ' ' || r == '\t':
			flush()
		default:
			cur.WriteRune(r)
			inWord = true
		}
	}
	flush()
	return args
}

// ---------------------------------------------------------------------------
// HTTP handlers
// ---------------------------------------------------------------------------

// resolveExplorerAddon loads the add-on and verifies it's ready to be queried.
func resolveExplorerAddon(w http.ResponseWriter, id string) *Addon {
	addon, err := dbGetAddon(id)
	if err != nil || addon == nil {
		jsonError(w, "Database not found", http.StatusNotFound)
		return nil
	}
	if addon.Type != "postgres" && addon.Type != "mysql" && addon.Type != "redis" {
		jsonError(w, "Unsupported database type", http.StatusBadRequest)
		return nil
	}
	if addon.Status != "running" {
		jsonError(w, "Database is not running", http.StatusConflict)
		return nil
	}
	if !containerExists(addon.ContainerName) {
		jsonError(w, "Database container is not available", http.StatusConflict)
		return nil
	}
	return addon
}

// POST /api/addons/db/tables — list tables (SQL) or keys (Redis).
func handleAddonDBTables(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		jsonError(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}
	var req struct {
		ID string `json:"id"`
	}
	if err := decodeJSON(r, &req); err != nil {
		jsonError(w, "Bad request", http.StatusBadRequest)
		return
	}
	addon := resolveExplorerAddon(w, req.ID)
	if addon == nil {
		return
	}
	tables, err := listTables(addon)
	if err != nil {
		jsonError(w, err.Error(), http.StatusBadGateway)
		return
	}
	jsonOK(w, map[string]any{"type": addon.Type, "tables": tables})
}

// POST /api/addons/db/table — browse one page of a table (or one Redis key).
func handleAddonDBTable(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		jsonError(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}
	var req struct {
		ID     string `json:"id"`
		Table  string `json:"table"`
		Limit  int    `json:"limit"`
		Offset int    `json:"offset"`
	}
	if err := decodeJSON(r, &req); err != nil {
		jsonError(w, "Bad request", http.StatusBadRequest)
		return
	}
	if strings.TrimSpace(req.Table) == "" {
		jsonError(w, "Table is required", http.StatusBadRequest)
		return
	}
	addon := resolveExplorerAddon(w, req.ID)
	if addon == nil {
		return
	}
	jsonOK(w, browseTable(addon, req.Table, req.Limit, req.Offset).normalized())
}

// POST /api/addons/db/query — run an ad-hoc query / command.
func handleAddonDBQuery(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		jsonError(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}
	var req struct {
		ID    string `json:"id"`
		Query string `json:"query"`
	}
	if err := decodeJSON(r, &req); err != nil {
		jsonError(w, "Bad request", http.StatusBadRequest)
		return
	}
	if strings.TrimSpace(req.Query) == "" {
		jsonError(w, "Query is required", http.StatusBadRequest)
		return
	}
	addon := resolveExplorerAddon(w, req.ID)
	if addon == nil {
		return
	}
	if addon.Type == "redis" {
		jsonOK(w, runRedisCommand(addon, req.Query).normalized())
		return
	}
	jsonOK(w, runSQL(addon, req.Query).normalized())
}
