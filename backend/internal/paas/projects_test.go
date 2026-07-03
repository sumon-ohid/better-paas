package paas

import (
	"testing"
	"time"
)

func TestPickPrimaryAppForProject(t *testing.T) {
	now := time.Now()
	older := now.Add(-time.Hour)

	standalone := App{ID: "proj1", Name: "web", ProjectID: "proj1", CreatedAt: now}
	composePrimary := App{ID: "svc-api", Name: "api", ProjectID: "proj2", ComposePrimary: true, CreatedAt: now}
	composeOther := App{ID: "svc-web", Name: "web", ProjectID: "proj2", CreatedAt: older}

	t.Run("prefers app whose id matches project id", func(t *testing.T) {
		got := pickPrimaryAppForProject("proj1", []App{standalone})
		if got.ID != "proj1" {
			t.Fatalf("got %q, want proj1", got.ID)
		}
	})

	t.Run("prefers compose primary when ids differ", func(t *testing.T) {
		got := pickPrimaryAppForProject("proj2", []App{composeOther, composePrimary})
		if got.ID != "svc-api" {
			t.Fatalf("got %q, want svc-api", got.ID)
		}
	})

	t.Run("falls back to earliest created", func(t *testing.T) {
		newer := App{ID: "b", Name: "b", ProjectID: "proj3", CreatedAt: now}
		earlier := App{ID: "a", Name: "a", ProjectID: "proj3", CreatedAt: older}
		got := pickPrimaryAppForProject("proj3", []App{newer, earlier})
		if got.ID != "a" {
			t.Fatalf("got %q, want a", got.ID)
		}
	})
}
