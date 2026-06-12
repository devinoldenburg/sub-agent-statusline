import { resolveConfig, type SymbolMode } from "./config.js";

export interface UiSymbols {
  branch: string;
  separator: string;
  total: string;
  expanded: string;
  collapsed: string;
  selected: string;
  ellipsis: string;
  clock: string;
  tokens: string;
  running: string;
  done: string;
  error: string;
}

const ASCII_SYMBOLS: UiSymbols = {
  branch: "->",
  separator: " | ",
  total: "total",
  expanded: "-",
  collapsed: "+",
  selected: ">",
  ellipsis: "...",
  clock: "time",
  tokens: "ctx",
  running: "[run]",
  done: "[ok]",
  error: "[err]",
};

const UNICODE_SYMBOLS: UiSymbols = {
  branch: "↳",
  separator: " · ",
  total: "Σ",
  expanded: "▼",
  collapsed: "▶",
  selected: "›",
  ellipsis: "…",
  clock: "time",
  tokens: "ctx",
  running: "●",
  done: "✓",
  error: "✕",
};

export function getSymbols(mode: SymbolMode = resolveConfig().symbolMode): UiSymbols {
  return mode === "unicode" ? UNICODE_SYMBOLS : ASCII_SYMBOLS;
}

export function currentSymbols(): UiSymbols {
  return getSymbols(resolveConfig().symbolMode);
}
