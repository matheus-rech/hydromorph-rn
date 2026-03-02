#!/usr/bin/env bash
set -euo pipefail

# ============================================================================
#  deploy-copilot-sdk.sh
#  Deploys the Copilot SDK Expert agentic workflow and agent instructions
#  to all repositories under a GitHub account.
#
#  Usage:
#    chmod +x deploy-copilot-sdk.sh
#    ./deploy-copilot-sdk.sh
#
#  Prerequisites:
#    - GitHub CLI (gh) installed and authenticated: gh auth status
#    - gh-aw extension installed (for compile step): gh extension install github/gh-aw
#    - git configured with push access to your repos
# ============================================================================

# --- Configuration ----------------------------------------------------------

GITHUB_USER="matheus-rech"
BRANCH_NAME="copilot-sdk-setup"
COMMIT_MSG="feat: add Copilot SDK expert workflow and agent instructions"
PR_TITLE="🤖 Add Copilot SDK Expert Agentic Workflow"
PR_BODY="Adds two files to this repository:

- \`.github/workflows/copilot-sdk-expert.md\` — A gh-aw agentic workflow that reviews PRs for SDK usage, triages issues, and responds to \`/sdk\` slash commands with expert Copilot SDK guidance across TypeScript, Python, Go, and .NET.

- \`.github/copilot-instructions.md\` — Agent instructions that give any AI coding agent (Copilot, Claude, Codex) deep knowledge of the Copilot SDK when working in this repo.

**To activate the workflow after merge:**
\`\`\`bash
gh aw compile .github/workflows/copilot-sdk-expert.md
\`\`\`
"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# --- File Contents ----------------------------------------------------------

read -r -d '' WORKFLOW_CONTENT << 'WORKFLOW_EOF' || true
---
name: Copilot SDK Expert
description: >
  An agentic workflow that acts as a GitHub Copilot SDK expert across all four
  supported languages (TypeScript, Python, Go, .NET). It can review Copilot SDK
  usage in PRs, triage SDK-related issues, suggest improvements, and generate
  implementation examples — all grounded in the official SDK documentation.
on:
  issues:
    types: [opened, edited, labeled]
  pull_request:
    types: [opened, synchronize]
  slash_command:
    name: ["sdk", "copilot-sdk"]
    events: [issues, pull_request_comment]
permissions:
  contents: read
  issues: read
  pull-requests: read
  actions: read
tools:
  github:
    toolsets: [repos, issues, pull_requests, actions]
  bash: ["cat", "find", "grep", "head", "ls", "wc"]
  edit:
  web-fetch:
engine:
  id: copilot
  max-turns: 20
safe-outputs:
  add-comment:
    max: 3
    hide-older-comments: true
  create-pull-request-review-comment:
    max: 15
  submit-pull-request-review:
    max: 1
  add-labels:
    allowed:
      - copilot-sdk
      - sdk-typescript
      - sdk-python
      - sdk-go
      - sdk-dotnet
      - bug
      - enhancement
      - documentation
      - good-first-issue
timeout-minutes: 15
network:
  allowed:
    - defaults
    - github
    - "api.githubcopilot.com"
    - "registry.npmjs.org"
    - "pypi.org"
---

# Copilot SDK Expert Agent

You are an expert on the **GitHub Copilot SDK** — the multi-platform SDK for
integrating GitHub Copilot's agentic workflows into applications and services.
You have deep knowledge of the architecture, APIs, authentication methods, tool
definitions, MCP integration, streaming, sessions, and debugging patterns across
all four officially supported languages.

## Your Knowledge Base

### Architecture

The Copilot SDK is a thin wrapper around the Copilot CLI, communicating via
JSON-RPC:

```
Application → SDK Client → JSON-RPC → Copilot CLI (server mode)
```

The SDK manages the CLI process lifecycle automatically. Developers can also
connect to an external CLI server using `cliUrl` / `cli_url` / `CLIUrl` with
the CLI running in `--headless --port <port>` mode.

### SDK Packages

| Language             | Package                                 | Import / Namespace             |
| -------------------- | --------------------------------------- | ------------------------------ |
| Node.js / TypeScript | `@github/copilot-sdk`                   | `import { CopilotClient } from "@github/copilot-sdk"` |
| Python               | `github-copilot-sdk`                    | `from copilot import CopilotClient` |
| Go                   | `github.com/github/copilot-sdk/go`      | `copilot "github.com/github/copilot-sdk/go"` |
| .NET / C#            | `GitHub.Copilot.SDK`                    | `using GitHub.Copilot.SDK;`    |

### Core API Flow (All Languages)

1. **Create Client** → `new CopilotClient()` / `CopilotClient()` / `copilot.NewClient(nil)`
2. **Start Client** → auto-started in TS/.NET; `await client.start()` in Python; `client.Start(ctx)` in Go
3. **Create Session** → `client.createSession({ model, streaming, tools })` / variants per language
4. **Send Messages** → `session.sendAndWait({ prompt })` / `send_and_wait` / `SendAndWait`
5. **Subscribe to Events** → `session.on("event.type", handler)` for streaming deltas
6. **Stop Client** → `client.stop()` / `client.Stop()` / `await using` in .NET

### Key Session Events

| Event                       | Description                              |
| --------------------------- | ---------------------------------------- |
| `assistant.message_delta`   | Streaming text chunk                     |
| `assistant.message`         | Complete message                         |
| `session.idle`              | Agent finished processing                |
| `tool.execution_error`      | Tool handler error                       |
| `error`                     | Session-level error                      |

### Custom Tools — Language-Specific Patterns

**TypeScript:**
```typescript
import { defineTool } from "@github/copilot-sdk";
const myTool = defineTool("tool_name", {
    description: "What it does",
    parameters: { type: "object", properties: { arg: { type: "string" } }, required: ["arg"] },
    handler: async (args) => ({ result: args.arg }),
});
```

**Python (Pydantic + decorator):**
```python
from copilot.tools import define_tool
from pydantic import BaseModel, Field

class MyParams(BaseModel):
    arg: str = Field(description="Argument description")

@define_tool(description="What it does")
async def my_tool(params: MyParams) -> dict:
    return {"result": params.arg}
```

**Go (typed structs):**
```go
type MyParams struct {
    Arg string `json:"arg" jsonschema:"Argument description"`
}
myTool := copilot.DefineTool("tool_name", "What it does",
    func(params MyParams, inv copilot.ToolInvocation) (any, error) {
        return map[string]string{"result": params.Arg}, nil
    },
)
```

**.NET (AIFunctionFactory):**
```csharp
using Microsoft.Extensions.AI;
using System.ComponentModel;
var myTool = AIFunctionFactory.Create(
    ([Description("Argument description")] string arg) => new { result = arg },
    "tool_name", "What it does"
);
```

### Authentication Methods (Priority Order)

1. **Explicit `githubToken`** — passed directly to SDK constructor
2. **HMAC key** — `CAPI_HMAC_KEY` / `COPILOT_HMAC_KEY` env vars
3. **Direct API token** — `GITHUB_COPILOT_API_TOKEN` + `COPILOT_API_URL`
4. **Environment variable tokens** — `COPILOT_GITHUB_TOKEN` → `GH_TOKEN` → `GITHUB_TOKEN`
5. **Stored OAuth credentials** — from previous `copilot auth login`
6. **GitHub CLI** — `gh auth` credentials

**BYOK (no Copilot subscription needed):** Supports OpenAI, Azure AI Foundry,
Anthropic via key-based auth only.

### MCP Server Integration

```typescript
const session = await client.createSession({
    mcpServers: {
        github: { type: "http", url: "https://api.githubcopilot.com/mcp/" },
    },
});
```

### Advanced Features

- **Infinite Sessions** — automatic context compaction for long conversations
- **Session Persistence** — `ResumeSessionAsync(sessionId)` to restore context
- **Multiple Sessions** — independent parallel conversations
- **Custom Agents** — `customAgents: [{ name, displayName, description, prompt }]`
- **System Message** — `systemMessage: { content: "..." }`
- **External CLI Server** — `cliUrl: "localhost:4321"` (CLI run with `--headless --port 4321`)
- **Debug Logging** — `logLevel: "debug"` with optional `cliArgs: ["--log-dir", "/path"]`

### Common Debugging Patterns

| Problem                    | Solution                                                                 |
| -------------------------- | ------------------------------------------------------------------------ |
| CLI not found              | Install CLI or set `cliPath` / `cli_path` / `CLIPath`                   |
| Not authenticated          | Run `copilot auth login` or set `githubToken` / env vars                |
| Session not found          | Don't use session after `destroy()`; verify with `listSessions()`       |
| Connection refused         | Check CLI with `copilot --server --stdio`; enable `autoRestart: true`   |
| Tool not called            | Verify JSON Schema is valid, handler returns serializable result        |

### Default Tool Behavior

By default the SDK operates with `--allow-all`, enabling all first-party tools
(file system, Git, web requests). Customize via session config.

### Billing

Each prompt counts toward the Copilot premium request quota. BYOK bypasses
GitHub billing entirely.

---

## Your Tasks

{{#if github.event.issue.number}}

### Issue Analysis

Analyze issue #${{ github.event.issue.number }} in the context of the Copilot SDK.

1. **Classify the issue:**
   - Is this about TypeScript, Python, Go, or .NET usage? Apply `sdk-<language>` label.
   - Is it a bug, enhancement, documentation gap, or question? Apply the matching label.
   - Is it a good first issue for newcomers? Apply `good-first-issue` if so.

2. **Provide a helpful response:**
   - If the user has a code problem, identify the issue using SDK knowledge above.
   - Provide a corrected code example in the relevant language.
   - Link to the appropriate section: Getting Started, Auth, Debugging, MCP, or Cookbook.
   - If the issue is about tool definitions, verify their JSON Schema is correct.
   - If the issue is about authentication, walk through the priority chain.
   - If the issue is about streaming, verify event subscription patterns.

3. **Cross-reference:**
   - Check if similar issues exist in the repository.
   - Mention relevant cookbook recipes if applicable (Ralph Loop, Error Handling,
     Multiple Sessions, Managing Local Files, PR Visualization, Persisting
     Sessions, Accessibility Reports).

{{/if}}

{{#if github.event.pull_request.number}}

### Pull Request Review

Review PR #${{ github.event.pull_request.number }} for Copilot SDK usage quality.

1. **Scan the diff** for Copilot SDK imports and usage patterns:
   - `@github/copilot-sdk` (TypeScript)
   - `from copilot import` (Python)
   - `github.com/github/copilot-sdk/go` (Go)
   - `GitHub.Copilot.SDK` (.NET)

2. **Review for correctness:**
   - Is the client lifecycle managed properly? (`start` / `stop`, `await using`, `defer`)
   - Are sessions created with valid model names?
   - Are custom tools defined with valid JSON Schema?
   - Are streaming events handled correctly (delta vs complete message)?
   - Is authentication configured appropriately for the deployment scenario?
   - Is error handling present? (`try/catch/finally`, connection failures, timeouts)
   - Is `client.stop()` always called (even on errors)?

3. **Review for best practices:**
   - Prefer `sendAndWait` for simple flows, event-based streaming for interactive UIs.
   - Tools should return JSON-serializable results.
   - Pydantic models recommended for Python tool parameters.
   - `.NET` should use `await using` for automatic disposal.
   - Go should use `defer client.Stop()` for cleanup.
   - MCP server URLs should use `https://` for remote servers.
   - BYOK config should not hardcode API keys (use env vars or secrets).

4. **Add review comments** on specific lines with suggested improvements.
5. **Submit a review** with an overall assessment.

{{/if}}

### Slash Command: `/sdk` or `/copilot-sdk`

When invoked via slash command, respond to the user's request in context:

- If asked for a code example, provide it in all four languages.
- If asked about a specific feature, explain it with reference code.
- If asked to debug an issue, analyze the code and suggest fixes.
- If asked about architecture, explain the Client → Session → Events flow.
- Always be specific, cite the SDK documentation, and provide runnable code.

## Output Guidelines

- Be concise but thorough. Developers value precision over verbosity.
- Always include the language name when showing code examples.
- When suggesting fixes, show both the problem and the corrected version.
- Reference official resources:
  - SDK Repository: https://github.com/github/copilot-sdk
  - Getting Started: https://github.com/github/copilot-sdk/blob/main/docs/getting-started.md
  - Authentication: https://github.com/github/copilot-sdk/blob/main/docs/auth/index.md
  - Debugging: https://github.com/github/copilot-sdk/blob/main/docs/debugging.md
  - Cookbook: https://github.com/github/awesome-copilot/tree/main/cookbook/copilot-sdk
WORKFLOW_EOF

read -r -d '' INSTRUCTIONS_CONTENT << 'INSTRUCTIONS_EOF' || true
# GitHub Copilot SDK — Agent Instructions

> These instructions give any AI coding agent (Copilot, Claude, Codex, or custom)
> deep knowledge of the GitHub Copilot SDK when working in this repository.

## About the Copilot SDK

The GitHub Copilot SDK (Technical Preview) is a multi-platform SDK for embedding
Copilot's agentic engine into any application. It wraps the Copilot CLI via
JSON-RPC and provides high-level abstractions for sessions, streaming, tools,
authentication, and MCP server integration.

**Supported languages:** TypeScript/Node.js, Python, Go, .NET/C#

## Quick Reference

### Installation

```bash
# TypeScript
npm install @github/copilot-sdk

# Python
pip install github-copilot-sdk

# Go
go get github.com/github/copilot-sdk/go

# .NET
dotnet add package GitHub.Copilot.SDK
```

### Minimal "Hello World" (All Languages)

**TypeScript:**
```typescript
import { CopilotClient } from "@github/copilot-sdk";
const client = new CopilotClient();
const session = await client.createSession({ model: "gpt-4.1" });
const response = await session.sendAndWait({ prompt: "Hello!" });
console.log(response?.data.content);
await client.stop();
```

**Python:**
```python
import asyncio
from copilot import CopilotClient

async def main():
    client = CopilotClient()
    await client.start()
    session = await client.create_session({"model": "gpt-4.1"})
    response = await session.send_and_wait({"prompt": "Hello!"})
    print(response.data.content)
    await client.stop()

asyncio.run(main())
```

**Go:**
```go
ctx := context.Background()
client := copilot.NewClient(nil)
_ = client.Start(ctx)
defer client.Stop()
session, _ := client.CreateSession(ctx, &copilot.SessionConfig{Model: "gpt-4.1"})
response, _ := session.SendAndWait(ctx, copilot.MessageOptions{Prompt: "Hello!"})
fmt.Println(*response.Data.Content)
```

**.NET:**
```csharp
await using var client = new CopilotClient();
await using var session = await client.CreateSessionAsync(new SessionConfig { Model = "gpt-4.1" });
var response = await session.SendAndWaitAsync(new MessageOptions { Prompt = "Hello!" });
Console.WriteLine(response?.Data.Content);
```

### Streaming

Enable with `streaming: true` in session config, then subscribe to events:

| Event                     | Payload Field     | Purpose               |
| ------------------------- | ----------------- | --------------------- |
| `assistant.message_delta` | `deltaContent`    | Real-time text chunks |
| `assistant.message`       | `content`         | Complete message      |
| `session.idle`            | —                 | Agent done processing |

### Custom Tools

Tools let the agent call your code. Define them with a name, description,
JSON Schema parameters, and a handler function, then pass them in `tools:[]`
when creating a session.

- **TypeScript**: `defineTool("name", { description, parameters, handler })`
- **Python**: `@define_tool(description="...")` decorator with Pydantic `BaseModel` params
- **Go**: `copilot.DefineTool("name", "desc", func(params T, inv ToolInvocation) (R, error))`
- **.NET**: `AIFunctionFactory.Create(delegate, "name", "description")`

### Authentication Priority

1. Explicit `githubToken` in constructor
2. `CAPI_HMAC_KEY` / `COPILOT_HMAC_KEY`
3. `GITHUB_COPILOT_API_TOKEN` + `COPILOT_API_URL`
4. `COPILOT_GITHUB_TOKEN` → `GH_TOKEN` → `GITHUB_TOKEN`
5. Stored OAuth from `copilot auth login`
6. `gh auth` credentials

**BYOK**: Use your own OpenAI / Azure AI Foundry / Anthropic keys — no Copilot
subscription needed. Key-based auth only (no Entra ID / managed identity).

### MCP Servers

```typescript
// Connect to GitHub's MCP server
const session = await client.createSession({
    mcpServers: {
        github: { type: "http", url: "https://api.githubcopilot.com/mcp/" },
    },
});
```

Supports both local stdio servers and remote HTTP servers.

### External CLI Server

```bash
copilot --headless --port 4321
```
```typescript
const client = new CopilotClient({ cliUrl: "localhost:4321" });
```

### Debugging

- Set `logLevel: "debug"` on client options
- Use `cliArgs: ["--log-dir", "/path"]` for persistent logs (TS/.NET)
- For Python/Go, run CLI manually with `--log-dir` and connect via `cli_url`
- Common errors: CLI not found → set `cliPath`; Not authenticated → `copilot auth login` or set token

## Coding Standards for This Repository

When writing code that uses the Copilot SDK:

1. **Always clean up**: Call `client.stop()` in `finally` blocks, use `defer` (Go),
   or `await using` (.NET). Never leave CLI processes orphaned.
2. **Handle errors**: Wrap SDK calls in try/catch. Subscribe to `error` and
   `tool.execution_error` events.
3. **Use streaming for interactive UIs**, `sendAndWait` for batch/script usage.
4. **Never hardcode tokens**: Use env vars (`COPILOT_GITHUB_TOKEN`) or secrets.
5. **Tool handlers must return JSON-serializable values**. Never return `undefined`.
6. **Validate tool schemas**: All `parameters` must be valid JSON Schema with
   `type: "object"` at the root and `required` fields specified.
7. **Test MCP servers independently** before integrating:
   ```bash
   echo '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{...}}' | /path/to/server
   ```

## Resources

- [SDK Repository](https://github.com/github/copilot-sdk)
- [Getting Started Guide](https://github.com/github/copilot-sdk/blob/main/docs/getting-started.md)
- [Authentication Docs](https://github.com/github/copilot-sdk/blob/main/docs/auth/index.md)
- [BYOK Docs](https://github.com/github/copilot-sdk/blob/main/docs/auth/byok.md)
- [Debugging Guide](https://github.com/github/copilot-sdk/blob/main/docs/debugging.md)
- [MCP Overview](https://github.com/github/copilot-sdk/blob/main/docs/mcp/overview.md)
- [Cookbook Recipes](https://github.com/github/awesome-copilot/tree/main/cookbook/copilot-sdk)
- [Awesome Copilot](https://github.com/github/awesome-copilot)
INSTRUCTIONS_EOF

# --- Helper Functions -------------------------------------------------------

log_info()  { echo -e "${CYAN}[INFO]${NC}  $1"; }
log_ok()    { echo -e "${GREEN}[OK]${NC}    $1"; }
log_warn()  { echo -e "${YELLOW}[WARN]${NC}  $1"; }
log_err()   { echo -e "${RED}[ERROR]${NC} $1"; }
log_step()  { echo -e "\n${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"; echo -e "${GREEN}  $1${NC}"; echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}\n"; }

# --- Preflight Checks -------------------------------------------------------

log_step "Preflight Checks"

# Check gh CLI
if ! command -v gh &> /dev/null; then
    log_err "GitHub CLI (gh) is not installed."
    echo "  Install it: https://cli.github.com/"
    exit 1
fi
log_ok "GitHub CLI found: $(gh --version | head -1)"

# Check authentication
if ! gh auth status &> /dev/null 2>&1; then
    log_err "GitHub CLI is not authenticated."
    echo "  Run: gh auth login"
    exit 1
fi
log_ok "GitHub CLI is authenticated"

# Check git
if ! command -v git &> /dev/null; then
    log_err "git is not installed."
    exit 1
fi
log_ok "git found: $(git --version)"

# Check gh-aw (optional, for compile step)
GH_AW_AVAILABLE=false
if gh aw --help &> /dev/null 2>&1; then
    GH_AW_AVAILABLE=true
    log_ok "gh-aw extension is available (will compile workflows)"
else
    log_warn "gh-aw extension not found (skipping compile step)"
    log_warn "  Install later with: gh extension install github/gh-aw"
fi

# --- Fetch Repositories -----------------------------------------------------

log_step "Fetching repositories for ${GITHUB_USER}"

REPOS_JSON=$(gh repo list "$GITHUB_USER" \
    --limit 500 \
    --no-archived \
    --json nameWithOwner,isArchived,isFork \
    --jq '[.[] | select(.isArchived == false) | .nameWithOwner]')

REPO_COUNT=$(echo "$REPOS_JSON" | jq 'length')

if [[ "$REPO_COUNT" -eq 0 ]]; then
    log_err "No repositories found for user: $GITHUB_USER"
    exit 1
fi

log_ok "Found $REPO_COUNT repositories"

# Show the list and ask for confirmation
echo ""
echo "$REPOS_JSON" | jq -r '.[]' | while read -r repo; do
    echo "  • $repo"
done

echo ""
read -p "$(echo -e "${YELLOW}Deploy to all $REPO_COUNT repositories? [y/N]: ${NC}")" CONFIRM
if [[ ! "$CONFIRM" =~ ^[Yy]$ ]]; then
    log_info "Aborted by user."
    exit 0
fi

# --- Deploy to Each Repository ----------------------------------------------

log_step "Starting deployment"

WORK_DIR=$(mktemp -d)
trap 'rm -rf "$WORK_DIR"' EXIT

SUCCESS_COUNT=0
SKIP_COUNT=0
FAIL_COUNT=0
COMPILE_COUNT=0

declare -a RESULTS=()

echo "$REPOS_JSON" | jq -r '.[]' | while read -r REPO; do

    REPO_DIR="$WORK_DIR/$(echo "$REPO" | tr '/' '_')"
    echo ""
    log_info "────────────────────────────────────────"
    log_info "Processing: $REPO"
    log_info "────────────────────────────────────────"

    # --- Clone (shallow) ---
    if ! gh repo clone "$REPO" "$REPO_DIR" -- --depth 1 --quiet 2>/dev/null; then
        log_err "Failed to clone $REPO (skipping)"
        RESULTS+=("FAIL|$REPO|clone failed")
        ((FAIL_COUNT++)) || true
        continue
    fi

    cd "$REPO_DIR"

    # --- Check default branch ---
    DEFAULT_BRANCH=$(git symbolic-ref refs/remotes/origin/HEAD 2>/dev/null | sed 's@^refs/remotes/origin/@@' || echo "main")

    # --- Check if files already exist ---
    WORKFLOW_EXISTS=false
    INSTRUCTIONS_EXISTS=false

    if [[ -f ".github/workflows/copilot-sdk-expert.md" ]]; then
        WORKFLOW_EXISTS=true
    fi
    if [[ -f ".github/copilot-instructions.md" ]]; then
        INSTRUCTIONS_EXISTS=true
    fi

    if $WORKFLOW_EXISTS && $INSTRUCTIONS_EXISTS; then
        log_warn "Both files already exist in $REPO (skipping)"
        RESULTS+=("SKIP|$REPO|files already exist")
        ((SKIP_COUNT++)) || true
        cd "$WORK_DIR"
        continue
    fi

    # --- Create branch ---
    # Check if branch already exists on remote
    if git ls-remote --heads origin "$BRANCH_NAME" 2>/dev/null | grep -q "$BRANCH_NAME"; then
        log_warn "Branch '$BRANCH_NAME' already exists in $REPO (skipping)"
        RESULTS+=("SKIP|$REPO|branch already exists")
        ((SKIP_COUNT++)) || true
        cd "$WORK_DIR"
        continue
    fi

    git checkout -b "$BRANCH_NAME" 2>/dev/null

    # --- Write files ---
    mkdir -p .github/workflows

    if ! $WORKFLOW_EXISTS; then
        echo "$WORKFLOW_CONTENT" > .github/workflows/copilot-sdk-expert.md
        git add .github/workflows/copilot-sdk-expert.md
        log_ok "  Created .github/workflows/copilot-sdk-expert.md"
    fi

    if ! $INSTRUCTIONS_EXISTS; then
        echo "$INSTRUCTIONS_CONTENT" > .github/copilot-instructions.md
        git add .github/copilot-instructions.md
        log_ok "  Created .github/copilot-instructions.md"
    fi

    # --- Check for changes ---
    if git diff --cached --quiet; then
        log_warn "No changes to commit for $REPO (skipping)"
        RESULTS+=("SKIP|$REPO|no changes")
        ((SKIP_COUNT++)) || true
        cd "$WORK_DIR"
        continue
    fi

    # --- Commit and push ---
    git commit -m "$COMMIT_MSG" --quiet
    if ! git push origin "$BRANCH_NAME" --quiet 2>/dev/null; then
        log_err "Failed to push branch for $REPO"
        RESULTS+=("FAIL|$REPO|push failed")
        ((FAIL_COUNT++)) || true
        cd "$WORK_DIR"
        continue
    fi
    log_ok "  Pushed branch '$BRANCH_NAME'"

    # --- Create PR ---
    PR_URL=$(gh pr create \
        --repo "$REPO" \
        --base "$DEFAULT_BRANCH" \
        --head "$BRANCH_NAME" \
        --title "$PR_TITLE" \
        --body "$PR_BODY" \
        2>/dev/null) || true

    if [[ -n "$PR_URL" ]]; then
        log_ok "  Created PR: $PR_URL"
    else
        log_warn "  PR may already exist or creation failed"
    fi

    # --- Compile workflow (if gh-aw available) ---
    if $GH_AW_AVAILABLE; then
        if gh aw compile .github/workflows/copilot-sdk-expert.md 2>/dev/null; then
            log_ok "  Compiled workflow with gh-aw"
            ((COMPILE_COUNT++)) || true
        else
            log_warn "  gh-aw compile skipped (may need to run after merge)"
        fi
    fi

    RESULTS+=("OK|$REPO|$PR_URL")
    ((SUCCESS_COUNT++)) || true

    cd "$WORK_DIR"
done

# --- Summary ----------------------------------------------------------------

log_step "Deployment Summary"

echo -e "  ${GREEN}Deployed:${NC}  $SUCCESS_COUNT"
echo -e "  ${YELLOW}Skipped:${NC}   $SKIP_COUNT"
echo -e "  ${RED}Failed:${NC}    $FAIL_COUNT"
if $GH_AW_AVAILABLE; then
    echo -e "  ${CYAN}Compiled:${NC}  $COMPILE_COUNT"
fi

echo ""

if [[ ${#RESULTS[@]} -gt 0 ]]; then
    echo "  Details:"
    for result in "${RESULTS[@]}"; do
        STATUS=$(echo "$result" | cut -d'|' -f1)
        REPO=$(echo "$result" | cut -d'|' -f2)
        DETAIL=$(echo "$result" | cut -d'|' -f3-)
        case "$STATUS" in
            OK)   echo -e "    ${GREEN}✓${NC} $REPO → $DETAIL" ;;
            SKIP) echo -e "    ${YELLOW}⊘${NC} $REPO ($DETAIL)" ;;
            FAIL) echo -e "    ${RED}✗${NC} $REPO ($DETAIL)" ;;
        esac
    done
fi

echo ""
log_info "Next steps:"
echo "  1. Review and merge the PRs in each repository"
echo "  2. After merging, compile each workflow:"
echo "     gh aw compile .github/workflows/copilot-sdk-expert.md"
echo "  3. The agent activates on new issues, PRs, and /sdk commands"
echo ""
log_ok "Done."
