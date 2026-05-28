import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import type { PlaudConfig as PlaudConfigData, PlaudSession } from './types.js';

const DEFAULT_DIR = path.join(os.homedir(), '.plaud');
const OFFICIAL_TOKENS_FILE = 'tokens.json';

export class PlaudConfig {
  private dir: string;

  constructor(dir?: string) {
    this.dir = dir ?? DEFAULT_DIR;
  }

  private tokensPath(): string {
    return path.join(this.dir, OFFICIAL_TOKENS_FILE);
  }

  load(): PlaudConfigData {
    // Try official tokens.json from @plaud-ai/cli
    try {
      if (fs.existsSync(this.tokensPath())) {
        const raw = fs.readFileSync(this.tokensPath(), 'utf-8');
        const data = JSON.parse(raw);
        return {
          session: {
            sessionId: data.access_token || data.accessToken,
            sessionType: data.token_type || data.tokenType || 'Auth',
            issuedAt: Date.now(),
            expiresAt: data.expires_at || data.expiresAt || (Date.now() + 3600000)
          }
        };
      }
    } catch (e) {
      console.error('Error loading official session:', e);
    }

    return {};
  }

  getSession(): PlaudSession | undefined {
    return this.load().session;
  }
}
