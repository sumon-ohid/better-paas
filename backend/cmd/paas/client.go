package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"
)

type Client struct {
	BaseURL string
	Token   string
	HTTP    *http.Client
}

func newClient(baseURL, token string) *Client {
	return &Client{
		BaseURL: strings.TrimRight(strings.TrimSpace(baseURL), "/"),
		Token:   strings.TrimSpace(token),
		HTTP:    &http.Client{Timeout: 30 * time.Second},
	}
}

type apiError struct {
	Error string `json:"error"`
}

func (c *Client) do(method, path string, in any, out any) error {
	var body io.Reader
	if in != nil {
		b, err := json.Marshal(in)
		if err != nil {
			return err
		}
		body = bytes.NewReader(b)
	}

	req, err := http.NewRequest(method, c.BaseURL+path, body)
	if err != nil {
		return err
	}
	if in != nil {
		req.Header.Set("Content-Type", "application/json")
	}
	if c.Token != "" {
		req.Header.Set("Authorization", "Bearer "+c.Token)
	}

	resp, err := c.HTTP.Do(req)
	if err != nil {
		return fmt.Errorf("request failed: %w", err)
	}
	defer resp.Body.Close()

	raw, err := io.ReadAll(resp.Body)
	if err != nil {
		return err
	}

	if resp.StatusCode >= 400 {
		var ae apiError
		if json.Unmarshal(raw, &ae) == nil && ae.Error != "" {
			return fmt.Errorf("%s (HTTP %d)", ae.Error, resp.StatusCode)
		}
		return fmt.Errorf("HTTP %d: %s", resp.StatusCode, strings.TrimSpace(string(raw)))
	}

	if out == nil {
		return nil
	}
	if len(raw) == 0 {
		return nil
	}
	return json.Unmarshal(raw, out)
}

func (c *Client) Health() error {
	return c.do(http.MethodGet, "/api/health", nil, &map[string]any{})
}

func (c *Client) VerifyToken() error {
	return c.do(http.MethodPost, "/api/auth/verify", nil, &map[string]any{})
}

type createAgentRequest struct {
	Name   string   `json:"name"`
	Scopes []string `json:"scopes"`
}

type createAgentResponse struct {
	ID     string   `json:"id"`
	Name   string   `json:"name"`
	Scopes []string `json:"scopes"`
	Token  string   `json:"token"`
}

func (c *Client) CreateAgent(name string, scopes []string) (createAgentResponse, error) {
	var out createAgentResponse
	err := c.do(http.MethodPost, "/api/agents/create", createAgentRequest{
		Name:   name,
		Scopes: scopes,
	}, &out)
	return out, err
}

type exchangeConnectResponse struct {
	URL     string `json:"url"`
	Token   string `json:"token"`
	Profile string `json:"profile"`
	Name    string `json:"name"`
	AgentID string `json:"agentId"`
}

func (c *Client) ExchangeConnect(state, code string) (exchangeConnectResponse, error) {
	var out exchangeConnectResponse
	err := c.do(http.MethodPost, "/api/connect/agent/exchange", map[string]string{
		"state": state,
		"code":  code,
	}, &out)
	return out, err
}

type App struct {
	ID     string `json:"id"`
	Name   string `json:"name"`
	Status string `json:"status"`
	URL    string `json:"url"`
}

func (c *Client) ListApps() ([]App, error) {
	var out []App
	err := c.do(http.MethodGet, "/api/apps", nil, &out)
	return out, err
}

type ProjectSummary struct {
	ID           string `json:"id"`
	Name         string `json:"name"`
	Status       string `json:"status"`
	ServiceCount int    `json:"serviceCount"`
}

func (c *Client) ListProjects() ([]ProjectSummary, error) {
	var out []ProjectSummary
	err := c.do(http.MethodGet, "/api/projects", nil, &out)
	return out, err
}
