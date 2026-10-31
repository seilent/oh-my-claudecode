import { readFileSync, readdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

export interface PiRun {
  id: string;
  start: number;
}

interface PiRunFile {
  id: string;
  pid: number;
  start: number;
  state: string;
  session: string;
}

function resolveStateDir(): string {
  return process.env.PI_RUN_STATE_DIR || join(homedir(), '.local', 'state', 'pi-run');
}

function readRunFile(path: string): PiRunFile | null {
  try {
    const parsed: unknown = JSON.parse(readFileSync(path, 'utf-8'));
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return null;
    }

    const record = parsed as Record<string, unknown>;
    const { id, pid, start, state, session } = record;

    if (typeof id !== 'string' || id.length === 0) return null;
    if (typeof pid !== 'number' || !Number.isInteger(pid) || pid <= 0) return null;
    if (typeof start !== 'number' || !Number.isFinite(start)) return null;
    if (typeof state !== 'string') return null;
    if (typeof session !== 'string') return null;

    return { id, pid, start, state, session };
  } catch {
    return null;
  }
}

function isAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

export function readPiRuns(sessionId: string | null): PiRun[] {
  if (!sessionId) return [];

  const stateDir = resolveStateDir();
  let entries: string[];
  try {
    entries = readdirSync(stateDir);
  } catch {
    return [];
  }

  const runs: PiRun[] = [];
  for (const entry of entries) {
    if (!entry.endsWith('.json')) continue;

    const run = readRunFile(join(stateDir, entry));
    if (!run) continue;
    if (run.state !== 'running') continue;
    if (run.session !== sessionId) continue;
    if (!isAlive(run.pid)) continue;

    runs.push({ id: run.id, start: run.start });
  }

  return runs;
}
