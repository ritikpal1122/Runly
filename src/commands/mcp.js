// ═══════════════════════════════════════════════════════════════════════════
// `runly mcp` — Launch the MCP stdio server
// ═══════════════════════════════════════════════════════════════════════════
//
// Usage from Claude Code (~/.claude.json):
//   "mcpServers": {
//     "runly": { "command": "runly", "args": ["mcp"] }
//   }
//
// Once connected, the agent can call:
//   runly_test, runly_run_file, runly_list_tests,
//   runly_inspect, runly_open_url, runly_last_run
// ═══════════════════════════════════════════════════════════════════════════

export async function mcpCommand() {
  // Dynamic import — only pull in the MCP SDK when actually running the server.
  // Keeps `runly --help` / `runly doctor` startup fast.
  const { startMcpServer } = await import('../mcp/server.js');
  await startMcpServer();
}
