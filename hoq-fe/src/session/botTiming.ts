/** One shared pause for consecutive bot decisions, until a human acts or the round ends. */
export function createBotTiming(now: () => number) {
  let readyAt: number | null = null;
  return {
    reset() { readyAt = null; },
    delay(turnMs: number | null) {
      readyAt ??= now() + 1000;
      return Math.min(Math.max(0, readyAt - now()), turnMs === null ? Infinity : turnMs * 0.6);
    },
  };
}
