const { spawn } = require('child_process');

function run(name, command, args) {
  const proc = spawn(command, args, {
    stdio: 'inherit',
    shell: true, // 🔥 CRITICAL FIX for Windows
  });

  proc.on('close', (code) => {
    console.log(`${name} exited with code ${code}`);
  });
}

// API
run('API', 'npm', ['run', 'dev', '--workspace=api']);

// WEB
run('WEB', 'npm', ['run', 'dev', '--workspace=web']);