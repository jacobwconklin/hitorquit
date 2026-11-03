import type { Snapshot } from './types';

export function remainingTurnMs(snapshot: Pick<Snapshot, 'deadline' | 'countdownDeadline'>, monotonicNow = performance.now(), wallNow = Date.now()): number {
  if (snapshot.deadline === null) return 0;
  return Math.max(0, snapshot.countdownDeadline === undefined
    ? snapshot.deadline - wallNow
    : snapshot.countdownDeadline - monotonicNow);
}
