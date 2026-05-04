#!/usr/bin/env node
const { spawn } = require('child_process');
const path = require('path');

const root = path.resolve(__dirname, '..');
const databaseUrl = process.env.DATABASE_URL || 'postgresql://cocoa:cocoa_dev@localhost:15433/cocoatrace';

const env = {
  ...process.env,
  DATABASE_URL: databaseUrl,
  JWT_SECRET: process.env.JWT_SECRET || 'cocoatrace_dev_secret_change_in_production',
  PORT: process.env.PORT || '3001',
  WEB_PORT: process.env.WEB_PORT || '3000',
  WEB_URL: process.env.WEB_URL || 'http://localhost:3000',
};

const isWindows = process.platform === 'win32';
const npmCmd = isWindows ? 'npm.cmd' : 'npm';

const child = spawn(
  npmCmd,
  [
    'exec',
    '--',
    'concurrently',
    '-n',
    'API,WEB',
    '-c',
    'green,blue',
    'npm run dev --workspace=api',
    'npm run dev --workspace=web',
  ],
  {
    cwd: root,
    env,
    stdio: 'inherit',
    shell: false,
  }
);

child.on('exit', (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  process.exit(code ?? 0);
});
