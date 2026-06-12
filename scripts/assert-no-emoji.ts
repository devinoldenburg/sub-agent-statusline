import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { argv, exit } from "node:process";

const roots = argv.slice(2);
const targets = roots.length > 0 ? roots : ["README.md", "docs", "src"];
const emojiPattern = /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}]/u;
const allowedFiles = new Set([join("src", "symbols.ts")]);

function walk(path: string): string[] {
  const stat = statSync(path);
  if (stat.isDirectory()) {
    return readdirSync(path).flatMap((entry) => walk(join(path, entry)));
  }
  return [path];
}

const failures: string[] = [];
for (const target of targets.flatMap(walk)) {
  if (allowedFiles.has(target)) continue;
  let content: string;
  try {
    content = readFileSync(target, "utf8");
  } catch {
    continue;
  }
  if (emojiPattern.test(content)) failures.push(target);
}

if (failures.length > 0) {
  console.error(`Emoji or decorative symbol guard failed:\n${failures.join("\n")}`);
  exit(1);
}
