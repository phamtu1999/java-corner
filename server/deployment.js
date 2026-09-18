import {tmpdir} from 'node:os';
import {resolve} from 'node:path';

export function deploymentConfig(env = process.env) {
  const vercel = env.VERCEL === '1';
  return {
    dataDir: vercel ? resolve(tmpdir(), 'java-corner') : env.DATA_DIR,
    remoteJars: vercel || env.GAME_STORAGE === 'supabase',
    // Leave room below Vercel's 4.5 MB envelope for multipart headers.
    uploadLimit: vercel ? 4 * 1024 * 1024 : null,
    relayMaxSeconds: vercel ? 300 : null
  };
}
