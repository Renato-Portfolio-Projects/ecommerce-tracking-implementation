// Runs a command with the store switched open, for building or previewing the whole store on any
// system. Usage: node scripts/with-store-open.mjs astro build --outDir dist-store
import { spawn } from 'node:child_process';

const [command, ...args] = process.argv.slice(2);
if (!command) {
  console.error('Usage: node scripts/with-store-open.mjs <command> [arguments]');
  process.exit(1);
}

const child = spawn(command, args, {
  stdio: 'inherit',
  shell: process.platform === 'win32',
  env: { ...process.env, PUBLIC_STORE_OPEN: 'true' },
});
child.on('exit', (code) => process.exit(code ?? 1));
