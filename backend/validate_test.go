package main

import "testing"

func TestValidateRootDir(t *testing.T) {
	valid := map[string]string{
		"":                "",
		".":               "",
		"./":              "",
		"apps/web":        "apps/web",
		"services/api/v1": "services/api/v1",
	}
	for in, want := range valid {
		got, err := validateRootDir(in)
		if err != nil {
			t.Fatalf("validateRootDir(%q) returned error: %v", in, err)
		}
		if got != want {
			t.Fatalf("validateRootDir(%q) = %q, want %q", in, got, want)
		}
	}

	invalid := []string{
		"/etc",
		"../outside",
		"apps/../../outside",
		"~/repo",
		`apps\windows`,
		string([]byte{'a', 0, 'b'}),
	}
	for _, in := range invalid {
		if got, err := validateRootDir(in); err == nil {
			t.Fatalf("validateRootDir(%q) = %q, want error", in, got)
		}
	}
}
