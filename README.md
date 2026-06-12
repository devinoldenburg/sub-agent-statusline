# opencode-subagent-statusline

Independent OpenCode TUI plugin for tracking delegated subagent work in the sidebar and footer.

This fork is maintained independently from `Joaquinvesapa/sub-agent-statusline`. The original project is MIT licensed and attribution is preserved in `LICENSE`.

## Features

- ASCII-first status output with no emoji in rendered UI.
- Optional Unicode symbols only when `OPENCODE_SUBAGENT_STATUSLINE_SYMBOL_MODE=unicode` is set.
- Defensive OpenCode TUI integration for missing or partial APIs, events, route state, slots, KV, and UI helpers.
- Sidebar rows sorted by newest work first with stable tie ordering, truncation for narrow terminals, keyboard focus, and safe no-op navigation when a child session is unavailable.
- Footer summary for active or recent subagent activity.
- Local state cleanup for stale terminal rows and best-effort persistence.

## Install

Add the plugin to your OpenCode TUI config:

```json
{
  "$schema": "https://opencode.ai/tui.json",
  "plugin": ["opencode-subagent-statusline"]
}
```

Restart OpenCode after editing the config.

## Configuration

Configuration is intentionally small and safe by default.

| Environment variable | Default | Values | Purpose |
| --- | --- | --- | --- |
| `OPENCODE_SUBAGENT_STATUSLINE_SYMBOL_MODE` | `ascii` | `ascii`, `unicode` | Select rendered symbol set. Unicode is explicit opt-in. |
| `OPENCODE_SUBAGENT_STATUSLINE_COLOR` | `1` | `1`, `0`, `true`, `false` | Enable or disable ANSI color in status text. |
| `NO_COLOR` | unset | any value | Disables ANSI color. |
| `OPENCODE_SUBAGENT_STATUSLINE_STATE` | runtime temp path | file path | Override persisted state file location. |
| `OPENCODE_SUBAGENT_STATUSLINE_STALE_RUNNING_MS` | internal default | milliseconds | Tune stale running cleanup. |

Default status text is ASCII-only:

```txt
-> 1 running | 1 done | 0 error | 2 total | Review diff 00:42 | Run tests 01:10
```

Unicode mode keeps compact symbols without emoji:

```sh
OPENCODE_SUBAGENT_STATUSLINE_SYMBOL_MODE=unicode opencode
```

## Keyboard Navigation

Run `Subagents: Focus sidebar list` from the OpenCode command palette, or press `Alt+B`.

| Shortcut | Action |
| --- | --- |
| `Alt+B` | Toggle focus between the subagent sidebar list and the prompt. |
| `j` / `ArrowDown` | Move selection to the next visible subagent. |
| `k` / `ArrowUp` | Move selection to the previous visible subagent. |
| `Enter` / `Space` | Open the selected child session when it is navigable. |
| `h` / `ArrowLeft` | Collapse the section. |
| `l` / `ArrowRight` | Expand the section. |
| `Esc` | Return focus to the prompt. |

Opening a selected session is a no-op when the row has no safe session target.

## Development

```sh
pnpm install --ignore-scripts
pnpm typecheck
pnpm test
pnpm test:coverage
pnpm build
pnpm pack --dry-run
```

Local TUI testing can load the built plugin directly:

```json
{
  "$schema": "https://opencode.ai/tui.json",
  "plugin": ["/absolute/path/to/sub-agent-statusline/dist/tui.js"]
}
```

Package entrypoints:

```txt
opencode-subagent-statusline          -> TUI plugin
opencode-subagent-statusline/tui      -> TUI plugin
opencode-subagent-statusline/runtime  -> runtime status writer
```

## Privacy And Persistence

The plugin persists local JSON state and a `status.txt` snapshot under `XDG_RUNTIME_DIR` or the system temp directory by default. These files can include OpenCode-derived titles and summaries from delegated tasks. Writes are best-effort and should not affect OpenCode if they fail.

## Release Policy

Do not publish or tag a release unless typecheck, tests, coverage, build, and package dry-run all pass and release credentials are available. This branch only prepares release-ready code; publishing remains a separate maintainer action.

## License

MIT. Original project attribution is preserved in `LICENSE`.
