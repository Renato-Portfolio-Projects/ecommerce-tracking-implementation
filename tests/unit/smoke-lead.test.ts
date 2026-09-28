import { execFile } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { startFakeUpstash, type FakeUpstash } from '../helpers/fake-upstash';

// scripts/smoke-lead.mjs is run by hand, against the real database, by the owner. These tests run it against the stand-in
// for Upstash's web interface, so its own logic is proved, and so is what it must never do: print a setting.

let fake: FakeUpstash;
beforeEach(async () => {
  fake = await startFakeUpstash('a-key-that-must-never-be-printed');
});
afterEach(async () => {
  await fake.close();
});

/**
 * Runs the script the way `npm run smoke:lead` does, with the settings it is given. It runs as a separate process that
 * this one does not wait on with its eyes shut: the stand-in for the database runs in this process, so this process
 * must be free to answer it while the script runs.
 */
function smoke(settings: Record<string, string | undefined>): Promise<{ status: number | null; output: string }> {
  const env: NodeJS.ProcessEnv = { ...process.env, KV_REST_API_URL: '', KV_REST_API_TOKEN: '' };
  for (const [name, value] of Object.entries(settings)) env[name] = value ?? '';
  return new Promise((resolve) => {
    execFile(
      process.execPath,
      ['scripts/smoke-lead.mjs'],
      { cwd: fileURLToPath(new URL('../../', import.meta.url)), env, encoding: 'utf8', timeout: 60000 },
      (error, stdout, stderr) => resolve({ status: error === null ? 0 : typeof error.code === 'number' ? error.code : null, output: `${stdout}${stderr}` }),
    );
  });
}

describe('scripts/smoke-lead.mjs', () => {
  it('keeps a demo lead, reads it back, checks both expiries, and deletes what it made, passing every check', async () => {
    const { status, output } = await smoke({ KV_REST_API_URL: fake.url, KV_REST_API_TOKEN: fake.token });
    expect(output).toContain('All good');
    expect(output).not.toContain('FAIL');
    expect(output.match(/PASS/g)).toHaveLength(7);
    expect(status).toBe(0);
    expect(fake.hashes.size).toBe(0);
    expect(fake.counters.size).toBe(0);
  });

  it('sends only what it should: one lead with its expiry, two counts of one counter, and the reads and deletes', async () => {
    await smoke({ KV_REST_API_URL: fake.url, KV_REST_API_TOKEN: fake.token });
    const names = fake.requests.flatMap((request) =>
      Array.isArray(request.body) && Array.isArray(request.body[0])
        ? (request.body as unknown[][]).map((command) => String(command[0]).toUpperCase())
        : [String((request.body as unknown[])[0]).toUpperCase()],
    );
    expect(names.filter((name) => name === 'HSET')).toHaveLength(1);
    expect(names.filter((name) => name === 'INCR')).toHaveLength(2);
    expect(new Set(names)).toEqual(new Set(['HSET', 'EXPIRE', 'INCR', 'HGETALL', 'TTL', 'DEL']));
  });

  it('never prints the database\'s address or its key, whether it passes or fails', async () => {
    const passing = await smoke({ KV_REST_API_URL: fake.url, KV_REST_API_TOKEN: fake.token });
    const failing = await smoke({ KV_REST_API_URL: fake.url, KV_REST_API_TOKEN: 'a-wrong-key-that-must-never-be-printed' });
    for (const { output } of [passing, failing]) {
      expect(output).not.toContain(fake.url);
      expect(output).not.toContain(fake.token);
      expect(output).not.toContain('a-wrong-key-that-must-never-be-printed');
      expect(output).not.toContain('127.0.0.1');
    }
  });

  it('fails on the expiry when the database does not keep it, the one thing the script is there to prove', async () => {
    const forgetful = await startFakeUpstash('a-key-that-must-never-be-printed', { forgetExpiry: true });
    try {
      const { status, output } = await smoke({ KV_REST_API_URL: forgetful.url, KV_REST_API_TOKEN: forgetful.token });
      expect(status).toBe(1);
      expect(output).toContain('FAIL  it expires by itself');
      expect(output).toContain('FAIL  the counter expires by itself');
    } finally {
      await forgetful.close();
    }
  });

  it('fails, saying so and what to check, when the key is wrong, and keeps nothing', async () => {
    const { status, output } = await smoke({ KV_REST_API_URL: fake.url, KV_REST_API_TOKEN: 'wrong' });
    expect(status).toBe(1);
    expect(output).toContain('FAIL');
    expect(output).toContain('Check the two settings');
    expect(fake.hashes.size).toBe(0);
  });

  it('is the script `npm run smoke:lead` runs, with the settings read from .env.local, which git does not keep', async () => {
    const root = new URL('../../', import.meta.url);
    const scripts = (JSON.parse(readFileSync(new URL('package.json', root), 'utf8')) as { scripts: Record<string, string> }).scripts;
    expect(scripts['smoke:lead']).toBe('node --env-file=.env.local scripts/smoke-lead.mjs');
    expect(readFileSync(new URL('.gitignore', root), 'utf8').split(/\r?\n/)).toEqual(expect.arrayContaining(['.env', '.env.*']));
  });

  it('says what to do, and does not try anything, when a setting is missing', async () => {
    for (const settings of [{}, { KV_REST_API_URL: fake.url }, { KV_REST_API_TOKEN: fake.token }]) {
      const { status, output } = await smoke(settings);
      expect(status, JSON.stringify(Object.keys(settings))).toBe(1);
      expect(output).toContain('.env.local');
    }
    expect(fake.requests).toEqual([]);
  });
});
