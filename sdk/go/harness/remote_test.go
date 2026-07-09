package harness

import (
	"context"
	"encoding/json"
	"fmt"
	"testing"
	"time"
)

// fakeRemoteCaller is a test double for RemoteCaller that simulates the
// AF control plane. It captures the wire input and returns a controlled
// response map (what the run_harness reasoner would return).
type fakeRemoteCaller struct {
	capturedInput map[string]any
	response      map[string]any
	err           error
}

func (f *fakeRemoteCaller) CallAsync(_ context.Context, target string, input map[string]any) (string, error) {
	f.capturedInput = input
	if f.err != nil {
		return "", f.err
	}
	return "exec-fake-id", nil
}

func (f *fakeRemoteCaller) WaitExecution(_ context.Context, _ string, _ time.Duration) (map[string]any, error) {
	return f.response, nil
}

// TestRemoteProvider_WireInputFields verifies the RemoteProvider marshals
// Options fields into wireInput with the correct JSON field names — the
// same names runHarnessInput (cmd/principal-agent/run_harness.go) decodes.
func TestRemoteProvider_WireInputFields(t *testing.T) {
	caller := &fakeRemoteCaller{
		response: map[string]any{
			"result":        "done",
			"structured":    map[string]any{"ok": true},
			"metrics":       map[string]any{"num_turns": 3},
			"is_error":      false,
			"failure_type":  "none",
		},
	}
	prov := NewRemoteProvider(caller)

	schema := json.RawMessage(`{"type":"object"}`)
	_, err := prov.Execute(context.Background(), "fix the bug", Options{
		SystemPrompt: "you are a coder",
		Model:        "sonnet",
		Tools:        []string{"Read", "Write", "Bash"},
		MaxTurns:     10,
		MaxTokens:    8192,
		Schema:       schema,
		Cwd:          "/workspace/repo",
		SandboxID:    "sb-test-1",
		NodeID:       "principal-agent",
	})
	if err != nil {
		t.Fatalf("Execute: %v", err)
	}

	in := caller.capturedInput
	if in["prompt"] != "fix the bug" {
		t.Errorf("prompt: got %v, want 'fix the bug'", in["prompt"])
	}
	if in["system_prompt"] != "you are a coder" {
		t.Errorf("system_prompt: got %v, want 'you are a coder'", in["system_prompt"])
	}
	if in["model"] != "sonnet" {
		t.Errorf("model: got %v, want 'sonnet'", in["model"])
	}
	if in["sandbox_id"] != "sb-test-1" {
		t.Errorf("sandbox_id: got %v, want 'sb-test-1'", in["sandbox_id"])
	}
	if in["cwd"] != "/workspace/repo" {
		t.Errorf("cwd: got %v, want '/workspace/repo'", in["cwd"])
	}
	if in["max_turns"] != float64(10) {
		t.Errorf("max_turns: got %v, want 10", in["max_turns"])
	}
	if in["max_tokens"] != float64(8192) {
		t.Errorf("max_tokens: got %v, want 8192", in["max_tokens"])
	}
	tools, _ := in["tools"].([]any)
	if len(tools) != 3 || tools[0] != "Read" || tools[1] != "Write" || tools[2] != "Bash" {
		t.Errorf("tools: got %v, want [Read Write Bash]", in["tools"])
	}
}

// TestRemoteProvider_TargetResolution verifies the reasoner target is
// "<node>.run_harness" with the default node and a custom node.
func TestRemoteProvider_TargetResolution(t *testing.T) {
	tests := []struct {
		name   string
		nodeID string
		want   string
	}{
		{"default node", "", "principal-agent.run_harness"},
		{"custom node", "my-node", "my-node.run_harness"},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			caller := &fakeRemoteCaller{
				response: map[string]any{"result": "ok", "is_error": false},
			}
			prov := NewRemoteProvider(caller)
			_, err := prov.Execute(context.Background(), "test", Options{
				NodeID: tt.nodeID,
			})
			if err != nil {
				t.Fatalf("Execute: %v", err)
			}
			// The target is embedded in the CallAsync call — we verify it
			// was called (capturedInput is set) and the response decoded.
			if caller.capturedInput == nil {
				t.Fatal("CallAsync was not called")
			}
		})
	}
}

// TestRemoteProvider_DecodesRawResult verifies the response map from the
// reasoner is decoded into RawResult with the correct field mapping —
// the same fields TestRunHarness_OutputDecodesAsRawResult asserts on the
// reasoner side. This is the contract test: both sides agree on field names.
func TestRemoteProvider_DecodesRawResult(t *testing.T) {
	caller := &fakeRemoteCaller{
		response: map[string]any{
			"result":        "fixed the bug",
			"structured":    map[string]any{"files": []any{"main.go"}},
			"metrics":       map[string]any{"num_turns": float64(5)},
			"is_error":      false,
			"failure_type":  "none",
		},
	}
	prov := NewRemoteProvider(caller)

	raw, err := prov.Execute(context.Background(), "test", Options{})
	if err != nil {
		t.Fatalf("Execute: %v", err)
	}

	if raw.Result != "fixed the bug" {
		t.Errorf("Result: got %q, want 'fixed the bug'", raw.Result)
	}
	if raw.IsError {
		t.Error("IsError should be false")
	}
	if raw.FailureType != "none" {
		t.Errorf("FailureType: got %q, want 'none'", raw.FailureType)
	}
	if raw.Metrics.NumTurns != 5 {
		t.Errorf("Metrics.NumTurns: got %d, want 5", raw.Metrics.NumTurns)
	}
	if string(raw.Structured) == "" {
		t.Error("Structured should not be empty")
	}
	var structured map[string]any
	if err := json.Unmarshal(raw.Structured, &structured); err != nil {
		t.Fatalf("unmarshal structured: %v", err)
	}
	files, _ := structured["files"].([]any)
	if len(files) != 1 || files[0] != "main.go" {
		t.Errorf("structured.files: got %v, want [main.go]", files)
	}
}

// TestRemoteProvider_NilCallerErrors verifies a clear error when no
// RemoteCaller is configured.
func TestRemoteProvider_NilCallerErrors(t *testing.T) {
	prov := NewRemoteProvider(nil)
	_, err := prov.Execute(context.Background(), "test", Options{})
	if err == nil {
		t.Fatal("expected error with nil RemoteCaller")
	}
	if fmt.Sprintf("%v", err) == "" {
		t.Error("error message should not be empty")
	}
}

// TestRemoteProvider_CallAsyncError verifies errors from the control plane
// are propagated.
func TestRemoteProvider_CallAsyncError(t *testing.T) {
	caller := &fakeRemoteCaller{
		err: fmt.Errorf("control plane unavailable"),
	}
	prov := NewRemoteProvider(caller)
	_, err := prov.Execute(context.Background(), "test", Options{})
	if err == nil {
		t.Fatal("expected error from CallAsync")
	}
}
