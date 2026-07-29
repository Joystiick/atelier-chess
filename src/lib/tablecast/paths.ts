/** Host-friendly Tablecast / venue URLs for pair & open-table responses. */
export function tablecastHostPaths(code: string, opts?: {
  whiteToken?: string | null;
  blackToken?: string | null;
}) {
  const whiteToken = opts?.whiteToken;
  const blackToken = opts?.blackToken;
  return {
    tablecast: true as const,
    hostPath: `/game/${code}`,
    gamePath: `/game/${code}`,
    watchPath: `/watch/${code}`,
    broadcastPath: `/watch/${code}?overlay=1`,
    overlayPath: `/watch/${code}?overlay=1`,
    watchOverlayPath: `/watch/${code}?overlay=1`,
    whiteSeatPath:
      whiteToken != null
        ? `/seat/${code}?c=w&t=${whiteToken}`
        : `/seat/${code}?c=w`,
    blackSeatPath:
      blackToken != null
        ? `/seat/${code}?c=b&t=${blackToken}`
        : `/seat/${code}?c=b`,
  };
}
