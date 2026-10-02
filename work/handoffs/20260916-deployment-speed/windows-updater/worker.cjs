'use strict';
// Installed outside the directory writable by NETWORK SERVICE.
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { performance } = require('node:perf_hooks');
const { assertDeployableChange } = require('./change-policy.cjs');
const base = __dirname;
const configuration = JSON.parse(fs.readFileSync(path.join(base, 'config.json'), 'utf8').replace(/^\uFEFF/, ''));
if (!path.isAbsolute(configuration.buildRoot || '')) throw new Error('An absolute buildRoot is required');
const buildBase = path.resolve(configuration.buildRoot);
fs.writeFileSync(path.join(buildBase, 'worker-start.json'), JSON.stringify({ at: new Date().toISOString(), node: process.version, identity: require('node:os').userInfo().username }));
const request = JSON.parse(fs.readFileSync(path.join(base, 'request.json'), 'utf8').replace(/^\uFEFF/, ''));
const names = { dashboard: 'dashboard', svis: 'svis', ops: 'ops-panel' };
if (!Object.hasOwn(names, request.app) || !/^[0-9a-f]{40}$/.test(request.sha) ||
    !/^\d{8}-\d{6}-[0-9a-f]{12}$/.test(request.id)) throw new Error('Invalid build request');
const buildRoot = path.join(buildBase, request.id);
const source = path.join(buildRoot, 'source');
const release = path.join(buildRoot, 'release');
if (fs.existsSync(buildRoot)) throw new Error('Build ID already exists');
fs.mkdirSync(buildRoot, { recursive: true });
const log = fs.openSync(path.join(buildRoot, 'build.log'), 'a');
const timings = [];
function timed(phase, operation) {
  const started = performance.now();
  try { return operation(); }
  finally {
    const entry = { phase, durationMs: Math.round(performance.now() - started) };
    timings.push(entry);
    fs.writeSync(log, '[deploy-timing] ' + JSON.stringify(entry) + '\n');
  }
}
function run(executable, args, cwd = buildRoot) {
  const result = spawnSync(executable, args, { cwd, windowsHide: true,
    env: { ...process.env, GIT_TERMINAL_PROMPT: '0', GCM_INTERACTIVE: 'Never' },
    stdio: ['ignore', log, log], timeout: 2400000 });
  if (result.error || result.status !== 0) throw new Error('Build command failed with exit ' + result.status);
}
try {
  const git = 'C:/Program Files/Git/cmd/git.exe';
  // Preserve Git's LF contents instead of applying the Windows machine's
  // autocrlf=true checkout conversion; source-inspection tests use LF text.
  timed('checkout', () => {
  run(git, ['clone', '--config', 'core.autocrlf=false', '--config', 'core.eol=lf', '--quiet', '--single-branch', '--branch', 'main',
    'https://github.com/peuanthinsan/' + names[request.app] + '.git', source]);
  run(git, ['-C', source, 'checkout', '--detach', request.sha]);
  });
  if (request.previousSha) timed('preflight', () => assertDeployableChange(git, source, request.previousSha, request.sha));
  // .env.local.example is tracked documentation, never a runtime input. The
  // published helper accepts .env.example but rejects this longer template name.
  // Omit only this exact template from the disposable checkout; retain the
  // helper's refusal of actual .env/.env.local/.env.production configuration.
  for (const directory of [source, path.join(source, 'web')]) {
    const template = path.join(directory, '.env.local.example');
    if (fs.existsSync(template)) {
      fs.unlinkSync(template);
      fs.writeSync(log, 'Excluded documentation template: ' + path.relative(source, template) + '\n');
    }
  }
  timed('build-and-package', () => run(process.execPath, [path.join(source, 'hosting/build.cjs'),
    path.join(base, 'public', request.app + '.json'), release, path.join(buildBase, 'cache', request.app)], source));
  const result = { status: 'built', app: request.app, sha: request.sha, id: request.id, timings, at: new Date().toISOString() };
  fs.writeFileSync(path.join(release, '.songdee-release.json'), JSON.stringify(result, null, 2));
  fs.writeFileSync(path.join(buildRoot, 'result.json'), JSON.stringify(result, null, 2));
} catch (error) {
  fs.writeFileSync(path.join(buildRoot, 'result.json'), JSON.stringify({ status: 'failed',
    app: request.app, sha: request.sha, id: request.id, message: error.message, at: new Date().toISOString() }, null, 2));
  process.exitCode = 1;
} finally { fs.closeSync(log); }
