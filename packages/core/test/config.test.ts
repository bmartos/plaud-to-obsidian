import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { PlaudConfig as Config } from '../src/config.js';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

describe('PlaudConfig', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'plaud-config-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('loads session from official tokens.json', () => {
    const tokensFile = path.join(tmpDir, 'tokens.json');
    fs.writeFileSync(tokensFile, JSON.stringify({
      access_token: 'abc',
      token_type: 'bearer',
      expires_at: 12345
    }));

    const config = new Config(tmpDir);
    const session = config.getSession();
    expect(session?.sessionId).toBe('abc');
    expect(session?.expiresAt).toBe(12345000);
  });

  it('loads session from official config.json', () => {
    const configFile = path.join(tmpDir, 'config.json');
    fs.writeFileSync(configFile, JSON.stringify({
      token: {
        accessToken: 'xyz',
        tokenType: 'bearer',
        expiresAt: 54321
      }
    }));

    const config = new Config(tmpDir);
    const session = config.getSession();
    expect(session?.sessionId).toBe('xyz');
    expect(session?.expiresAt).toBe(54321000);
  });

  it('returns empty object when file is missing', () => {
    const config = new Config(tmpDir);
    expect(config.load()).toEqual({});
    expect(config.getSession()).toBeUndefined();
  });
});
