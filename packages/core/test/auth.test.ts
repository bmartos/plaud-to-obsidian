import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { PlaudAuth } from '../src/auth.js';
import { PlaudConfig } from '../src/config.js';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

describe('PlaudAuth', () => {
  let tmpDir: string;
  let config: PlaudConfig;
  let auth: PlaudAuth;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'plaud-auth-'));
    config = new PlaudConfig(tmpDir);
    auth = new PlaudAuth(config);
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('returns session id from official tokens file', async () => {
    const futureExp = Date.now() + 3600000;
    const tokensFile = path.join(tmpDir, 'tokens.json');
    fs.writeFileSync(tokensFile, JSON.stringify({
      access_token: 'fake-session-id',
      token_type: 'bearer',
      expires_at: futureExp
    }));

    const sessionId = await auth.getSessionId();
    expect(sessionId).toBe('fake-session-id');
  });

  it('throws error when session is expired', async () => {
    const pastExp = Date.now() - 10000;
    const tokensFile = path.join(tmpDir, 'tokens.json');
    fs.writeFileSync(tokensFile, JSON.stringify({
      access_token: 'expired-session-id',
      token_type: 'bearer',
      expires_at: pastExp
    }));

    await expect(auth.getSessionId()).rejects.toThrow('session expired');
  });

  it('throws error when tokens file is missing', async () => {
    await expect(auth.getSessionId()).rejects.toThrow('not found');
  });
});
