export interface PlaudCredentials {
  email: string;
  password: string;
  region: 'us' | 'eu';
}

export interface PlaudSession {
  sessionId: string;
  sessionType: string;
  issuedAt: number;   // epoch ms
  expiresAt: number;  // epoch ms (decoded from JWT)
}

export interface PlaudConfig {
  credentials?: PlaudCredentials;
  session?: PlaudSession;
}

export const BASE_URLS: Record<string, string> = {
  us: 'https://platform.plaud.ai/developer/api',
  eu: 'https://platform.plaud.ai/developer/api',
};

export interface PlaudRecording {
  id: string;
  filename: string;
  fullname: string;
  filesize: number;
  duration: number;
  start_time: number;
  end_time: number;
  is_trash: boolean;
  is_trans: boolean;
  is_summary: boolean;
  keywords: string[];
  serial_number: string;
}

export interface PlaudRecordingDetail extends PlaudRecording {
  transcript: string;
  summary?: string;
}

export interface PlaudUserInfo {
  id: string;
  nickname: string;
  email: string;
  country: string;
  membership_type: string;
}
