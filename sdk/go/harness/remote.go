package harness

import (
	"context"
	"encoding/json"
	"fmt"
	"time"
)

// defaultRemoteNode is the AF node that serves the run_harness reasoner.
const defaultRemoteNode = "principal-agent"

// defaultPollInterval is the interval between WaitExecution polls.
const defaultPollInterval = 2 * time.Second

// RemoteProvider dispatches harness calls to a remote AF reasoner over the
// control plane. Unlike CLI providers, it does not spawn a subprocess: the
// LLM loop runs server-side on the target node. Schema is passed natively in
// the wire payload and structured output is returned in RawResult.Structured,
// so the Runner's file-based schema pipeline is bypassed entirely.
type RemoteProvider struct {
	Caller RemoteCaller
}

// NewRemoteProvider creates a provider that dispatches to a remote AF harness
// reasoner via the given caller (typically *agent.Agent).
func NewRemoteProvider(caller RemoteCaller) *RemoteProvider {
	return &RemoteProvider{Caller: caller}
}

// wireInput is the payload sent to the run_harness reasoner. Field names
// mirror harness.Options JSON tags so the reasoner can decode structurally
// without importing the harness package.
type wireInput struct {
	Prompt       string          `json:"prompt"`
	SystemPrompt  string          `json:"system_prompt"`
	Model        string          `json:"model"`
	Tools        []string        `json:"tools"`
	MaxTurns     int             `json:"max_turns"`
	MaxTokens    int             `json:"max_tokens"`
	Schema       json.RawMessage `json:"schema,omitempty"`
	Cwd          string          `json:"cwd"`
	SandboxID    string          `json:"sandbox_id"`
}

// Execute implements Provider by dispatching to the remote reasoner.
func (p *RemoteProvider) Execute(ctx context.Context, prompt string, opts Options) (*RawResult, error) {
	if p.Caller == nil {
		return nil, fmt.Errorf("remote provider: no RemoteCaller configured")
	}

	node := opts.NodeID
	if node == "" {
		node = defaultRemoteNode
	}
	target := node + ".run_harness"

	input := wireInput{
		Prompt:      prompt,
		SystemPrompt: opts.SystemPrompt,
		Model:       opts.Model,
		Tools:       opts.Tools,
		MaxTurns:    opts.MaxTurns,
		MaxTokens:   opts.MaxTokens,
		Schema:      opts.Schema,
		Cwd:         opts.Cwd,
		SandboxID:   opts.SandboxID,
	}

	inputMap := map[string]any{}
	b, err := json.Marshal(input)
	if err != nil {
		return nil, fmt.Errorf("remote provider: marshal input: %w", err)
	}
	if err := json.Unmarshal(b, &inputMap); err != nil {
		return nil, fmt.Errorf("remote provider: convert input: %w", err)
	}

	execID, err := p.Caller.CallAsync(ctx, target, inputMap)
	if err != nil {
		return nil, fmt.Errorf("remote provider: call %s: %w", target, err)
	}

	out, err := p.Caller.WaitExecution(ctx, execID, defaultPollInterval)
	if err != nil {
		return nil, fmt.Errorf("remote provider: wait %s: %w", target, err)
	}

	return decodeWireOutput(out)
}

// decodeWireOutput converts the reasoner's response map into a RawResult.
// The reasoner returns RawResult-shaped JSON fields (structural match, no
// import dependency).
func decodeWireOutput(out map[string]any) (*RawResult, error) {
	b, err := json.Marshal(out)
	if err != nil {
		return nil, fmt.Errorf("remote provider: marshal output: %w", err)
	}

	var raw RawResult
	if err := json.Unmarshal(b, &raw); err != nil {
		return nil, fmt.Errorf("remote provider: decode output: %w", err)
	}
	return &raw, nil
}
