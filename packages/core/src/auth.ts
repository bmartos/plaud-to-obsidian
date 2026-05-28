import { PlaudConfig } from './config';
import type { PlaudSession } from './types';

const SESSION_REFRESH_BUFFER_MS = 5 * 60 * 1000; // 5 minutes

export class PlaudAuth {
  private config: PlaudConfig;

  constructor(config: PlaudConfig) {
    this.config = config;
  }

  async getSessionId(): Promise<string> {
    const cached = this.config.getSession();
    if (cached && !this.isExpiringSoon(cached)) {
      return cached.sessionId;
    }
    throw new Error('Plaud session expired or not found. Please run `plaud login` again.');
  }

  private isExpiringSoon(session: PlaudSession): boolean {
    return Date.now() + SESSION_REFRESH_BUFFER_MS > session.expiresAt;
  }
}
