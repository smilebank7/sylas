#!/bin/sh
# =============================================================================
# Sylas Docker entrypoint
# Configures git credentials, OpenCode auth, and oh-my-opencode plugin.
# =============================================================================

# --- Git credentials ---------------------------------------------------------
if [ -n "$GITHUB_TOKEN" ]; then
  git config --global credential.helper store
  echo "https://x-access-token:${GITHUB_TOKEN}@github.com" > /root/.git-credentials
  echo "GitHub credentials configured"
fi

# --- OpenCode auth.json (Anthropic OAuth) ------------------------------------
# Seeds the Anthropic OAuth credential on first run.
# Once seeded (or manually added via `opencode auth login`), the file persists
# in the opencode-data volume and is NOT overwritten.
OPENCODE_DATA="/root/.local/share/opencode"
mkdir -p "$OPENCODE_DATA"
if [ -n "$ANTHROPIC_API_KEY" ] && [ ! -f "$OPENCODE_DATA/auth.json" ]; then
  printf '{"anthropic":{"type":"oauth","access":"%s","refresh":"","expires":9999999999999}}' \
    "$ANTHROPIC_API_KEY" > "$OPENCODE_DATA/auth.json"
  chmod 600 "$OPENCODE_DATA/auth.json"
  echo "OpenCode Anthropic OAuth credential seeded"
fi

# --- OpenCode config (oh-my-opencode plugin) ---------------------------------
# Always written so the plugin path stays in sync with the globally installed
# oh-my-opencode package inside the Docker image.
OPENCODE_CONFIG="/root/.config/opencode"
mkdir -p "$OPENCODE_CONFIG"
cat > "$OPENCODE_CONFIG/opencode.json" << 'OCJSON'
{
  "plugin": ["file:///usr/local/lib/node_modules/oh-my-opencode/dist/index.js"]
}
OCJSON
echo "OpenCode config written (oh-my-opencode via file://)"

# --- oh-my-opencode agent model config --------------------------------------
# Default: Claude Max20 subscription tier.
# Edit the models/variants below to match your subscription.
cat > "$OPENCODE_CONFIG/oh-my-opencode.json" << 'OMOJSON'
{
  "agents": {
    "sisyphus":         { "model": "anthropic/claude-opus-4-6",      "variant": "max" },
    "sisyphus-junior":  { "model": "anthropic/claude-sonnet-4-20250514" },
    "oracle":           { "model": "anthropic/claude-opus-4-6",      "variant": "max" },
    "explore":          { "model": "anthropic/claude-haiku-4-5" },
    "librarian":        { "model": "anthropic/claude-sonnet-4-6" },
    "multimodal-looker":{ "model": "anthropic/claude-haiku-4-5" },
    "prometheus":       { "model": "anthropic/claude-opus-4-6",      "variant": "max" },
    "metis":            { "model": "anthropic/claude-opus-4-6",      "variant": "max" },
    "momus":            { "model": "anthropic/claude-opus-4-6",      "variant": "max" },
    "atlas":            { "model": "anthropic/claude-sonnet-4-6" }
  },
  "categories": {
    "visual-engineering": { "model": "anthropic/claude-opus-4-6",    "variant": "max" },
    "ultrabrain":         { "model": "anthropic/claude-opus-4-6",    "variant": "max" },
    "quick":              { "model": "anthropic/claude-haiku-4-5" },
    "unspecified-low":    { "model": "anthropic/claude-sonnet-4-6" },
    "unspecified-high":   { "model": "anthropic/claude-opus-4-6",    "variant": "max" },
    "writing":            { "model": "anthropic/claude-sonnet-4-6" }
  }
}
OMOJSON
echo "oh-my-opencode agent config written"

# --- Prevent OpenCode from treating the OAuth token as a plain API key -------
unset ANTHROPIC_API_KEY

exec "$@"
