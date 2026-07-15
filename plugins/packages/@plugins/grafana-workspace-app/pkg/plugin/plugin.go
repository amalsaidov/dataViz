package plugin

import (
	"context"
	"encoding/json"
	"net/http"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/backend/instancemgmt"
	"github.com/grafana/grafana-plugin-sdk-go/backend/log"
	"github.com/grafana/grafana-plugin-sdk-go/backend/resource/httpadapter"
)

var (
	_ instancemgmt.InstanceDisposer = (*App)(nil)
	_ backend.CallResourceHandler   = (*App)(nil)
	_ backend.CheckHealthHandler    = (*App)(nil)
)

// App is a simple app backend plugin
type App struct {
	backend.CallResourceHandler
}

// NewApp creates a new *App instance
func NewApp() *App {
	return &App{}
}

// NewInstance creates a new app instance
func NewInstance(ctx context.Context, appInstanceSettings backend.AppInstanceSettings) (instancemgmt.Instance, error) {
	app := NewApp()

	// Use httpadapter for resource calls
	mux := http.NewServeMux()
	registerRoutes(mux, app)
	app.CallResourceHandler = httpadapter.New(mux)

	return app, nil
}

// Dispose here tells plugin SDK that plugin wants to clean up resources when a new instance
// created.
func (a *App) Dispose() {
	// Clean up if needed
}

// CheckHealth handles health checks sent from Grafana to the plugin.
func (a *App) CheckHealth(ctx context.Context, req *backend.CheckHealthRequest) (*backend.CheckHealthResult, error) {
	log.DefaultLogger.Info("CheckHealth called")

	return &backend.CheckHealthResult{
		Status:  backend.HealthStatusOk,
		Message: "Plugin is healthy",
	}, nil
}

// registerRoutes registers HTTP routes
func registerRoutes(mux *http.ServeMux, app *App) {
	mux.HandleFunc("/health", app.handleHealth)
	mux.HandleFunc("/echo", app.handleEcho)
}

// handleHealth returns a simple health check
func (a *App) handleHealth(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]string{
		"status": "ok",
	})
}

// handleEcho echoes back the request body
func (a *App) handleEcho(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		w.WriteHeader(http.StatusMethodNotAllowed)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]string{
		"message": "Echo endpoint - plugin backend is working",
	})
}
