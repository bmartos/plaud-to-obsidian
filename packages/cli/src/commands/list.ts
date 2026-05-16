import { PlaudConfig, PlaudAuth, PlaudClient } from '@plaud/core';

function createClient(): PlaudClient {
  const config = new PlaudConfig();
  const auth = new PlaudAuth(config);
  const region = process.env.PLAUD_REGION || 'eu';
  return new PlaudClient(auth, region as 'us' | 'eu');
}

export async function listCommand(_args: string[]): Promise<void> {
  const client = createClient();
  const recordings = await client.listRecordings();

  if (recordings.length === 0) {
    console.log('No recordings found.');
    return;
  }

  for (const rec of recordings) {
    const date = new Date(rec.start_time).toISOString().slice(0, 16).replace('T', ' ');
    const dur = rec.duration ? `${Math.round(rec.duration / 60000)}m` : '?';
    const flags = [rec.is_trans ? 'T' : '', rec.is_summary ? 'S' : ''].filter(Boolean).join('');
    console.log(`${rec.id}  ${date}  ${dur.padStart(4)}  ${flags.padEnd(2)}  ${rec.filename}`);
  }

  console.log(`\n${recordings.length} recording(s)`);
}
