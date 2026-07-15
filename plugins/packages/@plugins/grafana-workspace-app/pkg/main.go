package main

import (
	"os"

	"github.com/grafana/grafana-workspace-app/pkg/plugin"
	"github.com/grafana/grafana-plugin-sdk-go/backend/app"
	"github.com/grafana/grafana-plugin-sdk-go/backend/log"
	"github.com/grafana/grafana-plugin-sdk-go/backend/tracing"
)

func main() {
	// Start listening to requests sent from Grafana.
	if err := app.Manage("grafana-workspace-app", plugin.NewInstance, app.ManageOpts{
		TracingOpts: tracing.Opts{},
	}); err != nil {
		log.DefaultLogger.Error(err.Error())
		os.Exit(1)
	}
}
