package paas

import (
	"os"
	"strings"
	"testing"
)

func TestIsDatabaseService(t *testing.T) {
	cases := []struct {
		name  string
		image string
		want  bool
	}{
		{"db", "postgres:16", true},
		{"database", "myorg/custom-pg:1", true},
		{"web", "nginx:alpine", false},
		{"api", "node:22", false},
		{"redis-by-image", "redis:7", true},
		{"valkey", "valkey/valkey:8", true},
		{"mongo-by-name", "mongo", true},
		{"frontend", "myapp/frontend:latest", false},
		{"cache", "someregistry/whatever:1", true}, // name "cache" matches dbServiceNameRe
		{"rabbitmq", "rabbitmq:3-management", true},
		{"app", "ghcr.io/acme/app:tag", false},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			if got := isDatabaseService(c.name, c.image); got != c.want {
				t.Errorf("isDatabaseService(%q, %q) = %v, want %v", c.name, c.image, got, c.want)
			}
		})
	}
}

func TestComposeDatabaseType(t *testing.T) {
	cases := []struct {
		name string
		svc  composeServiceConfig
		want string
	}{
		{name: "db", svc: composeServiceConfig{Image: "postgres:16-alpine"}, want: "postgres"},
		{name: "mysql", svc: composeServiceConfig{Image: "mariadb:11"}, want: "mysql"},
		{name: "cache", svc: composeServiceConfig{Image: "redis:7-alpine"}, want: "redis"},
		{name: "store", svc: composeServiceConfig{Ports: []composePort{{Target: 5432}}}, want: "postgres"},
		{name: "frontend", svc: composeServiceConfig{Image: "node:22", Ports: []composePort{{Target: 3000}}}, want: ""},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			if got := composeDatabaseType(c.name, c.svc); got != c.want {
				t.Errorf("composeDatabaseType(%q) = %q, want %q", c.name, got, c.want)
			}
		})
	}
}

func TestComposeAddonID(t *testing.T) {
	got := composeAddonID("paas-abc123", "Primary_DB")
	if got != "compose-paas-abc123-primary-db" {
		t.Errorf("composeAddonID = %q", got)
	}
	if !isComposeAddonID(got) {
		t.Errorf("expected %q to be recognized as compose-backed", got)
	}
}

func TestClassifyComposeServices(t *testing.T) {
	cfg := &composeConfig{
		Services: map[string]composeServiceConfig{
			"web": {
				Image: "nginx:alpine",
				Ports: []composePort{{Target: 80, Published: "8080", Protocol: "tcp"}},
			},
			"api": {
				Image: "node:22",
				Ports: []composePort{{Target: 3000, Published: "3000", Protocol: "tcp"}},
			},
			"frontend": {
				Image: "node:22",
				Ports: []composePort{{Target: 5173, Protocol: "tcp"}},
			},
			"db": {
				Image: "postgres:16",
				Ports: []composePort{{Target: 5432, Published: "5432", Protocol: "tcp"}},
			},
			"worker": {
				Image: "node:22",
				// no ports → not web
			},
			"redis": {
				Image: "redis:7",
				// published but datastore by image+name
				Ports: []composePort{{Target: 6379, Published: "6379", Protocol: "tcp"}},
			},
		},
	}

	services := classifyComposeServices(cfg)
	byName := map[string]composeService{}
	for _, s := range services {
		byName[s.Name] = s
	}

	if !byName["web"].Web || byName["web"].ContainerPort != 80 {
		t.Errorf("web: got web=%v port=%d, want web=true port=80", byName["web"].Web, byName["web"].ContainerPort)
	}
	if !byName["api"].Web || byName["api"].ContainerPort != 3000 {
		t.Errorf("api: got web=%v port=%d, want web=true port=3000", byName["api"].Web, byName["api"].ContainerPort)
	}
	if !byName["frontend"].Web || byName["frontend"].ContainerPort != 5173 {
		t.Errorf("frontend: got web=%v port=%d, want web=true port=5173", byName["frontend"].Web, byName["frontend"].ContainerPort)
	}
	if byName["db"].Web {
		t.Error("db should not be web-facing")
	}
	if byName["worker"].Web {
		t.Error("worker (no ports) should not be web-facing")
	}
	if byName["redis"].Web {
		t.Error("redis should not be web-facing")
	}
	// Services must be sorted by name for stable ordering.
	if services[0].Name != "api" {
		t.Errorf("expected sorted order, first = %q want %q", services[0].Name, "api")
	}
}

func TestClassifyComposeServicesDBPortWithoutKnownImage(t *testing.T) {
	// A service exposing only a well-known DB port (and a single port) is
	// treated as a datastore even with an unrecognized image/name.
	cfg := &composeConfig{
		Services: map[string]composeServiceConfig{
			"store": {
				Image: "myorg/mystore:1",
				Ports: []composePort{{Target: 5432, Published: "5432", Protocol: "tcp"}},
			},
		},
	}
	services := classifyComposeServices(cfg)
	if services[0].Web {
		t.Error("service exposing only port 5432 should be treated as a datastore")
	}
}

func TestChoosePrimaryService(t *testing.T) {
	cases := []struct {
		name string
		svcs []composeService
		want string
	}{
		{
			"prefers web name",
			[]composeService{{Name: "api", Web: true}, {Name: "web", Web: true}},
			"web",
		},
		{
			"first web when no preferred name",
			[]composeService{{Name: "zeta", Web: true}, {Name: "alpha", Web: false}},
			"zeta",
		},
		{
			"falls back to first service when none web",
			[]composeService{{Name: "db", Web: false}, {Name: "worker", Web: false}},
			"db",
		},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			if got := choosePrimaryService(c.svcs); got != c.want {
				t.Errorf("choosePrimaryService = %q, want %q", got, c.want)
			}
		})
	}
}

func TestWriteComposeOverride(t *testing.T) {
	dir := t.TempDir()
	path := dir + "/paas-override.yml"
	services := []composeService{
		{Name: "web", Web: true, ContainerPort: 80},
		{Name: "db", Web: false, HadPublished: true},
		{Name: "worker", Web: false, HadPublished: false},
	}
	hostPorts := map[string]int{"web": 9123}

	if err := writeComposeOverride(path, services, hostPorts); err != nil {
		t.Fatalf("writeComposeOverride: %v", err)
	}
	data, err := os.ReadFile(path)
	if err != nil {
		t.Fatalf("read: %v", err)
	}
	dataStr := string(data)

	if !strings.Contains(dataStr, "web:") || !strings.Contains(dataStr, "ports: !override") {
		t.Errorf("override missing web port pin:\n%s", dataStr)
	}
	if !strings.Contains(dataStr, "127.0.0.1:9123:80") {
		t.Errorf("override missing host:container mapping:\n%s", dataStr)
	}
	if !strings.Contains(dataStr, "db:") || !strings.Contains(dataStr, "ports: !reset []") {
		t.Errorf("override should reset db ports:\n%s", dataStr)
	}
	// worker had no published ports → should not appear at all.
	if strings.Contains(dataStr, "worker:") {
		t.Errorf("worker should be absent (no published ports):\n%s", dataStr)
	}
}

func TestWriteComposeOverrideEmptyServices(t *testing.T) {
	dir := t.TempDir()
	path := dir + "/paas-override.yml"
	services := []composeService{
		{Name: "worker", Web: false, HadPublished: false},
	}

	if err := writeComposeOverride(path, services, map[string]int{}); err != nil {
		t.Fatalf("writeComposeOverride: %v", err)
	}
	data, err := os.ReadFile(path)
	if err != nil {
		t.Fatalf("read: %v", err)
	}
	if got := string(data); !strings.Contains(got, "services: {}") {
		t.Errorf("empty override should use an empty services mapping, got:\n%s", got)
	}
}

func TestUniqueComposeRowName(t *testing.T) {
	taken := map[string]bool{"myapp-web": true}
	got := uniqueComposeRowName("myapp", "web", taken)
	if got == "myapp-web" {
		t.Errorf("expected a unique name distinct from existing, got %q", got)
	}
	if !taken[got] {
		t.Errorf("returned name %q should be marked taken", got)
	}
	// Second call for the same base/service must also be unique.
	got2 := uniqueComposeRowName("myapp", "web", taken)
	if got2 == got {
		t.Errorf("expected distinct names on repeat, both %q", got)
	}
}

func TestComposeProjectName(t *testing.T) {
	if got := composeProjectName("ab12cd34ef"); got != "paas-ab12cd34ef" {
		t.Errorf("composeProjectName = %q, want paas-ab12cd34ef", got)
	}
}
