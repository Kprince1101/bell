import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { z } from 'zod';

export const FUNCTION_PREFIX = 'bell-';

export const SECRETS_MANIFEST = 'secrets.json';

const secretName = z.string().regex(/^[A-Z][A-Z0-9_]*$/);

export const secretsManifestSchema = z.object({
  app: z.array(secretName),
  functions: z.record(
    z.string().regex(/^bell-[a-z0-9-]+$/),
    z.array(secretName),
  ),
});

export type SecretsManifest = z.infer<typeof secretsManifestSchema>;

export type CommandMode = 'stream' | 'capture';

export interface CommandResult {
  status: number | null;
  stdout: string;
}

export type RunSupabase = (args: string[], mode: CommandMode) => CommandResult;

export interface DeployDeps {
  run: RunSupabase;
  log: (line: string) => void;
}

export type SecretStatus = 'set' | 'MISSING' | 'unknown';

export interface SecretRow {
  fn: string;
  name: string;
  status: SecretStatus;
}

const secretList = z.array(z.object({ name: z.string() }));

export const findFunctions = async (dir: string): Promise<string[]> => {
  const entries = await readdir(dir, { withFileTypes: true });
  return entries
    .filter(
      (entry) => entry.isDirectory() && entry.name.startsWith(FUNCTION_PREFIX),
    )
    .map((entry) => entry.name)
    .sort();
};

export const readManifest = async (dir: string): Promise<SecretsManifest> =>
  secretsManifestSchema.parse(
    JSON.parse(await readFile(join(dir, SECRETS_MANIFEST), 'utf8')),
  );

export const manifestProblems = (
  functions: string[],
  manifest: SecretsManifest,
): string[] => {
  const listed = Object.keys(manifest.functions);
  return [
    ...functions
      .filter((name) => !listed.includes(name))
      .map((name) => `${name} has no entry in ${SECRETS_MANIFEST}.`),
    ...listed
      .filter((name) => !functions.includes(name))
      .map((name) => `${SECRETS_MANIFEST} lists ${name}, which has no folder.`),
  ];
};

export const parseSecretNames = (stdout: string): string[] | null => {
  try {
    return secretList.parse(JSON.parse(stdout)).map((secret) => secret.name);
  } catch {
    return null;
  }
};

const secretStatus = (
  name: string,
  setNames: string[] | null,
): SecretStatus => {
  if (!setNames) return 'unknown';
  if (setNames.includes(name)) return 'set';
  return 'MISSING';
};

export const secretRows = (
  manifest: SecretsManifest,
  setNames: string[] | null,
): SecretRow[] =>
  Object.entries(manifest.functions)
    .sort(([a], [b]) => a.localeCompare(b))
    .flatMap(([fn, names]) =>
      names.map((name) => ({
        fn,
        name,
        status: secretStatus(name, setNames),
      })),
    );

const widest = (values: string[]): number =>
  Math.max(...values.map((value) => value.length));

export const formatSecretsTable = (rows: SecretRow[]): string[] => {
  const fnWidth = widest(['FUNCTION', ...rows.map((row) => row.fn)]);
  const nameWidth = widest(['SECRET', ...rows.map((row) => row.name)]);
  const line = (fn: string, name: string, status: string) =>
    `${fn.padEnd(fnWidth)}  ${name.padEnd(nameWidth)}  ${status}`;
  return [
    line('FUNCTION', 'SECRET', 'STATUS'),
    ...rows.map((row) => line(row.fn, row.name, row.status)),
  ];
};

const listSetSecrets = (run: RunSupabase, ref: string): string[] | null => {
  const listed = run(
    ['secrets', 'list', '--project-ref', ref, '--output', 'json'],
    'capture',
  );
  if (listed.status !== 0) return null;
  return parseSecretNames(listed.stdout);
};

const deployEach = (
  functions: string[],
  ref: string,
  { run, log }: DeployDeps,
): boolean =>
  functions.every((name) => {
    log(`Deploying ${name}...`);
    const result = run(
      ['functions', 'deploy', name, '--project-ref', ref],
      'stream',
    );
    if (result.status === 0) return true;
    log(`Deploying ${name} failed (exit ${result.status ?? 'none'}).`);
    return false;
  });

const appSecretsNote = (manifest: SecretsManifest): string =>
  `App secrets live in Vercel, not in Supabase, and Health shows whether each is set: ${manifest.app.join(', ')}.`;

const secretsVerdict = (
  rows: SecretRow[],
  ref: string,
  log: (line: string) => void,
): number => {
  const missing = rows.filter((row) => row.status === 'MISSING');
  if (rows.some((row) => row.status === 'unknown')) {
    log('Could not read the project secrets. Run `supabase login` and retry.');
    return 1;
  }
  if (missing.length) {
    log(
      `${missing.length} secret(s) missing. Set each with: supabase secrets set --project-ref ${ref} NAME=value`,
    );
    return 1;
  }
  return 0;
};

export const deployFunctions = async (
  dir: string,
  ref: string,
  deps: DeployDeps,
): Promise<number> => {
  const { run, log } = deps;
  const functions = await findFunctions(dir);
  const manifest = await readManifest(dir);
  const problems = manifestProblems(functions, manifest);
  if (problems.length) {
    problems.forEach((problem) => log(problem));
    return 1;
  }
  if (!functions.length) {
    log('No bell-* edge functions in supabase/functions: nothing to deploy.');
    log(appSecretsNote(manifest));
    return 0;
  }
  if (!deployEach(functions, ref, deps)) return 1;
  log(`Deployed ${functions.length} function(s): ${functions.join(', ')}.`);
  const rows = secretRows(manifest, listSetSecrets(run, ref));
  formatSecretsTable(rows).forEach((line) => log(line));
  log(appSecretsNote(manifest));
  return secretsVerdict(rows, ref, log);
};
