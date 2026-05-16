import * as fs from 'fs';
import * as path from 'path';
import { PlaudConfig, PlaudAuth, PlaudClient } from '@plaud/core';

export async function downloadCommand(args: string[]): Promise<void> {
  const id = args[0];
  const dir = args[1] || '.';
  if (!id) {
    console.error('Usage: plaud download <recording-id> [directory]');
    process.exit(1);
  }

  const config = new PlaudConfig();
  const auth = new PlaudAuth(config);
  const region = process.env.PLAUD_REGION || 'eu';
  const client = new PlaudClient(auth, region as 'us' | 'eu');

  // Try MP3 first
  const mp3Url = await client.getMp3Url(id);
  let buffer: ArrayBuffer;
  let ext = 'opus';

  if (mp3Url) {
    console.log('Downloading MP3...');
    const res = await fetch(mp3Url);
    buffer = await res.arrayBuffer();
    ext = 'mp3';
  } else {
    console.log('Downloading audio...');
    // client.downloadAudio is not in client.ts, but let's assume it was intended or use downloadAudioStream
    // Actually, I'll check client.ts again to be sure.
    // Based on my previous read, it has downloadAudioStream.
    const stream = await client.downloadAudioStream(id);
    const reader = stream.getReader();
    const chunks: Uint8Array[] = [];
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
    }
    const totalLength = chunks.reduce((acc, chunk) => acc + chunk.length, 0);
    const result = new Uint8Array(totalLength);
    let offset = 0;
    for (const chunk of chunks) {
      result.set(chunk, offset);
      offset += chunk.length;
    }
    buffer = result.buffer;
  }

  fs.mkdirSync(dir, { recursive: true });
  const filename = `${id}.${ext}`;
  const filepath = path.join(dir, filename);
  fs.writeFileSync(filepath, Buffer.from(buffer));
  console.log(`Saved: ${filepath} (${(buffer.byteLength / 1024).toFixed(0)} KB)`);
}
