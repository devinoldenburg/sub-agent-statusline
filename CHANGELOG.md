# Changelog

## 0.8.0 - 2026-06-12

- Made the fork independent with repository metadata pointing to `devinoldenburg/sub-agent-statusline` while preserving MIT attribution for the original project.
- Added typed configuration with safe defaults and ASCII symbols as the default render mode.
- Added an explicit Unicode symbol mode through `OPENCODE_SUBAGENT_STATUSLINE_SYMBOL_MODE=unicode`.
- Removed emoji and unstable decorative Unicode from default rendered output and documentation examples.
- Hardened OpenCode TUI integration for missing KV, UI, route, lifecycle, slots, event, state, and client APIs.
- Broadened event parsing for snake-case and alternate parent, session, message, and metadata fields.
- Updated tests for config, symbols, missing event data, ASCII output, sorting, TTL cleanup, and package exports.
- Updated CI to run typecheck, tests, coverage, build, package dry-run, and an emoji guard.

Release note: this version is release-ready only after all validation commands pass in CI and release credentials are available. No tag or publish step is performed by this branch.
