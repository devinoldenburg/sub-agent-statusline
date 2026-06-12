import { describe, expect, it } from "vitest";
import packageJson from "../package.json" with { type: "json" };

describe("package metadata", () => {
  it("uses independent repository metadata and expected exports", () => {
    expect(packageJson.version).toBe("0.8.0");
    expect(packageJson.repository.url).toBe(
      "https://github.com/devinoldenburg/sub-agent-statusline",
    );
    expect(packageJson.exports).toMatchObject({
      ".": { import: "./dist/tui.js" },
      "./tui": { import: "./dist/tui.js" },
      "./runtime": { import: "./dist/index.js" },
    });
  });
});
