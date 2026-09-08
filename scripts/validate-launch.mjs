import { spawnSync } from 'node:child_process';
import { existsSync, rmSync } from 'node:fs';
import path from 'node:path';

const windows = process.platform === 'win32'; const repositoryRoot = process.cwd(); const npmCli = process.env.npm_execpath;
if (!npmCli) throw new Error('Run launch validation through npm run validate:launch');
const prismaCli = path.join(repositoryRoot, 'node_modules', 'prisma', 'build', 'index.js');
const typescriptCli = path.join(repositoryRoot, 'node_modules', 'typescript', 'bin', 'tsc');
const deterministic = { AUTH_MODE: 'mock', MEDIA_PROVIDER: 'mock', IMAGE_PROVIDER: 'mock', VIDEO_PROVIDER: 'mock', AUDIO_PROVIDER: 'mock', EXPORT_ENGINE: 'mock', DATABASE_URL: '' };
const prismaEnvironment = { ...deterministic, DATABASE_URL: 'postgresql://launch_validation:launch_validation@127.0.0.1:5432/launch_validation' };
const steps = [
  { label: 'prisma generate', command: process.execPath, args: [prismaCli, 'generate'], extra: prismaEnvironment },
  { label: 'prisma validate', command: process.execPath, args: [prismaCli, 'validate'], extra: prismaEnvironment },
  { label: 'npm run lint', command: process.execPath, args: [npmCli, 'run', 'lint'], extra: {} },
  { label: 'tsc --noEmit', command: process.execPath, args: [typescriptCli, '--noEmit'], extra: {} },
  { label: 'npm test', command: process.execPath, args: [npmCli, 'test'], extra: deterministic },
  { label: 'npm run build', command: process.execPath, args: [npmCli, 'run', 'build'], extra: deterministic, cleansBuild: true },
  { label: 'git diff --check', command: 'git', args: ['diff', '--check'], extra: {} },
];
for (const { label, command, args, extra, cleansBuild } of steps) {
  if (cleansBuild) {
    const buildOutput = path.resolve(repositoryRoot, '.next');
    if (path.basename(buildOutput) !== '.next') throw new Error('Refusing to clean an unexpected build output path');
    if (existsSync(buildOutput)) {
      if (windows) spawnSync('attrib', ['-R', `${buildOutput}\\*`, '/S', '/D'], { stdio: 'ignore' });
      rmSync(buildOutput, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
    }
  }
  console.log(`\n[launch-validation] ${label}`);
  const result = spawnSync(command, args, { stdio: 'inherit', env: { ...process.env, ...extra } });
  if (result.error) console.error(`[launch-validation] Unable to start ${command}: ${result.error.message}`);
  if (result.status !== 0) process.exit(result.status ?? 1);
}
console.log('\nSceneForge launch validation passed. No deployment or live provider calls were performed.');
