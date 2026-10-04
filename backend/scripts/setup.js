/**
 * One-time local setup: RSA JWT keys + optional .env from .env.example
 * Run from backend folder: node scripts/setup.js
 */
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const backendRoot = path.join(__dirname, '..');
const keysDir = path.join(backendRoot, 'keys');
const envPath = path.join(backendRoot, '.env');
const envExamplePath = path.join(backendRoot, '.env.example');

function ensureJwtKeys() {
  const privatePath = path.join(keysDir, 'private.pem');
  const publicPath = path.join(keysDir, 'public.pem');

  if (fs.existsSync(privatePath) && fs.existsSync(publicPath)) {
    console.log('✓ JWT keys already exist in backend/keys/');
    return;
  }

  if (!fs.existsSync(keysDir)) {
    fs.mkdirSync(keysDir, { recursive: true });
  }

  const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  });

  fs.writeFileSync(privatePath, privateKey, { encoding: 'utf8', flag: 'wx' });
  fs.writeFileSync(publicPath, publicKey, { encoding: 'utf8', flag: 'wx' });
  console.log('✓ Generated backend/keys/private.pem and public.pem');
}

function ensureEnvFile() {
  const cookieSecret = crypto.randomBytes(32).toString('hex');

  if (fs.existsSync(envPath)) {
    const current = fs.readFileSync(envPath, 'utf8');
    if (!/^\s*COOKIE_SECRET=./m.test(current)) {
      fs.appendFileSync(envPath, `\nCOOKIE_SECRET=${cookieSecret}\n`);
      console.log('✓ Appended COOKIE_SECRET to existing backend/.env');
    } else {
      console.log('✓ backend/.env already exists (COOKIE_SECRET present)');
    }
    return;
  }

  if (!fs.existsSync(envExamplePath)) {
    console.warn('⚠ backend/.env.example not found; create backend/.env manually.');
    console.log(`  COOKIE_SECRET=${cookieSecret}`);
    return;
  }

  let template = fs.readFileSync(envExamplePath, 'utf8');
  template = template.replace(
    /^COOKIE_SECRET=.*$/m,
    `COOKIE_SECRET=${cookieSecret}`
  );
  fs.writeFileSync(envPath, template, 'utf8');
  console.log('✓ Created backend/.env from .env.example (with random COOKIE_SECRET)');
}

ensureJwtKeys();
ensureEnvFile();

console.log('\nNext steps:');
console.log('  1. Start MongoDB (default URI: mongodb://localhost:27017/securebank)');
console.log('  2. cd backend && npm run dev');
console.log('  3. cd frontend && npm run dev');
console.log('  4. Open http://localhost:3000 (use Chrome/Edge for passkeys)\n');
