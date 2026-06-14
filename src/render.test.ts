import { describe, expect, it } from "vitest";
import {
  aggregateWorkItemCounts,
  byPriority,
  collapseSubagentWorkItems,
  formatContext,
  formatContextCompact,
  formatContextDetails,
  formatDuration,
  renderStatusLine,
  visibleSubagentWorkItems,
} from "./render.js";
import type { ChildSessionState, StatuslineState } from "./state.js";

function child(overrides: Partial<ChildSessionState> = {}): ChildSessionState {
  return {
    id: "ses_child",
    title: "Review auth changes",
    parentID: "ses_parent",
    messageID: "msg_1",
    source: "session",
    targetSessionID: "ses_child",
    status: "running",
    color: "yellow",
    startedAt: "2026-04-30T10:00:00.000Z",
    updatedAt: "2026-04-30T10:01:00.000Z",
    elapsedMs: 61000,
    ...overrides,
  };
}

describe("render", () => {
  it("formats durations and context details semantically", () => {
    const withTokens = child({
      tokens: { input: 1200, output: 300, contextPercent: 12.34 },
    });

    expect(formatDuration(61000)).toBe("01:01");
    expect(formatDuration(3_661_000)).toBe("01:01:01");
    expect(formatContextDetails(withTokens)).toBe("1,500 tokens | 12.3% used");
    expect(formatContext(withTokens)).toBe("ctx 1,500 tokens | 12.3% used");
    expect(formatContextCompact(withTokens)).toBe("1.5k ctx 12%");
  });

  it("collapses synthetic work items with matching session children", () => {
    const synthetic = child({
      id: "tool:part_1",
      title: "Investigate flaky tests",
      source: "tool",
      targetSessionID: "ses_child",
      agentName: "tester",
    });
    const session = child({
      id: "ses_child",
      title: "Investigate flaky tests",
      source: "session",
      status: "done",
      color: "green",
      endedAt: "2026-04-30T10:04:00.000Z",
      elapsedMs: 240000,
    });

    expect(collapseSubagentWorkItems([synthetic, session])).toEqual([
      expect.objectContaining({
        id: "tool:part_1",
        status: "done",
        color: "green",
        targetSessionID: "ses_child",
        elapsedMs: 240000,
      }),
    ]);
  });

  it("does not collapse a targetless generic task wrapper without correlation", () => {
    const children: ChildSessionState[] = [
      child({
        id: "tool:sync-task",
        title: "task",
        source: "tool",
        targetSessionID: undefined,
        messageID: "msg_sync",
      }),
      child({
        id: "ses_sync_child",
        title: "Run task cleanup",
        source: "session",
        targetSessionID: "ses_sync_child",
        messageID: undefined,
        status: "running",
      }),
    ];

    expect(collapseSubagentWorkItems(children).map((item) => item.id)).toEqual([
      "tool:sync-task",
      "ses_sync_child",
    ]);
  });

  it("keeps one grouped row and avoids duplicate wrappers", () => {
    const children: ChildSessionState[] = [
      child({
        id: "tool:task-wrapper",
        title: "task",
        source: "tool",
        messageID: "msg_1",
      }),
      child({
        id: "subtask:work_1",
        title: "Implement grouping assertions",
        source: "subtask",
        messageID: "msg_1",
        targetSessionID: "ses_child_1",
      }),
      child({
        id: "ses_child_1",
        title: "Implement grouping assertions (coder)",
        source: "session",
        messageID: "msg_1",
        status: "done",
        color: "green",
        endedAt: "2026-04-30T12:10:00.000Z",
        updatedAt: "2026-04-30T12:10:00.000Z",
      }),
    ];

    const collapsed = collapseSubagentWorkItems(children);

    expect(collapsed.map((item) => item.id)).toEqual(["subtask:work_1"]);
    expect(collapsed[0]).toMatchObject({
      status: "done",
      color: "green",
      targetSessionID: "ses_child_1",
      endedAt: "2026-04-30T12:10:00.000Z",
    });
  });

  it("hides done items as soon as they finish while keeping running and error visible", () => {
    const now = Date.parse("2026-04-30T10:20:00.000Z");
    const justFinished = child({
      id: "done_recent",
      status: "done",
      color: "green",
      endedAt: "2026-04-30T10:19:59.000Z",
    });
    const stillRunning = child({
      id: "running_now",
      status: "running",
      color: "yellow",
    });
    const failed = child({
      id: "errored",
      status: "error",
      color: "red",
      endedAt: "2026-04-30T10:18:00.000Z",
    });

    expect(
      visibleSubagentWorkItems(
        [justFinished, stillRunning, failed],
        now,
      ).map((item) => item.id),
    ).toEqual(["running_now", "errored"]);
  });

  it("hides every completed row regardless of active work in the same thread", () => {
    const nowMs = Date.parse("2026-04-30T12:15:00.000Z");
    const children: ChildSessionState[] = [
      child({
        id: "subtask:active",
        title: "Long running active work",
        source: "subtask",
        messageID: "msg_active",
        status: "running",
      }),
      child({
        id: "subtask:active-done",
        title: "Recent completion in active thread",
        source: "subtask",
        messageID: "msg_active",
        status: "done",
        color: "green",
        endedAt: "2026-04-30T12:14:00.000Z",
        updatedAt: "2026-04-30T12:14:00.000Z",
      }),
      child({
        id: "subtask:historical",
        title: "Historical completion",
        source: "subtask",
        messageID: "msg_old",
        status: "done",
        color: "green",
        endedAt: "2026-04-30T12:14:00.000Z",
        updatedAt: "2026-04-30T12:14:00.000Z",
      }),
    ];

    const visible = visibleSubagentWorkItems(children, nowMs);

    expect(visible.map((item) => item.id)).toEqual(["subtask:active"]);
  });

  it("counts finished work in the aggregate even though its row is hidden", () => {
    const children: ChildSessionState[] = [
      child({ id: "ses_running", status: "running" }),
      child({
        id: "ses_done_1",
        status: "done",
        color: "green",
        endedAt: "2026-04-30T10:00:00.000Z",
      }),
      child({
        id: "ses_done_2",
        status: "done",
        color: "green",
        endedAt: "2026-04-30T09:00:00.000Z",
      }),
      child({ id: "ses_error", status: "error", color: "red" }),
    ];

    expect(visibleSubagentWorkItems(children).map((item) => item.id)).toEqual([
      "ses_running",
      "ses_error",
    ]);
    expect(aggregateWorkItemCounts(children)).toEqual({
      running: 1,
      done: 2,
      error: 1,
    });
  });

  it("keeps the done count in the rendered statusline aggregate after rows hide", () => {
    process.env.NO_COLOR = "1";
    const state: StatuslineState = {
      children: {
        running: child({ id: "running", title: "Run tests", status: "running" }),
        done: child({
          id: "done",
          title: "Finished work",
          status: "done",
          color: "green",
          endedAt: "2026-04-30T10:00:00.000Z",
        }),
      },
      countedChildIDs: { running: true, done: true },
      totalExecuted: 2,
      updatedAt: "2026-04-30T10:00:00.000Z",
    };

    const line = renderStatusLine(state);
    expect(line).toContain("-> 1 running | 1 done | 0 error | 2 total");
    // The finished row is hidden from the per-child detail section.
    expect(line).not.toContain("Finished work");
    expect(line).toContain("Run tests");
    delete process.env.NO_COLOR;
  });

  it("sorts ties by id for stable priority", () => {
    const a = child({ id: "a", startedAt: "2026-04-30T12:00:00.000Z" });
    const b = child({ id: "b", startedAt: "2026-04-30T12:00:00.000Z" });
    expect([b, a].sort(byPriority).map((item) => item.id)).toEqual(["a", "b"]);
  });

  it("renders aggregate and detail statusline output without color when disabled", () => {
    process.env.NO_COLOR = "1";
    const state: StatuslineState = {
      children: {
        running: child({
          id: "running",
          title: "Run tests",
          status: "running",
          color: "yellow",
        }),
        error: child({
          id: "error",
          title: "Fix bug",
          status: "error",
          color: "red",
        }),
      },
      countedChildIDs: { running: true, error: true },
      totalExecuted: 2,
      updatedAt: "2026-04-30T10:00:00.000Z",
    };

    expect(renderStatusLine(state)).toContain(
      "-> 1 running | 0 done | 1 error | 2 total",
    );
    expect(renderStatusLine(state)).toContain("Run tests 01:01");
    expect(renderStatusLine(state)).not.toContain("\u001B[");
  });

  it("renders ASCII-only output by default", () => {
    process.env.NO_COLOR = "1";
    const state: StatuslineState = {
      children: {
        running: child({ id: "running", title: "Run tests" }),
      },
      countedChildIDs: { running: true },
      totalExecuted: 1,
      updatedAt: "2026-04-30T10:00:00.000Z",
    };

    expect(renderStatusLine(state)).toBe(
      "-> 1 running | 0 done | 0 error | 1 total | Run tests 01:01",
    );
    expect([...renderStatusLine(state)].every((char) => char.charCodeAt(0) < 128)).toBe(
      true,
    );
    delete process.env.NO_COLOR;
  });

  it("supports Unicode mode only when configured", () => {
    process.env.OPENCODE_SUBAGENT_STATUSLINE_SYMBOL_MODE = "unicode";
    const state: StatuslineState = {
      children: {},
      countedChildIDs: {},
      totalExecuted: 0,
      updatedAt: "2026-04-30T10:00:00.000Z",
    };

    expect(renderStatusLine(state)).toBe("↳ 0 running · 0 done · 0 error · 0 Σ");
    delete process.env.OPENCODE_SUBAGENT_STATUSLINE_SYMBOL_MODE;
  });
});
