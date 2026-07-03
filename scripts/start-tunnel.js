import fs from 'fs';
import { spawn } from 'child_process';
import path from 'path';

const envPath = path.join(process.cwd(), '.env');
let domain = '';

if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  // Match VITE_ASR_ENDPOINT=https://<domain>/transcribe
  const match = envContent.match(/VITE_ASR_ENDPOINT=https:\/\/([^/]+)\/transcribe/);
  if (match) {
    domain = match[1].trim();
  }
}

const args = ['ngrok', 'http', '8001'];
if (domain && !domain.includes('localhost') && !domain.includes('127.0.0.1')) {
  args.push(`--domain=${domain}`);
  console.log(`[Tunnel] Starting ngrok with static domain: ${domain}`);
} else {
  console.log('[Tunnel] Starting ngrok with dynamic/random domain (no static endpoint found in .env)');
}

const child = spawn('npx', args, { shell: true, stdio: 'inherit' });

child.on('exit', (code) => {
  process.exit(code || 0);
});
