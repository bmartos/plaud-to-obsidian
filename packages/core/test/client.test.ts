import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { PlaudClient } from '../src/client.js';
import { PlaudAuth } from '../src/auth.js';
import { PlaudConfig } from '../src/config.js';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

// Mock global fetch
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

describe('PlaudClient', () => {
  let tmpDir: string;
  let client: PlaudClient;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'plaud-client-'));
    const tokensFile = path.join(tmpDir, 'tokens.json');
    fs.writeFileSync(tokensFile, JSON.stringify({
      access_token: 'fake-session',
      token_type: 'bearer',
      expires_at: Date.now() + 3600000
    }));

    const config = new PlaudConfig(tmpDir);
    const auth = new PlaudAuth(config);
    client = new PlaudClient(auth, 'eu');
    mockFetch.mockReset();
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('lists recordings', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        status: 0,
        data: [{ id: 'rec1', name: 'Test', filesize: 100, duration: 1000, created_at: '2024-01-01' }],
      }),
    });

    const recs = await client.listRecordings();
    expect(recs).toHaveLength(1);
    expect(recs[0].id).toBe('rec1');
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/open/third-party/files/'),
      expect.objectContaining({
        headers: expect.objectContaining({
          'Authorization': 'Bearer fake-session'
        })
      })
    );
  });
});
