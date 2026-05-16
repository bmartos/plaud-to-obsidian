import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import type { PlaudConfig as PlaudConfigData, PlaudTokenData } from './types.js';

const DEFAULT_DIR = path.join(os.homedir(), '.plaud');
const OFFICIAL_TOKENS_FILE = 'tokens.json';
const LEGACY_CONFIG_FILE = 'config.json';

export class PlaudConfig {
  private dir: string;

  constructor(dir?: string) {
    this.dir = dir ?? DEFAULT_DIR;
  }

  private tokensPath(): string {
    return path.join(this.dir, OFFICIAL_TOKENS_FILE);
  }

  private legacyPath(): string {
    return path.join(this.dir, LEGACY_CONFIG_FILE);
  }

  load(): PlaudConfigData {
    // 1. Try official tokens.json first (from @plaud-ai/cli)
    try {
      if (fs.existsSync(this.tokensPath())) {
        const raw = fs.readFileSync(this.tokensPath(), 'utf-8');
        const data = JSON.parse(raw);
        return {
          token: {
            accessToken: data.access_token || data.accessToken,
            tokenType: data.token_type || data.tokenType || 'Bearer',
            issuedAt: Date.now(),
            expiresAt: data.expires_at || data.expiresAt || (Date.now() + 3600000)
          }
        };
      }
    } catch (e) {
      console.error('Error loading official tokens:', e);
    }

    // 2. Fallback to our internal config.json
    try {
      if (fs.existsSync(this.legacyPath())) {
        const raw = fs.readFileSync(this.legacyPath(), 'utf-8');
        return JSON.parse(raw) as PlaudConfigData;
      }
    } catch {}

    return {};
  }

  saveToken(token: PlaudTokenData): void {
    fs.mkdirSync(this.dir, { recursive: true, mode: 0o700 });
    const merged = { token };
    fs.writeFileSync(this.legacyPath(), JSON.stringify(merged, null, 2), { mode: 0o600 });
  }

  getToken(): PlaudTokenData | undefined {
    return this.load().token;
  }
}
