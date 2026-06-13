import type { UiSymbols } from "./symbols.js";
import type { ChildSessionState } from "./state.js";

export function sidebarStatusMarker(
  status: ChildSessionState["status"],
  symbols: UiSymbols,
): string {
  if (status === "done") return symbols.sidebarDone;
  if (status === "error") return symbols.sidebarError;
  return symbols.sidebarRunning;
}

export function sidebarStatusLabel(status: ChildSessionState["status"]): string {
  if (status === "done") return "Done";
  if (status === "error") return "Error";
  return "Running";
}

export function sidebarRowPrefixWidth(marker: string): number {
  return 2 + marker.length;
}

export function sidebarRowContinuationIndent(marker: string): string {
  return " ".repeat(sidebarRowPrefixWidth(marker));
}

export function sidebarAggregateSegments(
  input: {
    running: number;
    done: number;
    error: number;
    total: number;
  },
  symbols: UiSymbols,
): [string, string, string, string] {
  return [
    `${symbols.sidebarRunning} ${input.running}`,
    `${symbols.sidebarDone} ${input.done}`,
    `${symbols.sidebarError} ${input.error}`,
    `${symbols.sidebarTotal} ${input.total}`,
  ];
}

export function sidebarAggregateTitle(input: {
  running: number;
  done: number;
  error: number;
  total: number;
}): string {
  return `${input.running} running, ${input.done} done, ${input.error} error, ${input.total} total`;
}
