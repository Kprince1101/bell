import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { defineLegionConfig, recommendedInput } from 'legion-toolkit/rules';

const root = resolve(import.meta.dirname, '..');
const target = resolve(root, '.oxlintrc.json');
const checkOnly = process.argv.includes('--check');

const legion = defineLegionConfig({
  rules: {
    ...recommendedInput.rules,
    'no-narrative-comments': 3,
    'scoped-disables': 3,
    'no-disables': 3,
    'no-react-fc': 3,
    'no-enum': 3,
    'no-function-keyword': 3,
    'no-client-globals-in-state-init': 3,
    'no-use-client-in-page': 3,
    'guarded-context-hook': 3,
    'presentational-components': 3,
    'no-literal-conditions-in-jsx': 3,
    'no-admin-client-in-browser': 3,
  },
  noTernary: 3,
  noExplicitAny: 3,
  anyBoundaries: ['lib/supabase/**', '**/*.d.ts'],
});

const config = {
  $schema: './node_modules/oxlint/configuration_schema.json',
  ...legion.oxlint,
  plugins: ['react', 'unicorn', 'oxc', 'typescript'],
  rules: {
    ...legion.oxlint.rules,
    'react/button-has-type': 'error',
  },
  jsPlugins: ['legion-toolkit/eslint-plugin'],
  ignorePatterns: [
    'node_modules/**',
    '.next/**',
    'out/**',
    'build/**',
    'coverage/**',
    'public/**',
    'next-env.d.ts',
    '**/*.d.ts',
  ],
};

const next = `${JSON.stringify(config, null, 2)}\n`;
let current = '';
try {
  current = readFileSync(target, 'utf8');
} catch {
  current = '';
}

if (checkOnly) {
  if (current !== next) {
    console.error(
      '.oxlintrc.json is out of date; run `npm run sync:oxlintrc`.',
    );
    process.exit(1);
  }
  console.log('.oxlintrc.json is in sync with scripts/sync-oxlintrc.mts');
  process.exit(0);
}

writeFileSync(target, next);
console.log('.oxlintrc.json written');
