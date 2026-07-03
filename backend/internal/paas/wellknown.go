package paas

import (
	"net/http"
	"os"
	"strings"
)

// GET /.well-known/better-paas.json
// Public discovery document for the paas CLI and other clients.
func handleWellKnown(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet && r.Method != http.MethodHead {
		jsonError(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}
	apiURL := requestBaseURL(r)
	uiURL := strings.TrimRight(strings.TrimSpace(os.Getenv("PAAS_UI_URL")), "/")
	out := map[string]string{"apiUrl": apiURL}
	if uiURL != "" {
		out["uiUrl"] = uiURL
	}
	jsonOK(w, out)
}
