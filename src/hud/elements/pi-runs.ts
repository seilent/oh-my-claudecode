import type { HudLabels } from '../types.js';
import type { PiRun } from '../pi-runs.js';
import { RESET } from '../colors.js';

const GREEN = '\x1b[32m';
const DIM = '\x1b[2m';

const SECONDS_PER_MINUTE = 60;

function formatDuration(totalSeconds: number): string {
  if (totalSeconds < SECONDS_PER_MINUTE) {
    return `${totalSeconds}s`;
  }
  return `${Math.floor(totalSeconds / SECONDS_PER_MINUTE)}m`;
}

export function renderPiRuns(
  runs: PiRun[],
  labels: Pick<HudLabels, 'pi'>,
  now: number = Date.now(),
): string | null {
  if (runs.length === 0) {
    return null;
  }

  const oldestStart = runs.reduce(
    (oldest, run) => (run.start < oldest ? run.start : oldest),
    runs[0].start,
  );
  const elapsed = Math.max(0, Math.floor(now / 1000) - oldestStart);

  return `${labels.pi}:${GREEN}${runs.length}${RESET} ${DIM}${formatDuration(elapsed)}${RESET}`;
}
