package paas

import (
	"testing"
	"time"
)

func TestProjectDeployType(t *testing.T) {
	now := time.Now()
	composeWeb := App{
		ID: "w1", ProjectID: "p1", ComposeProject: "paas-p1", ComposeService: "web",
		ComposePrimary: true, BuildMethod: "compose", CreatedAt: now,
	}
	composeAPI := App{
		ID: "a1", ProjectID: "p1", ComposeProject: "paas-p1", ComposeService: "api",
		BuildMethod: "compose", CreatedAt: now,
	}
	dockerfile := App{
		ID: "d1", ProjectID: "p2", BuildMethod: "dockerfile", CreatedAt: now,
	}
	mixed := []App{
		{ID: "m1", ProjectID: "p3", BuildMethod: "nixpacks"},
		{ID: "m2", ProjectID: "p3", BuildMethod: "dockerfile"},
	}

	t.Run("compose group", func(t *testing.T) {
		typ, primary := projectDeployType([]App{composeAPI, composeWeb})
		if typ != "compose" || primary == nil || primary.ID != "w1" {
			t.Fatalf("got type=%q primary=%v", typ, primary)
		}
	})

	t.Run("single dockerfile", func(t *testing.T) {
		typ, primary := projectDeployType([]App{dockerfile})
		if typ != "dockerfile" || primary == nil || primary.ID != "d1" {
			t.Fatalf("got type=%q primary=%v", typ, primary)
		}
	})

	t.Run("mixed services", func(t *testing.T) {
		typ, primary := projectDeployType(mixed)
		if typ != "" || primary != nil {
			t.Fatalf("got type=%q primary=%v, want empty", typ, primary)
		}
	})
}
