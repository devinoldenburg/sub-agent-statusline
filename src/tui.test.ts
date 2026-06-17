import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { readOpenCodeLogFileIfSmall } from "./logs.js";
import {
  backfillHydratedTargetSessionIDs,
  resolveTuiSubagentSnapshot,
} from "./tui.js";
import {
  focusPromptWithDeferredRetry,
  resolveSidebarReturnFocusAction,
} from "./tui-focus.js";
import { registerSubagentCommands } from "./tui-commands.js";
import type { ChildSessionState, StatuslineState } from "./state.js";

function child(overrides: Partial<ChildSessionState> = {}): ChildSessionState {
  return {
    id: "ses_child",
    title: "Child work",
    parentID: "ses_parent",
    source: "session",
    targetSessionID: "ses_child",
    status: "running",
    color: "yellow",
    startedAt: "2026-04-30T10:00:00.000Z",
    updatedAt: "2026-04-30T10:01:00.000Z",
    ...overrides,
  };
}

function stateWith(children: ChildSessionState[]): StatuslineState {
  return {
    children: Object.fromEntries(children.map((item) => [item.id, item])),
    countedChildIDs: {},
    totalExecuted: 99,
    updatedAt: "2026-04-30T10:20:00.000Z",
  };
}

describe("TUI subagent snapshots", () => {
  it("resolves sidebar and home snapshots from classified real executions only", () => {
    const nowMs = Date.parse("2026-04-30T10:20:00.000Z");
    const state = stateWith([
      child({
        id: "tool:delegate-wrapper",
        title: "Delegation: inspect counters",
        source: "tool",
        toolName: "delegate",
        targetSessionID: undefined,
        messageID: "msg_delegate",
      }),
      child({
        id: "tool:task-proxy",
        title: "task",
        source: "tool",
        toolName: "task",
        targetSessionID: "ses_real_running",
        messageID: "msg_real_running",
      }),
      child({
        id: "ses_real_running",
        title: "Delegation: real child still counts",
        source: "session",
        targetSessionID: "ses_real_running",
        messageID: "msg_real_running",
        status: "running",
      }),
      child({
        id: "ses_real_done_old",
        title: "Completed child",
        source: "session",
        targetSessionID: "ses_real_done_old",
        status: "done",
        color: "green",
        endedAt: "2026-04-30T10:02:00.000Z",
        updatedAt: "2026-04-30T10:02:00.000Z",
      }),
    ]);

    const sidebar = resolveTuiSubagentSnapshot({
      state,
      sessionID: "ses_parent",
      nowMs,
    });
    const home = resolveTuiSubagentSnapshot({ state, nowMs });

    expect(sidebar.visibleChildren.map((item) => item.id)).toEqual([
      "ses_real_running",
    ]);
    expect(sidebar.visibleCounts).toEqual({ running: 1, done: 0, error: 0 });
    expect(sidebar.totalExecuted).toBe(2);
    expect(home.visibleChildren.map((item) => item.id)).toEqual([
      "ses_real_running",
    ]);
    expect(home.visibleCounts).toEqual(sidebar.visibleCounts);
    expect(home.totalExecuted).toBe(2);
  });

  it("shows completed real history without adding wrappers to visible counts", () => {
    const nowMs = Date.parse("2026-04-30T10:20:00.000Z");
    const state = stateWith([
      child({
        id: "tool:old-wrapper",
        title: "delegate",
        source: "tool",
        toolName: "delegate",
        targetSessionID: undefined,
      }),
      child({
        id: "ses_real_done_old",
        title: "Delegation: old but real",
        source: "session",
        targetSessionID: "ses_real_done_old",
        status: "done",
        color: "green",
        endedAt: "2026-04-30T10:02:00.000Z",
        updatedAt: "2026-04-30T10:02:00.000Z",
      }),
    ]);

    const snapshot = resolveTuiSubagentSnapshot({
      state,
      sessionID: "ses_parent",
      nowMs,
      showCompletedHistory: true,
    });

    expect(snapshot.visibleChildren.map((item) => item.id)).toEqual([
      "ses_real_done_old",
    ]);
    expect(snapshot.visibleCounts).toEqual({ running: 0, done: 1, error: 0 });
    expect(snapshot.totalExecuted).toBe(1);
  });

  it("backfills hydrated targets only when the real session match is unique", () => {
    const ambiguous = stateWith([
      child({
        id: "tool:ambiguous",
        source: "tool",
        toolName: "task",
        targetSessionID: undefined,
        messageID: "msg_wrapper",
      }),
      child({ id: "ses_first", targetSessionID: "ses_first" }),
      child({ id: "ses_second", targetSessionID: "ses_second" }),
    ]);

    expect(backfillHydratedTargetSessionIDs(ambiguous, "ses_parent")).toBe(
      false,
    );
    expect(ambiguous.children["tool:ambiguous"]?.targetSessionID).toBeUndefined();

    const unique = stateWith([
      child({
        id: "tool:matched",
        source: "tool",
        toolName: "task",
        targetSessionID: undefined,
        messageID: "msg_real",
      }),
      child({
        id: "ses_first",
        targetSessionID: "ses_first",
        messageID: "msg_other",
      }),
      child({
        id: "ses_second",
        targetSessionID: "ses_second",
        messageID: "msg_real",
      }),
    ]);

    expect(backfillHydratedTargetSessionIDs(unique, "ses_parent")).toBe(true);
    expect(unique.children["tool:matched"]?.targetSessionID).toBe("ses_second");
  });
});

describe("registerSubagentCommands", () => {
  it("registers both keymap and legacy commands when both APIs are available", () => {
    const keymapDispose = vi.fn();
    const legacyDispose = vi.fn();
    const registerLayer = vi.fn(() => keymapDispose);
    const commandRegister = vi.fn(() => legacyDispose);
    const toggleSection = vi.fn();
    const focusSidebarList = vi.fn();
    const toggleCompletedHistory = vi.fn();

    const result = registerSubagentCommands({
      api: {
        keymap: { registerLayer },
        command: { register: commandRegister },
      },
      sectionEnabled: () => true,
      toggleSection,
      focusSidebarList,
      toggleCompletedHistory,
    });

    expect(commandRegister).toHaveBeenCalledOnce();
    expect(registerLayer).toHaveBeenCalledOnce();
    expect(registerLayer).toHaveBeenCalledWith({
      commands: [
        expect.objectContaining({
          name: "subagent-statusline.toggle-sidebar-section",
          title: expect.stringContaining("Subagents"),
          run: expect.any(Function),
        }),
        expect.objectContaining({
          name: "subagent-statusline.focus-sidebar-list",
          title: "Subagents: Focus sidebar list",
          run: expect.any(Function),
        }),
        expect.objectContaining({
          name: "subagent-statusline.toggle-completed-history",
          title: "Subagents: Toggle completed history",
          run: expect.any(Function),
        }),
      ],
      bindings: [
        {
          key: "alt+b",
          cmd: "subagent-statusline.focus-sidebar-list",
        },
      ],
    });

    const layer = registerLayer.mock.calls[0]?.[0];
    layer?.commands?.[0]?.run();
    layer?.commands?.[1]?.run();
    layer?.commands?.[2]?.run();

    const legacyCommands = commandRegister.mock.calls[0]?.[0]?.();
    legacyCommands?.[0]?.onSelect?.();
    legacyCommands?.[1]?.onSelect?.();
    legacyCommands?.[2]?.onSelect?.();

    expect(toggleSection).toHaveBeenNthCalledWith(1, false);
    expect(toggleSection).toHaveBeenNthCalledWith(2, false);
    expect(focusSidebarList).toHaveBeenCalledTimes(2);
    expect(toggleCompletedHistory).toHaveBeenCalledTimes(2);

    expect(legacyCommands).toEqual([
      expect.objectContaining({
        value: "subagent-statusline.toggle-sidebar-section",
        description: "Toggle the entire subagent sidebar section",
        category: "Subagents",
      }),
      expect.objectContaining({
        title: "Subagents: Focus sidebar list",
        value: "subagent-statusline.focus-sidebar-list",
        keybind: "alt+b",
      }),
      expect.objectContaining({
        title: "Subagents: Toggle completed history",
        value: "subagent-statusline.toggle-completed-history",
        description: expect.stringContaining("Shortcut: c"),
      }),
    ]);

    result();
    expect(keymapDispose).toHaveBeenCalledOnce();
    expect(legacyDispose).toHaveBeenCalledOnce();

    result();
    expect(keymapDispose).toHaveBeenCalledOnce();
    expect(legacyDispose).toHaveBeenCalledOnce();
  });

  it("registers only keymap when legacy API is unavailable", () => {
    const dispose = vi.fn();
    const registerLayer = vi.fn(() => dispose);
    const toggleSection = vi.fn();
    const focusSidebarList = vi.fn();
    const toggleCompletedHistory = vi.fn();

    const result = registerSubagentCommands({
      api: {
        keymap: { registerLayer },
      },
      sectionEnabled: () => true,
      toggleSection,
      focusSidebarList,
      toggleCompletedHistory,
    });

    expect(registerLayer).toHaveBeenCalledOnce();
    const layer = registerLayer.mock.calls[0]?.[0];
    expect(layer?.bindings).toEqual([
      {
        key: "alt+b",
        cmd: "subagent-statusline.focus-sidebar-list",
      },
    ]);

    layer?.commands?.[0]?.run();
    layer?.commands?.[1]?.run();
    layer?.commands?.[2]?.run();
    expect(toggleSection).toHaveBeenCalledWith(false);
    expect(focusSidebarList).toHaveBeenCalledOnce();
    expect(toggleCompletedHistory).toHaveBeenCalledOnce();

    result();
    expect(dispose).toHaveBeenCalledOnce();
  });

  it("falls back to the legacy command API when keymap is unavailable", () => {
    const dispose = vi.fn();
    const register = vi.fn(() => dispose);
    const toggleSection = vi.fn();
    const focusSidebarList = vi.fn();
    const toggleCompletedHistory = vi.fn();

    const result = registerSubagentCommands({
      api: { command: { register } },
      sectionEnabled: () => false,
      toggleSection,
      focusSidebarList,
      toggleCompletedHistory,
    });

    expect(register).toHaveBeenCalledOnce();
    const legacyCommands = register.mock.calls[0]?.[0]?.();
    expect(legacyCommands).toEqual([
      expect.objectContaining({
        title: "Subagents: Enable sidebar section",
        value: "subagent-statusline.toggle-sidebar-section",
      }),
      expect.objectContaining({
        value: "subagent-statusline.focus-sidebar-list",
        keybind: "alt+b",
      }),
      expect.objectContaining({
        value: "subagent-statusline.toggle-completed-history",
        description: expect.stringContaining("sidebar list is focused"),
      }),
    ]);

    legacyCommands?.[0]?.onSelect?.();
    legacyCommands?.[1]?.onSelect?.();
    legacyCommands?.[2]?.onSelect?.();
    expect(toggleSection).toHaveBeenCalledWith(true);
    expect(focusSidebarList).toHaveBeenCalledOnce();
    expect(toggleCompletedHistory).toHaveBeenCalledOnce();

    result();
    expect(dispose).toHaveBeenCalledOnce();
  });

  it("returns a safe no-op disposer when neither API is available", () => {
    const result = registerSubagentCommands({
      api: {},
      sectionEnabled: () => false,
      toggleSection: vi.fn(),
      focusSidebarList: vi.fn(),
      toggleCompletedHistory: vi.fn(),
    });

    expect(() => result()).not.toThrow();
    expect(() => result()).not.toThrow();
  });

  it("disposes all created registrations even if one dispose throws", () => {
    const keymapDispose = vi.fn(() => {
      throw new Error("keymap dispose failed");
    });
    const legacyDispose = vi.fn();
    const registerLayer = vi.fn(() => keymapDispose);
    const register = vi.fn(() => legacyDispose);

    const result = registerSubagentCommands({
      api: {
        keymap: { registerLayer },
        command: { register },
      },
      sectionEnabled: () => false,
      toggleSection: vi.fn(),
      focusSidebarList: vi.fn(),
      toggleCompletedHistory: vi.fn(),
    });

    expect(() => result()).not.toThrow();
    expect(keymapDispose).toHaveBeenCalledOnce();
    expect(legacyDispose).toHaveBeenCalledOnce();

    result();
    expect(keymapDispose).toHaveBeenCalledOnce();
    expect(legacyDispose).toHaveBeenCalledOnce();
  });
});

describe("readOpenCodeLogFileIfSmall", () => {
  it("skips oversized OpenCode logs before reading them synchronously", async () => {
    const dir = await mkdtemp(join(tmpdir(), "subagent-statusline-logs-"));
    const smallLog = join(dir, "small.log");
    const hugeLog = join(dir, "huge.log");

    await writeFile(smallLog, "small log", "utf8");
    await writeFile(hugeLog, `${"x".repeat(1024 * 1024)}x`, "utf8");

    expect(readOpenCodeLogFileIfSmall(smallLog)).toBe("small log");
    expect(readOpenCodeLogFileIfSmall(hugeLog)).toBeUndefined();
  });
});

describe("resolveSidebarReturnFocusAction", () => {
  const pendingSidebarRefocus = {
    parentSessionID: "parent",
    childSessionID: "child",
    childRowID: "row-1",
  };

  it("returns focus-prompt for remembered child -> parent return", () => {
    expect(
      resolveSidebarReturnFocusAction({
        pendingSidebarRefocus,
        previousRouteSessionID: "child",
        routeSessionID: "parent",
      }),
    ).toBe("focus-prompt");
  });

  it("returns clear-pending when route leaves remembered child path", () => {
    expect(
      resolveSidebarReturnFocusAction({
        pendingSidebarRefocus,
        previousRouteSessionID: "child",
        routeSessionID: "another",
      }),
    ).toBe("clear-pending");
  });

  it("returns none for unrelated transitions while still on child", () => {
    expect(
      resolveSidebarReturnFocusAction({
        pendingSidebarRefocus,
        previousRouteSessionID: "parent",
        routeSessionID: "child",
      }),
    ).toBe("none");
  });

  it("returns none when no pending sidebar navigation exists", () => {
    expect(
      resolveSidebarReturnFocusAction({
        previousRouteSessionID: "child",
        routeSessionID: "parent",
      }),
    ).toBe("none");
  });
});

describe("focusPromptWithDeferredRetry", () => {
  it("retries once when prompt focus is initially unavailable", () => {
    const queue: Array<() => void> = [];
    const schedule = (callback: () => void): void => {
      queue.push(callback);
    };
    let hasPromptRef = false;
    const focus = vi.fn(() => {
      if (!hasPromptRef) {
        hasPromptRef = true;
        return false;
      }
      return true;
    });

    focusPromptWithDeferredRetry(focus, schedule);
    expect(queue).toHaveLength(1);
    queue.shift()?.();
    expect(focus).toHaveBeenCalledTimes(1);
    expect(queue).toHaveLength(1);
    queue.shift()?.();
    expect(focus).toHaveBeenCalledTimes(2);
  });
});
