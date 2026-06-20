# sub-agent-statusline sidebar header cleanup

## Task
Remove the plugin version and ASCII `-`/`+` prefix from the Subagents sidebar title so it matches native OpenCode TUI sidebar sections.

## Outcome
- Sidebar header now uses bold `Subagents` text like Context/Todo/MCP sections.
- Expand chevrons (`▼`/`▶`) appear only when more than two subagent rows are visible.
- Plugin version label removed from sidebar UI.
- CHANGELOG updated for 0.9.3; release expected via semantic-release on push to `main`.
