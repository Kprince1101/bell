import { spawnSync } from 'node:child_process';
import { chmod, mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT = fileURLToPath(
  new URL('../deploy-functions.mts', import.meta.url),
);

const STUB_CLI = `#!${process.execPath}
const fs = require('node:fs');
const args = process.argv.slice(2);
fs.appendFileSync(process.env.STUB_LOG, JSON.stringify(args) + '\\n');
if (args[0] === 'secrets') process.stdout.write(process.env.STUB_SECRETS);
if (args[0] === 'functions' && process.env.STUB_FAIL === args[2]) process.exit(3);
`;

const SECRETS_SET = JSON.stringify([
  { name: 'TWILIO_AUTH_TOKEN', value: 'digest-of-the-twilio-token' },
  { name: 'PUSHOVER_APP_TOKEN', value: 'digest-of-the-pushover-token' },
]);

interface StubRun {
  status: number | null;
  stdout: string;
  stderr: string;
  calls: string[][];
}

const project = async (
  folders: string[],
  functions: Record<string, string[]>,
): Promise<{ root: string; bin: string; log: string }> => {
  const root = await mkdtemp(join(tmpdir(), 'bell-deploy-'));
  const functionsDir = join(root, 'supabase', 'functions');
  const bin = join(root, 'bin');
  await mkdir(functionsDir, { recursive: true });
  await mkdir(bin);
  await Promise.all(
    folders.map(async (name) => {
      await mkdir(join(functionsDir, name));
      await writeFile(join(functionsDir, name, 'index.ts'), 'export {};');
    }),
  );
  await writeFile(
    join(functionsDir, 'secrets.json'),
    JSON.stringify({ app: ['CRON_SECRET'], functions }),
  );
  await writeFile(join(bin, 'supabase'), STUB_CLI);
  await chmod(join(bin, 'supabase'), 0o755);
  const log = join(root, 'calls.log');
  await writeFile(log, '');
  return { root, bin, log };
};

const runScript = async (
  { root, bin, log }: { root: string; bin: string; log: string },
  env: Record<string, string>,
): Promise<StubRun> => {
  const result = spawnSync(process.execPath, [SCRIPT], {
    cwd: root,
    encoding: 'utf8',
    env: {
      ...process.env,
      SUPABASE_PROJECT_REF: '',
      PATH: `${bin}${delimiter}${process.env.PATH ?? ''}`,
      STUB_LOG: log,
      STUB_SECRETS: SECRETS_SET,
      ...env,
    },
  });
  const calls = (await readFile(log, 'utf8'))
    .split('\n')
    .filter(Boolean)
    .map((line) => JSON.parse(line) as string[]);
  return {
    status: result.status,
    stdout: result.stdout,
    stderr: result.stderr,
    calls,
  };
};

const NOTIFY_ONLY = {
  'bell-notify': ['TWILIO_AUTH_TOKEN', 'PUSHOVER_APP_TOKEN'],
};

describe('npm run deploy:functions against a stubbed supabase CLI', () => {
  it('deploys each bell-* function to SUPABASE_PROJECT_REF and prints the secrets table without values', async () => {
    const setup = await project(['bell-notify', 'bell-sync', 'other'], {
      ...NOTIFY_ONLY,
      'bell-sync': ['GOOGLE_CLIENT_SECRET'],
    });

    const run = await runScript(setup, { SUPABASE_PROJECT_REF: 'stubref' });

    expect(run.calls).toEqual([
      ['functions', 'deploy', 'bell-notify', '--project-ref', 'stubref'],
      ['functions', 'deploy', 'bell-sync', '--project-ref', 'stubref'],
      ['secrets', 'list', '--project-ref', 'stubref', '--output', 'json'],
    ]);
    expect(run.stdout).toContain('bell-notify  TWILIO_AUTH_TOKEN     set');
    expect(run.stdout).toContain('bell-notify  PUSHOVER_APP_TOKEN    set');
    expect(run.stdout).toContain('bell-sync    GOOGLE_CLIENT_SECRET  MISSING');
    expect(run.stdout).not.toContain('digest');
    expect(run.status).toBe(1);
  }, 30_000);

  it('exits 0 when everything deployed and every secret is set', async () => {
    const setup = await project(['bell-notify'], NOTIFY_ONLY);

    const run = await runScript(setup, { SUPABASE_PROJECT_REF: 'stubref' });

    expect(run.status).toBe(0);
    expect(run.stdout).toContain('Deployed 1 function(s): bell-notify.');
  }, 30_000);

  it('stops when a deploy fails', async () => {
    const setup = await project(['bell-notify', 'bell-sync'], {
      ...NOTIFY_ONLY,
      'bell-sync': [],
    });

    const run = await runScript(setup, {
      SUPABASE_PROJECT_REF: 'stubref',
      STUB_FAIL: 'bell-notify',
    });

    expect(run.status).toBe(1);
    expect(run.calls).toHaveLength(1);
    expect(run.stdout).toContain('Deploying bell-notify failed (exit 3).');
  }, 30_000);

  it('refuses to run without SUPABASE_PROJECT_REF and never calls the CLI', async () => {
    const setup = await project(['bell-notify'], NOTIFY_ONLY);

    const run = await runScript(setup, {});

    expect(run.status).toBe(1);
    expect(run.stderr).toContain('SUPABASE_PROJECT_REF is not set.');
    expect(run.calls).toEqual([]);
  }, 30_000);
});
