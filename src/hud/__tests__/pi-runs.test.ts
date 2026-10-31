import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { renderPiRuns } from '../elements/pi-runs.js';
import { readPiRuns } from '../pi-runs.js';

const LABELS = { pi: 'pi' };

function stripAnsi(value: string): string {
  return value.replace(/\x1b\[[0-9;]*[a-zA-Z]/g, '');
}

describe('renderPiRuns', () => {
  it('returns null when there are no runs', () => {
    expect(renderPiRuns([], LABELS, 1_700_000_000_000)).toBeNull();
  });

  it('renders the count and seconds for a short run', () => {
    const now = 1_700_000_000_000;
    const result = renderPiRuns(
      [{ id: 'run-1', start: 1_700_000_000 - 45 }],
      LABELS,
      now,
    );
    expect(result).not.toBeNull();
    expect(stripAnsi(result as string)).toBe('pi:1 45s');
  });

  it('uses the longest running run and floors minutes from 60s up', () => {
    const now = 1_700_000_000_000;
    const result = renderPiRuns(
      [
        { id: 'run-1', start: 1_700_000_000 - 30 },
        { id: 'run-2', start: 1_700_000_000 - 185 },
      ],
      LABELS,
      now,
    );
    expect(stripAnsi(result as string)).toBe('pi:2 3m');
  });

  it('renders the 60s boundary as whole minutes', () => {
    const now = 1_700_000_000_000;
    expect(
      stripAnsi(renderPiRuns([{ id: 'run-1', start: 1_700_000_000 - 60 }], LABELS, now) as string),
    ).toBe('pi:1 1m');
    expect(
      stripAnsi(renderPiRuns([{ id: 'run-1', start: 1_700_000_000 - 599 }], LABELS, now) as string),
    ).toBe('pi:1 9m');
  });

  it('applies green to the count and dim to the duration', () => {
    const result = renderPiRuns(
      [{ id: 'run-1', start: 1_700_000_000 - 45 }],
      LABELS,
      1_700_000_000_000,
    );
    expect(result).toBe('pi:\x1b[32m1\x1b[0m \x1b[2m45s\x1b[0m');
  });
});

describe('readPiRuns', () => {
  let stateDir: string;
  let previousStateDir: string | undefined;

  beforeEach(() => {
    previousStateDir = process.env.PI_RUN_STATE_DIR;
    stateDir = mkdtempSync(join(tmpdir(), 'pi-runs-'));
    process.env.PI_RUN_STATE_DIR = stateDir;
  });

  afterEach(() => {
    if (previousStateDir === undefined) {
      delete process.env.PI_RUN_STATE_DIR;
    } else {
      process.env.PI_RUN_STATE_DIR = previousStateDir;
    }
    rmSync(stateDir, { recursive: true, force: true });
  });

  function writeRun(id: string, overrides: Record<string, unknown> = {}): void {
    writeFileSync(
      join(stateDir, `${id}.json`),
      JSON.stringify({
        id,
        pid: process.pid,
        start: 1_700_000_000,
        state: 'running',
        session: 'session-1',
        cwd: '/tmp/work',
        model: 'test-model',
        task: 'test-task',
        ...overrides,
      }),
      'utf-8',
    );
  }

  it('returns running runs with an alive pid in the current session', () => {
    writeRun('run-1');

    expect(readPiRuns('session-1')).toEqual([
      { id: 'run-1', start: 1_700_000_000 },
    ]);
  });

  it('returns an empty list when the session id is null', () => {
    writeRun('run-1');

    expect(readPiRuns(null)).toEqual([]);
  });

  it('skips runs from another session', () => {
    writeRun('run-1', { session: 'session-2' });

    expect(readPiRuns('session-1')).toEqual([]);
  });

  it('skips runs that are not in the running state', () => {
    writeRun('run-1', { state: 'done' });
    writeRun('run-2', { state: 'failed' });

    expect(readPiRuns('session-1')).toEqual([]);
  });

  it('skips runs whose pid is no longer alive', () => {
    const finished = spawnSync(process.execPath, ['-e', '']);
    writeRun('run-1', { pid: finished.pid });

    expect(readPiRuns('session-1')).toEqual([]);
  });

  it('skips malformed and non-run files', () => {
    writeRun('run-1');
    writeFileSync(join(stateDir, 'broken.json'), '{not json', 'utf-8');
    writeFileSync(join(stateDir, 'array.json'), '[]', 'utf-8');
    writeFileSync(join(stateDir, 'ignored.txt'), 'not a run', 'utf-8');

    expect(readPiRuns('session-1')).toEqual([
      { id: 'run-1', start: 1_700_000_000 },
    ]);
  });

  it('returns an empty list when the state directory is missing', () => {
    process.env.PI_RUN_STATE_DIR = join(stateDir, 'missing');

    expect(readPiRuns('session-1')).toEqual([]);
  });
});
