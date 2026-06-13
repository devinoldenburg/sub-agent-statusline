import { describe, expect, it, vi } from "vitest";
import { readFile } from "node:fs/promises";
import {
  createRuntimeHarness,
  readRuntimeState,
} from "../test/helpers/runtime-harness.js";
import type { StatuslineState } from "./state.js";

vi.mock("@opentui/solid", () => {
  const element = (type: string, props: Record<string, unknown> = {}) => ({
    type,
    props,
  });
  return {
    useKeyboard: vi.fn(),
    createElement: element,
    jsx: element,
    jsxs: element,
    jsxDEV: element,
    createTextNode: (value: unknown) => String(value),
    createComponent: (component: (...args: unknown[]) => unknown, props: unknown) =>
      component(props),
    insert: vi.fn(),
    insertNode: vi.fn(),
    setProp: vi.fn(),
    effect: (fn: () => void) => fn(),
    memo: (fn: () => unknown) => fn,
    use: vi.fn(),
  };
});

vi.mock("@opentui/solid/jsx-dev-runtime", () => {
  const element = (type: string | ((props: unknown) => unknown), props: Record<string, unknown> = {}) =>
    typeof type === "function" ? type(props) : { type, props };
  return { jsx: element, jsxs: element, jsxDEV: element };
});

function createTheme() {
  return {
    current: {
      accent: "accent",
      backgroundElement: "backgroundElement",
      backgroundPanel: "backgroundPanel",
      error: "error",
      success: "success",
      text: "text",
      textMuted: "textMuted",
      warning: "warning",
    },
  };
}

function createMockApi() {
  const eventDisposers = new Map<string, ReturnType<typeof vi.fn>>();
  const eventHandlers = new Map<string, (event: unknown) => void>();
  const lifecycleCallbacks: Array<() => void> = [];
  const registeredSlots: Array<Record<string, unknown>> = [];

  const api = {
    command: { register: vi.fn(() => vi.fn()) },
    keymap: { registerLayer: vi.fn(() => vi.fn()) },
    route: {
      current: { name: "session", params: { sessionID: "ses_parent" } },
      navigate: vi.fn(),
    },
    kv: {
      get: vi.fn((_key: string, fallback: unknown) => fallback),
      set: vi.fn(),
    },
    ui: {
      Prompt: vi.fn((props: Record<string, unknown>) => ({ type: "Prompt", props })),
      Slot: vi.fn((props: Record<string, unknown>) => ({ type: "Slot", props })),
      toast: vi.fn(),
      dialog: { clear: vi.fn() },
    },
    state: {
      path: { directory: "/tmp/opencode-test" },
      session: {
        status: vi.fn(),
        messages: vi.fn(() => []),
      },
      part: vi.fn(() => []),
    },
    client: {
      session: {
        children: vi.fn(async () => ({ data: [] })),
        messages: vi.fn(async () => ({ data: [] })),
        status: vi.fn(async () => ({ data: {} })),
      },
    },
    event: {
      on: vi.fn((eventName: string, handler: (event: unknown) => void) => {
        const dispose = vi.fn();
        eventDisposers.set(eventName, dispose);
        eventHandlers.set(eventName, handler);
        return dispose;
      }),
    },
    slots: {
      register: vi.fn((plugin: Record<string, unknown>) => {
        registeredSlots.push(plugin);
        return "slot-registration-id";
      }),
    },
    lifecycle: {
      signal: new AbortController().signal,
      onDispose: vi.fn((callback: () => void) => {
        lifecycleCallbacks.push(callback);
        return vi.fn();
      }),
    },
  };

  return { api, eventDisposers, eventHandlers, lifecycleCallbacks, registeredSlots };
}

describe("TUI plugin contract", () => {
  it("registers events, slots, commands, and lifecycle cleanup exactly once", async () => {
    const { default: plugin } = await import("./tui.js");
    const { api, eventDisposers, lifecycleCallbacks, registeredSlots } =
      createMockApi();

    await plugin.tui(api as never, undefined, {} as never);

    expect(api.keymap.registerLayer).toHaveBeenCalledOnce();
    expect(api.command.register).toHaveBeenCalledOnce();
    expect(api.event.on).toHaveBeenCalledTimes(7);
    expect([...eventDisposers.keys()]).toEqual([
      "session.created",
      "session.updated",
      "session.status",
      "session.idle",
      "session.error",
      "message.updated",
      "message.part.updated",
    ]);
    expect(api.slots.register).toHaveBeenCalledOnce();
    expect(registeredSlots[0]?.slots).toEqual(
      expect.objectContaining({
        sidebar_content: expect.any(Function),
        home_bottom: expect.any(Function),
        home_prompt: expect.any(Function),
        session_prompt: expect.any(Function),
      }),
    );
    expect(api.lifecycle.onDispose).toHaveBeenCalledOnce();

    lifecycleCallbacks[0]?.();

    for (const dispose of eventDisposers.values()) {
      expect(dispose).toHaveBeenCalledOnce();
    }
  });

  it("forwards prompt props across OpenCode naming variants", async () => {
    const { default: plugin } = await import("./tui.js");
    const { api, registeredSlots } = createMockApi();
    await plugin.tui(api as never, undefined, {} as never);
    const slots = registeredSlots[0]?.slots as Record<
      string,
      (ctx: unknown, props: Record<string, unknown>) => unknown
    >;

    const homeRef = vi.fn();
    slots.home_prompt({ theme: createTheme() }, { workspace_id: "ws_1", ref: homeRef });
    expect(api.ui.Prompt).toHaveBeenLastCalledWith(
      expect.objectContaining({ workspaceID: "ws_1", ref: expect.any(Function) }),
    );

    const onSubmit = vi.fn();
    slots.session_prompt(
      { theme: createTheme() },
      { session_id: "ses_child", on_submit: onSubmit },
    );
    expect(api.ui.Prompt).toHaveBeenLastCalledWith(
      expect.objectContaining({
        sessionID: "ses_child",
        onSubmit,
        right: expect.objectContaining({ type: "Slot" }),
      }),
    );
    expect(api.ui.Slot).toHaveBeenLastCalledWith(
      expect.objectContaining({ name: "session_prompt_right", session_id: "ses_child" }),
    );
  });

  it("uses safe defaults for missing optional compatibility APIs", async () => {
    const { default: plugin } = await import("./tui.js");
    const { api } = createMockApi();
    delete (api as { command?: unknown }).command;
    delete (api as { kv?: unknown }).kv;
    delete (api.ui as { toast?: unknown }).toast;
    delete (api.ui as { dialog?: unknown }).dialog;

    await expect(plugin.tui(api as never, undefined, {} as never)).resolves.toBeUndefined();
    expect(api.slots.register).toHaveBeenCalledOnce();
    expect(api.event.on).toHaveBeenCalledTimes(7);
  });

  it("applies captured OpenCode events and persists status text", async () => {
    const harness = await createRuntimeHarness();
    vi.resetModules();
    const { default: plugin } = await import("./tui.js");
    const { api, eventHandlers, lifecycleCallbacks } = createMockApi();
    await plugin.tui(api as never, undefined, {} as never);

    eventHandlers.get("session.created")?.({
      type: "session.created",
      properties: {
        info: {
          id: "ses_child_precise",
          parentID: "ses_parent",
          title: "Precise child",
        },
      },
    });

    for (let attempt = 0; attempt < 20; attempt += 1) {
      let state: StatuslineState;
      try {
        state = await readRuntimeState<StatuslineState>(harness.statePath);
      } catch {
        await new Promise((resolve) => setTimeout(resolve, 10));
        continue;
      }
      if (state.children.ses_child_precise) {
        expect(state.children.ses_child_precise).toMatchObject({
          parentID: "ses_parent",
          title: "Precise child",
          status: "running",
        });
        for (let textAttempt = 0; textAttempt < 20; textAttempt += 1) {
          try {
            expect(await readFile(harness.textPath, "utf8")).toContain(
              "Precise child",
            );
            lifecycleCallbacks[0]?.();
            return;
          } catch {
            await new Promise((resolve) => setTimeout(resolve, 10));
          }
        }
        lifecycleCallbacks[0]?.();
        throw new Error("status text was not persisted");
      }
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
    lifecycleCallbacks[0]?.();
    throw new Error("session.created event was not persisted");
  });

  it("cleans interval timers and subscriptions on lifecycle dispose", async () => {
    vi.useFakeTimers();
    const { default: plugin } = await import("./tui.js");
    const { api, eventDisposers, lifecycleCallbacks } = createMockApi();
    await plugin.tui(api as never, undefined, {} as never);

    expect(vi.getTimerCount()).toBeGreaterThan(0);
    lifecycleCallbacks[0]?.();
    expect(vi.getTimerCount()).toBe(0);
    for (const dispose of eventDisposers.values()) {
      expect(dispose).toHaveBeenCalledOnce();
    }
  });

  it("keeps degraded health rows out of execution counters", async () => {
    vi.resetModules();
    const { upsertTuiHealth } = await import("./tui.js");
    const { createEmptyState } = await import("./state.js");
    const state = createEmptyState();

    expect(
      upsertTuiHealth(
        state,
        "degraded",
        "OpenCode session data is incomplete.",
      ),
    ).toBe(true);

    expect(state.children["subagent-statusline:tui-health"]).toMatchObject({
      title: "OpenCode compatibility degraded",
      status: "error",
      parentID: "",
      source: "tool",
    });
    expect(state.totalExecuted).toBe(0);
    expect(state.countedChildIDs).toEqual({});

    expect(upsertTuiHealth(state, "ok", "recovered")).toBe(true);
    expect(state.children["subagent-statusline:tui-health"]).toBeUndefined();
  });
});
