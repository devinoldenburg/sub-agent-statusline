import { describe, expect, it } from "vitest";
import {
  sidebarAggregateTitle,
  sidebarAggregateSegments,
  sidebarRowContinuationIndent,
  sidebarRowPrefixWidth,
  sidebarStatusLabel,
  sidebarStatusMarker,
} from "./sidebar-symbols.js";
import { getSymbols } from "./symbols.js";

describe("sidebar symbols", () => {
  it("uses compact ASCII symbols instead of text labels by default", () => {
    const symbols = getSymbols("ascii");

    expect(sidebarStatusMarker("running", symbols)).toBe(">");
    expect(sidebarStatusMarker("done", symbols)).toBe("+");
    expect(sidebarStatusMarker("error", symbols)).toBe("!");
    expect(sidebarRowPrefixWidth(sidebarStatusMarker("running", symbols))).toBe(3);
    expect(sidebarRowContinuationIndent(sidebarStatusMarker("running", symbols))).toBe("   ");
    expect(
      sidebarAggregateSegments({ running: 1, done: 2, error: 3, total: 6 }, symbols),
    ).toEqual(["> 1", "+ 2", "! 3", "# 6"]);
  });

  it("uses opt-in Unicode symbols for sidebar status markers", () => {
    const symbols = getSymbols("unicode");

    expect(sidebarStatusMarker("running", symbols)).toBe("\u25cf");
    expect(sidebarStatusMarker("done", symbols)).toBe("\u2713");
    expect(sidebarStatusMarker("error", symbols)).toBe("!");
    expect(
      sidebarAggregateSegments({ running: 1, done: 2, error: 3, total: 6 }, symbols),
    ).toEqual(["\u25cf 1", "\u2713 2", "! 3", "\u03a3 6"]);
  });

  it("keeps readable labels for row titles and aggregate titles", () => {
    expect(sidebarStatusLabel("running")).toBe("Running");
    expect(sidebarStatusLabel("done")).toBe("Done");
    expect(sidebarStatusLabel("error")).toBe("Error");
    expect(
      sidebarAggregateTitle({ running: 1, done: 2, error: 3, total: 6 }),
    ).toBe("1 running, 2 done, 3 error, 6 total");
  });
});
