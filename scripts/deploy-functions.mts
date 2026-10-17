import { spawnSync } from 'node:child_process';
import type { StdioOptions } from 'node:child_process';
import { join } from 'node:path';
import { deployFunctions } from '../lib/deploy/functions.ts';
import type { CommandMode } from '../lib/deploy/functions.ts';

const STDIO: Record<CommandMode, StdioOptions> = {
  stream: 'inherit',
  capture: ['ignore', 'pipe', 'inherit'],
};

const ref = process.env.SUPABASE_PROJECT_REF;

if (!ref) {
  console.error('SUPABASE_PROJECT_REF is not set.');
  process.exit(1);
}

process.exitCode = await deployFunctions(
  join(process.cwd(), 'supabase', 'functions'),
  ref,
  {
    run: (args, mode) => {
      const result = spawnSync('supabase', args, {
        stdio: STDIO[mode],
        encoding: 'utf8',
      });
      if (result.error) console.error(result.error.message);
      return { status: result.status, stdout: result.stdout ?? '' };
    },
    log: console.log,
  },
);
