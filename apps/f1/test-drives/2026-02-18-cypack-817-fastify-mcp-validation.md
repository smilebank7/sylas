# Test Drive CYPACK-817: Fastify-MCP Sylas Tools Validation

**Date**: 2026-02-18
**Goal**: Validate that sylas-tools are served from the existing Fastify server (SYLAS_PORT/SYLAS_SERVER_PORT equivalent) via `fastify-mcp`.
**Test Repo**: `/tmp/f1-test-drive-cypack-817-20260217-185650`
**Server Port**: `3617`

## Verification Results

### Issue-Tracker
- [x] Issue created
- [x] Issue ID returned
- [x] Issue metadata accessible

### EdgeWorker
- [x] Session started
- [x] Worktree created (fallback path used after existing checked-out branch warning)
- [x] Activities tracked
- [x] Agent processed issue

### Renderer
- [x] Activity format correct (`thought`, `action`, `response` visible)
- [x] Pagination works (`--limit`, `--offset`)
- [x] Search works (`--search Bash`)

### MCP Endpoint (CYPACK-817 target)
- [x] `sylas-tools` endpoint registered on same Fastify server: `/mcp/sylas-tools`
- [x] MCP `initialize` succeeds with `mcp-session-id` returned
- [x] MCP `tools/list` succeeds and returns sylas tool set

## Session Log

1. Create fresh F1 repo
```bash
cd apps/f1
./f1 init-test-repo --path /tmp/f1-test-drive-cypack-817-20260217-185650
```
Result: repo created with git init + initial commit.

2. Start F1 server
```bash
cd apps/f1
HOME=/tmp SYLAS_PORT=3617 SYLAS_REPO_PATH=/tmp/f1-test-drive-cypack-817-20260217-185650 node dist/server.js
```
Key output included:
- `✅ Sylas tools MCP endpoint registered at /mcp/sylas-tools`
- `RPC endpoint: /cli/rpc`
- `Shared application server listening on http://localhost:3617`

3. Health checks
```bash
SYLAS_PORT=3617 ./f1 ping
SYLAS_PORT=3617 ./f1 status
```
Result: healthy, `status: ready`.

4. Issue + session flow
```bash
SYLAS_PORT=3617 ./f1 create-issue --title "CYPACK-817 MCP fastify validation" --description "Validate sylas-tools served from fastify-mcp endpoint on SYLAS_SERVER_PORT"
SYLAS_PORT=3617 ./f1 start-session --issue-id issue-1
SYLAS_PORT=3617 ./f1 view-session --session-id session-1 --limit 10 --offset 0
SYLAS_PORT=3617 ./f1 view-session --session-id session-1 --limit 5 --offset 0 --search Bash
```
Result:
- session created (`session-1`)
- activities present with expected types
- pagination/search behavior verified

5. Direct MCP validation on same Fastify server
```bash
curl -X POST http://127.0.0.1:3617/mcp/sylas-tools \
  -H 'Content-Type: application/json' \
  -H 'Accept: application/json, text/event-stream' \
  -H 'x-sylas-mcp-context-id: f1-test-repo:session-1' \
  --data '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-03-26","capabilities":{},"clientInfo":{"name":"cypack817-test","version":"1.0.0"}}}'
```
Initialize response included:
- `mcp-session-id: 959cb3f1-b2b2-4597-88f9-e37bf20db049`
- `serverInfo.name: "sylas-tools"`

Then:
```bash
curl -X POST http://127.0.0.1:3617/mcp/sylas-tools \
  -H 'Content-Type: application/json' \
  -H 'Accept: application/json, text/event-stream' \
  -H 'x-sylas-mcp-context-id: f1-test-repo:session-1' \
  -H 'mcp-session-id: 959cb3f1-b2b2-4597-88f9-e37bf20db049' \
  --data '{"jsonrpc":"2.0","id":2,"method":"tools/list","params":{}}'
```
Result: tool list returned (`linear_upload_file`, `linear_agent_session_create`, `linear_agent_give_feedback`, etc.).

6. Cleanup
```bash
SYLAS_PORT=3617 ./f1 stop-session --session-id session-1
# Ctrl+C on server process
```
Result: clean session stop + graceful server shutdown.

## Final Retrospective

- Fastify MCP wiring is working end-to-end on the same server port as RPC/status/version routes.
- `buildMcpConfig` now routes `sylas-tools` through local HTTP MCP with context headers, and Claude connected successfully (`sylas-tools MCP session connected` observed).
- One environment-specific issue occurred on an initial run (`EPERM` writing under `/Users/agentops/.claude/debug`); rerunning server with `HOME=/tmp` resolved this in the sandbox and did not affect MCP functionality.
