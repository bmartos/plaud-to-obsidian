import { PlaudConfig } from './config.js';
import { BASE_URLS } from './types.js';
import type { PlaudTokenData } from './types.js';

const TOKEN_REFRESH_BUFFER_MS = 5 * 60 * 1000; // 5 minutes

export class PlaudAuth {
  private config: PlaudConfig;

  constructor(config: PlaudConfig) {
    this.config = config;
  }

  async getToken(): Promise<string> {
    const cached = this.config.getToken();
    if (cached && !this.isExpiringSoon(cached)) {
      return cached.accessToken;
    }
    throw new Error('Plaud token expired or not found. Please run `plaud login` again.');
  }

  private isExpiringSoon(token: PlaudTokenData): boolean {
    return Date.now() + TOKEN_REFRESH_BUFFER_MS > token.expiresAt;
  }
}
