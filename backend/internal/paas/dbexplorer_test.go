package paas

import "testing"

// deref turns a *string into a comparable value for assertions; nil becomes the
// sentinel "<nil>".
func deref(s *string) string {
	if s == nil {
		return "<nil>"
	}
	return *s
}

func TestParsePsql(t *testing.T) {
	// id<US>name<US>email<RS>1<US>Alice<US>a@x.com<RS>2<US>Bob<US>␀<RS>
	out := "id" + pgFieldSep + "name" + pgFieldSep + "email" + pgRecSep +
		"1" + pgFieldSep + "Alice" + pgFieldSep + "a@x.com" + pgRecSep +
		"2" + pgFieldSep + "Bob" + pgFieldSep + pgNullMark + pgRecSep

	res := parsePsql(out)
	if res.Error != "" {
		t.Fatalf("unexpected error: %s", res.Error)
	}
	wantCols := []string{"id", "name", "email"}
	if len(res.Columns) != len(wantCols) {
		t.Fatalf("columns=%v want %v", res.Columns, wantCols)
	}
	for i := range wantCols {
		if res.Columns[i] != wantCols[i] {
			t.Errorf("col[%d]=%q want %q", i, res.Columns[i], wantCols[i])
		}
	}
	if len(res.Rows) != 2 {
		t.Fatalf("rows=%d want 2", len(res.Rows))
	}
	if deref(res.Rows[0][1]) != "Alice" {
		t.Errorf("row0 name=%q want Alice", deref(res.Rows[0][1]))
	}
	// The email of row 1 (Bob) should be a real NULL, not the literal mark.
	if res.Rows[1][2] != nil {
		t.Errorf("row1 email=%q want NULL (nil)", deref(res.Rows[1][2]))
	}
}

func TestParsePsqlEmpty(t *testing.T) {
	res := parsePsql("")
	if res.Error != "" {
		t.Fatalf("unexpected error: %s", res.Error)
	}
	if len(res.Rows) != 0 {
		t.Errorf("rows=%d want 0", len(res.Rows))
	}
}

func TestParseMySQL(t *testing.T) {
	// MySQL --batch is tab-separated; NULL is the bare token NULL, and special
	// characters are backslash-escaped (e.g. \n for a newline inside a value).
	out := "id\tname\tnote\n" +
		"1\tAlice\tline1\\nline2\n" +
		"2\tBob\tNULL\n"

	res := parseMySQL(out)
	if res.Error != "" {
		t.Fatalf("unexpected error: %s", res.Error)
	}
	if len(res.Columns) != 3 || res.Columns[2] != "note" {
		t.Fatalf("columns=%v", res.Columns)
	}
	if len(res.Rows) != 2 {
		t.Fatalf("rows=%d want 2", len(res.Rows))
	}
	if deref(res.Rows[0][2]) != "line1\nline2" {
		t.Errorf("row0 note=%q want line1<LF>line2", deref(res.Rows[0][2]))
	}
	if res.Rows[1][2] != nil {
		t.Errorf("row1 note=%q want NULL (nil)", deref(res.Rows[1][2]))
	}
	// An empty-string cell must stay distinct from NULL.
	emptyOut := "a\tb\n\tx\n"
	er := parseMySQL(emptyOut)
	if er.Rows[0][0] == nil {
		t.Errorf("empty cell parsed as NULL, want empty string")
	}
	if deref(er.Rows[0][0]) != "" {
		t.Errorf("empty cell=%q want empty string", deref(er.Rows[0][0]))
	}
}

func TestIsRowReturning(t *testing.T) {
	cases := map[string]bool{
		"SELECT * FROM t":                       true,
		"  select 1":                            true,
		"WITH x AS (...) SELECT * FROM x":       true,
		"SHOW TABLES":                           true,
		"EXPLAIN SELECT 1":                      true,
		"INSERT INTO t VALUES (1)":              false,
		"UPDATE t SET a=1":                      false,
		"DELETE FROM t":                         false,
		"INSERT INTO t VALUES (1) RETURNING id": true,
		"CREATE TABLE t (id int)":               false,
	}
	for sql, want := range cases {
		if got := isRowReturning(sql); got != want {
			t.Errorf("isRowReturning(%q)=%v want %v", sql, got, want)
		}
	}
}

func TestTokenizeCommand(t *testing.T) {
	cases := []struct {
		in   string
		want []string
	}{
		{"GET mykey", []string{"GET", "mykey"}},
		{`SET k "hello world"`, []string{"SET", "k", "hello world"}},
		{"  KEYS   *  ", []string{"KEYS", "*"}},
		{`HSET h field 'a b c'`, []string{"HSET", "h", "field", "a b c"}},
		{"", nil},
	}
	for _, c := range cases {
		got := tokenizeCommand(c.in)
		if len(got) != len(c.want) {
			t.Errorf("tokenizeCommand(%q)=%v want %v", c.in, got, c.want)
			continue
		}
		for i := range c.want {
			if got[i] != c.want[i] {
				t.Errorf("tokenizeCommand(%q)[%d]=%q want %q", c.in, i, got[i], c.want[i])
			}
		}
	}
}

func TestQuoteIdent(t *testing.T) {
	if got := pgQuoteIdent(`weird"name`); got != `"weird""name"` {
		t.Errorf("pgQuoteIdent=%q", got)
	}
	if got := myQuoteIdent("weird`name"); got != "`weird``name`" {
		t.Errorf("myQuoteIdent=%q", got)
	}
}
