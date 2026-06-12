import { describe, expect, it } from "vitest";
import { parseBoolean, parseSymbolMode, resolveConfig } from "./config.js";
import { getSymbols } from "./symbols.js";

describe("config", () => {
  it("defaults to ASCII symbols and color enabled", () => {
    expect(resolveConfig({}).symbolMode).toBe("ascii");
    expect(resolveConfig({}).color).toBe(true);
    expect(getSymbols().branch).toBe("->");
  });

  it("allows Unicode mode only by explicit opt-in", () => {
    expect(
      resolveConfig({ OPENCODE_SUBAGENT_STATUSLINE_SYMBOL_MODE: "unicode" })
        .symbolMode,
    ).toBe("unicode");
    expect(parseSymbolMode("invalid")).toBe("ascii");
  });

  it("parses boolean config safely", () => {
    expect(parseBoolean("0", true)).toBe(false);
    expect(parseBoolean("false", true)).toBe(false);
    expect(parseBoolean("yes", false)).toBe(true);
    expect(parseBoolean("unexpected", true)).toBe(true);
    expect(resolveConfig({ NO_COLOR: "1" }).color).toBe(false);
  });
});
