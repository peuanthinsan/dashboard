'use strict';
const { spawnSync } = require('node:child_process');
const SCHEMA_PATH = /^(migrations\/|drizzle\/|db\/|sql\/|scripts\/migrate|web\/scripts\/migrate|app\/db-schema\.ts)|\.sql$/;
function assertDeployableChange(git, source, previousSha, sha, run = spawnSync) {
  if (![previousSha, sha].every(value => typeof value === 'string' && /^[0-9a-f]{40}$/.test(value))) {
    throw new Error('Invalid deployment comparison revision');
  }
  function command(args) {
    const result = run(git, ['-c', 'core.fsmonitor=false', '-c', 'core.hooksPath=' + (process.platform === 'win32' ? 'NUL' : '/dev/null'),
      '-C', source, ...args], { encoding: 'utf8', windowsHide: true, timeout: 120000 });
    if (result.error || result.status !== 0) throw new Error('Deployment ancestry check failed; review repository history before retrying');
    return result.stdout || '';
  }
  command(['merge-base', '--is-ancestor', previousSha, sha]);
  const changed = command(['diff', '--no-ext-diff', '--no-textconv', '--ignore-submodules=all', '--name-only', previousSha, sha]);
  if (changed.split(/\r?\n/).some(filename => filename !== 'db/README.md' && SCHEMA_PATH.test(filename))) {
    throw new Error('Schema or migration files changed; review and apply migrations explicitly before retrying deployment');
  }
}
module.exports = { assertDeployableChange, SCHEMA_PATH };
