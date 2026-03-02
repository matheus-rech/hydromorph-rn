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
