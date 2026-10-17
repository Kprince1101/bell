import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  deployFunctions,
  formatSecretsTable,
  manifestProblems,
  parseSecretNames,
  secretRows,
} from '@/lib/deploy/functions';
import type { CommandResult, RunSupabase } from '@/lib/deploy/functions';

const REPO_FUNCTIONS = fileURLToPath(
  new URL('../../../supabase/functions', import.meta.url),
);

const MANIFEST = {
  app: ['CRON_SECRET'],
  functions: {
    'bell-sync': ['GOOGLE_CLIENT_SECRET'],
    'bell-notify': ['TWILIO_AUTH_TOKEN', 'PUSHOVER_APP_TOKEN'],
  },
};

const fixture = async (
  folders: string[],
  manifest: unknown = MANIFEST,
): Promise<string> => {
  const dir = await mkdtemp(join(tmpdir(), 'bell-functions-'));
  await Promise.all(
    folders.map(async (name) => {
      await mkdir(join(dir, name));
      await writeFile(join(dir, name, 'index.ts'), 'export {};');
    }),
  );
  await writeFile(join(dir, 'secrets.json'), JSON.stringify(manifest));
  return dir;
};

const fakeRun = (
  secrets: string,
  overrides: Record<string, CommandResult> = {},
) =>
  vi.fn<RunSupabase>((args) => {
    if (args[0] === 'secrets') return { status: 0, stdout: secrets };
    return overrides[args[2]] ?? { status: 0, stdout: '' };
  });

const SET_SECRETS = JSON.stringify([
  { name: 'GOOGLE_CLIENT_SECRET', value: 'digest-1' },
  { name: 'TWILIO_AUTH_TOKEN', value: 'digest-2' },
  { name: 'PUSHOVER_APP_TOKEN', value: 'digest-3' },
]);

describe('manifestProblems', () => {
  it('names a function folder with no manifest entry and an entry with no folder', () => {
    expect(manifestProblems(['bell-sync', 'bell-extra'], MANIFEST)).toEqual([
      'bell-extra has no entry in secrets.json.',
      'secrets.json lists bell-notify, which has no folder.',
    ]);
  });
});

describe('parseSecretNames', () => {
  it('keeps only names from the CLI listing', () => {
    expect(parseSecretNames(SET_SECRETS)).toEqual([
      'GOOGLE_CLIENT_SECRET',
      'TWILIO_AUTH_TOKEN',
      'PUSHOVER_APP_TOKEN',
    ]);
  });

  it('gives up on output that is not a JSON listing', () => {
    expect(parseSecretNames('You need to be logged in')).toBeNull();
    expect(parseSecretNames('{"name":"X"}')).toBeNull();
  });
});

describe('secretRows and formatSecretsTable', () => {
  it('marks each secret set, missing or unknown and lines the columns up', () => {
    const rows = secretRows(MANIFEST, ['TWILIO_AUTH_TOKEN']);

    expect(rows).toEqual([
      { fn: 'bell-notify', name: 'TWILIO_AUTH_TOKEN', status: 'set' },
      { fn: 'bell-notify', name: 'PUSHOVER_APP_TOKEN', status: 'MISSING' },
      { fn: 'bell-sync', name: 'GOOGLE_CLIENT_SECRET', status: 'MISSING' },
    ]);
    expect(secretRows(MANIFEST, null).map((row) => row.status)).toEqual([
      'unknown',
      'unknown',
      'unknown',
    ]);
    expect(formatSecretsTable(rows)).toEqual([
      'FUNCTION     SECRET                STATUS',
      'bell-notify  TWILIO_AUTH_TOKEN     set',
      'bell-notify  PUSHOVER_APP_TOKEN    MISSING',
      'bell-sync    GOOGLE_CLIENT_SECRET  MISSING',
    ]);
  });
});

describe('deployFunctions', () => {
  it('deploys every bell-* folder to the given project and passes when every secret is set', async () => {
    const dir = await fixture(['bell-sync', 'bell-notify', '_shared']);
    const run = fakeRun(SET_SECRETS);
    const log = vi.fn();

    const code = await deployFunctions(dir, 'ref123', { run, log });

    expect(code).toBe(0);
    expect(run.mock.calls).toEqual([
      [
        ['functions', 'deploy', 'bell-notify', '--project-ref', 'ref123'],
        'stream',
      ],
      [
        ['functions', 'deploy', 'bell-sync', '--project-ref', 'ref123'],
        'stream',
      ],
      [
        ['secrets', 'list', '--project-ref', 'ref123', '--output', 'json'],
        'capture',
      ],
    ]);
    expect(log).toHaveBeenCalledWith(
      'Deployed 2 function(s): bell-notify, bell-sync.',
    );
    expect(log.mock.calls.flat().join('\n')).not.toContain('digest');
  });

  it('fails after deploying when a secret is missing, and says how to set it', async () => {
    const dir = await fixture(['bell-sync', 'bell-notify']);
    const log = vi.fn();

    const code = await deployFunctions(dir, 'ref123', {
      run: fakeRun(JSON.stringify([{ name: 'TWILIO_AUTH_TOKEN' }])),
      log,
    });

    expect(code).toBe(1);
    expect(log).toHaveBeenCalledWith(
      '2 secret(s) missing. Set each with: supabase secrets set --project-ref ref123 NAME=value',
    );
  });

  it('fails when the secrets cannot be listed', async () => {
    const dir = await fixture(['bell-sync', 'bell-notify']);
    const log = vi.fn();

    const code = await deployFunctions(dir, 'ref123', {
      run: fakeRun('not json'),
      log,
    });

    expect(code).toBe(1);
    expect(log).toHaveBeenCalledWith(
      'Could not read the project secrets. Run `supabase login` and retry.',
    );
  });

  it('stops at the first failed deploy', async () => {
    const dir = await fixture(['bell-sync', 'bell-notify']);
    const run = fakeRun(SET_SECRETS, {
      'bell-notify': { status: 2, stdout: '' },
    });
    const log = vi.fn();

    const code = await deployFunctions(dir, 'ref123', { run, log });

    expect(code).toBe(1);
    expect(run).toHaveBeenCalledTimes(1);
    expect(log).toHaveBeenCalledWith('Deploying bell-notify failed (exit 2).');
  });

  it('refuses to deploy when the manifest and the folders disagree', async () => {
    const dir = await fixture(['bell-sync']);
    const run = fakeRun(SET_SECRETS);
    const log = vi.fn();

    expect(await deployFunctions(dir, 'ref123', { run, log })).toBe(1);
    expect(run).not.toHaveBeenCalled();
  });

  it('the repo manifest matches the repo functions', async () => {
    const run = fakeRun(SET_SECRETS);
    const log = vi.fn();

    expect(await deployFunctions(REPO_FUNCTIONS, 'ref123', { run, log })).toBe(
      0,
    );
    expect(log).toHaveBeenCalledWith(
      expect.stringContaining('PUSHOVER_APP_TOKEN, TWILIO_ACCOUNT_SID'),
    );
  });
});
