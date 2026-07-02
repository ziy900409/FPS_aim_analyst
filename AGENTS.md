## graphify

This project has a graphify knowledge graph at `graphify-out/`.

Rules:
- Before answering architecture or codebase questions, read `graphify-out/GRAPH_REPORT.md` for god nodes and community structure.
- If `graphify-out/wiki/index.md` exists, navigate it instead of reading raw files.
- For cross-module "how does X relate to Y" questions, prefer `graphify query "<question>"`, `graphify path "<A>" "<B>"`, or `graphify explain "<concept>"` over grep. These traverse EXTRACTED + INFERRED graph edges instead of scanning files.
- After modifying code files, run `graphify update .` to keep the graph current (AST-only, no API cost).

## CodeGraph

This project uses CodeGraph for source-level code intelligence. The MCP server is configured in `.mcp.json` as:

```json
{
  "mcpServers": {
    "codegraph": {
      "type": "stdio",
      "command": "codegraph",
      "args": ["serve", "--mcp"]
    }
  }
}
```

The local index lives in `.codegraph/`.

Rules:
- Before exploring unfamiliar code, prefer CodeGraph over grep:
  - `codegraph_status` to confirm the index is available.
  - `codegraph_files` to inspect project structure.
  - `codegraph_search` to find symbols by name.
  - `codegraph_callers` to inspect direct callers.
  - `codegraph_impact` before editing an existing function, class, method, or exported symbol.
- Before editing a symbol, run `codegraph_impact` for that symbol and report the blast radius to the user: affected files/symbols and whether the change is local or cross-module.
- If CodeGraph tools report stale or pending files after an edit, read those files directly before relying on indexed content.
- Before committing, review `git status --short`, `git diff --cached --stat`, and staged file names to verify only intended files are included.
