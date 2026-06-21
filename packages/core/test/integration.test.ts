import { describe, it, expect } from 'vitest';
import { PlaudConfig, PlaudAuth, PlaudClient } from '../src/index.js';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

const OFFICIAL_TOKENS = path.join(os.homedir(), '.plaud', 'tokens.json');
const OFFICIAL_CONFIG = path.join(os.homedir(), '.plaud', 'config.json');
const HAS_SESSION = fs.existsSync(OFFICIAL_TOKENS) || fs.existsSync(OFFICIAL_CONFIG);

describe.skipIf(!HAS_SESSION)('integration (live API)', () => {
  const config = new PlaudConfig();
  const auth = new PlaudAuth(config);
  const client = new PlaudClient(auth, 'eu');

  it('gets user info', async () => {
    const user = await client.getUserInfo();
    expect(user.id).toBeDefined();
    expect(user.email).toContain('@');
  });

  it('lists recordings', async () => {
    const recs = await client.listRecordings();
    expect(Array.isArray(recs)).toBe(true);
  });
});
