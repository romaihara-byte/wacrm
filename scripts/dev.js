#!/usr/bin/env node

const net = require('node:net');
const { spawn } = require('node:child_process');

function isPortAvailable(port) {
  return new Promise((resolve, reject) => {
    const server = net.createServer();

    server.once('error', (error) => {
      if (error.code === 'EADDRINUSE') {
        resolve(false);
      } else {
        reject(error);
      }
    });

    server.once('listening', () => {
      server.close(() => resolve(true));
    });

    server.listen(port, '127.0.0.1');
  });
}

async function getAvailablePort(startPort) {
  let port = startPort;

  while (true) {
    const available = await isPortAvailable(port);
    if (available) {
      return port;
    }

    console.warn(`Port ${port} is already in use. Trying ${port + 1}...`);
    port += 1;
  }
}

async function main() {
  const preferredPort = Number(process.env.PORT || 3000);
  const port = await getAvailablePort(preferredPort);

  const nextBin = require.resolve('next/dist/bin/next');
  const args = ['dev', '--hostname', '127.0.0.1', '--port', String(port), ...process.argv.slice(2)];

  console.log(`Starting Next.js on http://127.0.0.1:${port}`);

  const child = spawn(process.execPath, [nextBin, ...args], {
    stdio: 'inherit',
    env: process.env,
  });

  child.on('exit', (code) => {
    process.exit(code ?? 0);
  });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
