import { PlaudAuth } from './auth';
import { BASE_URLS } from './types';
import type { PlaudRecording, PlaudRecordingDetail, PlaudUserInfo } from './types';

export class PlaudClient {
  private auth: PlaudAuth;
  private region: string;

  constructor(auth: PlaudAuth, region: string = 'us') {
    this.auth = auth;
    this.region = region;
  }

  private get baseUrl(): string {
    return (BASE_URLS[this.region] ?? BASE_URLS['us']) as string;
  }

  private async request(path: string, options?: RequestInit, attempts: number = 0): Promise<any> {
    if (attempts > 2) throw new Error('Too many region redirect attempts');
    
    const sessionId = await this.auth.getSessionId();
    const url = `${this.baseUrl}${path}`;
    
    console.log(`[DEBUG] Requesting: ${url}`);
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30s timeout

    try {
      const res = await fetch(url, {
        ...options,
        signal: controller.signal,
        headers: {
          'Authorization': `Bearer ${sessionId}`,
          'Content-Type': 'application/json',
          ...options?.headers,
        },
      });

      if (!res.ok) {
        if (res.status === 429 && attempts < 3) {
          const delay = Math.pow(2, attempts) * 1000;
          await new Promise(r => setTimeout(r, delay));
          return this.request(path, options, attempts + 1);
        }
        const body = await res.text().catch(() => '');
        console.error(`[DEBUG] API Error Body: ${body}`);
        throw new Error(`Plaud API error: ${res.status} ${res.statusText} - URL: ${url} - Body: ${body}`);
      }

      const data = await res.json();
      console.log(`[DEBUG] API Response Data: ${JSON.stringify(data).slice(0, 500)}`);

      // Handle region mismatch
      if (data?.status === -302 && data?.data?.domains?.api) {
        const domain: string = data.data.domains.api;
        this.region = domain.includes('euc1') ? 'eu' : 'us';
        return this.request(path, options, attempts + 1);
      }

      return data;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  async listRecordings(): Promise<PlaudRecording[]> {
    const data = await this.request('/open/third-party/files/?page=1&page_size=50');
    const list = data?.data ?? [];
    return list.map((r: any) => ({
      id: r.id,
      filename: r.name,
      fullname: r.name,
      filesize: r.filesize || 0,
      duration: r.duration,
      start_time: r.start_at ? new Date(r.start_at).getTime() : new Date(r.created_at).getTime(),
      end_time: 0,
      is_trash: false,
      is_trans: !!r.is_trans,
      is_summary: !!r.is_summary,
      keywords: [],
      serial_number: r.serial_number,
    }));
  }

  async getRecording(id: string): Promise<PlaudRecordingDetail> {
    const data = await this.request(`/open/third-party/files/${id}`);
    const raw = data.data ?? data;

    let transcript = '';
    const sourceList = raw.source_list ?? [];
    const source = sourceList.find((s: any) => s.data_type === 'transaction');

    if (source && source.data_content) {
      try {
        const segments = JSON.parse(source.data_content);
        transcript = segments.map((seg: any) => {
          const start = Math.floor(seg.start_time / 1000);
          const m = Math.floor(start / 60);
          const s = start % 60;
          const time = `[${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}]`;
          const speaker = seg.speaker ? `${seg.speaker}: ` : "";
          return `${time} ${speaker}${seg.content}`;
        }).join('\n');
      } catch {
        transcript = source.data_content;
      }
    }

    return {
      id: raw.id,
      filename: raw.name,
      fullname: raw.name,
      filesize: raw.filesize,
      duration: raw.duration,
      start_time: raw.start_at ? new Date(raw.start_at).getTime() : new Date(raw.created_at).getTime(),
      end_time: 0,
      is_trash: false,
      is_trans: !!source,
      is_summary: false,
      keywords: [],
      serial_number: raw.serial_number,
      transcript,
    };
  }

  async getUserInfo(): Promise<PlaudUserInfo> {
    const data = await this.request('/open/third-party/users/current');
    const user = data.data ?? data;
    return {
      id: user.id,
      nickname: user.nickname,
      email: user.email,
      country: user.country || '',
      membership_type: 'unknown',
    };
  }

  async downloadAudioStream(id: string): Promise<ReadableStream<Uint8Array>> {
    const url = await this.getMp3Url(id);
    if (!url) throw new Error(`Could not get download URL for recording ${id}`);
    
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`Download failed: ${res.status} ${res.statusText} - URL: ${url}`);
    }
    if (!res.body) throw new Error('Response body is null');
    return res.body;
  }

  async getMp3Url(id: string): Promise<string | null> {
    try {
      const data = await this.request(`/file/temp-url/${id}?is_opus=false`);
      console.log(`[DEBUG] Temp URL Response: ${JSON.stringify(data)}`);
      return data?.data?.url ?? data?.data ?? null;
    } catch (e: any) {
      console.error(`[DEBUG] getMp3Url Error: ${e.message}`);
      return null;
    }
  }
}
