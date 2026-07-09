package harness

import "fmt"

// BuildProvider creates a Provider instance for the given provider name.
// Supported providers: "claude-code", "codex", "gemini", "opencode".
// "remote" requires a RemoteCaller and must be constructed via NewRemoteProvider.
func BuildProvider(name string, binPath string) (Provider, error) {
	switch name {
	case ProviderClaudeCode:
		return NewClaudeCodeProvider(binPath), nil
	case ProviderCodex:
		return NewCodexProvider(binPath), nil
	case ProviderGemini:
		return NewGeminiProvider(binPath), nil
	case ProviderOpenCode:
		return NewOpenCodeProvider(binPath, ""), nil
	case ProviderRemote:
		return nil, fmt.Errorf(
			"provider %q requires a RemoteCaller; use NewRemoteProvider(caller) instead of BuildProvider",
			name,
		)
	default:
		return nil, fmt.Errorf(
			"unknown harness provider: %q (supported: %s, %s, %s, %s, %s)",
			name, ProviderClaudeCode, ProviderCodex, ProviderGemini, ProviderOpenCode, ProviderRemote,
		)
	}
}
