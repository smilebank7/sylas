#!/bin/bash
set -euo pipefail

SYLAS_ROOT="${SYLAS_ROOT:-/opt/sylas}"
STATE_DIR="$SYLAS_ROOT/state"

echo "=== Sylas auth bootstrap ==="
echo "State directory: $STATE_DIR"

mkdir -p "$STATE_DIR"/{sylas,opencode,opencode-config,gh}
touch "$STATE_DIR/git-credentials"

# --- OpenCode OAuth ----------------------------------------------------------

AUTH_FILE="$STATE_DIR/opencode/auth.json"
if [ -f "$AUTH_FILE" ]; then
  echo "[opencode] auth.json already exists — skipping"
else
  echo ""
  echo "[opencode] Paste your Anthropic OAuth token (sk-ant-oat01-...)."
  echo "  Get it from: opencode auth login (on a machine with a browser)"
  echo "  Or from: Claude Max dashboard"
  read -rsp "Token: " ANTHROPIC_TOKEN
  echo ""

  if [ -z "$ANTHROPIC_TOKEN" ]; then
    echo "[opencode] SKIP — no token provided"
  else
    printf '{"anthropic":{"type":"oauth","access":"%s","refresh":"","expires":9999999999999}}' \
      "$ANTHROPIC_TOKEN" > "$AUTH_FILE"
    chmod 600 "$AUTH_FILE"
    echo "[opencode] auth.json written"
  fi
fi

# --- Git credentials ---------------------------------------------------------

GIT_CRED_FILE="$STATE_DIR/git-credentials"
if [ -f "$GIT_CRED_FILE" ] && [ -s "$GIT_CRED_FILE" ]; then
  echo "[git] credentials file already exists — skipping"
else
  echo ""
  echo "[git] Enter GitHub personal access token (for git push/pull)."
  echo "  Required scopes: repo, workflow"
  read -rsp "Token: " GH_TOKEN
  echo ""

  if [ -z "$GH_TOKEN" ]; then
    echo "[git] SKIP — no token provided"
  else
    echo "https://x-access-token:${GH_TOKEN}@github.com" > "$GIT_CRED_FILE"
    chmod 600 "$GIT_CRED_FILE"
    echo "[git] credentials written"
  fi
fi

# --- GitHub CLI auth ---------------------------------------------------------

GH_HOSTS="$STATE_DIR/gh/hosts.yml"
if [ -f "$GH_HOSTS" ]; then
  echo "[gh] hosts.yml already exists — skipping"
else
  echo ""
  echo "[gh] Enter GitHub token for gh CLI (same token as above, or a separate one)."
  read -rsp "Token: " GH_CLI_TOKEN
  echo ""

  if [ -z "$GH_CLI_TOKEN" ]; then
    echo "[gh] SKIP — no token provided"
  else
    mkdir -p "$STATE_DIR/gh"
    cat > "$GH_HOSTS" << EOF
github.com:
  oauth_token: $GH_CLI_TOKEN
  user: smilebank7
  git_protocol: https
EOF
    chmod 600 "$GH_HOSTS"
    echo "[gh] hosts.yml written"
  fi
fi

echo ""
echo "=== Bootstrap complete ==="
echo "Start Sylas: cd $SYLAS_ROOT && sudo docker compose up -d"
