const { execSync } = require('node:child_process');

const shouldSkip =
  process.env.VERCEL === '1' ||
  process.env.VERCEL_ENV ||
  process.env.SKIP_PRISMA_GENERATE === '1';

if (shouldSkip) {
  console.log('[postinstall] Skipping backend prisma generate for frontend/Vercel build.');
  process.exit(0);
}

try {
  execSync('npm run prisma:generate --workspace backend', { stdio: 'inherit' });
} catch (error) {
  console.error('[postinstall] Backend prisma generate failed.');
  process.exit(error && typeof error.status === 'number' ? error.status : 1);
}
