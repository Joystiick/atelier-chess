/**
 * Interval that skips ticks while the document is hidden (Electron minimized /
 * background tab). Saves Netlify function compute + web requests.
 * Fires once immediately when becoming visible again.
 */
export function startVisibilityAwareInterval(
  fn: () => void,
  ms: number,
  options?: { runWhenHidden?: boolean },
): () => void {
  const runWhenHidden = options?.runWhenHidden === true;

  const tick = () => {
    if (runWhenHidden || document.visibilityState === "visible") {
      fn();
    }
  };

  const id = window.setInterval(tick, ms);
  const onVis = () => {
    if (document.visibilityState === "visible") fn();
  };
  document.addEventListener("visibilitychange", onVis);

  return () => {
    window.clearInterval(id);
    document.removeEventListener("visibilitychange", onVis);
  };
}
