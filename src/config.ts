export type SymbolMode = "ascii" | "unicode";

export interface SubagentStatuslineConfig {
  symbolMode: SymbolMode;
  color: boolean;
}

const TRUTHY = new Set(["1", "true", "yes", "on"]);
const FALSY = new Set(["0", "false", "no", "off"]);

export const DEFAULT_CONFIG: SubagentStatuslineConfig = {
  symbolMode: "ascii",
  color: true,
};

export function parseSymbolMode(value: unknown): SymbolMode {
  if (value === undefined || value === null || value === "") {
    return DEFAULT_CONFIG.symbolMode;
  }
  const normalized = String(value).trim().toLowerCase();
  if (normalized === "ascii" || normalized === "unicode") return normalized;
  return DEFAULT_CONFIG.symbolMode;
}

export function parseBoolean(value: unknown, fallback: boolean): boolean {
  if (value === undefined || value === null || value === "") return fallback;
  const normalized = String(value).trim().toLowerCase();
  if (TRUTHY.has(normalized)) return true;
  if (FALSY.has(normalized)) return false;
  return fallback;
}

export function resolveConfig(
  env: NodeJS.ProcessEnv = process.env,
): SubagentStatuslineConfig {
  return {
    symbolMode: parseSymbolMode(
      env.OPENCODE_SUBAGENT_STATUSLINE_SYMBOL_MODE,
    ),
    color:
      !env.NO_COLOR &&
      parseBoolean(env.OPENCODE_SUBAGENT_STATUSLINE_COLOR, DEFAULT_CONFIG.color),
  };
}
