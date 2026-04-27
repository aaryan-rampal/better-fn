type DebugData = Record<string, unknown>;

const DEBUG_KEY = "better-fn.debugPopover";

export const isDebugEnabled = (): boolean =>
  globalThis.localStorage?.getItem(DEBUG_KEY) === "true";

export const logDebugStatus = (): void => {
  console.log("[better-fn:popover]", "debug status", {
    enabled: isDebugEnabled(),
    localStorageValue: globalThis.localStorage?.getItem(DEBUG_KEY),
  });
};

export const summarizeElement = (target: EventTarget | null): DebugData => {
  if (!(target instanceof Element)) return { targetType: typeof target };

  return {
    tag: target.tagName.toLowerCase(),
    id: target.id || undefined,
    className: target.className || undefined,
    text: target.textContent?.slice(0, 80),
  };
};

export const countPopoverRoots = (): DebugData => ({
  hoverPopovers: document.querySelectorAll(".popover.hover-popover").length,
  betterFnHoverPopovers: document.querySelectorAll(
    ".popover.hover-popover.bn-hover-popover",
  ).length,
  tippyRoots: document.querySelectorAll("[data-tippy-root]").length,
  tippyBoxes: document.querySelectorAll(".tippy-box").length,
});

export const debugPopover = (event: string, data: DebugData = {}): void => {
  if (!isDebugEnabled()) return;

  console.log("[better-fn:popover]", event, {
    atMs: Math.round(performance.now() * 10) / 10,
    ...countPopoverRoots(),
    ...data,
  });
};
