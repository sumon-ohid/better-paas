package main

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"strings"

	"github.com/mark3labs/mcp-go/mcp"
	"github.com/mark3labs/mcp-go/server"
)

func runMCP() int {
	cfg, err := loadConfig()
	if err != nil {
		fmt.Fprintf(os.Stderr, "error: %v\n", err)
		return 1
	}
	client := newClient(cfg.URL, cfg.Token)

	s := server.NewMCPServer(
		"better-paas",
		cliVersion,
		server.WithToolCapabilities(true),
		server.WithRecovery(),
	)

	registerMCPTool(s, "paas_list_apps", "List all deployed apps on the connected Better-PaaS instance.", nil,
		func(_ context.Context, _ mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			apps, err := client.ListApps()
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}
			return mcpJSONResult(apps)
		})

	registerMCPTool(s, "paas_list_projects", "List all projects (multi-service groups) on Better-PaaS.", nil,
		func(_ context.Context, _ mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			projects, err := client.ListProjects()
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}
			return mcpJSONResult(projects)
		})

	registerMCPTool(s, "paas_get_app", "Get detailed info for an app by name or ID.", []mcp.ToolOption{
		mcp.WithString("app", mcp.Required(), mcp.Description("App name or ID")),
	}, func(_ context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		app, err := req.RequireString("app")
		if err != nil {
			return mcp.NewToolResultError(err.Error()), nil
		}
		id, err := resolveAppID(client, app)
		if err != nil {
			return mcp.NewToolResultError(err.Error()), nil
		}
		out, err := client.GetApp(id)
		if err != nil {
			return mcp.NewToolResultError(err.Error()), nil
		}
		return mcpJSONResult(out)
	})

	registerMCPTool(s, "paas_deploy", "Deploy a new app from a Git repository.", []mcp.ToolOption{
		mcp.WithString("name", mcp.Required(), mcp.Description("App name (lowercase, hyphens ok)")),
		mcp.WithString("gitRepo", mcp.Required(), mcp.Description("Git repository URL")),
		mcp.WithString("branch", mcp.Description("Git branch (default: main)")),
	}, func(_ context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		name, err := req.RequireString("name")
		if err != nil {
			return mcp.NewToolResultError(err.Error()), nil
		}
		repo, err := req.RequireString("gitRepo")
		if err != nil {
			return mcp.NewToolResultError(err.Error()), nil
		}
		branch := strings.TrimSpace(req.GetString("branch", "main"))
		out, err := client.Deploy(name, repo, branch)
		if err != nil {
			return mcp.NewToolResultError(err.Error()), nil
		}
		return mcpJSONResult(out)
	})

	registerMCPTool(s, "paas_redeploy", "Redeploy an existing app (rebuild from Git).", []mcp.ToolOption{
		mcp.WithString("app", mcp.Required(), mcp.Description("App name or ID")),
	}, func(_ context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		app, err := req.RequireString("app")
		if err != nil {
			return mcp.NewToolResultError(err.Error()), nil
		}
		id, err := resolveAppID(client, app)
		if err != nil {
			return mcp.NewToolResultError(err.Error()), nil
		}
		out, err := client.Redeploy(id)
		if err != nil {
			return mcp.NewToolResultError(err.Error()), nil
		}
		return mcpJSONResult(out)
	})

	registerMCPTool(s, "paas_get_logs", "Read recent runtime logs for an app.", []mcp.ToolOption{
		mcp.WithString("app", mcp.Required(), mcp.Description("App name or ID")),
		mcp.WithNumber("lines", mcp.Description("Number of log lines (default: 100)")),
	}, func(_ context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		app, err := req.RequireString("app")
		if err != nil {
			return mcp.NewToolResultError(err.Error()), nil
		}
		id, err := resolveAppID(client, app)
		if err != nil {
			return mcp.NewToolResultError(err.Error()), nil
		}
		lines := int(req.GetFloat("lines", 100))
		logs, err := client.RuntimeLogs(id, lines)
		if err != nil {
			return mcp.NewToolResultError(err.Error()), nil
		}
		return mcpJSONResult(map[string]any{"app": app, "lines": len(logs), "logs": logs})
	})

	registerMCPTool(s, "paas_status", "Show connection info and a summary of apps.", nil,
		func(_ context.Context, _ mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			apps, err := client.ListApps()
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}
			return mcpJSONResult(map[string]any{
				"url":     cfg.URL,
				"agent":   cfg.Name,
				"profile": cfg.Profile,
				"apps":    apps,
			})
		})

	if err := server.ServeStdio(s); err != nil {
		fmt.Fprintf(os.Stderr, "mcp error: %v\n", err)
		return 1
	}
	return 0
}

func registerMCPTool(s *server.MCPServer, name, description string, opts []mcp.ToolOption, handler server.ToolHandlerFunc) {
	toolOpts := []mcp.ToolOption{mcp.WithDescription(description)}
	toolOpts = append(toolOpts, opts...)
	s.AddTool(mcp.NewTool(name, toolOpts...), handler)
}

func mcpJSONResult(v any) (*mcp.CallToolResult, error) {
	b, err := json.MarshalIndent(v, "", "  ")
	if err != nil {
		return mcp.NewToolResultError(err.Error()), nil
	}
	return mcp.NewToolResultText(string(b)), nil
}
